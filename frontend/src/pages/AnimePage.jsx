import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getAnimeEpisodes } from '../services/api'
import EpisodeList from '../components/EpisodeList'
import LoadingSpinner from '../components/LoadingSpinner'
import { ArrowLeft, Film, Play } from 'lucide-react'

function AnimePage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const animeName = searchParams.get('name') || slug

  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEpisodes = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getAnimeEpisodes(slug, animeName)
        setAnime(data)
      } catch (err) {
        console.error('Failed to fetch episodes:', err)
        setError('Failed to load episodes. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchEpisodes()
  }, [slug, animeName])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <Link
          to="/"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 
                     hover:bg-primary-500 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center space-x-2 text-gray-400 hover:text-white 
                   transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Search</span>
      </Link>

      {/* Anime Header */}
      <div className="mb-8">
        <div className="flex items-start space-x-4 md:space-x-6">
          {/* Poster placeholder */}
          <div className="flex-shrink-0 w-32 md:w-48 aspect-[3/4] bg-dark-800 rounded-xl 
                          flex items-center justify-center">
            <Film className="w-16 h-16 md:w-24 md:h-24 text-dark-600" />
          </div>

          {/* Anime info */}
          <div className="flex-grow">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
              {anime?.name}
            </h1>
            
            <div className="flex items-center space-x-4 text-gray-400 text-sm mb-4">
              <span>{anime?.total_episodes || 0} Episodes</span>
            </div>

            {/* Quick play first episode */}
            {anime?.episodes && anime.episodes.length > 0 && (
              <Link
                to={`/watch/${slug}/${anime.episodes[0].session}?anime=${encodeURIComponent(anime.name)}&ep=${anime.episodes[0].episode}`}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 
                           hover:bg-primary-500 text-white font-medium rounded-lg 
                           transition-colors"
              >
                <Play className="w-5 h-5" />
                <span>Watch Episode 1</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Episodes List */}
      {anime && (
        <EpisodeList
          episodes={anime.episodes}
          animeSlug={slug}
          animeName={anime.name}
        />
      )}
    </div>
  )
}

export default AnimePage
