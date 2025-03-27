import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongoose"
import User from "@/lib/db/models/user"

// Simple API endpoint that returns the user's avatar image
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session?.user) {
      console.error("No authenticated session found")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Get user ID from query params if exists, otherwise use authenticated user
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get("userId")
    const userId = queryUserId || session.user.id
    
    if (!userId) {
      console.error("No userId found in session")
      return NextResponse.json({ error: "User ID not found" }, { status: 400 })
    }
    
    // Connect to database
    await dbConnect()
    
    // Find user
    const userDoc = await User.findById(userId).select("image name").lean()
    
    if (!userDoc) {
      console.error(`User not found for ID: ${userId}`)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    // Use a type assertion to handle the document
    const user = userDoc as any
    
    // Enhanced logging to debug issues
    console.log(`User found: id=${userId}, name=${user.name || 'unknown'}`)
    console.log(`Has image property: ${user.hasOwnProperty('image')}`)
    
    // Log image information
    if (user.image) {
      console.log(`Found avatar image: ${user.image.substring(0, 30)}... (${Math.round(user.image.length / 1024)}KB)`)
    } else {
      console.log("No avatar image found for user")
    }
    
    // Return image data
    return NextResponse.json({ 
      image: user.image || null,
      name: user.name || null
    })
  } catch (error) {
    console.error("Error getting avatar:", error)
    return NextResponse.json({ error: "Failed to get avatar" }, { status: 500 })
  }
} 