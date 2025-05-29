import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get all users and their image info (for debugging)
    const users = await User.find({}).select("name email image createdAt").lean();
    
    const userImageInfo = users.map((user: any) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      hasImage: !!user.image,
      imageSize: user.image ? Math.round(user.image.length / 1024) + "KB" : "No image",
      imageSample: user.image ? user.image.substring(0, 50) + "..." : null,
      createdAt: user.createdAt,
      isCurrentUser: user._id.toString() === session.user.id
    }));
    
    // Find current user specifically
    const currentUser = await User.findById(session.user.id).select("name email image").lean();
    
    return NextResponse.json({
      currentSession: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        hasImageInSession: !!session.user.image,
        sessionImageSize: session.user.image ? Math.round(session.user.image.length / 1024) + "KB" : "No image"
      },
      currentUserInDB: currentUser ? {
        id: (currentUser as any)._id.toString(),
        name: (currentUser as any).name,
        email: (currentUser as any).email,
        hasImage: !!(currentUser as any).image,
        imageSize: (currentUser as any).image ? Math.round((currentUser as any).image.length / 1024) + "KB" : "No image"
      } : null,
      allUsers: userImageInfo,
      totalUsers: users.length,
      usersWithImages: userImageInfo.filter(u => u.hasImage).length,
      potentialIssues: {
        multipleUsersWithSameImage: checkForDuplicateImages(users),
        sessionDbMismatch: currentUser && session.user.image !== (currentUser as any).image
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error in debug profile pictures:", error);
    return NextResponse.json(
      { error: "Failed to debug profile pictures" },
      { status: 500 }
    );
  }
}

function checkForDuplicateImages(users: any[]) {
  const imageMap = new Map();
  const duplicates: any[] = [];
  
  users.forEach((user: any) => {
    if (user.image) {
      const imageSignature = user.image.substring(0, 100); // First 100 chars as signature
      if (imageMap.has(imageSignature)) {
        duplicates.push({
          users: [imageMap.get(imageSignature), { id: user._id.toString(), email: user.email }],
          imageSignature
        });
      } else {
        imageMap.set(imageSignature, { id: user._id.toString(), email: user.email });
      }
    }
  });
  
  return duplicates;
} 