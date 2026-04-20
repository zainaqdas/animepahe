import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'

function App() {
  return (
    <div className="min-h-screen bg-dark-900">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/anime/:slug" element={<AnimePage />} />
          <Route path="/watch/:animeSlug/:episodeSession" element={<WatchPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
