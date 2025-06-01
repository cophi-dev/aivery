import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { setNoCacheHeaders } from "@/app/api/force-dynamic";
import { getToken } from 'next-auth/jwt';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Set cache control headers
    const response = NextResponse.next();
    setNoCacheHeaders(response.headers);
    
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session?.user) {
      const errorResponse = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      setNoCacheHeaders(errorResponse.headers);
      return errorResponse;
    }
    
    // Connect to MongoDB
    await dbConnect();
    
    // Fetch the latest user data
    const userDoc = await User.findById(session.user.id)
      .select("name email image")
      .lean();
    
    if (!userDoc) {
      const errorResponse = NextResponse.json({ error: "User not found" }, { status: 404 });
      setNoCacheHeaders(errorResponse.headers);
      return errorResponse;
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
    const sessionResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/session`, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    
    // Return the refreshed user data
    const finalResponse = NextResponse.json({
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
    
    // Apply cache-busting headers to final response
    setNoCacheHeaders(finalResponse.headers);
    return finalResponse;
  } catch (error) {
    console.error("Error refreshing session:", error);
    const errorResponse = NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
    setNoCacheHeaders(errorResponse.headers);
    return errorResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Connect to database and get fresh user data
    await dbConnect();
    const user = await User.findById(session.user.id).select('tier email').lean();
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tier = (user as any).tier || 'free';
    
    // Force the client to refetch the session
    // This will trigger the JWT callback to update the tier
    return NextResponse.json({
      success: true,
      tier,
      message: 'Session refresh initiated. Please reload the page.',
    });
  } catch (error) {
    console.error('Error refreshing session:', error);
    return NextResponse.json({
      error: 'Failed to refresh session',
      message: (error as Error).message,
    }, { status: 500 });
  }
} 