import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { getToken } from "next-auth/jwt";

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Check if we have a session
    if (!session) {
      return NextResponse.json({ 
        error: "Not authenticated - no session",
        status: "unauthenticated"
      }, { status: 401 });
    }
    
    // Check if we have a user ID
    if (!session.user?.id) {
      return NextResponse.json({ 
        error: "Session exists but no user ID",
        sessionExists: true,
        hasUserId: false
      }, { status: 401 });
    }
    
    // Get token from JWT to compare
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET
    });
    
    let tokenInfo = null;
    
    if (token) {
      tokenInfo = {
        id: token.id || token.sub,
        name: token.name,
        email: token.email,
        nickname: token.nickname,
        hasNickname: !!token.nickname
      };
    }
    
    // Connect to DB and get user data
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('nickname name email')
      .lean() as any;

    if (!user) {
      return NextResponse.json({ 
        error: "User not found in database", 
        userId: session.user.id,
        session: {
          nickname: session.user.nickname,
          name: session.user.name,
          email: session.user.email,
          id: session.user.id
        },
        token: tokenInfo
      }, { status: 404 });
    }

    // Return debug info including all sources of the nickname
    return NextResponse.json({
      success: true,
      nickname: {
        fromDatabase: user.nickname,
        fromSession: session.user.nickname,
        fromToken: token?.nickname,
        effectiveNickname: user.nickname || session.user.nickname || token?.nickname || user.name
      },
      database: {
        userId: user._id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        hasNickname: !!user.nickname
      },
      session: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        nickname: session.user.nickname,
        hasNickname: !!session.user.nickname
      },
      token: tokenInfo
    });
  } catch (error) {
    console.error('Error in nickname debug endpoint:', error);
    return NextResponse.json({ 
      error: "Server error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 