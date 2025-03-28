import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"

interface UserDocument {
  _id: any;
  name?: string;
  email?: string;
  image?: string;
  [key: string]: any;
}

export async function POST(request: Request) {
  try {
    // Connect to database early
    await dbConnect()
    
    // Check authentication
    const session = await getServerSession(authOptions)
    
    let userEmail = session?.user?.email
    let userId = session?.user?.id
    
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    
    const { image, email } = body
    
    // If no session, try to use email from request (development only)
    if (!userEmail && email) {
      userEmail = email
    }
    
    // Ensure we have user identification
    if (!userEmail && !userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Validate image data
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: "Invalid image data. Expected base64 encoded image." },
        { status: 400 }
      )
    }

    // Check image size (1MB limit)
    const sizeInKB = Math.round(image.length * 0.75 / 1024)
    const maxSizeKB = 1024
    if (sizeInKB > maxSizeKB) {
      return NextResponse.json(
        { error: `Image too large (${sizeInKB}KB). Maximum size is ${maxSizeKB}KB.` },
        { status: 400 }
      )
    }

    // Prepare query - use user ID if available, otherwise email
    const query = userId ? { _id: userId } : { email: userEmail }
    
    // Update user's image in database
    const updatedUser = await User.findOneAndUpdate(
      query,
      { $set: { image: image } },
      { new: true }
    ).lean() as UserDocument | null;

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      message: "Profile image updated successfully",
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name || 'User',
        imageUpdated: true
      }
    })
  } catch (error) {
    console.error("Error updating profile image:", error)
    return NextResponse.json(
      { error: "Failed to update profile image" },
      { status: 500 }
    )
  }
} 