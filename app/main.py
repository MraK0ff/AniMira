"""FastAPI application — AniMira Universal Parser Engine."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
    title="AniMira Parser Engine",
    description="Universal REST API for AniMira JSON parser configs",
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

# API Routes (все под префиксом /api)
app.include_router(sources_router, prefix="/api")
app.include_router(anime_router, prefix="/api")
app.include_router(shikimori_router, prefix="/api")

# Static files (frontend) — только если есть build
static_dir = Path(__file__).parent.parent / "web" / "dist"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    # Serve index.html for root and all frontend routes
    @app.get("/", tags=["frontend"])
    async def serve_index():
        return FileResponse(static_dir / "index.html")
    
    @app.get("/{path:path}", tags=["frontend"])
    async def serve_frontend(path: str):
        # Skip API routes
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = static_dir / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")


@app.get("/api/", tags=["health"])
async def root():
    """Health check and API info."""
    names = config_loader.list_names()
    return {
        "name": "AniMira Parser Engine",
        "version": "1.0.0",
        "sources_loaded": len(names),
        "sources": names,
        "endpoints": [
            "GET /api/sources",
            "GET /api/sources/{name}",
            "GET /api/anime/list?source=...&page=1",
            "GET /api/anime/search?source=...&query=...",
            "GET /api/anime/details?source=...&url=...",
            "GET /api/anime/episodes?source=...&url=...",
            "GET /api/anime/video?source=...&episode_url=...",
            "GET /api/anime/filters?source=...",
        ],
    }


@app.get("/", tags=["frontend"])
async def serve_frontend():
    """Serve the frontend index.html."""
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "API is running. Frontend not built yet."}


@app.post("/api/cache/clear", tags=["admin"])
async def clear_cache():
    """Clear the HTTP response cache."""
    http_client.clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@app.get("/api/proxy", tags=["proxy"])
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
async def get_version(request: Request):
    """Get current APK version info for auto-updater."""
    # Determine base URL from environment or request
    env_base_url = os.environ.get("BASE_URL", "")
    if env_base_url:
        base_url = env_base_url
    else:
        # Auto-detect from request (works on Render and local)
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.hostname))
        base_url = f"{scheme}://{host}"

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
        filename="animira-tv.apk",
        media_type="application/vnd.android.package-archive"
    )


# SPA catch-all — все неизвестные пути возвращают index.html
# (должен быть ПОСЛЕ всех остальных роутов)
@app.get("/{full_path:path}", tags=["frontend"])
async def serve_spa(full_path: str):
    """Serve index.html for any non-API path (SPA routing)."""
    # Проверяем что это не API путь и не assets
    if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("static/"):
        return {"detail": "Not found"}

    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "API is running. Frontend not built yet."}
