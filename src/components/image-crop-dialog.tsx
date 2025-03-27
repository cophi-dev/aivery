import { useState, useRef, useEffect } from 'react'
import ReactCrop, { type Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ImageCropDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (croppedImage: Blob) => void
  imageUrl: string
}

export function ImageCropDialog({ isOpen, onClose, onSave, imageUrl }: ImageCropDialogProps) {
  // Initialize with a centered square crop
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10
  })
  
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  // Reset crop when dialog opens
  useEffect(() => {
    if (isOpen && imageUrl) {
      console.log('ImageCropDialog opened with URL:', imageUrl)
      setCrop({
        unit: '%',
        width: 80,
        height: 80,
        x: 10,
        y: 10
      })
      setCompletedCrop(undefined)
      setIsImageLoaded(false)
    }
  }, [isOpen, imageUrl])

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current || !isImageLoaded) {
      console.log('Cannot save: missing requirements', {
        completedCrop: !!completedCrop,
        imgRef: !!imgRef.current,
        isImageLoaded
      })
      return
    }

    console.log('Starting save with crop:', completedCrop)
    
    const canvas = document.createElement('canvas')
    const image = imgRef.current
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    
    console.log('Image dimensions:', {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      displayWidth: image.width,
      displayHeight: image.height,
      scaleX,
      scaleY
    })

    // Calculate the size based on the smaller dimension to ensure we don't exceed image bounds
    const cropWidth = completedCrop.width * scaleX
    const cropHeight = completedCrop.height * scaleY
    
    // Use smaller dimension to ensure a square that fits within the crop area
    const size = Math.min(cropWidth, cropHeight)
    
    // Limit max size to prevent large images - 300px is sufficient for profile pictures
    const MAX_SIZE = 300
    const finalSize = size > MAX_SIZE ? MAX_SIZE : size
    
    canvas.width = finalSize
    canvas.height = finalSize
    
    console.log('Canvas dimensions:', {
      width: canvas.width,
      height: canvas.height
    })

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('No 2d context')
      return
    }

    try {
      // For smoother images when downscaling
      ctx.imageSmoothingQuality = 'high'
      
      // Draw the cropped image onto the canvas
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        finalSize,
        finalSize
      )

      // Convert to blob with reduced quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Blob created successfully:', {
              size: blob.size,
              type: blob.type
            })
            onSave(blob)
          } else {
            console.error('Failed to create blob')
          }
        },
        'image/png',
        0.7 // Lower quality to save space
      )
    } catch (e) {
      console.error('Error drawing image:', e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Crop Profile Picture</DialogTitle>
          <DialogDescription>
            Drag or resize the square to crop your profile picture.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          {imageUrl && (
            <div className="relative max-h-[500px] overflow-hidden flex justify-center">
              <ReactCrop
                crop={crop}
                aspect={1}
                onChange={(_, percentCrop) => {
                  // Force aspect ratio 1:1 for a perfect square
                  setCrop(percentCrop)
                }}
                onComplete={(c) => {
                  console.log('Crop completed:', c)
                  setCompletedCrop(c)
                }}
                circularCrop={false}
                minWidth={50}
                className="flex justify-center"
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imageUrl}
                  style={{ 
                    maxHeight: '500px',
                    objectFit: 'contain'
                  }}
                  onLoad={(e) => {
                    console.log('Image loaded:', {
                      width: e.currentTarget.width,
                      height: e.currentTarget.height
                    })
                    setIsImageLoaded(true)
                  }}
                />
              </ReactCrop>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!completedCrop || !isImageLoaded}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 