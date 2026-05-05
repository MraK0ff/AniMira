"""Source info API routes."""
from fastapi import APIRouter, HTTPException
from app.models.source import SourceInfo, SourceDetail

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceInfo])
async def list_sources():
    """List all available parser sources."""
    from app.main import config_loader
    return config_loader.list_sources()


@router.get("/{name}", response_model=SourceDetail)
async def get_source(name: str):
    """Get detailed info about a specific parser source."""
    from app.main import config_loader
    cfg = config_loader.get(name)
    if not cfg:
        raise HTTPException(404, f"Source '{name}' not found")
    return cfg.to_source_detail()
