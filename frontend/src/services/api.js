import axios from 'axios'

// Use relative path for production (same domain), localhost for development
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Search anime
export const searchAnime = async (query, limit = 20) => {
  const response = await api.get('/search', {
    params: { q: query, limit },
  })
  return response.data
}

// Get anime episodes
export const getAnimeEpisodes = async (slug, name = null) => {
  const params = name ? { name } : {}
  const response = await api.get(`/anime/${slug}/episodes`, { params })
  return response.data
}

// Get stream URL for an episode
export const getStreamUrl = async (animeSlug, episodeSession, quality = 'best', audio = 'jpn') => {
  const response = await api.get(`/anime/${animeSlug}/episode/${episodeSession}/stream`, {
    params: { quality, audio },
  })
  return response.data
}

export const getAllStreams = async (animeSlug, episodeSession) => {
  const response = await api.get(`/anime/${animeSlug}/episode/${episodeSession}/streams`)
  return response.data
}

// Update anime cache
export const updateCache = async () => {
  const response = await api.post('/cache/update')
  return response.data
}

// Get airing anime
export const getAiringAnime = async () => {
  const response = await api.get('/airing')
  return response.data
}

// Get proxy URL for streaming (to bypass CORS)
export const getProxyUrl = (streamUrl) => {
  if (!streamUrl) return null
  return `${API_BASE_URL}/proxy/stream?url=${encodeURIComponent(streamUrl)}`
}

export default api
