"""Anime API routes — list, search, details, episodes, video, filters."""
import re
from fastapi import APIRouter, HTTPException, Query
from app.parser_engine import ParserEngine
from app.http_client import HttpClient

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
    # Ensure items is always a list
    if not isinstance(items, list):
        items = []
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
    
    # Handle async content parsing if needed
    if info.get("needs_async_parsing") and info.get("form_data_tag"):
        from app import content_parsers
        parser = content_parsers.get_content_parser(info["form_data_tag"], engine.http)
        if parser and hasattr(parser, 'get_video_info'):
            try:
                video_info = await parser.get_video_info(episode_url)
                info.update(video_info)
                # Remove the async parsing flag
                info.pop("needs_async_parsing", None)
                info.pop("form_data_tag", None)
            except Exception as e:
                # Log error and continue with basic info
                import logging
                logger = logging.getLogger(__name__)
                logger.warning("Async content parsing failed for %s: %s", source, e)
    
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


def _bdecode(data: bytes) -> dict:
    """Simple bencode decoder for torrent files."""
    idx = [0]
    
    def parse():
        if idx[0] >= len(data):
            return None
        c = data[idx[0]]
        
        if c == ord('i'):  # integer
            idx[0] += 1
            end = data.find(b'e', idx[0])
            val = int(data[idx[0]:end])
            idx[0] = end + 1
            return val
        elif c == ord('l'):  # list
            idx[0] += 1
            lst = []
            while data[idx[0]] != ord('e'):
                lst.append(parse())
            idx[0] += 1
            return lst
        elif c == ord('d'):  # dict
            idx[0] += 1
            dct = {}
            while data[idx[0]] != ord('e'):
                key = parse()
                val = parse()
                if isinstance(key, bytes):
                    key = key.decode('utf-8', errors='replace')
                dct[key] = val
            idx[0] += 1
            return dct
        elif c == ord('e'):  # end
            return None
        else:  # string
            colon = data.find(b':', idx[0])
            length = int(data[idx[0]:colon])
            idx[0] = colon + 1
            val = data[idx[0]:idx[0]+length]
            idx[0] += length
            return val
    
    return parse()


def _extract_torrent_info(torrent_data: bytes) -> dict:
    """Extract filename and quality info from torrent metadata."""
    try:
        data = _bdecode(torrent_data)
        info = data.get('info', {})
        
        # Get filename
        name = info.get('name', b'')
        if isinstance(name, bytes):
            name = name.decode('utf-8', errors='replace')
        
        # If multi-file torrent, get first file name
        files = info.get('files', [])
        if files and isinstance(files, list):
            first_file = files[0]
            if isinstance(first_file, dict):
                path_parts = first_file.get('path', [])
                if path_parts and isinstance(path_parts, list):
                    filename = b''.join(path_parts) if all(isinstance(p, bytes) for p in path_parts) else path_parts[-1]
                    if isinstance(filename, bytes):
                        filename = filename.decode('utf-8', errors='replace')
                    name = filename
        
        # Extract quality from filename
        quality = None
        quality_match = re.search(r'(\d{3,4}p|4K|UHD|FHD|FullHD|HD|SD)', name, re.IGNORECASE)
        if quality_match:
            quality = quality_match.group(1).upper()
        
        return {
            "filename": name,
            "quality": quality,
        }
    except Exception as e:
        return {"filename": None, "quality": None, "error": str(e)}


@router.get("/torrent/info")
async def torrent_info(
    torrent_url: str = Query(..., description="Torrent file URL"),
):
    """Get metadata from torrent file including internal filename and quality."""
    http = HttpClient()
    
    try:
        # Download torrent file
        torrent_data = await http.get_bytes(torrent_url)
        if not torrent_data:
            raise HTTPException(404, "Failed to download torrent")
        
        info = _extract_torrent_info(torrent_data)
        return {
            "torrent_url": torrent_url,
            **info,
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to parse torrent: {e}")
