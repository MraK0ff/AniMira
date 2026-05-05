"""Anime API routes — list, search, details, episodes, video, filters."""
from fastapi import APIRouter, HTTPException, Query
from app.parser_engine import ParserEngine

router = APIRouter(prefix="/anime", tags=["anime"])


def _get_engine(source: str) -> ParserEngine:
    from app.main import config_loader, http_client
    cfg = config_loader.get(source)
    if not cfg:
        raise HTTPException(404, f"Source '{source}' not found")
    return ParserEngine(cfg, http_client)


@router.get("/list")
async def anime_list(
    source: str = Query(..., description="Parser source name"),
    page: int = Query(1, ge=1),
    category: str | None = Query(None, description="Category tag"),
):
    """Get anime catalog list from source."""
    engine = _get_engine(source)
    items = await engine.parse_list(page=page, category=category)
    categories = engine.list_categories()
    return {
        "source": source,
        "page": page,
        "category": category,
        "categories": categories,
        "items": items,
        "count": len(items),
        "has_next": len(items) > 0,
    }


@router.get("/search")
async def anime_search(
    source: str = Query(...),
    query: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
):
    """Search anime on a source."""
    engine = _get_engine(source)
    items = await engine.parse_search(query=query, page=page)
    return {
        "source": source,
        "query": query,
        "page": page,
        "items": items,
        "count": len(items),
    }


@router.get("/details")
async def anime_details(
    source: str = Query(...),
    url: str = Query(..., description="Anime page URL"),
):
    """Get detailed anime info from its page URL."""
    engine = _get_engine(source)
    details = await engine.parse_details(url)
    return {"source": source, **details}


@router.get("/episodes")
async def anime_episodes(
    source: str = Query(...),
    url: str = Query(..., description="Anime page URL"),
):
    """Get episode list for an anime."""
    engine = _get_engine(source)
    result = await engine.parse_episodes(url)
    return {"source": source, **result}


@router.get("/video")
async def anime_video(
    source: str = Query(...),
    episode_url: str = Query(..., description="Episode URL"),
):
    """Get video playback info for an episode."""
    engine = _get_engine(source)
    info = engine.get_video_info(episode_url)
    return {"source": source, **info}


@router.get("/filters")
async def anime_filters(
    source: str = Query(...),
):
    """Get available filters for a source."""
    engine = _get_engine(source)
    filters = await engine.parse_filters()
    categories = engine.list_categories()
    return {
        "source": source,
        "filters": filters,
        "categories": categories,
    }
