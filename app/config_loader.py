"""
Config loader for AniLabX JSON parser configurations.

Scans the repos/ directory for .json files and builds a registry of
parser configurations indexed by name. Handles name as both str and list[str].
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from app.models.source import SourceInfo, SourceDetail

logger = logging.getLogger(__name__)


class ParserConfig:
    """Wrapper around a loaded JSON parser config."""

    def __init__(self, data: dict, file_path: str):
        self.data = data
        self.file_path = file_path

        # Extract primary name
        raw_name = data.get("name", "")
        if isinstance(raw_name, list):
            self.primary_name = raw_name[0] if raw_name else Path(file_path).stem
            self.aliases = raw_name
        else:
            self.primary_name = raw_name or Path(file_path).stem
            self.aliases = [self.primary_name]

        self.title = data.get("title", self.primary_name)
        self.host = data.get("host", "")
        self.language = data.get("language", "unknown")
        self.content_type = data.get("content_type", "unknown")
        self.encoding = data.get("encoding")
        self.user_agent = data.get("user_agent")
        self.icon_link = data.get("icon_link")
        self.episodes_order = data.get("episodes_order", False)
        self.version = data.get("version")
        self.author = data.get("author")
        self.custom_settings = data.get("custom_settings")
        self.folder = data.get("folder", self.primary_name)

    @property
    def has_search(self) -> bool:
        section = self.data.get("anime_search_complete", {})
        return bool(section and section.get("search_link"))

    @property
    def has_list(self) -> bool:
        return bool(self.data.get("anime_list_complete"))

    @property
    def has_filters(self) -> bool:
        return bool(self.data.get("anime_list_filters_complete"))

    def get_section(self, key: str) -> dict | list | None:
        """Get a top-level config section by key."""
        return self.data.get(key)

    def to_source_info(self) -> SourceInfo:
        return SourceInfo(
            name=self.primary_name,
            title=self.title,
            host=self.host,
            language=self.language,
            content_type=self.content_type,
            icon_link=self.icon_link,
            has_search=self.has_search,
            has_list=self.has_list,
            has_filters=self.has_filters,
        )

    def to_source_detail(self) -> SourceDetail:
        # Collect filter info summary
        filters_section = self.data.get("anime_list_filters_complete", {})
        available_filters = {}
        if filters_section:
            for key in ("genre_filters", "year_filters"):
                f = filters_section.get(key)
                if f and "filters" in f:
                    available_filters[key] = len(f["filters"])
            # Also check the unified "filters" dict
            unified = filters_section.get("filters", {})
            if isinstance(unified, dict):
                for fkey, fval in unified.items():
                    if isinstance(fval, dict) and "values" in fval:
                        available_filters[fkey] = len(fval["values"])

        return SourceDetail(
            name=self.primary_name,
            title=self.title,
            host=self.host,
            language=self.language,
            content_type=self.content_type,
            icon_link=self.icon_link,
            has_search=self.has_search,
            has_list=self.has_list,
            has_filters=self.has_filters,
            version=self.version,
            encoding=self.encoding,
            user_agent=self.user_agent,
            episodes_order=self.episodes_order,
            aliases=self.aliases,
            author=self.author,
            custom_settings=self.custom_settings,
            available_filters=available_filters or None,
        )


class ConfigLoader:
    """Loads and manages parser configs from a directory."""

    def __init__(self, config_dir: str = "repos"):
        self._config_dir = config_dir
        self._registry: dict[str, ParserConfig] = {}

    def load_all(self) -> int:
        """Load all .json configs from the config directory.

        Returns:
            Number of successfully loaded configs.
        """
        config_path = Path(self._config_dir)
        if not config_path.exists():
            logger.error("Config directory not found: %s", self._config_dir)
            return 0

        count = 0
        for json_file in sorted(config_path.glob("*.json")):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                config = ParserConfig(data, str(json_file))

                # Register by primary name
                self._registry[config.primary_name] = config

                # Also register by all aliases
                for alias in config.aliases:
                    if alias not in self._registry:
                        self._registry[alias] = config

                # Register by folder name
                if config.folder and config.folder not in self._registry:
                    self._registry[config.folder] = config

                count += 1
                logger.debug("Loaded config: %s (%s)", config.title, json_file.name)

            except json.JSONDecodeError as e:
                logger.warning("Invalid JSON in %s: %s", json_file.name, e)
            except Exception as e:
                logger.warning("Error loading %s: %s", json_file.name, e)

        logger.info("Loaded %d parser configs from '%s'", count, self._config_dir)
        return count

    def get(self, name: str) -> ParserConfig | None:
        """Get a parser config by name or alias."""
        return self._registry.get(name)

    def list_sources(self) -> list[SourceInfo]:
        """List all unique sources."""
        seen = set()
        sources = []
        for config in self._registry.values():
            if config.primary_name not in seen:
                seen.add(config.primary_name)
                sources.append(config.to_source_info())
        return sorted(sources, key=lambda s: s.title)

    def list_names(self) -> list[str]:
        """List all unique primary config names."""
        seen = set()
        names = []
        for config in self._registry.values():
            if config.primary_name not in seen:
                seen.add(config.primary_name)
                names.append(config.primary_name)
        return sorted(names)
