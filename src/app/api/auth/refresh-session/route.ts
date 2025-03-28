import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
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
    
    // Log the image information for debugging
    if (user.image) {
      console.log(`User image found in DB: ${user.image.substring(0, 30)}... (${Math.round(user.image.length / 1024)}KB)`);
    } else {
      console.log("No image found for user in DB");
    }
    
    // Force update the session with the latest user data
    // This approach works around issues with NextAuth's session handling
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/session`, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    
    // Return the refreshed user data
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image,
        // Include image data size for debugging
        imageSize: user.image ? Math.round(user.image.length / 1024) + "KB" : "No image"
      },
      message: "Session refreshed with latest user data"
    });
  } catch (error) {
    console.error("Error refreshing session:", error);
    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
  }
} 