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
    // We know the user is authenticated at this point
    const userId = session.user.id;
    
    // Connect to database
    await dbConnect()
    
    // Find the user by ID (more reliable than email)
    const userDoc = await User.findById(userId).lean()

    // If user not found, return 404
    if (!userDoc) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    try {
      // Serialize the user document to prevent client serialization issues
      const serializedUser = toClientData(userDoc)
      
      // Create a userData object from the serialized data
      const userData = serializedUser as any;
      
      // If nickname is missing but should be set, add it explicitly
      if (!userData.nickname && (userDoc as any).nickname) {
        userData.nickname = (userDoc as any).nickname;
      }
      
      // Add debug info in development
      const debugInfo = process.env.NODE_ENV === 'development' ? {
        userId,
        sessionId: session.user?.id,
        sessionEmail: session.user?.email,
      } : undefined;

      return NextResponse.json({ 
        user: userData,
        debug: debugInfo 
      })
    } catch (error) {
      // Fallback with minimal user data to prevent frontend errors
      return NextResponse.json({
        user: {
          _id: userId,
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
}); 