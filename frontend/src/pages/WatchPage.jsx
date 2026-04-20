import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getAllStreams, getAnimeEpisodes } from '../services/api'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw, Download } from 'lucide-react'

function WatchPage() {
  const { animeSlug, episodeSession } = useParams()
  const [searchParams] = useSearchParams()
  const animeName = searchParams.get('anime') || 'Unknown Anime'
  const currentEpNumber = parseInt(searchParams.get('ep')) || 1

  const [streams, setStreams] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStream, setSelectedStream] = useState(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Fetch all stream options
  useEffect(() => {
    const fetchStreams = async () => {
      setLoading(true)
      setError(null)
      setIframeLoaded(false)
      try {
        const data = await getAllStreams(animeSlug, episodeSession)
        if (data.error) {
          setError(data.error)
        } else if (data.streams && data.streams.length > 0) {
          setStreams(data.streams)
          // Select highest quality by default (sorted by resolution descending)
          const sortedStreams = [...data.streams].sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution))
          setSelectedStream(sortedStreams[0])
        } else {
          setError('No streams available for this episode')
        }
      } catch (err) {
        console.error('Failed to fetch streams:', err)
        setError('Failed to load video stream. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchStreams()
  }, [animeSlug, episodeSession])

  // Fetch all episodes for navigation
  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        const data = await getAnimeEpisodes(animeSlug, animeName)
        setEpisodes(data.episodes || [])
      } catch (err) {
        console.error('Failed to fetch episodes:', err)
      }
    }

    fetchEpisodes()
  }, [animeSlug, animeName])

  const currentIndex = episodes.findIndex(ep => ep.session === episodeSession)
  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null
  const nextEpisode = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null

  return (
    <div className="animate-fade-in">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/anime/${animeSlug}?name=${encodeURIComponent(animeName)}`}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Episodes</span>
        </Link>

        {/* Quality Selector */}
        {streams.length > 0 && (
          <>
            <select
              value={selectedStream?.src || ''}
              onChange={(e) => setSelectedStream(streams.find(s => s.src === e.target.value))}
              className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg
                         text-white text-sm focus:border-primary-500 focus:outline-none"
            >
              {streams.map((stream) => (
                <option key={stream.src} value={stream.src}>
                  {stream.fansub || 'Unknown'} · {stream.resolution}p
                </option>
              ))}
            </select>

            {/* Download Button */}
            {selectedStream?.src && (
              <a
                href={selectedStream.src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500
                           text-white text-sm rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
            )}
          </>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-white">{animeName}</h1>
        <p className="text-gray-400">Episode {currentEpNumber}</p>
      </div>

      {/* Video Player - Iframe-based like animepahe.pw */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800">
            <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800">
            <div className="text-center p-6">
              <p className="text-red-400 mb-2">{error}</p>
            </div>
          </div>
        ) : selectedStream?.src ? (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-800 z-10 cursor-pointer" onClick={() => setIframeLoaded(true)}>
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 text-primary-400 mx-auto mb-2 animate-spin" />
                  <p className="text-white">Click to load</p>
                </div>
              </div>
            )}
            <iframe
              src={iframeLoaded ? selectedStream.src : 'about:blank'}
              className="w-full h-full border-0"
              allowFullScreen
              allow="autoplay; encrypted-media"
              onLoad={() => setIframeLoaded(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800">
            <div className="text-center p-6">
              <p className="text-gray-400">No video stream available.</p>
            </div>
          </div>
        )}

        {/* Previous Episode Preview */}
        {prevEpisode && (
          <Link
            to={`/watch/${animeSlug}/${prevEpisode.session}?anime=${encodeURIComponent(animeName)}&ep=${prevEpisode.episode}`}
            className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center space-y-2 px-4 py-2 bg-dark-900/80 hover:bg-dark-800 rounded-lg transition-colors z-20"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
            <span className="text-white text-sm">Previous</span>
          </Link>
        )}

        {/* Next Episode Preview */}
        {nextEpisode && (
          <Link
            to={`/watch/${animeSlug}/${nextEpisode.session}?anime=${encodeURIComponent(animeName)}&ep=${nextEpisode.episode}`}
            className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center space-y-2 px-4 py-2 bg-dark-900/80 hover:bg-dark-800 rounded-lg transition-colors z-20"
          >
            <ChevronRight className="w-6 h-6 text-white" />
            <span className="text-white text-sm">Next</span>
          </Link>
        )}
      </div>

      {/* Episode Navigation */}
      {episodes.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          {prevEpisode ? (
            <Link
              to={`/watch/${animeSlug}/${prevEpisode.session}?anime=${encodeURIComponent(animeName)}&ep=${prevEpisode.episode}`}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-dark-800 
                         hover:bg-dark-700 text-white rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Episode {prevEpisode.episode}</span>
            </Link>
          ) : <div />}

          {nextEpisode ? (
            <Link
              to={`/watch/${animeSlug}/${nextEpisode.session}?anime=${encodeURIComponent(animeName)}&ep=${nextEpisode.episode}`}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 
                         hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              <span>Episode {nextEpisode.episode}</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          ) : <div />}
        </div>
      )}

      {/* All Episodes Quick Links */}
      {episodes.length > 0 && (
        <div className="mt-8 pt-6 border-t border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-4">All Episodes</h3>
          <div className="flex flex-wrap gap-2">
            {episodes.map((ep) => (
              <Link
                key={ep.session}
                to={`/watch/${animeSlug}/${ep.session}?anime=${encodeURIComponent(animeName)}&ep=${ep.episode}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                           ${ep.session === episodeSession
                             ? 'bg-primary-600 text-white'
                             : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white'
                           }`}
              >
                {ep.episode}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WatchPage
