import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { VERSION } from '@/app/version'

// Paths that are considered public (accessible without authentication)
const publicPaths = ['/', '/login', '/register', '/api/auth', '/api/stripe/webhook'];

// Paths that authenticated users should be redirected AWAY from
const authProtectedPaths = ['/login', '/register'];

// The main dashboard path
const dashboardPath = '/dashboard';

// Authentication middleware
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and specific API routes (like webhook)
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico') || pathname.startsWith('/icons/') || pathname.startsWith('/images/') || pathname === '/api/stripe/webhook') {
    return NextResponse.next();
  }

  // Get token
  let token;
  try {
    token = await getToken({ req: request });
  } catch (error) {
    console.error("[MIDDLEWARE] Error getting token:", error);
  }
  const isAuthenticated = !!token;

  // Log request details
  console.log(`[MIDDLEWARE] Path: ${pathname}, Authenticated: ${isAuthenticated}, User: ${token?.email || 'none'}`);

  // --- START ROUTING LOGIC ---

  // 1. Handle root path ('/')
  if (pathname === '/') {
    if (isAuthenticated) {
      // If authenticated, redirect from landing page to dashboard
      const url = request.nextUrl.clone();
      url.pathname = dashboardPath;
      console.log(`[MIDDLEWARE] Authenticated user on '/'. Redirecting to ${dashboardPath}`);
      return NextResponse.redirect(url);
    } else {
      // If not authenticated, allow access to landing page
      console.log(`[MIDDLEWARE] Unauthenticated user accessing '/'. Allowing.`);
      // We still return NextResponse.next() with headers below
    }
  }

  // 2. Handle authenticated users trying to access login/register
  if (isAuthenticated && authProtectedPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = dashboardPath;
    console.log(`[MIDDLEWARE] Authenticated user on '${pathname}'. Redirecting to ${dashboardPath}`);
    return NextResponse.redirect(url);
  }

  // 3. Handle unauthenticated users trying to access protected paths
  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  if (!isAuthenticated && !isPublic) {
    // Special check for API routes - often return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      console.log(`[MIDDLEWARE] Unauthenticated access attempt to API route '${pathname}'. Returning 401.`);
      return new NextResponse('Unauthorized', { status: 401 });
    }
    // For non-API protected routes, redirect to login
    const url = request.nextUrl.clone();
    const originalPath = pathname; // Keep original path for callback
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', originalPath);
    console.log(`[MIDDLEWARE] Unauthenticated user on protected path '${pathname}'. Redirecting to login.`);
    return NextResponse.redirect(url);
  }

  // --- END ROUTING LOGIC ---

  // --- Common response handling (headers) ---
  // Allow the request to proceed if none of the above conditions caused a redirect
  const response = NextResponse.next();

  // Force all responses to be dynamic with strong cache-busting headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  response.headers.set('X-Accel-Expires', '0');
  response.headers.set('X-Middleware-Bypass', 'true'); // Keep bypass header if needed

  // Add version header
  response.headers.set('X-App-Version', VERSION);

  // Add auth debugging headers (optional)
  const cookieHeader = request.headers.get('cookie') || '';
  const hasAuthCookie = cookieHeader.includes('next-auth.session-token') || cookieHeader.includes('__Secure-next-auth.session-token');
  response.headers.set('X-Auth-Debug', `token:${!!token};cookie:${hasAuthCookie}`);

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

// Define which paths the middleware should run on
// Exclude static assets, images, icons, etc.
// Include root ('/') and specific app/api paths.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/stripe/webhook (Stripe webhook)
     * - api/auth/ (NextAuth)
     * - icons/ (app icons)
     * - images/ (public images)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/auth|icons/|images/).*)',
  ],
} 