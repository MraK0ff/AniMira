"""Aggregated anime routes — combine multiple sources via Shikimori."""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import asyncio
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/aggregated", tags=["aggregated"])


def _get_shikimori():
    from app.main import shikimori_client
    return shikimori_client


def _get_config_loader():
    from app.main import config_loader
    return config_loader


def _get_http_client():
    from app.main import http_client
    return http_client


async def search_anime_on_source(source: str, query: str, http_client) -> list[dict]:
    """Search anime on a specific source."""
    from app.parser_engine import ParserEngine
    
    cfg = _get_config_loader().get(source)
    if not cfg:
        return []
    
    try:
        engine = ParserEngine(cfg, http_client)
        items = await engine.parse_search(query=query, page=1)
        return [{"source": source, **item} for item in items]
    except Exception as e:
        logger.warning(f"Failed to search on {source}: {e}")
        return []


async def get_anime_details_from_source(source: str, url: str, http_client) -> Optional[dict]:
    """Get anime details from a specific source."""
    from app.parser_engine import ParserEngine
    
    cfg = _get_config_loader().get(source)
    if not cfg:
        return None
    
    try:
        engine = ParserEngine(cfg, http_client)
        details = await engine.parse_details(url)
        return {"source": source, "url": url, **details}
    except Exception as e:
        logger.warning(f"Failed to get details from {source}: {e}")
        return None


async def get_episodes_from_source(source: str, url: str, http_client) -> list[dict]:
    """Get episodes from a specific source."""
    from app.parser_engine import ParserEngine
    
    cfg = _get_config_loader().get(source)
    if not cfg:
        return []
    
    try:
        engine = ParserEngine(cfg, http_client)
        result = await engine.parse_episodes(url)
        episodes = result.get("episodes", [])
        
        # Add source info to each episode
        for ep in episodes:
            ep["source"] = source
            ep["anime_url"] = url
            
        return episodes
    except Exception as e:
        logger.warning(f"Failed to get episodes from {source}: {e}")
        return []


