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
    
    // Find the user by ID with all needed fields, including tier
    const user = await User.findById(session.user.id)
      .select('name email nickname image height weight age gender activityLevel aiPreferences tier')
      .lean()
    
    if (!user) {
      console.error("User not found in GET /api/user route")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    // Use type assertion for TypeScript
    const typedUser = user as any;

    console.log("Returning user data with physical info:", {
      height: typedUser.height,
      weight: typedUser.weight,
      age: typedUser.age,
      gender: typedUser.gender,
      activityLevel: typedUser.activityLevel
    })
    
    console.log("Returning user data with AI preferences:", typedUser.aiPreferences || "None")
    console.log("Returning user tier:", typedUser.tier || "Free")
    
    // Return only necessary user data explicitly
    const clientUserData = {
        id: typedUser._id.toString(), // Ensure ID is a string
        name: typedUser.name,
        email: typedUser.email,
        image: typedUser.image,
        tier: typedUser.tier || 'Free' // Default to 'Free' if tier is missing
        // Add other fields here ONLY if explicitly needed by the client
    };

    return NextResponse.json({ user: clientUserData }, { status: 200 })
  } catch (error) {
    console.error("Error getting user data:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}); 