"""Shikimori API routes — search, auto-bind, bindings management."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/shikimori", tags=["shikimori"])


def _get_shikimori():
    from app.main import shikimori_client
    return shikimori_client


# ─── Request models ───────────────────────────────────────────────────

class AutoBindRequest(BaseModel):
    source: str
    content_id: str
    title: str
    alt_title: str = ""
    content_type: str = "anime"
    threshold: int = 70


class ManualBindRequest(BaseModel):
    source: str
    content_id: str
    shikimori_id: int


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("/search/anime")
async def search_anime(
    query: str = Query(..., min_length=1, description="Anime title to search"),
):
    """Search anime on Shikimori by title."""
    client = _get_shikimori()
    results = await client.search_anime(query)
    return {
        "query": query,
        "count": len(results),
        "results": results,
    }


@router.get("/search/manga")
async def search_manga(
    query: str = Query(..., min_length=1, description="Manga title to search"),
):
    """Search manga on Shikimori by title."""
    client = _get_shikimori()
    results = await client.search_manga(query)
    return {
        "query": query,
        "count": len(results),
        "results": results,
    }


@router.get("/anime/{shikimori_id}")
async def get_anime(shikimori_id: int):
    """Get anime details by Shikimori ID."""
    client = _get_shikimori()
    details = await client.get_anime_by_id(shikimori_id)
    if not details:
        raise HTTPException(404, f"Anime {shikimori_id} not found on Shikimori")
    return details


@router.get("/manga/{shikimori_id}")
async def get_manga(shikimori_id: int):
    """Get manga details by Shikimori ID."""
    client = _get_shikimori()
    details = await client.get_manga_by_id(shikimori_id)
    if not details:
        raise HTTPException(404, f"Manga {shikimori_id} not found on Shikimori")
    return details


@router.post("/autobind")
async def autobind(req: AutoBindRequest):
    """Auto-bind content to Shikimori using title similarity.

    Algorithm:
    1. Check if already bound (returns cached binding)
    2. Search Shikimori GraphQL by title
    3. Compute Levenshtein similarity against all results
    4. If best score >= threshold (default 70%) → bind and return
    5. If no match → return failure with top candidates
    """
    client = _get_shikimori()
    result = await client.autobind(
        source=req.source,
        content_id=req.content_id,
        title=req.title,
        alt_title=req.alt_title,
        content_type=req.content_type,
        threshold=req.threshold,
    )
    return result


@router.post("/bind")
async def manual_bind(req: ManualBindRequest):
    """Manually bind content to a specific Shikimori ID."""
    client = _get_shikimori()
    client.save_binding(req.source, req.content_id, req.shikimori_id)
    return {
        "status": "success",
        "source": req.source,
        "content_id": req.content_id,
        "shikimori_id": req.shikimori_id,
    }


@router.delete("/bind")
async def remove_bind(
    source: str = Query(...),
    content_id: str = Query(...),
):
    """Remove a Shikimori binding."""
    client = _get_shikimori()
    client.remove_binding(source, content_id)
    return {"status": "ok", "message": f"Binding removed for {source}/{content_id}"}


@router.get("/bindings")
async def list_bindings():
    """List all stored Shikimori bindings."""
    client = _get_shikimori()
    bindings = client.list_bindings()
    return {
        "count": len(bindings),
        "bindings": bindings,
    }


@router.get("/auth/url")
async def auth_url():
    """Get Shikimori OAuth2 authorization URL."""
    client = _get_shikimori()
    return {"url": client.get_auth_url()}


@router.post("/auth/token")
async def auth_token(code: str = Query(..., description="OAuth2 authorization code")):
    """Exchange OAuth2 code for access token."""
    client = _get_shikimori()
    result = await client.exchange_code(code)
    if not result:
        raise HTTPException(400, "Failed to exchange authorization code")
    return result
