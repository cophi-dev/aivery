import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";

// Explicitly mark this route as dynamic
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get email from query params
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    
    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get user document directly (bypassing auth for debugging)
    const user = await User.findOne({ email }).lean();
    
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
    
    // Return information about the user's image
    return NextResponse.json({
      user: {
        id: (user as any)._id.toString(),
        email: (user as any).email,
        hasImage: hasImage,
        imageSize: `${imageSize}KB`,
        imageSample: imageSample,
        // Only include the full image if it's not too large
        fullImage: imageSize < 100 ? (user as any).image : null
      },
      message: hasImage 
        ? `User has an image stored in DB (${imageSize}KB)` 
        : "User does not have an image stored in DB"
    });
  } catch (error) {
    console.error("Error checking user image:", error);
    return NextResponse.json(
      { error: "Failed to check user image" },
      { status: 500 }
    );
  }
} 