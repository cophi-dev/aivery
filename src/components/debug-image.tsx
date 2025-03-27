import { useState, useEffect } from 'react'

interface DebugImageProps {
  src: string
}

export function DebugImage({ src }: DebugImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [fileExists, setFileExists] = useState<boolean | null>(null)
  const [isBase64, setIsBase64] = useState(false)
  const [isBlob, setIsBlob] = useState(false)
  const [base64Length, setBase64Length] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  useEffect(() => {
    // Reset states when src changes
    setStatus('loading')
    setErrorMessage(null)
    
    // Check what type of image source we have
    if (!src) {
      setStatus('error')
      setErrorMessage('No image source provided')
      return
    }
    
    if (src.startsWith('data:')) {
      // Base64 image
      setIsBase64(true)
      setIsBlob(false)
      setBase64Length(src.length)
      setFileExists(null) // Not applicable for base64
      console.log(`Base64 image detected: ${src.substring(0, 30)}... (${Math.round(src.length / 1024)}KB)`)
    } else if (src.startsWith('blob:')) {
      // Blob URL
      setIsBase64(false)
      setIsBlob(true)
      setFileExists(null) // Not applicable for blobs
      console.log(`Blob URL detected: ${src}`)
    } else if (src.startsWith('/')) {
      // File path
      setIsBase64(false)
      setIsBlob(false)
      
      // Check if file exists
      const checkFile = async () => {
        try {
          // Add cache-busting parameter
          const response = await fetch(`${src}?check=${Date.now()}`, {
            method: 'HEAD'
          })
          setFileExists(response.ok)
          console.log(`File check for ${src}: ${response.ok ? 'exists' : 'not found'}, status: ${response.status}`)
          
          if (!response.ok) {
            setErrorMessage(`File not found: ${response.status} ${response.statusText}`)
          }
        } catch (error) {
          console.error(`Error checking file ${src}:`, error)
          setFileExists(false)
          setErrorMessage(`Error checking file: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      checkFile()
    } else {
      // Unknown format
      setIsBase64(false)
      setIsBlob(false)
      setFileExists(null)
      console.log(`Unknown image source format: ${src}`)
    }
  }, [src])
  
  useEffect(() => {
    if (!src) {
      setStatus('error')
      setErrorMessage('No image source provided')
      return
    }
    
    const img = new Image()
    
    img.onload = () => {
      setStatus('success')
      setDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
      setErrorMessage(null)
    }
    
    img.onerror = (e) => {
      setStatus('error')
      setErrorMessage(`Failed to load image: ${e instanceof Error ? e.message : 'Unknown error'}`)
      console.error('Image load error:', e)
    }
    
    img.src = src
    
    return () => {
      // Clean up to prevent memory leaks
      img.onload = null
      img.onerror = null
    }
  }, [src])
  
  return (
    <div className="p-4 border rounded-md">
      <h3 className="font-medium mb-2">Image Debug</h3>
      <p className="text-sm mb-2">
        Source: {isBase64 
          ? `Base64 image (${(base64Length / 1024).toFixed(1)}KB)` 
          : isBlob
            ? `Blob URL: ${src}`
            : (src || 'none')}
      </p>
      <p className="text-sm mb-2">
        Type: {
          isBase64 
            ? 'Base64 encoded (stored in MongoDB)' 
            : isBlob
              ? 'Blob URL (temporary browser memory)'
              : 'File path (stored on filesystem)'
        }
      </p>
      <p className="text-sm mb-2">
        Status: 
        {status === 'loading' && <span className="text-yellow-500"> Loading...</span>}
        {status === 'success' && <span className="text-green-500"> Loaded successfully</span>}
        {status === 'error' && <span className="text-red-500"> Failed to load</span>}
      </p>
      
      {errorMessage && (
        <p className="text-sm text-red-500 mb-2">{errorMessage}</p>
      )}
      
      {fileExists !== null && (
        <p className="text-sm mb-2">
          File check: 
          {fileExists === true && <span className="text-green-500"> File exists on server</span>}
          {fileExists === false && <span className="text-red-500"> File not found on server</span>}
        </p>
      )}
      
      {status === 'success' && (
        <p className="text-sm">Dimensions: {dimensions.width} x {dimensions.height}px</p>
      )}
      
      {src && (
        <div className="mt-2 max-w-[200px]">
          <img 
            src={src} 
            alt="Debug preview" 
            className="border border-dashed border-gray-300 max-w-full h-auto"
            onError={() => setStatus('error')}
          />
        </div>
      )}
    </div>
  )
} 