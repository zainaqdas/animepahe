import { Link } from 'react-router-dom'
import { Search, Tv, Menu, X } from 'lucide-react'
import { useState } from 'react'

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <Tv className="w-8 h-8 text-primary-400 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold gradient-text">AnimePahe</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-300 hover:text-white transition-colors flex items-center space-x-1"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-700">
            <Link
              to="/"
              className="block py-2 text-gray-300 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Search
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}

export default Header
