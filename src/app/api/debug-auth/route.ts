export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Set cache control headers to prevent caching
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    // Get session data
    const session = await getServerSession(authOptions);
    
    // Add request info
    const cookies = Object.fromEntries(
      req.cookies.getAll().map(c => [c.name, c.value.substring(0, 20) + '...'])
    );
    
    // Build debug info
    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        user: session?.user ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email?.substring(0, 3) + '***@***' + (session.user.email?.split('@')[1] || ''),
        } : null,
        expires: session?.expires,
      },
      cookies,
      headers: {
        userAgent: req.headers.get('user-agent'),
        host: req.headers.get('host'),
      },
      nextAuthVersion: '4.22.1', // Update with your actual version
      nodeEnv: process.env.NODE_ENV,
    };
    
    return NextResponse.json(debugInfo, { headers });
    
  } catch (error) {
    console.error('Error in debug auth API:', error);
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve auth debug info',
        errorMessage: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers }
    );
  }
} 