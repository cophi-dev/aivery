import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Get the raw session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value 
      || request.cookies.get('__Secure-next-auth.session-token')?.value;

    // Get token details using getToken
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production'
    });

    // Get server session 
    const session = await getServerSession(authOptions);

    return NextResponse.json({
      date: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      nextAuthUrl: process.env.NEXTAUTH_URL?.substring(0, 10) + '...',
      hasSessionToken: !!sessionToken,
      sessionTokenLength: sessionToken ? sessionToken.length : 0,
      tokenFound: !!token,
      sessionFound: !!session,
      authStatus: token ? "authenticated" : "unauthenticated",
      headers: {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        cookie: request.headers.get('cookie')?.substring(0, 20) + '...'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: "Error in debug-session endpoint",
      message: (error as Error).message,
    }, { status: 500 });
  }
} 