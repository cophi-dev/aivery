import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { withDatabase } from "@/lib/db/middleware"
import User from "@/lib/db/models/user"

// Simple API endpoint that returns the user's avatar image
export const GET = (request: NextRequest) => withDatabase(request, async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions)
    
    // Start detailed debugging
    console.log('---------- AVATAR DEBUG START ----------');
    console.log('Session:', {
      exists: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id || 'none',
      userEmail: session?.user?.email || 'none',
      userName: session?.user?.name || 'none',
      hasImage: !!session?.user?.hasImage
    });
    
    // Check if user is authenticated
    if (!session?.user) {
      console.log("No authenticated session found - normal for unauthenticated users")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Get user ID from query params if exists, otherwise use authenticated user
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get("userId")
    const userId = queryUserId || session.user.id
    
    console.log('User ID for avatar lookup:', userId);
    
    if (!userId) {
      console.error("No userId found in session")
      return NextResponse.json({ error: "User ID not found" }, { status: 400 })
    }
    
    try {
      // Find user (no need to call dbConnect() manually, it's handled by the middleware)
      console.log(`Looking up user with ID: ${userId}`)
      const userDoc = await User.findById(userId).select("image name").lean()
      
      // Use a type assertion immediately to avoid TypeScript errors
      const user = userDoc as any;
      
      // Enhanced debugging
      console.log('User document found:', {
        exists: !!user,
        id: user?._id?.toString() || 'none',
        hasImageField: user ? 'image' in user : false,
        imageType: user?.image ? typeof user.image : 'undefined',
        imageLength: user?.image?.length || 0
      });
      
      if (!user) {
        console.error(`User not found for ID: ${userId}`)
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      
      // Enhanced logging to debug issues
      console.log(`User found: id=${userId}, name=${user.name || 'unknown'}`)
      console.log(`Has image property: ${user.hasOwnProperty('image')}`)
      
      // Log image information
      if (user.image) {
        console.log(`Found avatar image: ${user.image.substring(0, 30)}... (${Math.round(user.image.length / 1024)}KB)`)
      } else {
        console.log("No avatar image found for user")
      }
      
      console.log('---------- AVATAR DEBUG END ----------');
      
      // Return image data
      return NextResponse.json({ 
        image: user.image || null,
        name: user.name || null
      })
    } catch (dbError) {
      console.error('Error querying database:', dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error getting avatar:", error)
    return NextResponse.json({ error: "Failed to get avatar" }, { status: 500 })
  }
}) 