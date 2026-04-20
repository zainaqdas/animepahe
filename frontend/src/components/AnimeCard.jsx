import { Link } from 'react-router-dom'
import { Play, Film } from 'lucide-react'

function AnimeCard({ anime }) {
  return (
    <Link
      to={`/anime/${anime.session}?name=${encodeURIComponent(anime.title)}`}
      className="group block bg-dark-800 rounded-xl overflow-hidden card-hover"
    >
      <div className="relative aspect-[3/4] bg-dark-700">
        {/* Placeholder for anime poster */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-16 h-16 text-dark-600" />
        </div>
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 
                            bg-primary-600 rounded-full transform scale-0 group-hover:scale-100 
                            transition-transform duration-300">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-2 group-hover:text-primary-400 transition-colors">
          {anime.title}
        </h3>
      </div>
    </Link>
  )
}

export default AnimeCard
