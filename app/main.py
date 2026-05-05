"""FastAPI application — AniLabX Universal Parser Engine."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urljoin, quote
import httpx

from app.config_loader import ConfigLoader
from app.http_client import HttpClient
from app.shikimori import ShikimoriClient
from app.routes import sources_router, anime_router, shikimori_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Global instances
config_loader = ConfigLoader(config_dir="repos")
http_client = HttpClient()
shikimori_client = ShikimoriClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    # Startup
    count = config_loader.load_all()
    logger.info("🚀 Parser Engine started — %d sources loaded", count)
    yield
    # Shutdown
    await http_client.close()
    await shikimori_client.close()
    logger.info("🛑 Parser Engine stopped")


app = FastAPI(
    title="AniLabX Parser Engine",
    description="Universal REST API for AniLabX JSON parser configs",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(sources_router)
app.include_router(anime_router)
app.include_router(shikimori_router)


@app.get("/", tags=["health"])
async def root():
    """Health check and API info."""
    names = config_loader.list_names()
    return {
        "name": "AniLabX Parser Engine",
        "version": "1.0.0",
        "sources_loaded": len(names),
        "sources": names,
        "endpoints": [
            "GET /sources",
            "GET /sources/{name}",
            "GET /anime/list?source=...&page=1",
            "GET /anime/search?source=...&query=...",
            "GET /anime/details?source=...&url=...",
            "GET /anime/episodes?source=...&url=...",
            "GET /anime/video?source=...&episode_url=...",
            "GET /anime/filters?source=...",
        ],
    }


@app.post("/cache/clear", tags=["admin"])
async def clear_cache():
    """Clear the HTTP response cache."""
    http_client.clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@app.get("/proxy", tags=["proxy"])
async def proxy_media(url: str, referer: str = ""):
    """Proxy media requests to bypass CORS and Referer checks."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    if referer:
        headers["Referer"] = referer

    client = httpx.AsyncClient(follow_redirects=True)
    req = client.build_request("GET", url, headers=headers)
    res = await client.send(req, stream=True)

    # If it's an m3u8 playlist, we must rewrite the URIs inside it to also use the proxy
    if "mpegurl" in res.headers.get("Content-Type", "") or url.endswith(".m3u8"):
        await res.aread()
        text = res.text
        lines = []
        for line in text.splitlines():
            if line and not line.startswith("#"):
                abs_url = urljoin(url, line)
                # Proxy the segment too
                proxy_url = f"/api/proxy?url={quote(abs_url, safe='')}&referer={quote(referer, safe='')}"
                lines.append(proxy_url)
            elif line.startswith("#EXT-X-STREAM-INF") or line.startswith("#EXT-X-I-FRAME-STREAM-INF"):
                lines.append(line)
            else:
                # Some tags like URI="key.key" might also need rewriting, but usually anime doesn't use DRM keys
                # We'll just rewrite basic lines
                if 'URI="' in line:
                    # Very basic rewrite for URI="..."
                    import re
                    def replace_uri(m):
                        inner = m.group(1)
                        if not inner.startswith("data:"):
                            abs_url = urljoin(url, inner)
                            return f'URI="/api/proxy?url={quote(abs_url, safe="")}&referer={quote(referer, safe="")}"'
                        return m.group(0)
                    line = re.sub(r'URI="([^"]+)"', replace_uri, line)
                lines.append(line)
        
        await client.aclose()
        return Response(content="\n".join(lines), media_type=res.headers.get("Content-Type", "application/vnd.apple.mpegurl"))

    # For TS segments or MP4, stream it directly
    async def stream_generator():
        async for chunk in res.aiter_bytes(chunk_size=65536):
            yield chunk
        await client.aclose()

    return StreamingResponse(
        stream_generator(),
        status_code=res.status_code,
        media_type=res.headers.get("Content-Type"),
    )

