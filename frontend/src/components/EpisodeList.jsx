import { Link } from 'react-router-dom'
import { Play, Clock, Calendar } from 'lucide-react'

function EpisodeList({ episodes, animeSlug, animeName }) {
  if (!episodes || episodes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No episodes found.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-white mb-4">
        Episodes ({episodes.length})
      </h2>
      
      <div className="grid gap-3">
        {episodes.map((episode) => (
          <Link
            key={episode.session}
            to={`/watch/${animeSlug}/${episode.session}?anime=${encodeURIComponent(animeName)}&ep=${episode.episode}`}
            className="group flex items-center p-4 bg-dark-800 rounded-lg hover:bg-dark-700 
                       transition-colors border border-transparent hover:border-primary-500/30"
          >
            {/* Episode number */}
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center 
                            bg-primary-600/20 rounded-lg mr-4 group-hover:bg-primary-600 
                            transition-colors">
              <span className="font-bold text-primary-400 group-hover:text-white">
                {episode.episode}
              </span>
            </div>

            {/* Episode info */}
            <div className="flex-grow min-w-0">
              <h3 className="font-medium text-white truncate">
                Episode {episode.episode}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                {episode.duration && (
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{episode.duration}</span>
                  </span>
                )}
                {episode.created_at && (
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(episode.created_at).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Play button */}
            <div className="flex-shrink-0 ml-4">
              <div className="w-10 h-10 flex items-center justify-center 
                              bg-primary-600 rounded-full opacity-0 group-hover:opacity-100 
                              transition-opacity">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default EpisodeList
