import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"
import { toClientData } from "@/lib/db/utils"
import { withApiAuth } from "@/lib/auth-utils"

// Main handler wrapped with authentication
export const GET = withApiAuth(async (request: NextRequest, session: any) => {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      console.error("Authentication failed in GET /api/user route")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    console.log("Getting user data for:", session.user.id)
    
    // Connect to database
    await dbConnect()
    
    // Find the user by ID with all needed fields
    const user = await User.findById(session.user.id)
      .select('name email nickname image height weight age gender activityLevel aiPreferences')
      .lean()
    
    if (!user) {
      console.error("User not found in GET /api/user route")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    console.log("Returning user data with physical info:", {
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      activityLevel: user.activityLevel
    })
    
    console.log("Returning user data with AI preferences:", user.aiPreferences || "None")
    
    // Return user data
    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    console.error("Error getting user data:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}); 