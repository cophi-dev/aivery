import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import User from "@/lib/db/models/user"
import { toClientData } from "@/lib/db/utils"

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      console.log("Unauthorized access attempt to user API");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Connect to database
    await dbConnect()
    
    // Find the user by ID (more reliable than email)
    const userDoc = await User.findById(session.user.id).lean()

    // If user not found, return 404
    if (!userDoc) {
      console.log("User not found:", session.user.id);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    try {
      // Serialize the user document to prevent client serialization issues
      const serializedUser = toClientData(userDoc)
      return NextResponse.json({ user: serializedUser })
    } catch (error) {
      console.error("Error serializing user data:", error);
      
      // Fallback with minimal user data to prevent frontend errors
      return NextResponse.json({
        user: {
          _id: session.user.id,
          name: session.user.name || "User",
          email: session.user.email,
          image: session.user.image,
          plans: []
        },
        warning: "Limited user data returned due to serialization issues"
      })
    }
  } catch (error) {
    console.error("Error in user API route:", error)
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    )
  }
} 