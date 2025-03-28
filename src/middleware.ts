import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Authentication middleware
export async function middleware(request: NextRequest) {
  // Get the path from the request
  const path = request.nextUrl.pathname;
  
  // Define path categories more precisely
  const isAuthPath = path === '/login' || path === '/register' || path === '/forgot-password';
  const isApiPath = path.startsWith('/api/');
  const isNextAuthPath = path.startsWith('/api/auth');
  const isPublicPath = path === '/' || isNextAuthPath;
  
  // Get token for auth status
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  // Add debug header to track auth status in responses
  const response = NextResponse.next();
  response.headers.set('X-Auth-Status', token ? 'authenticated' : 'unauthenticated');
  
  // Case 1: User is on auth page (login/register) but already authenticated
  // Redirect to home page
  if (isAuthPath && token) {
    console.log('[MIDDLEWARE] Authenticated user on auth page, redirecting to home');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Case 2: User is on protected page but not authenticated
  // Redirect to login
  if (!isAuthPath && !isPublicPath && !isApiPath && !token) {
    console.log('[MIDDLEWARE] Unauthenticated user on protected page, redirecting to login');
    const callbackUrl = encodeURIComponent(request.nextUrl.pathname);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }
  
  // Case 3: API request that requires authentication
  // Return 401 if not authenticated, except for auth APIs
  if (isApiPath && !isNextAuthPath && !token) {
    // Allow auth API endpoints to work without authentication
    if (path.startsWith('/api/auth/')) {
      return response;
    }
    
    // If it's a chat API endpoint, decide based on path
    if (path === '/api/chat') {
      // Allow unauthenticated chat access for public routes
      return response;
    }
    
    console.log('[MIDDLEWARE] Unauthenticated API request');
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Add cache-busting headers for specific routes
  if (path === '/api/chat' || path === '/chat') {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
  // Allow the request to proceed
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 