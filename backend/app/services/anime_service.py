"""
Service layer for interacting with the anime_downloader library.
"""

import sys
import os
from typing import List, Dict, Any, Optional

# Add the anime_downloader library to the path
# Try multiple possible paths (local dev and Docker)
possible_paths = [
    '/home/zainu/Downloads/animepahe-dl',
    '/app/animepahe-dl',
    os.path.join(os.path.dirname(__file__), '../../../../animepahe-dl'),
    os.path.join(os.path.dirname(__file__), '../../../animepahe-dl'),
]

for path in possible_paths:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)
        break

from anime_downloader.api.client import AnimePaheAPI
from anime_downloader.utils import constants


class AnimeService:
    """Service wrapper for AnimePahe API interactions."""
    
    _instance = None
    _api = None
    
    def __new__(cls):
        """Singleton pattern to ensure single API instance."""
        if cls._instance is None:
            cls._instance = super(AnimeService, cls).__new__(cls)
            cls._api = AnimePaheAPI(verify_ssl=False)
        return cls._instance
    
    def search(self, query: str) -> List[Dict[str, str]]:
        """Search for anime by query string."""
        return self._api.search(query)
    
    def get_episodes(self, anime_name: str, anime_slug: str) -> List[Dict[str, Any]]:
        """Get all episodes for an anime."""
        return self._api.fetch_episode_data(anime_name, anime_slug)
    
    def get_stream_url(
        self, 
        anime_slug: str, 
        episode_session: str, 
        quality: str = "best",
        audio: str = "jpn"
    ) -> Optional[str]:
        """Get the stream URL for an episode."""
        return self._api.get_stream_url(anime_slug, episode_session, quality, audio)
    
    def get_playlist_url(self, stream_url: str) -> Optional[str]:
        """Extract m3u8 playlist URL from stream page."""
        return self._api.get_playlist_url(stream_url)

    def get_all_streams(
        self, anime_slug: str, episode_session: str
    ) -> List[Dict[str, Any]]:
        """Get all available stream options for an episode."""
        play_url = f"{constants.PLAY_URL}/{anime_slug}/{episode_session}"
        response = self._api._request(play_url)
        if not response:
            return []

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.data, "html.parser")
        buttons = soup.find_all("button", attrs={"data-src": True, "data-av1": "0"})

        streams = []
        for b in buttons:
            streams.append({
                "src": b.get("data-src") or "",
                "fansub": b.get("data-fansub"),
                "resolution": b.get("data-resolution") or "0",
                "audio": b.get("data-audio") or "jpn",
                "av1": b.get("data-av1") or "0"
            })

        return streams
    
    def update_cache(self) -> int:
        """Update the anime list cache."""
        return self._api.download_anime_list_cache()
    
    def get_airing_anime(self) -> List[Dict[str, Any]]:
        """Get currently airing anime."""
        return self._api.check_for_updates()
    
    def get_base_url(self) -> str:
        """Get the base URL for AnimePahe."""
        return constants.get_base_url()
