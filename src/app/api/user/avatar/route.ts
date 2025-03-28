import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { withDatabase } from "@/lib/db/middleware"
import User from "@/lib/db/models/user"
import dbConnect from "@/lib/db/mongodb"
import UserModel from '@/lib/db/models/user'

// Helper function to properly serialize MongoDB objects
function serializeDocument(doc: any): any {
  if (!doc) return null;
  
  // Create a plain object without MongoDB methods
  const result: any = { ...doc };
  
  // Convert _id to string if it exists
  if (result._id) {
    result._id = result._id.toString();
  }
  
  // Handle other MongoDB specific properties
  if (result.__v !== undefined) {
    delete result.__v;
  }
  
  return result;
}

// Simple API endpoint that returns the user's avatar image
export const GET = (request: NextRequest) => withDatabase(request, async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Connect to DB
    await dbConnect()
    
    // Get user ID from query params if exists, otherwise use authenticated user
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get("userId")
    const userId = queryUserId || session.user.id
    
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 })
    }
    
    // Find user (no need to call dbConnect() manually, it's handled by the middleware)
    const userDoc = await UserModel.findById(userId).select("name image").lean()
    
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    // Properly serialize the document
    const user = serializeDocument(userDoc)
    
    // Set cache headers for 1 hour to reduce frequent requests
    const headers = {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    }
    
    // Return image data
    return NextResponse.json({ 
      image: user.image || null,
      name: user.name || null
    }, { headers })
  } catch (error) {
    console.error("Error getting avatar:", error)
    return NextResponse.json({ error: "Failed to get avatar" }, { status: 500 })
  }
}) 