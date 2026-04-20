"""
API routes for AnimePahe Web.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
import httpx
import urllib.parse

from ..services.anime_service import AnimeService

router = APIRouter()
anime_service = AnimeService()


# Pydantic models for request/response
class SearchResult(BaseModel):
    session: str
    title: str


class EpisodeInfo(BaseModel):
    episode: int
    session: str
    created_at: Optional[str] = None
    duration: Optional[str] = None


class AnimeDetails(BaseModel):
    name: str
    slug: str
    episodes: List[EpisodeInfo]
    total_episodes: Optional[int] = None


class StreamUrlResponse(BaseModel):
    stream_url: Optional[str] = None
    playlist_url: Optional[str] = None
    quality: str
    audio: str
    error: Optional[str] = None


class StreamOption(BaseModel):
    src: str
    fansub: Optional[str] = None
    resolution: str
    audio: str
    av1: str = "0"


class AllStreamsResponse(BaseModel):
    streams: List[StreamOption]
    error: Optional[str] = None


class UpdateCacheResponse(BaseModel):
    status: str
    entries_count: int
    message: str


@router.get("/search", response_model=List[SearchResult])
async def search_anime(
    q: str = Query(..., description="Search query for anime"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results")
):
    """Search for anime by title."""
    try:
        results = anime_service.search(q)
        return results[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/anime/{anime_slug}/episodes", response_model=AnimeDetails)
async def get_episodes(
    anime_slug: str,
    name: Optional[str] = Query(None, description="Anime name for display")
):
    """Get all episodes for a specific anime."""
    try:
        anime_name = name or anime_slug
        episodes = anime_service.get_episodes(anime_name, anime_slug)
        
        episode_list = [
            EpisodeInfo(
                episode=ep.get("episode", 0),
                session=ep.get("session", ""),
                created_at=ep.get("created_at"),
                duration=ep.get("duration")
            )
            for ep in episodes
        ]
        
        return AnimeDetails(
            name=anime_name,
            slug=anime_slug,
            episodes=episode_list,
            total_episodes=len(episode_list)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch episodes: {str(e)}")


@router.get("/anime/{anime_slug}/episode/{episode_session}/stream", response_model=StreamUrlResponse)
async def get_stream_url(
    anime_slug: str,
    episode_session: str,
    quality: str = Query("best", description="Video quality (best, 1080, 720, 480, 360)"),
    audio: str = Query("jpn", description="Audio language (jpn, eng)")
):
    """Get streaming URL for a specific episode."""
    try:
        # Get stream page URL
        stream_page_url = anime_service.get_stream_url(anime_slug, episode_session, quality, audio)

        if not stream_page_url:
            return StreamUrlResponse(
                stream_url=None,
                playlist_url=None,
                quality=quality,
                audio=audio,
                error="Could not find stream URL"
            )

        # Get m3u8 playlist URL from stream page
        playlist_url = anime_service.get_playlist_url(stream_page_url)

        return StreamUrlResponse(
            stream_url=stream_page_url,
            playlist_url=playlist_url,
            quality=quality,
            audio=audio,
            error=None if playlist_url else "Could not extract playlist URL"
        )
    except Exception as e:
        return StreamUrlResponse(
            stream_url=None,
            playlist_url=None,
            quality=quality,
            audio=audio,
            error=str(e)
        )


@router.get("/anime/{anime_slug}/episode/{episode_session}/streams", response_model=AllStreamsResponse)
async def get_all_streams(
    anime_slug: str,
    episode_session: str
):
    """Get all available stream options for an episode (matching animepahe.pw format)."""
    try:
        streams = anime_service.get_all_streams(anime_slug, episode_session)
        stream_options = [
            StreamOption(
                src=s["src"],
                fansub=s.get("fansub"),
                resolution=s["resolution"],
                audio=s["audio"],
                av1=s["av1"]
            )
            for s in streams if s["src"]
        ]
        return AllStreamsResponse(streams=stream_options, error=None)
    except Exception as e:
        return AllStreamsResponse(streams=[], error=str(e))


@router.post("/cache/update", response_model=UpdateCacheResponse)
async def update_cache():
    """Update the anime list cache."""
    try:
        count = anime_service.update_cache()
        if count > 0:
            return UpdateCacheResponse(
                status="success",
                entries_count=count,
                message=f"Successfully cached {count} anime entries"
            )
        elif count == 0:
            return UpdateCacheResponse(
                status="warning",
                entries_count=0,
                message="No entries were cached. Cache might already be up to date."
            )
        else:
            return UpdateCacheResponse(
                status="error",
                entries_count=-1,
                message="Failed to update cache"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache update failed: {str(e)}")


@router.get("/airing")
async def get_airing_anime():
    """Get currently airing anime."""
    try:
        airing = anime_service.get_airing_anime()
        return {"data": airing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch airing anime: {str(e)}")


@router.get("/proxy/stream")
async def proxy_stream(url: str = Query(..., description="Stream URL to proxy")):
    """Proxy video stream to bypass CORS restrictions. Rewrites m3u8 to proxy all segments."""
    try:
        # Decode URL in case it was double-encoded
        try:
            decoded_url = urllib.parse.unquote(url)
            if decoded_url != url:
                url = decoded_url
        except Exception:
            pass

        # Prevent proxy loops - reject URLs pointing to ourselves
        if url.startswith("http://localhost:8000") or url.startswith("https://localhost:8000"):
            raise HTTPException(status_code=400, detail="Cannot proxy self-referential URL")

        # Validate it's an external HTTPS URL
        if not url.startswith("https://"):
            raise HTTPException(status_code=400, detail="Invalid URL - must be HTTPS CDN URL")

        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Referer": "https://kwik.cx/",
            "Origin": "https://kwik.cx",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.6",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
        }

        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            # If it's an m3u8 playlist, rewrite segment URLs to go through proxy
            if "mpegurl" in content_type or url.endswith(".m3u8"):
                playlist_content = response.text
                base_url = url.rsplit("/", 1)[0] + "/"

                # Rewrite relative URLs to absolute proxy URLs
                lines = playlist_content.split("\n")
                rewritten_lines = []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        # It's a segment URL - convert to absolute and proxy it
                        if line.startswith("http"):
                            absolute_url = line
                        else:
                            # Relative URL - make it absolute
                            absolute_url = base_url + line

                        # Proxy the segment URL (use absolute URL to backend)
                        encoded_url = urllib.parse.quote(absolute_url, safe='')
                        proxy_segment_url = f"http://localhost:8000/api/v1/proxy/stream?url={encoded_url}"
                        rewritten_lines.append(proxy_segment_url)
                    else:
                        rewritten_lines.append(line)

                rewritten_content = "\n".join(rewritten_lines)

                return StreamingResponse(
                    content=iter([rewritten_content.encode("utf-8")]),
                    media_type="application/vnd.apple.mpegurl",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600",
                    }
                )
            else:
                # Binary segment data - stream as-is
                return StreamingResponse(
                    content=response.iter_bytes(),
                    media_type=content_type or "video/mp2t",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600",
                    }
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to proxy stream: {str(e)}")
