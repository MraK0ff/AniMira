"""FastAPI application — AniMira Universal Parser Engine."""
from __future__ import annotations

import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
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

    # Self-ping task to keep Render service awake (free tier sleeps after 15 min inactivity)
    keep_alive_task = None
    if os.environ.get("ENVIRONMENT") == "production":
        async def self_ping():
            """Ping the /api/ endpoint every 10 minutes to prevent sleeping."""
            base_url = os.environ.get("BASE_URL", "https://animira.onrender.com")
            while True:
                try:
                    await asyncio.sleep(600)  # 10 minutes
                    async with httpx.AsyncClient() as client:
                        response = await client.get(f"{base_url}/api/", timeout=30)
                        logger.debug("Self-ping status: %s", response.status_code)
                except Exception as e:
                    logger.warning("Self-ping failed: %s", e)

        keep_alive_task = asyncio.create_task(self_ping())
        logger.info("🔄 Self-ping task started (keep-alive for Render)")

    yield

    # Shutdown
    if keep_alive_task:
        keep_alive_task.cancel()
        try:
            await keep_alive_task
        except asyncio.CancelledError:
            pass
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
    """Serve the frontend index.html or redirect to static site."""
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    # Redirect to static site if frontend not built in this service
    return {"message": "API is running. Use https://animira.onrender.com for frontend."}


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


# APK Update endpoints - default fallback values
DEFAULT_APK_VERSION = {
    "version_code": 2,
    "version_name": "1.1",
    "changelog": "Исправлена версия приложения, добавлена автогенерация version.json"
}

# Check multiple possible APK locations (local build or deployed)
APK_PATHS = [
    Path("apk/app-debug.apk"),  # Deployed location at project root
    Path("android-tv-webview/apk/app-debug.apk"),  # Gradle copyApk destination
    Path("android-tv-webview/app/build/outputs/apk/debug/app-debug.apk"),  # Local build
]

# version.json is generated by gradle during build (check multiple locations)
VERSION_JSON_PATHS = [
    Path("apk/version.json"),  # Project root
    Path("android-tv-webview/apk/version.json"),  # Gradle output directory
]

def find_version_json() -> Path | None:
    """Find version.json file in known locations."""
    for path in VERSION_JSON_PATHS:
        if path.exists():
            return path
    return None

def get_apk_version() -> dict:
    """Get APK version from version.json if available, otherwise use APK file info."""
    # First try to read version.json generated by gradle
    version_file = find_version_json()
    if version_file:
        try:
            with open(version_file) as f:
                data = json.load(f)
                # Add file size from APK if available
                apk_file = find_apk_file()
                if apk_file:
                    data["apk_size"] = apk_file.stat().st_size
                logger.info(f"Loaded version from {version_file}: code={data.get('version_code')}, name={data.get('version_name')}, build_time={data.get('build_time')}")
                return data
        except Exception as e:
            logger.warning(f"Failed to read version.json: {e}")
    else:
        logger.warning("version.json not found in any location")
        for path in VERSION_JSON_PATHS:
            logger.warning(f"  Checked: {path.absolute()} (exists: {path.exists()})")

    # Fallback: get version from APK file modification time (less reliable with auto-increment)
    apk_file = find_apk_file()
    if apk_file:
        stat = apk_file.stat()
        # Use modification time as version code (only as last resort)
        version_code = int(stat.st_mtime)
        version_name = f"build.{version_code}"
        logger.warning(f"Using APK mtime as version (fallback): code={version_code}, file={apk_file}")
        logger.warning("This may cause version mismatch! Ensure version.json is deployed with APK.")
        return {
            "version_code": version_code,
            "version_name": version_name,
            "changelog": f"Сборка от {stat.st_mtime}",
            "apk_size": stat.st_size
        }

    # Last fallback: return default
    logger.error("No APK or version.json found! Using default version.")
    return DEFAULT_APK_VERSION.copy()

def find_apk_file() -> Path | None:
    """Find APK file in known locations."""
    for path in APK_PATHS:
        if path.exists():
            return path
    return None

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

    # Get dynamic version info (from version.json or APK file)
    version_info = get_apk_version()

    # Check if APK is available
    apk_file = find_apk_file()
    apk_available = apk_file is not None

    result = {
        "version_code": version_info.get("version_code", 1),
        "version_name": version_info.get("version_name", "1.0.0"),
        "download_url": f"{base_url}/api/download/apk",
        "changelog": version_info.get("changelog", "Автоматическая сборка"),
        "apk_available": apk_available,
        "apk_size": version_info.get("apk_size") or (apk_file.stat().st_size if apk_file else None),
        "build_time": version_info.get("build_time")
    }

    logger.info(f"/api/version response: code={result['version_code']}, name={result['version_name']}, apk_available={apk_available}")
    return result

@app.get("/api/download/apk", tags=["update"])
async def download_apk():
    """Download the latest APK file."""
    apk_file = find_apk_file()

    if not apk_file:
        logger.error("APK file not found in any location")
        # Log what paths were checked
        for path in APK_PATHS:
            logger.error(f"  Checked: {path.absolute()} (exists: {path.exists()})")
        return JSONResponse(
            status_code=404,
            content={
                "error": "APK file not found. Please build the app first.",
                "hint": "Run: cd android-tv-webview && ./gradlew assembleDebug"
            }
        )

    logger.info(f"Serving APK file: {apk_file.absolute()} ({apk_file.stat().st_size} bytes)")

    return FileResponse(
        path=apk_file,
        filename="animira-tv.apk",
        media_type="application/vnd.android.package-archive"
    )


# SPA 404 handler — возвращает index.html для не-API путей (React Router)
@app.exception_handler(StarletteHTTPException)
async def spa_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return index.html for 404 on non-API routes (SPA routing)."""
    # API routes should return proper 404
    if request.url.path.startswith("/api/"):
        return await http_exception_handler(request, exc)
    
    # For all other routes, return index.html for SPA routing
    if exc.status_code == 404:
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    
    return await http_exception_handler(request, exc)
