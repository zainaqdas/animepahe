import { useState } from 'react'
import SearchBar from '../components/SearchBar'
import AnimeCard from '../components/AnimeCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { searchAnime, updateCache } from '../services/api'
import { RefreshCw, Tv, Film, Sparkles } from 'lucide-react'

function HomePage() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [updatingCache, setUpdatingCache] = useState(false)

  const handleSearch = async (query) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const data = await searchAnime(query)
      setResults(data)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCache = async () => {
    setUpdatingCache(true)
    try {
      await updateCache()
      alert('Anime cache updated successfully!')
    } catch (error) {
      console.error('Cache update failed:', error)
      alert('Failed to update cache. Please try again.')
    } finally {
      setUpdatingCache(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="text-center py-12 md:py-16">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary-600/20 rounded-2xl">
            <Tv className="w-12 h-12 text-primary-400" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">AnimePahe Web</span>
        </h1>
        <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
          Search and stream your favorite anime directly in your browser. 
          High-quality video with a seamless viewing experience.
        </p>
        
        {/* Search Bar */}
        <SearchBar 
          onSearch={handleSearch} 
          loading={loading} 
          placeholder="Search for anime (e.g., Attack on Titan, Demon Slayer...)"
        />

        {/* Update Cache Button */}
        <div className="mt-6">
          <button
            onClick={handleUpdateCache}
            disabled={updatingCache}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-dark-800 
                       hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg
                       transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${updatingCache ? 'animate-spin' : ''}`} />
            <span>{updatingCache ? 'Updating...' : 'Update Anime Cache'}</span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="mt-8 animate-slide-up">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size={48} />
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Search Results
                </h2>
                <span className="text-gray-500 text-sm">
                  {results.length} anime found
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.map((anime) => (
                  <AnimeCard key={anime.session} anime={anime} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-dark-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No results found
              </h3>
              <p className="text-gray-500">
                Try searching with a different keyword or update the anime cache.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Features Section (shown when no search) */}
      {!hasSearched && (
        <div className="mt-16 grid md:grid-cols-3 gap-6 animate-slide-up">
          <div className="p-6 bg-dark-800 rounded-xl">
            <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              High Quality Streaming
            </h3>
            <p className="text-gray-400">
              Watch anime in up to 1080p quality with smooth playback and minimal buffering.
            </p>
          </div>
          
          <div className="p-6 bg-dark-800 rounded-xl">
            <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4">
              <Tv className="w-6 h-6 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Extensive Library
            </h3>
            <p className="text-gray-400">
              Search through thousands of anime titles with our regularly updated cache.
            </p>
          </div>
          
          <div className="p-6 bg-dark-800 rounded-xl">
            <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-4">
              <Film className="w-6 h-6 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Easy Episode Access
            </h3>
            <p className="text-gray-400">
              Browse and watch any episode instantly. No downloads required.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
