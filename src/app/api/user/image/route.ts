import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"

// Helper function to compress image data
async function optimizeBase64Image(base64Data: string): Promise<string> {
  try {
    // If the image is already small, just return it
    if (base64Data.length < 20000) { // 20KB is pretty small already
      console.log('Image already small enough, skipping optimization')
      return base64Data
    }
    
    // Create an image element to redraw the image at a smaller size
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas')
        
        // Max dimensions for profile picture - 150px is plenty
        const MAX_SIZE = 150
        
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }
        
        // Set canvas size
        canvas.width = width
        canvas.height = height
        
        // Draw image with high quality
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to more compressed format
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.7)
        
        console.log(`Image optimized: ${base64Data.length} → ${optimizedBase64.length} bytes (${Math.round((optimizedBase64.length / base64Data.length) * 100)}% of original)`)
        
        resolve(optimizedBase64)
      }
      
      img.onerror = () => reject(new Error('Failed to load image for optimization'))
      img.src = base64Data
    })
  } catch (error) {
    console.error('Error optimizing image:', error)
    return base64Data // Fallback to original if optimization fails
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.error('No authenticated session found')
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Parse request body to get base64 image data
    const body = await request.json()
    const { image } = body
    
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      console.error('Invalid image data provided')
      return NextResponse.json(
        { error: "Invalid image data. Expected base64 encoded image." },
        { status: 400 }
      )
    }

    // Log the size of the base64 image
    console.log(`Received base64 image of length: ${image.length} characters`)
    console.log(`First 30 chars: ${image.substring(0, 30)}...`)
    const sizeInKB = Math.round(image.length * 0.75 / 1024) // Approximate size in KB
    console.log(`Approximate image size: ${sizeInKB}KB`)

    // Size limit check (1MB)
    const maxSizeKB = 1024 // 1MB in KB
    if (sizeInKB > maxSizeKB) {
      console.error(`Image too large: ${sizeInKB}KB exceeds ${maxSizeKB}KB limit`)
      return NextResponse.json(
        { error: `Image too large (${sizeInKB}KB). Maximum size is ${maxSizeKB}KB.` },
        { status: 400 }
      )
    }

    // Connect to database
    await dbConnect()
    
    // Update user's image in database
    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      { image: image },
      { new: true }
    )

    if (!updatedUser) {
      console.error(`User not found with email: ${session.user.email}`)
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Log success with image details
    console.log(
      `Image saved successfully. Size: ${Math.round(image.length / 1024)}KB, First chars: ${image.substring(0, 30)}...`
    )

    // Return success with the new image data
    return NextResponse.json({ 
      message: "Profile image updated",
      imageLength: image.length,
      imageSample: image.substring(0, 30) + "..." 
    })
  } catch (error) {
    console.error("Error updating profile image:", error)
    return NextResponse.json(
      { error: "Failed to update profile image" },
      { status: 500 }
    )
  }
} 