"""FastAPI application — AniLabX Universal Parser Engine."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urljoin, quote
import httpx
import json
import os
from pathlib import Path

from app.config_loader import ConfigLoader
from app.http_client import HttpClient
from app.shikimori import ShikimoriClient
from app.routes import sources_router, anime_router, shikimori_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
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
async def proxy_media(url: str, referer: str = "", headers: str = "{}"):
    """Proxy media requests to bypass CORS and Referer/Cookie checks."""
    try:
        custom_headers = json.loads(headers)
    except:
        custom_headers = {}
    
    logger.info("Proxying request to %s (headers: %s)", url[:50], list(custom_headers.keys()))

    request_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Merge custom headers
    for k, v in custom_headers.items():
        request_headers[k] = v
        
    # Backward compatibility for referer param
    if referer and "Referer" not in request_headers:
        request_headers["Referer"] = referer

    try:
        # Use a fresh client for streaming. We'll close it in the generator's finally block or after reading m3u8.
        client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
        request = client.build_request("GET", url, headers=request_headers)
        response = await client.send(request, stream=True)
        
        if response.status_code != 200:
            content = await response.aread()
            await response.aclose()
            await client.aclose()
            return Response(status_code=response.status_code, content=content)
        
        # If it's a playlist, rewrite segment URLs
        is_m3u8 = url.lower().endswith(".m3u8") or "m3u8" in url.lower() or "mpegurl" in response.headers.get("content-type", "").lower()
        
        if is_m3u8:
            try:
                content_bytes = await response.aread()
                text = content_bytes.decode("utf-8", errors="ignore")
                lines = []
                for line in text.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("#"):
                        # Handle URI="..." in tags (like keys or sub-playlists)
                        if 'URI="' in line:
                            import re
                            def replace_uri(m):
                                inner = m.group(1)
                                if not inner.startswith("data:"):
                                    abs_url = urljoin(url, inner)
                                    return f'URI="/api/proxy?url={quote(abs_url, safe="")}&headers={quote(json.dumps(custom_headers))}"'
                                return m.group(0)
                            line = re.sub(r'URI="([^"]+)"', replace_uri, line)
                        lines.append(line)
                    else:
                        # Segment URL. If relative, make it absolute.
                        seg_url = urljoin(url, line)
                        # Proxy the segment too, passing the same headers!
                        proxied_seg = f"/api/proxy?url={quote(seg_url, safe='')}&headers={quote(json.dumps(custom_headers))}"
                        lines.append(proxied_seg)
                
                final_content = "\n".join(lines)
                return Response(content=final_content, media_type="application/vnd.apple.mpegurl")
            finally:
                await response.aclose()
                await client.aclose()
        
        # For segments or other media, stream the content correctly
        async def stream_generator():
            try:
                async for chunk in response.aiter_bytes():
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()
        
        return StreamingResponse(
            stream_generator(),
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/octet-stream")
        )
    except Exception as e:
        logger.error("Proxy error for %s: %s", url, e)
        return Response(status_code=500, content=str(e))


# APK Update endpoints
APK_VERSION = {
    "version_code": 2,
    "version_name": "1.1",
    "changelog": "Добавлена функция автообновления"
}

APK_PATH = Path("android-tv-webview/app/build/outputs/apk/debug/app-debug.apk")

@app.get("/api/version", tags=["update"])
async def get_version():
    """Get current APK version info for auto-updater."""
    base_url = os.environ.get("BASE_URL", "http://192.168.2.7:8000")
    return {
        "version_code": APK_VERSION["version_code"],
        "version_name": APK_VERSION["version_name"],
        "download_url": f"{base_url}/api/download/apk",
        "changelog": APK_VERSION["changelog"]
    }

@app.get("/api/download/apk", tags=["update"])
async def download_apk():
    """Download the latest APK file."""
    apk_file = APK_PATH

    if not apk_file.exists():
        logger.error(f"APK file not found at: {apk_file.absolute()}")
        return JSONResponse(
            status_code=404,
            content={"error": "APK file not found. Please build the app first."}
        )

    logger.info(f"Serving APK file: {apk_file.absolute()} ({apk_file.stat().st_size} bytes)")

    return FileResponse(
        path=apk_file,
        filename="anistar-tv.apk",
        media_type="application/vnd.android.package-archive"
    )

