import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { VERSION } from '@/app/version'

// Authentication middleware
export async function middleware(request: NextRequest) {
  // Get the path from the request
  const path = request.nextUrl.pathname;
  
  // Get auth token for debugging
  let token;
  try {
    token = await getToken({ req: request });
  } catch (error) {
    console.error("Error getting token in middleware:", error);
  }

  // Log request details
  console.log(`[MIDDLEWARE] Path: ${path}, Has token: ${!!token}, User: ${token?.email || 'none'}`);
  
  // Log cookies for debugging
  const cookieHeader = request.headers.get('cookie') || '';
  const hasCookies = cookieHeader.length > 0;
  const hasAuthCookie = cookieHeader.includes('next-auth.session-token') || 
                       cookieHeader.includes('__Secure-next-auth.session-token');
  
  console.log(`[MIDDLEWARE] Cookies: ${hasCookies ? 'Yes' : 'No'}, Auth cookie: ${hasAuthCookie ? 'Yes' : 'No'}`);
  
  // TEMPORARY FIX: Skip ALL middleware processing to diagnose redirect issues
  // Just add headers and return
  const response = NextResponse.next();
  
  // Force all responses to be dynamic with strong cache-busting headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  response.headers.set('X-Accel-Expires', '0');
  response.headers.set('X-Middleware-Bypass', 'true');
  
  // Add version header to help with debugging and cache busting
  response.headers.set('X-App-Version', VERSION);
  
  // Add auth debugging headers
  response.headers.set('X-Auth-Debug', `token:${!!token};cookie:${hasAuthCookie}`);
  
  // Allow all requests to proceed without any redirects
  return response;
}

/* TEMPORARILY COMMENT OUT REWRITES TO TROUBLESHOOT
export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
*/

// Use a more specific matcher to avoid processing static files
export const config = {
  matcher: [
    '/workouts',
    '/workouts-direct',
    '/login',
    '/register',
    '/api/:path*'
  ],
} 