import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

function SearchBar({ onSearch, loading = false, placeholder = "Search for anime..." }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400 group-focus-within:text-primary-400 transition-colors" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-4 bg-dark-800 border border-dark-600 rounded-xl 
                     text-white placeholder-gray-500
                     focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                     transition-all duration-200"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-2 bottom-2 px-6 bg-primary-600 hover:bg-primary-500 
                     disabled:bg-dark-600 disabled:cursor-not-allowed
                     text-white font-medium rounded-lg transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  )
}

export default SearchBar