ANIME_SEARCH_QUERY = """
{
  animes(search: "%s", page: 1, limit: 50) {
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


def is_valid_title(title: str) -> bool:
    """Filter out invalid titles like URLs, file paths, etc."""
    if not title:
        return False
    invalid_prefixes = (
        "http://", "https://", "/", "script", "xml", "php", "css", "js",
        "Да", "Нет", "Ввод", "Отмена", "Сохранить", "Удалить", "Загрузка",
    )
    if title.startswith(invalid_prefixes):
        return False
    return True


def transliterate_russian(text: str) -> str:
    """Transliterate Russian text to Latin."""
    ru_en = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    }
    return ''.join(ru_en.get(c, c) for c in text)


@router.get("/search")
async def aggregated_search(
    query: str = Query(..., min_length=1, description="Anime title to search"),
    sources: Optional[str] = Query(None, description="Comma-separated source names (default: all)"),
):
    """Search anime across multiple sources and match with Shikimori.
    
    Returns aggregated results grouped by Shikimori anime ID.
    """
    client = _get_shikimori()
    http = _get_http_client()
    config_loader = _get_config_loader()
    
    # Get list of sources to search
    if sources:
        source_list = [s.strip() for s in sources.split(",")]
    else:
        source_list = config_loader.list_names()
    
    # Search Shikimori with multiple queries for better matching
    # Try original query + transliteration for Russian
    shikimori_queries = [query]
    
    # If query contains Russian characters, also try transliteration
    if any('\u0400' <= c <= '\u04ff' for c in query):
        transliterated = transliterate_russian(query)
        if transliterated != query:
            shikimori_queries.append(transliterated)
    
    # Search Shikimori with all queries
    shikimori_results = []
    seen_ids = set()
    for q in shikimori_queries:
        results = await client.search_anime(q)
        for r in results:
            if r["id"] not in seen_ids:
                seen_ids.add(r["id"])
                shikimori_results.append(r)
    
    # Search all sources in parallel
    search_tasks = [search_anime_on_source(s, query, http) for s in source_list]
    source_results = await asyncio.gather(*search_tasks)
    
    # Flatten and filter results
    all_source_items = []
    for items in source_results:
        for item in items:
            title = item.get("title", "")
            if is_valid_title(title):
                all_source_items.append(item)
    
    # Try to match source items with Shikimori results
    matched = {}  # shikimori_id -> {shikimori_data, sources: []}
    unmatched = []  # Items that couldn't be matched
    
    from app.shikimori import similarity
    
    for item in all_source_items:
        title = item.get("title", "").strip()
        alt_title = item.get("additional_title", "").strip()
        
        # Also try to extract romaji/english from alt_title patterns
        titles_to_check = [t for t in [title, alt_title] if t and is_valid_title(t)]
        
        best_match = None
        best_score = 0
        
        for shiki_anime in shikimori_results:
            # Compare against all possible titles from Shikimori
            shiki_titles = [
                shiki_anime.get("name", ""),
                shiki_anime.get("russian", ""),
                shiki_anime.get("english", ""),
                shiki_anime.get("japanese", ""),
            ]
            shiki_titles = [t.strip() for t in shiki_titles if t and len(t) > 2]
            
            scores = []
            for src_title in titles_to_check:
                for shiki_title in shiki_titles:
                    scores.append(similarity(src_title, shiki_title))
            
            if scores:
                max_score = max(scores)
                if max_score > best_score and max_score >= 60:  # Lowered threshold
                    best_score = max_score
                    best_match = shiki_anime
        
        if best_match:
            shiki_id = best_match["id"]
            if shiki_id not in matched:
                matched[shiki_id] = {
                    "shikimori": best_match,
                    "sources": [],
                    "similarity": best_score,
                }
            matched[shiki_id]["sources"].append({
                "source": item["source"],
                "title": item.get("title"),
                "url": item.get("url"),
                "cover": item.get("cover"),
                "episodes_aired": item.get("episodes_aired"),
            })
        else:
            unmatched.append(item)
    
    return {
        "query": query,
        "shikimori_matches": len(matched),
        "unmatched_count": len(unmatched),
        "results": [
            {
                "shikimori_id": k,
                "shikimori": v["shikimori"],
                "similarity": v["similarity"],
                "sources": v["sources"],
                "source_count": len(v["sources"]),
            }
            for k, v in sorted(matched.items(), key=lambda x: -x[1]["similarity"])
        ],
        "unmatched": unmatched[:20],  # Limit unmatched results
    }


@router.get("/details/{shikimori_id}")
async def aggregated_details(
    shikimori_id: int,
    sources: Optional[str] = Query(None, description="Comma-separated source names (default: all)"),
):
    """Get aggregated anime details from all sources for a Shikimori anime.
    
    Returns:
    - Shikimori data (poster, description, genres, etc.)
    - All matching sources with their episodes
    - Episodes grouped by dubbing studio
    """
    client = _get_shikimori()
    http = _get_http_client()
    config_loader = _get_config_loader()
    
    # Get Shikimori details
    shiki_details = await client.get_anime_by_id(shikimori_id)
    if not shiki_details:
        raise HTTPException(404, f"Anime {shikimori_id} not found on Shikimori")
    
    # Get list of sources to search
    if sources:
        source_list = [s.strip() for s in sources.split(",")]
    else:
        source_list = config_loader.list_names()
    
    # Search for this anime on all sources
    search_query = shiki_details.get("russian") or shiki_details.get("name", "")
    search_tasks = [search_anime_on_source(s, search_query, http) for s in source_list]
    source_results = await asyncio.gather(*search_tasks)
    
    # Match and get details+episodes from matching sources
    matched_sources = []
    all_episodes = []
    
    from app.shikimori import similarity
    
    for items in source_results:
        for item in items:
            title = item.get("title", "")
            alt_title = item.get("additional_title", "")
            
            # Check if matches
            scores = [
                similarity(title, shiki_details.get("name", "")),
                similarity(title, shiki_details.get("russian", "")),
                similarity(title, shiki_details.get("english", "")),
            ]
            if alt_title:
                scores.extend([
                    similarity(alt_title, shiki_details.get("name", "")),
                    similarity(alt_title, shiki_details.get("russian", "")),
                    similarity(alt_title, shiki_details.get("english", "")),
                ])
            
            if max(scores) >= 70:
                # Get full details and episodes
                source = item["source"]
                url = item.get("url")
                
                details = await get_anime_details_from_source(source, url, http)
                episodes = await get_episodes_from_source(source, url, http)
                
                if details:
                    matched_sources.append({
                        "source": source,
                        "url": url,
                        "title": details.get("title"),
                        "additional_title": details.get("additional_title"),
                        "dubbers": details.get("dubbers", []),
                        "episodes_count": len(episodes),
                    })
                    
                    # Add dubber info to episodes
                    for ep in episodes:
                        ep["dubbers"] = details.get("dubbers", [])
                        ep["source_title"] = details.get("title", "")
                    
                    all_episodes.extend(episodes)
    
    # Group episodes by dubber
    episodes_by_dubber = {}
    for ep in all_episodes:
        dubbers_key = ", ".join(ep.get("dubbers", [])) or "Неизвестная озвучка"
        
        if dubbers_key not in episodes_by_dubber:
            episodes_by_dubber[dubbers_key] = []
        episodes_by_dubber[dubbers_key].append(ep)
    
    # Sort episodes within each dubber group
    for dubber in episodes_by_dubber:
        episodes_by_dubber[dubber].sort(key=lambda x: x.get("uniq", x.get("title", "")))
    
    return {
        "shikimori_id": shikimori_id,
        "shikimori": shiki_details,
        "sources": matched_sources,
        "episodes_by_dubber": episodes_by_dubber,
        "total_episodes": len(all_episodes),
        "dubber_count": len(episodes_by_dubber),
    }


@router.get("/episodes/{shikimori_id}")
async def aggregated_episodes(
    shikimori_id: int,
    episode_uniq: str = Query(..., description="Episode identifier (e.g., 'Серия 5')"),
):
    """Get all available versions of a specific episode from all sources/dubbers.
    
    Useful for switching between dubbers in the player.
    """
    client = _get_shikimori()
    http = _get_http_client()
    
    # First get aggregated details
    from fastapi.requests import Request
    
    # Get all sources for this anime
    sources_param = ",".join(_get_config_loader().list_names())
    
    # Use the details endpoint logic
    shiki_details = await client.get_anime_by_id(shikimori_id)
    if not shiki_details:
        raise HTTPException(404, f"Anime {shikimori_id} not found")
    
    # Search and aggregate (simplified version of details endpoint)
    source_list = _get_config_loader().list_names()
    search_query = shiki_details.get("russian") or shiki_details.get("name", "")
    
    all_episodes = []
    
    from app.shikimori import similarity
    from app.parser_engine import ParserEngine
    
    for source in source_list:
        cfg = _get_config_loader().get(source)
        if not cfg:
            continue
            
        try:
            engine = ParserEngine(cfg, http)
            items = await engine.parse_search(query=search_query, page=1)
            
            for item in items:
                title = item.get("title", "")
                alt_title = item.get("additional_title", "")
                
                scores = [
                    similarity(title, shiki_details.get("name", "")),
                    similarity(title, shiki_details.get("russian", "")),
                ]
                if alt_title:
                    scores.append(similarity(alt_title, shiki_details.get("russian", "")))
                
                if max(scores) >= 70:
                    # Found match, get episodes
                    url = item.get("url")
                    result = await engine.parse_episodes(url)
                    episodes = result.get("episodes", [])
                    
                    # Filter for requested episode
                    for ep in episodes:
                        ep_uniq = ep.get("uniq") or ep.get("title", "")
                        if episode_uniq.lower() in ep_uniq.lower() or ep_uniq.lower() in episode_uniq.lower():
                            ep["source"] = source
                            ep["source_title"] = item.get("title")
                            all_episodes.append(ep)
                    
                    break  # Found match for this source, move to next
                    
        except Exception as e:
            logger.warning(f"Error processing source {source}: {e}")
            continue
    
    # Group by dubber/service
    versions = {}
    for ep in all_episodes:
        key = ep.get("service", "Unknown")
        if key not in versions:
            versions[key] = []
        versions[key].append(ep)
    
    return {
        "shikimori_id": shikimori_id,
        "episode_uniq": episode_uniq,
        "versions": versions,
        "version_count": len(versions),
    }
