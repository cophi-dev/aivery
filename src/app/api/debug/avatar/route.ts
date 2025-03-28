import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get user document
    const user = await User.findOne({ email: session.user.email }).lean();
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Check if user has an image property
    const hasImage = !!(user as any).image;
    const imageSize = hasImage ? Math.round((user as any).image.length / 1024) : 0;
    const imageSample = hasImage ? (user as any).image.substring(0, 50) + "..." : null;
    
    // Return debug information about the user's avatar
    return NextResponse.json({
      user: {
        id: (user as any)._id.toString(),
        email: (user as any).email,
        hasImage: hasImage,
        imageSize: `${imageSize}KB`,
        imageSample: imageSample
      },
      message: hasImage 
        ? `User has an image stored (${imageSize}KB)` 
        : "User does not have an image stored"
    });
  } catch (error) {
    console.error("Error getting user avatar debug info:", error);
    return NextResponse.json(
      { error: "Failed to get user avatar debug info" },
      { status: 500 }
    );
  }
} 