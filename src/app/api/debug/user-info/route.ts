import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";

export async function GET() {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: "Not authenticated",
        session: session ? "Session exists but no user ID" : "No session"
      }, { status: 401 });
    }

    // Connect to DB and get user data
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('nickname name email')
      .lean() as any;

    if (!user) {
      return NextResponse.json({ 
        error: "User not found", 
        userId: session.user.id 
      }, { status: 404 });
    }

    // Return debug info
    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        hasNickname: !!user.nickname
      },
      session: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ 
      error: "Server error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 