"""Pydantic models for anime data — list items, details, episodes, video."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnimeItem(BaseModel):
    """Single anime entry from list/search results."""
    title: str
    additional_title: str | None = None
    url: str
    cover: str | None = None
    episodes_aired: str | None = None
    next_episode_at: str | None = None
    season: str | None = None
    uniq: str | None = None


class AnimeListResponse(BaseModel):
    """Response for anime list endpoint."""
    source: str
    page: int
    category: str | None = None
    items: list[AnimeItem] = []
    has_next: bool = False


class AnimeSearchResponse(BaseModel):
    """Response for anime search endpoint."""
    source: str
    query: str
    page: int
    items: list[AnimeItem] = []


class AnimeDetails(BaseModel):
    """Detailed anime information from detail page."""
    title: str
    additional_title: str | None = None
    alt_title: str | None = None
    url: str
    cover: str | None = None
    summary: str | None = None
    production_year: str | None = None
    episodes: str | None = None
    ep_length: str | None = None
    status: str | None = None
    content_type: str | None = None
    country: str | None = None
    author: str | None = None
    genres: list[str] = []
    dubbers: list[str] = []
    producers: list[str] = []
    related: str | None = None
    is_have_subs: bool = False
    uniq: str | None = None


class EpisodeLink(BaseModel):
    """Quality variant link for an episode."""
    name: str
    url: str


class Episode(BaseModel):
    """Single episode entry."""
    title: str
    url: str
    uniq: str | None = None
    direct_links: bool = False
    url360: str | None = None
    url720: str | None = None
    links: list[EpisodeLink] = []
    service: str | None = None


class EpisodesResponse(BaseModel):
    """Response for episodes endpoint."""
    source: str
    anime_url: str
    episodes_from_page: str | None = None
    episodes: list[Episode] = []


class VideoInfo(BaseModel):
    """Video playback information."""
    url: str
    headers: dict[str, str] = {}
    referer: str | None = None
    direct: bool = False


class FilterOption(BaseModel):
    """Single filter option."""
    name: str
    value: str


class FilterInfo(BaseModel):
    """Filter category."""
    name: str
    filter_key: str
    choice_mode: str = "single"
    options: list[FilterOption] = []


class FiltersResponse(BaseModel):
    """Available filters for a source."""
    source: str
    filters: list[FilterInfo] = []
