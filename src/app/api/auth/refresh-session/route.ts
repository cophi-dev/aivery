import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongoose";
import User from "@/lib/db/models/user";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Connect to MongoDB
    await dbConnect();
    
    // Fetch the latest user data
    const userDoc = await User.findById(session.user.id)
      .select("name email image")
      .lean();
    
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Use type assertion to handle MongoDB document type
    const user = userDoc as any;
    
    // Return the refreshed user data
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        // Include image data size for debugging
        imageSize: user.image ? Math.round(user.image.length / 1024) + "KB" : "No image"
      }
    });
  } catch (error) {
    console.error("Error refreshing session:", error);
    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
  }
} 