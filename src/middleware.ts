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
  const isPublicPath = path === '/' || isNextAuthPath || path === '/api/quotes';
  
  // Check for specific paths that need direct access (protected but no redirect)
  const isProtectedNoRedirect = path === '/workouts' || path === '/exercises' || path === '/chat';
  
  // Debug cookie values
  const cookieHeader = request.headers.get('cookie') || '';
  const hasSessionToken = cookieHeader.includes('next-auth.session-token');
  const hasSecureSessionToken = cookieHeader.includes('__Secure-next-auth.session-token');
  
  // Skip authentication for specific hosts if needed
  const host = request.headers.get('host') || '';
  const isSpecialSubdomain = host.startsWith('api.') || host.startsWith('public.');
  
  // Get token for auth status with appropriate options
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production'
  });
  
  // Debug log token info
  console.log(`[MIDDLEWARE] Path: ${path}, Host: ${host}, HasToken: ${!!token}, HasSessionCookie: ${hasSessionToken || hasSecureSessionToken}, Secure: ${hasSecureSessionToken}`);
  
  // Create response 
  const response = NextResponse.next();
  
  // Add debug header to track auth status in responses
  response.headers.set('X-Auth-Status', token ? 'authenticated' : 'unauthenticated');
  if (hasSessionToken) {
    response.headers.set('X-Has-Session-Cookie', 'true');
  }
  if (hasSecureSessionToken) {
    response.headers.set('X-Has-Secure-Session-Cookie', 'true');
  }
  
  // Add CSRF protection header
  response.headers.set('X-CSRF-Protection', '1; mode=block');
  
  // Case 1: All API requests pass through to the route handlers
  // Let the API routes handle their own authentication
  if (isApiPath) {
    // Add cache-busting headers for specific routes
    if (path === '/api/chat') {
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    return response;
  }
  
  // Skip auth redirects for special subdomains
  if (isSpecialSubdomain) {
    return response;
  }
  
  // Case 2: User is on auth page (login/register) but already authenticated
  // Redirect to home page
  if (isAuthPath && token) {
    console.log('[MIDDLEWARE] Authenticated user on auth page, redirecting to home');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Case 3: User is on protected page but not authenticated
  // Redirect to login - except for protected no-redirect paths
  if (!isAuthPath && !isPublicPath && !token && !isProtectedNoRedirect) {
    console.log('[MIDDLEWARE] Unauthenticated user on protected page, redirecting to login');
    const callbackUrl = encodeURIComponent(request.nextUrl.pathname);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }
  
  // Add cache-busting headers for the chat page
  if (path === '/chat') {
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