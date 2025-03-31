import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

// Force dynamic rendering for the API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Debug route to check authentication status
 */
export async function GET(req: NextRequest) {
  // Get cookies
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);
  const hasSessionCookie = cookieNames.some(name => 
    name.includes('session') || name.includes('next-auth')
  );
  
  // Get session using NextAuth
  let session = null;
  let sessionError = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    sessionError = error instanceof Error ? error.message : String(error);
  }
  
  // Get token directly
  let token = null;
  let tokenError = null;
  try {
    token = await getToken({ req });
  } catch (error) {
    tokenError = error instanceof Error ? error.message : String(error);
  }
  
  // Prepare response data
  const responseData = {
    timestamp: new Date().toISOString(),
    cookies: {
      count: allCookies.length,
      names: cookieNames,
      hasSessionCookie,
    },
    session: {
      exists: !!session,
      hasUser: !!session?.user,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      } : null,
      error: sessionError,
    },
    token: {
      exists: !!token,
      email: token?.email,
      name: token?.name,
      error: tokenError,
    },
    headers: {
      cookieHeader: req.headers.get('cookie'),
      userAgent: req.headers.get('user-agent'),
    }
  };
  
  // Return debug information
  return NextResponse.json(responseData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Content-Type': 'application/json',
    },
  });
} 