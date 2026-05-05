"""Pydantic models for source/parser metadata."""

from __future__ import annotations

from pydantic import BaseModel


class SourceInfo(BaseModel):
    """Summary info about a loaded parser source."""
    name: str
    title: str
    host: str
    language: str
    content_type: str
    icon_link: str | None = None
    has_search: bool = False
    has_list: bool = False
    has_filters: bool = False


class SourceDetail(SourceInfo):
    """Detailed info including config internals."""
    version: int | None = None
    encoding: str | None = None
    user_agent: str | None = None
    episodes_order: bool = False
    aliases: list[str] = []
    author: dict | None = None
    custom_settings: dict | None = None
    available_filters: dict | None = None
