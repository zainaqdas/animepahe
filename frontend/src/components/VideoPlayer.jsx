import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, SkipBack, SkipForward } from 'lucide-react'

function VideoPlayer({ playlistUrl, title }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const controlsTimeoutRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playlistUrl) return

    setLoading(true)
    setError(null)

    let hls

    if (Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        xhrSetup: (xhr, url) => {
          // Don't double-proxy already proxied URLs
          if (url.includes('/api/v1/proxy/stream')) {
            xhr.open('GET', url, true)
          } else {
            // Route all requests through backend proxy to bypass CORS
            const proxyUrl = `http://localhost:8000/api/v1/proxy/stream?url=${encodeURIComponent(url)}`
            xhr.open('GET', proxyUrl, true)
          }
        }
      })

      hls.loadSource(playlistUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        video.play().catch(() => {
          // Auto-play blocked, user needs to interact
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. Please check your connection.')
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. The video format may not be supported.')
              break
            default:
              setError('An error occurred while playing the video.')
          }
          setLoading(false)
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = playlistUrl
      video.addEventListener('loadedmetadata', () => {
        setLoading(false)
      })
    } else {
      setError('Your browser does not support HLS streaming.')
      setLoading(false)
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [playlistUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateDuration)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateDuration)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    const video = videoRef.current
    if (video) {
      video.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value)
    const video = videoRef.current
    if (video) {
      video.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!isFullscreen) {
      container.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  const skip = (seconds) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
    }
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="aspect-video bg-dark-800 rounded-xl flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-gray-500 text-sm">
            The video may not be available or your browser doesn't support the format.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        onClick={togglePlay}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent 
                    transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Title */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <h3 className="text-white font-medium truncate">{title}</h3>
        </div>

        {/* Center play button */}
        {!isPlaying && !loading && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       w-20 h-20 bg-primary-600/90 rounded-full flex items-center justify-center
                       hover:bg-primary-500 transition-colors"
          >
            <Play className="w-10 h-10 text-white ml-1" />
          </button>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none 
                         [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                         [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-primary-400 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>

              {/* Skip backward */}
              <button
                onClick={() => skip(-10)}
                className="text-white hover:text-primary-400 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(10)}
                className="text-white hover:text-primary-400 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-primary-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none 
                             [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 
                             [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* Time display */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-primary-400 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
