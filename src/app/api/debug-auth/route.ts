export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/db/mongodb';
import UserModel from '@/lib/db/models/user';

export async function GET(request: NextRequest) {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
      cookieDomain: process.env.COOKIE_DOMAIN || 'Not set',
    };

    // Try to get JWT token
    try {
      const token = await getToken({
        req: request,
        secureCookie: process.env.NODE_ENV === 'production',
      });
      debugInfo.jwtToken = token ? {
        sub: token.sub,
        email: token.email,
        name: token.name,
        tier: (token as any).tier,
        hasAccessToken: !!(token as any).accessToken,
      } : null;
    } catch (error) {
      debugInfo.jwtError = (error as Error).message;
    }

    // Try to get server session
    try {
      const session = await getServerSession(authOptions);
      debugInfo.serverSession = session ? {
        userId: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
        expires: session.expires,
      } : null;
    } catch (error) {
      debugInfo.sessionError = (error as Error).message;
    }

    // Try database connection
    try {
      await dbConnect();
      debugInfo.dbConnection = 'Success';
      
      // If we have a user ID from token, try to fetch user
      if (debugInfo.jwtToken?.sub) {
        const user = await UserModel.findById(debugInfo.jwtToken.sub).select('email tier').lean();
        debugInfo.dbUser = user ? {
          email: (user as any).email,
          tier: (user as any).tier || 'free',
        } : null;
      }
    } catch (error) {
      debugInfo.dbError = (error as Error).message;
    }

    // Check request headers
    debugInfo.headers = {
      cookie: request.headers.get('cookie') ? 'Present' : 'Missing',
      authorization: request.headers.get('authorization') ? 'Present' : 'Missing',
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: (error as Error).message,
      stack: (error as Error).stack,
    }, { status: 500 });
  }
} 