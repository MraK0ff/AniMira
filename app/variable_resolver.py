"""
Variable resolver for AniLabX parser config templates.

Handles substitution of template variables like $scheme$, $hostname$, $page$, etc.
in config strings before they are used for HTTP requests or parsing.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class VariableResolver:
    """Resolves template variables in parser config strings."""

    def __init__(self, config: dict):
        self.config = config
        host = config.get("host", "")
        parsed = urlparse(host)
        self._scheme = parsed.scheme or "https"       # e.g. "https"
        self._hostname = parsed.hostname or ""         # e.g. "www.anilibria.tv"
        self._host = host.rstrip("/")                  # e.g. "https://www.anilibria.tv"
        self._port = parsed.port
        # Support api_endpoint if defined in config
        self._api_endpoint = config.get("api_endpoint", "")

    def resolve(
        self,
        template: str,
        *,
        page: int | str | None = None,
        query: str | None = None,
        filter_value: str | None = None,
        current_url: str | None = None,
        uniq: str | None = None,
    ) -> str:
        """Replace all template variables in a string.

        Args:
            template: String potentially containing $var$ placeholders.
            page: Current page number for $page$.
            query: Search query for $query$.
            filter_value: Active filter for $filter$.
            current_url: Current page URL for %%url%% replacement.
            uniq: Anime unique identifier for $uniq$.

        Returns:
            String with all known variables substituted.
        """
        if not isinstance(template, str):
            return template

        result = template

        # Core URL variables
        result = result.replace("$scheme$", f"{self._scheme}:")
        result = result.replace("$hostname$", self._hostname)
        result = result.replace("$host$", self._host)
        result = result.replace("$api_endpoint$", self._api_endpoint)

        # Pagination
        if page is not None:
            result = result.replace("$page$", str(page))

        # Search query
        if query is not None:
            result = result.replace("$query$", str(query))

        # Filter
        if filter_value is not None:
            result = result.replace("$filter$", str(filter_value))

        # Current URL (used in episode link construction)
        if current_url is not None:
            result = result.replace("%%url%%", current_url)

        # Uniq identifier (for detail URL construction)
        if uniq is not None:
            result = result.replace("$uniq$", str(uniq))

        return result

    def resolve_dict(
        self,
        data: dict,
        **kwargs,
    ) -> dict:
        """Recursively resolve variables in all string values of a dict."""
        resolved = {}
        for key, value in data.items():
            if isinstance(value, str):
                resolved[key] = self.resolve(value, **kwargs)
            elif isinstance(value, dict):
                resolved[key] = self.resolve_dict(value, **kwargs)
            elif isinstance(value, list):
                resolved[key] = [
                    self.resolve(item, **kwargs) if isinstance(item, str)
                    else self.resolve_dict(item, **kwargs) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                resolved[key] = value
        return resolved

    @property
    def scheme(self) -> str:
        return self._scheme

    @property
    def hostname(self) -> str:
        return self._hostname

    @property
    def host(self) -> str:
        return self._host
