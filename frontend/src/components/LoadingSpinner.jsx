import { Loader2 } from 'lucide-react'

function LoadingSpinner({ size = 24, className = '' }) {
  return (
    <Loader2 
      className={`animate-spin text-primary-400 ${className}`} 
      size={size} 
    />
  )
}

export default LoadingSpinner
