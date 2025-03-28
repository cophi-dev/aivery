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
    return NextResponse.next();
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
  return NextResponse.next();
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