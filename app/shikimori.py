"""
Shikimori API client with auto-binding support.

Implements:
- GraphQL search for anime/manga
- Levenshtein-based similarity matching
- Auto-bind with configurable threshold
- Rate limiting (5 req/sec, 90 req/min)
- In-memory binding cache
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Shikimori config
SHIKIMORI_BASE = "https://shikimori.one"
SHIKIMORI_API = f"{SHIKIMORI_BASE}/api"
SHIKIMORI_GRAPHQL = f"{SHIKIMORI_API}/graphql"
SHIKIMORI_UA = "ShikimoriXAPI Library"

# OAuth2 credentials (public — no auth needed for search)
CLIENT_ID = "SYfnx3e6keqJWj11J57shdpdnZB_F6Z-Cxhamsoe3pQ"
CLIENT_SECRET = "qU9FvWZ1isnOart7vVOVltvVCSNa6u7AI68qXtJXFYo"
REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"

SIMILARITY_THRESHOLD = 70  # AniLabX uses > 69


# ─── Levenshtein similarity ───────────────────────────────────────────

def levenshtein_distance(s1: str, s2: str) -> int:
    """Optimized Levenshtein distance with common prefix/suffix trimming."""
    # Trim common prefix
    while s1 and s2 and s1[0] == s2[0]:
        s1, s2 = s1[1:], s2[1:]
    # Trim common suffix
    while s1 and s2 and s1[-1] == s2[-1]:
        s1, s2 = s1[:-1], s2[:-1]

    if not s1:
        return len(s2)
    if not s2:
        return len(s1)

    # Ensure s1 is shorter for memory optimization
    if len(s1) > len(s2):
        s1, s2 = s2, s1

    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr.append(min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost))
        prev = curr
    return prev[-1]


def similarity(s1: str, s2: str) -> int:
    """Returns similarity percentage (0-100) between two strings."""
    if not s1 or not s2:
        return 0
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if s1 == s2:
        return 100
    max_len = len(s1) + len(s2)
    distance = levenshtein_distance(s1, s2)
    return round((max_len - distance) / max_len * 100)


def find_best_match(
    title: str,
    alt_title: str,
    results: list[dict],
) -> tuple[dict | None, int]:
    """Find best match among Shikimori search results.

    Compares local title/alt_title against remote name/russian/english/japanese.
    Returns (best_match, best_score) or (None, 0).
    """
    best_score = -1
    best_match = None

    for result in results:
        name = result.get("name", "")
        russian = result.get("russian", "") or ""
        english = result.get("english", "") or ""
        japanese = result.get("japanese", "") or ""

        # Compare all combinations
        scores = [
            similarity(title, name),
            similarity(title, russian),
            similarity(title, english),
            similarity(title, japanese),
        ]
        if alt_title:
            scores.extend([
                similarity(alt_title, name),
                similarity(alt_title, russian),
                similarity(alt_title, english),
                similarity(alt_title, japanese),
            ])

        max_score = max(scores)
        if max_score > best_score:
            best_score = max_score
            best_match = result

    if best_score >= SIMILARITY_THRESHOLD and best_match:
        logger.info(
            "Shikimori match: %s / %s — similarity: %d%%",
            best_match.get("name"), best_match.get("russian", ""), best_score,
        )
        return best_match, best_score

    logger.info("No Shikimori match above threshold (%d%%). Best: %d%%", SIMILARITY_THRESHOLD, best_score)
    return None, best_score


# ─── GraphQL queries ──────────────────────────────────────────────────

ANIME_SEARCH_QUERY = """
{
  animes(search: "%s", page: 1, limit: 30) {
    id url name russian english japanese
    kind rating score status
    episodes episodesAired duration season
    isCensored
    poster { originalUrl mainUrl }
    airedOn { date }
    releasedOn { date }
    genres { id name russian kind }
  }
}
"""

MANGA_SEARCH_QUERY = """
{
  mangas(search: "%s", page: 1, limit: 30) {
    id url name russian english japanese
    kind score status
    volumes chapters
    isCensored
    poster { originalUrl mainUrl }
    airedOn { date }
    releasedOn { date }
    genres { id name russian kind }
  }
}
"""

ANIME_DETAIL_QUERY = """
{
  animes(ids: "%s") {
    id name russian english japanese synonyms
    kind rating score status
    episodes episodesAired duration
    airedOn { date }
    releasedOn { date }
    url season franchise
    poster { originalUrl mainUrl }
    nextEpisodeAt isCensored
    genres { id name russian kind }
    studios { id name imageUrl }
    description
    videos { url name kind playerUrl imageUrl }
    screenshots { originalUrl x332Url }
    scoresStats { score count }
    related {
      anime { id name poster { originalUrl } }
      manga { id name poster { originalUrl } }
      relationKind relationText
    }
  }
}
"""

MANGA_DETAIL_QUERY = """
{
  mangas(ids: "%s") {
    id name russian english japanese synonyms
    kind score status
    volumes chapters
    airedOn { date }
    releasedOn { date }
    url
    poster { originalUrl mainUrl }
    isCensored
    genres { id name russian kind }
    description
    related {
      anime { id name poster { originalUrl } }
      manga { id name poster { originalUrl } }
      relationKind relationText
    }
  }
}
"""


# ─── Shikimori client ─────────────────────────────────────────────────

class ShikimoriClient:
    """Async Shikimori API client with rate limiting and caching."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._access_token: str | None = None
        # Rate limiting: track request timestamps
        self._request_times: list[float] = []
        # Cache: GraphQL results (TTL 10 min)
        self._cache: TTLCache = TTLCache(maxsize=256, ttl=600)
        # Binding store: content_key -> shikimori_id
        self._bindings: dict[str, int] = {}

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=15.0,
                follow_redirects=True,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _headers(self, auth: bool = False) -> dict[str, str]:
        h = {
            "User-Agent": SHIKIMORI_UA,
            "Content-Type": "application/json",
        }
        if auth and self._access_token:
            h["Authorization"] = f"Bearer {self._access_token}"
        return h

    async def _rate_limit(self):
        """Enforce Shikimori rate limits: 5/sec, 90/min."""
        now = time.monotonic()
        # Clean old timestamps
        self._request_times = [t for t in self._request_times if now - t < 60]

        # Check per-second limit
        recent_1s = sum(1 for t in self._request_times if now - t < 1.0)
        if recent_1s >= 5:
            wait = 1.0 - (now - self._request_times[-5])
            if wait > 0:
                logger.debug("Rate limit: waiting %.2fs (per-sec)", wait)
                await asyncio.sleep(wait)

        # Check per-minute limit
        if len(self._request_times) >= 90:
            wait = 60.0 - (now - self._request_times[-90])
            if wait > 0:
                logger.debug("Rate limit: waiting %.2fs (per-min)", wait)
                await asyncio.sleep(wait)

        self._request_times.append(time.monotonic())

    async def graphql(self, query: str, use_cache: bool = True) -> list[dict]:
        """Execute GraphQL query against Shikimori API."""
        cache_key = query.strip()
        if use_cache and cache_key in self._cache:
            logger.debug("Shikimori cache hit")
            return self._cache[cache_key]

        await self._rate_limit()
        client = await self._get_client()

        try:
            response = await client.post(
                SHIKIMORI_GRAPHQL,
                headers=self._headers(),
                json={"query": query},
            )
            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                logger.warning("Shikimori GraphQL errors: %s", data["errors"])
                return []

            # Extract the first data key (animes or mangas)
            result_data = data.get("data", {})
            for key in ("animes", "mangas"):
                if key in result_data:
                    results = result_data[key]
                    if use_cache:
                        self._cache[cache_key] = results
                    return results

            return []

        except httpx.HTTPStatusError as e:
            logger.error("Shikimori HTTP %d: %s", e.response.status_code, e.response.text[:200])
            return []
        except Exception as e:
            logger.error("Shikimori request failed: %s", e)
            return []

    async def search_anime(self, title: str) -> list[dict]:
        """Search anime by title."""
        # Escape quotes in title
        safe_title = title.replace('"', '\\"').replace("\n", " ")
        query = ANIME_SEARCH_QUERY % safe_title
        return await self.graphql(query)

    async def search_manga(self, title: str) -> list[dict]:
        """Search manga by title."""
        safe_title = title.replace('"', '\\"').replace("\n", " ")
        query = MANGA_SEARCH_QUERY % safe_title
        return await self.graphql(query)

    async def get_anime_by_id(self, shikimori_id: int | str) -> dict | None:
        """Get anime details by Shikimori ID."""
        query = ANIME_DETAIL_QUERY % str(shikimori_id)
        results = await self.graphql(query, use_cache=True)
        return results[0] if results else None

    async def get_manga_by_id(self, shikimori_id: int | str) -> dict | None:
        """Get manga details by Shikimori ID."""
        query = MANGA_DETAIL_QUERY % str(shikimori_id)
        results = await self.graphql(query, use_cache=True)
        return results[0] if results else None

    # ─── Binding management ───────────────────────────────────────────

    def _binding_key(self, source: str, content_id: str) -> str:
        return f"Tracking@Shikimori+{source}+{content_id}"

    def get_binding(self, source: str, content_id: str) -> int | None:
        """Get stored shikimori_id for content."""
        key = self._binding_key(source, content_id)
        return self._bindings.get(key)

    def save_binding(self, source: str, content_id: str, shikimori_id: int):
        """Store shikimori_id binding."""
        key = self._binding_key(source, content_id)
        self._bindings[key] = shikimori_id
        logger.info("Saved binding: %s -> shikimori:%d", key, shikimori_id)

    def remove_binding(self, source: str, content_id: str):
        """Remove a stored binding."""
        key = self._binding_key(source, content_id)
        self._bindings.pop(key, None)

    def list_bindings(self) -> dict[str, int]:
        """List all stored bindings."""
        return dict(self._bindings)

    # ─── Auto-bind ────────────────────────────────────────────────────

    async def autobind(
        self,
        source: str,
        content_id: str,
        title: str,
        alt_title: str = "",
        content_type: str = "anime",
        threshold: int = SIMILARITY_THRESHOLD,
    ) -> dict[str, Any]:
        """Auto-bind content to Shikimori.

        Flow:
        1. Check if already bound
        2. Search Shikimori by title
        3. Find best match via Levenshtein similarity
        4. Bind if score >= threshold

        Returns dict with status, shikimori data, and similarity score.
        """
        # Step 1: Check existing binding
        existing_id = self.get_binding(source, content_id)
        if existing_id and existing_id > 0:
            logger.info("Found existing binding: %s -> %d", content_id, existing_id)
            if content_type == "manga":
                details = await self.get_manga_by_id(existing_id)
            else:
                details = await self.get_anime_by_id(existing_id)
            return {
                "status": "already_bound",
                "shikimori_id": existing_id,
                "details": details,
            }

        # Step 2: Search
        if content_type == "manga":
            results = await self.search_manga(title)
        else:
            results = await self.search_anime(title)

        if not results:
            return {
                "status": "failed",
                "reason": "no_results",
                "query": title,
            }

        # Step 3: Find best match
        match, score = find_best_match(title, alt_title, results)

        if not match:
            return {
                "status": "failed",
                "reason": "low_similarity",
                "best_score": score,
                "threshold": threshold,
                "query": title,
                "candidates": [
                    {
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "russian": r.get("russian"),
                    }
                    for r in results[:5]
                ],
            }

        # Step 4: Save binding
        shikimori_id = int(match["id"])
        self.save_binding(source, content_id, shikimori_id)

        return {
            "status": "success",
            "shikimori_id": shikimori_id,
            "similarity": score,
            "match": match,
            "message": f"Автоматически связано с Shikimori: {match.get('name')} / {match.get('russian', '')}",
        }

    # ─── OAuth2 (for future use) ─────────────────────────────────────

    def get_auth_url(self) -> str:
        """Get OAuth2 authorization URL."""
        return (
            f"{SHIKIMORI_BASE}/oauth/authorize?"
            f"client_id={CLIENT_ID}&"
            f"redirect_uri={REDIRECT_URI}&"
            f"response_type=code"
        )

    async def exchange_code(self, code: str) -> dict | None:
        """Exchange authorization code for access token."""
        client = await self._get_client()
        try:
            response = await client.post(
                f"{SHIKIMORI_BASE}/oauth/token",
                json={
                    "grant_type": "authorization_code",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": REDIRECT_URI,
                },
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data.get("access_token")
            logger.info("Shikimori auth successful")
            return data
        except Exception as e:
            logger.error("Shikimori auth failed: %s", e)
            return None

    async def refresh_token(self, refresh_token: str) -> dict | None:
        """Refresh access token."""
        client = await self._get_client()
        try:
            response = await client.post(
                f"{SHIKIMORI_BASE}/oauth/token",
                json={
                    "grant_type": "refresh_token",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "refresh_token": refresh_token,
                },
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data.get("access_token")
            return data
        except Exception as e:
            logger.error("Shikimori token refresh failed: %s", e)
            return None
