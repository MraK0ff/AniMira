"""Content parsers for specific sources like AniStar."""
import re
import urllib.parse
from typing import Any, Dict
from app.http_client import HttpClient


class AniStarContentParser:
    """AniStar-specific content parser for extracting direct video URLs."""
    
    def __init__(self, http: HttpClient):
        self.http = http
        self.host = "https://v24.astar.bz"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "Cookie": "3d3b81c3810f50abfa556d8a468c805b=1"
        }

    async def get_video_info(self, url: str) -> Dict[str, Any]:
        """Extract direct video URL from AniStar episode page or embed URL."""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"AniStar content parser processing URL: {url}")
            
            # Handle embed URLs (like https://n2.astar.bz/embed/284216)
            if "/embed/" in url:
                logger.info("Detected embed URL, using embed handler")
                result = await self._handle_embed_url(url)
                logger.info(f"Embed handler result: direct={result.get('direct')}, url={result.get('url')}")
                return result
            
            # Handle regular episode pages
            logger.info("Using regular episode page handler")
            result = await self._handle_episode_page(url)
            logger.info(f"Episode handler result: direct={result.get('direct')}, url={result.get('url')}")
            return result

        except Exception as e:
            logger.error(f"AniStar content parser error: {e}")
            # Return fallback info on error
            return {
                "url": url,
                "headers": {
                    "Referer": "https://v24.astar.bz",
                    "User-Agent": self.headers["User-Agent"]
                },
                "referer": "https://v24.astar.bz",
                "direct": False
            }

    async def _handle_embed_url(self, embed_url: str) -> Dict[str, Any]:
        """Handle embed URLs and extract direct video URLs."""
        # Fetch the embed page (follow redirects automatically)
        html = await self.http.get(embed_url, headers=self.headers)
        
        # Look for direct video URLs in the embed page
        # AniStar embeds often contain iframe sources or direct video links
        
        # Try to find m3u8 playlist URLs
        m3u8_matches = re.findall(r'https?://[^\s"\'<>]*\.m3u8[^\s"\'<>]*', html)
        if m3u8_matches:
            video_url = m3u8_matches[0]
            return {
                "url": video_url,
                "headers": {
                    "Referer": embed_url,
                    "User-Agent": self.headers["User-Agent"]
                },
                "referer": embed_url,
                "direct": True
            }
        
        # Try to find mp4 URLs
        mp4_matches = re.findall(r'https?://[^\s"\'<>]*\.mp4[^\s"\'<>]*', html)
        if mp4_matches:
            video_url = mp4_matches[0]
            return {
                "url": video_url,
                "headers": {
                    "Referer": embed_url,
                    "User-Agent": self.headers["User-Agent"]
                },
                "referer": embed_url,
                "direct": True
            }
        
        # Look for video sources in script tags
        script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
        for script in script_matches:
            # Look for file: or url: patterns
            file_matches = re.findall(r'["\']file["\']:\s*["\']([^"\']+)["\']', script)
            if file_matches:
                video_url = file_matches[0]
                if not video_url.startswith('http'):
                    # Handle relative URLs
                    if video_url.startswith('//'):
                        video_url = 'https:' + video_url
                    elif video_url.startswith('/'):
                        video_url = 'https://v24.astar.bz' + video_url
                
                return {
                    "url": video_url,
                    "headers": {
                        "Referer": embed_url,
                        "User-Agent": self.headers["User-Agent"]
                    },
                    "referer": embed_url,
                    "direct": True
                }
            
            # Look for video URLs in various JavaScript patterns
            video_patterns = [
                r'["\']?url["\']?\s*:\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']',
                r'["\']?src["\']?\s*:\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']',
                r'["\']?video["\']?\s*:\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']',
                r'["\']?stream["\']?\s*:\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']',
                r'["\']?playlist["\']?\s*:\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']',
            ]
            
            for pattern in video_patterns:
                matches = re.findall(pattern, script, re.IGNORECASE)
                if matches:
                    video_url = matches[0]
                    if not video_url.startswith('http'):
                        if video_url.startswith('//'):
                            video_url = 'https:' + video_url
                        elif video_url.startswith('/'):
                            # Extract domain from embed_url
                            from urllib.parse import urlparse
                            parsed = urlparse(embed_url)
                            video_url = f"{parsed.scheme}://{parsed.netloc}{video_url}"
                    
                    return {
                        "url": video_url,
                        "headers": {
                            "Referer": embed_url,
                            "User-Agent": self.headers["User-Agent"]
                        },
                        "referer": embed_url,
                        "direct": True
                    }
        
        # Look for iframe sources that might contain video players
        iframe_matches = re.findall(r'<iframe[^>]*src=["\']([^"\']+)["\']', html)
        for iframe_src in iframe_matches:
            if not iframe_src.startswith('http'):
                if iframe_src.startswith('//'):
                    iframe_src = 'https:' + iframe_src
                elif iframe_src.startswith('/'):
                    iframe_src = 'https://v24.astar.bz' + iframe_src
            
            # Try to fetch the iframe content
            try:
                iframe_html = await self.http.get(iframe_src, headers=self.headers)
                # Look for video URLs in the iframe
                iframe_m3u8 = re.findall(r'https?://[^\s"\'<>]*\.m3u8[^\s"\'<>]*', iframe_html)
                if iframe_m3u8:
                    return {
                        "url": iframe_m3u8[0],
                        "headers": {
                            "Referer": iframe_src,
                            "User-Agent": self.headers["User-Agent"]
                        },
                        "referer": iframe_src,
                        "direct": True
                    }
            except Exception:
                continue
        
        # For AniStar embed URLs, return them as direct URLs since the player can handle JavaScript-based players
        # The embed URL will be processed by the frontend player which can handle the JavaScript video loading
        return {
            "url": embed_url,
            "headers": {
                "Referer": "https://v24.astar.bz",
                "User-Agent": self.headers["User-Agent"]
            },
            "referer": "https://v24.astar.bz",
            "direct": True
        }

    def _extract_episode_id(self, url: str) -> str | None:
        """Extract episode ID from AniStar URL."""
        # Try to extract ID from patterns like /embed/284216 or /videoas.php?id=284216
        patterns = [
            r'/embed/(\d+)',
            r'id=(\d+)',
            r'/(\d+)(?:\.html)?$',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None

    async def _handle_episode_page(self, url: str) -> Dict[str, Any]:
        """Handle regular episode pages."""
        # Fetch the episode page
        html = await self.http.get(url, headers=self.headers, encoding='cp1251')
        
        # Try to parse playlist directly from the page
        video_info = self._parse_playlist(html)
        if video_info:
            return {
                "url": video_info["url"],
                "headers": {
                    "Referer": "https://v24.astar.bz",
                    "User-Agent": self.headers["User-Agent"]
                },
                "referer": "https://v24.astar.bz",
                "direct": True
            }

        # If no playlist found, try to find internal player
        player_match = re.search(r'src="(/test/player2/.*?)"', html)
        if player_match:
            player_url = self.host + player_match.group(1)
            player_html = await self.http.get(player_url, headers=self.headers)
            video_info = self._parse_playlist(player_html)
            if video_info:
                return {
                    "url": video_info["url"],
                    "headers": {
                        "Referer": "https://v24.astar.bz",
                        "User-Agent": self.headers["User-Agent"]
                    },
                    "referer": "https://v24.astar.bz",
                    "direct": True
                }

        # Fallback: return the original URL if no direct link found
        return {
            "url": url,
            "headers": {
                "Referer": "https://v24.astar.bz",
                "User-Agent": self.headers["User-Agent"]
            },
            "referer": "https://v24.astar.bz",
            "direct": False
        }

    def _parse_playlist(self, html: str) -> Dict[str, Any] | None:
        """Parse AniStar playlist to extract direct video URL."""
        playlist_match = re.search(r'var playlst\s*=\s*(\[.*?\]);', html, re.DOTALL)
        if not playlist_match:
            return None

        playlist_raw = playlist_match.group(1)
        
        # Extract HD links and titles
        links_720 = re.findall(r'file_h:"(.*?)"', playlist_raw)
        links_360 = re.findall(r'file:"(.*?)"', playlist_raw)
        titles = re.findall(r'title:"(.*?)"', playlist_raw)

        if not links_720 and not links_360:
            return None

        # Get the first available link (usually the latest episode)
        all_links = links_720 if links_720 else links_360
        if not all_links:
            return None

        first_link = all_links[0]
        
        # Decode the URL
        url = first_link.replace('%2F', '/').replace('%3A', ':').replace('%3D', '=').replace('%2C', ',')
        
        # Apply AniStar-specific URL transformations
        # Replace server sfv with sf2
        url = url.replace("sfv.an-media", "sf2.an-media")
        
        # Extract video ID and create clean URL
        video_id_match = re.search(r'/([^/]+)/720\.mp4', url)
        if video_id_match:
            video_id = video_id_match.group(1)
            url = f"https://sf2.an-media.org/video/{video_id}/720.mp4"
        
        # Add HLS suffix if needed
        if not url.endswith("/index.m3u8"):
            url += "/index.m3u8"

        return {"url": url}


# Registry of content parsers
CONTENT_PARSERS = {
    "anistar": AniStarContentParser,
}


def get_content_parser(tag: str, http: HttpClient):
    """Get content parser instance by tag."""
    parser_class = CONTENT_PARSERS.get(tag)
    if parser_class:
        return parser_class(http)
    return None
