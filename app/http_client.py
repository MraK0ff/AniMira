"""
Async HTTP client with retry, caching, and encoding support.

Wraps httpx.AsyncClient with:
- Connection pooling
- Configurable retry with exponential backoff
- In-memory TTL cache for responses
- Custom headers/cookies merging
- Response encoding override (e.g., Windows-1251)
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

import httpx
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_CACHE_TTL = 300       # 5 minutes
DEFAULT_CACHE_MAXSIZE = 512


class HttpClient:
    """Async HTTP client with caching and retry support."""

    def __init__(
        self,
        cache_ttl: int = DEFAULT_CACHE_TTL,
        cache_maxsize: int = DEFAULT_CACHE_MAXSIZE,
        max_retries: int = DEFAULT_MAX_RETRIES,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self._cache: TTLCache = TTLCache(maxsize=cache_maxsize, ttl=cache_ttl)
        self._max_retries = max_retries
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy-init the shared async client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                follow_redirects=True,
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                ),
            )
        return self._client

    async def close(self):
        """Close the underlying httpx client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _cache_key(self, method: str, url: str, form_data: dict | None = None) -> str:
        """Generate a deterministic cache key."""
        parts = f"{method}:{url}"
        if form_data:
            parts += f":{sorted(form_data.items())}"
        return hashlib.md5(parts.encode()).hexdigest()

    async def get(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        encoding: str | None = None,
        user_agent: str | None = None,
        use_cache: bool = True,
    ) -> str:
        """Perform GET request with retry and optional caching.

        Args:
            url: Target URL.
            headers: Extra headers to merge.
            encoding: Force response encoding (e.g., 'Windows-1251').
            user_agent: Override default User-Agent.
            use_cache: Whether to use response cache.

        Returns:
            Response body as decoded text.
        """
        cache_key = self._cache_key("GET", url)
        if use_cache and cache_key in self._cache:
            logger.debug("Cache hit: GET %s", url)
            return self._cache[cache_key]

        merged_headers = self._build_headers(headers, user_agent)
        client = await self._get_client()

        text = await self._request_with_retry(
            client, "GET", url, headers=merged_headers, encoding=encoding
        )

        if use_cache and text is not None:
            self._cache[cache_key] = text
        return text

    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        form_data: dict[str, str] | None = None,
        encoding: str | None = None,
        user_agent: str | None = None,
        use_cache: bool = True,
    ) -> str:
        """Perform POST request with form data.

        Args:
            url: Target URL.
            headers: Extra headers to merge.
            form_data: Form data dict for POST body.
            encoding: Force response encoding.
            user_agent: Override default User-Agent.
            use_cache: Whether to use response cache.

        Returns:
            Response body as decoded text.
        """
        cache_key = self._cache_key("POST", url, form_data)
        if use_cache and cache_key in self._cache:
            logger.debug("Cache hit: POST %s", url)
            return self._cache[cache_key]

        merged_headers = self._build_headers(headers, user_agent)
        client = await self._get_client()

        text = await self._request_with_retry(
            client, "POST", url,
            headers=merged_headers, data=form_data, encoding=encoding,
        )

        if use_cache and text is not None:
            self._cache[cache_key] = text
        return text

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        *,
        headers: dict | None = None,
        data: dict | None = None,
        encoding: str | None = None,
    ) -> str:
        """Execute HTTP request with exponential backoff retry."""
        last_error: Exception | None = None

        for attempt in range(1, self._max_retries + 1):
            try:
                logger.info("[%s] %s %s (attempt %d)", method, url[:120], "", attempt)

                if method == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.post(url, headers=headers, data=data)

                response.raise_for_status()

                # Apply encoding override if specified
                if encoding:
                    return response.content.decode(encoding, errors="replace")
                return response.text

            except httpx.HTTPStatusError as e:
                logger.warning(
                    "HTTP %d for %s (attempt %d): %s",
                    e.response.status_code, url[:80], attempt, str(e)[:100]
                )
                last_error = e
                # Don't retry on client errors (4xx) except 429
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    break
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                logger.warning("Connection error for %s (attempt %d): %s", url[:80], attempt, str(e)[:100])
                last_error = e
            except Exception as e:
                logger.error("Unexpected error for %s: %s", url[:80], str(e)[:200])
                last_error = e
                break

            # Exponential backoff
            if attempt < self._max_retries:
                import asyncio
                wait = 2 ** (attempt - 1)
                logger.debug("Retrying in %ds...", wait)
                await asyncio.sleep(wait)

        error_msg = f"Request failed after {self._max_retries} attempts: {url}"
        if last_error:
            error_msg += f" — {type(last_error).__name__}: {last_error}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    def _build_headers(
        self, extra: dict[str, str] | None, user_agent: str | None
    ) -> dict[str, str]:
        """Merge default headers with request-specific overrides."""
        headers = {
            "User-Agent": user_agent or DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        if extra:
            headers.update(extra)
        return headers

    def clear_cache(self):
        """Clear the response cache."""
        self._cache.clear()
        logger.info("HTTP cache cleared")
