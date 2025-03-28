import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Authentication middleware
export async function middleware(request: NextRequest) {
  // Get the path from the request
  const path = request.nextUrl.pathname;
  
  // Check if the path should be protected
  const isApiPath = path.startsWith('/api/');
  const isPublicPath = path === '/login' || 
                      path === '/register' || 
                      path === '/' || 
                      path === '/auth/signin' ||
                      path.startsWith('/api/auth');
  
  // If it's a public path or API path, let the request continue
  if (isPublicPath || isApiPath) {
    // Pass to next middleware
    const response = NextResponse.next();
    
    // Add cache-busting headers for chat API endpoints
    if (path === '/api/chat' || path === '/chat') {
      console.log('[MIDDLEWARE] Adding cache-busting headers for', path);
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response;
  }
  
  // Otherwise, get the token to check authentication
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  // If not authenticated and not on a public path, redirect to login
  if (!token && !isPublicPath) {
    // Get the callback URL to redirect back after login
    const callbackUrl = encodeURIComponent(request.nextUrl.pathname);
    const loginUrl = new URL(`/login?callbackUrl=${callbackUrl}`, request.url);
    
    return NextResponse.redirect(loginUrl);
  }
  
  // Allow authenticated users to access protected routes
  const response = NextResponse.next();
  
  // Add cache-busting headers for the chat page
  if (path === '/chat') {
    console.log('[MIDDLEWARE] Adding cache-busting headers for', path);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
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