import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { VERSION } from '@/app/version'

// Paths that are considered public (accessible without authentication)
const publicPaths = [
  '/', 
  '/login', 
  '/register', 
  '/forgot-password',
  '/reset',
  '/api/auth/',
  '/api/stripe/webhook',
  '/api/health'
];

// Paths that are explicitly protected (require authentication)
const protectedPaths = [
  '/dashboard',
  '/workouts',
  '/workout',
  '/exercises',
  '/exercise', // Singular form
  '/excercises', // Common misspelling 
  '/chat',
  '/challenges',
  '/calendar',
  '/integrations',
  '/integration', // Singular form
  '/my-story',
  '/plan',
  '/planner',
  '/settings',
  '/analytics',
  '/activity',
  '/admin',
  '/profile',
  '/user',
  '/debug',
  '/health', // Health checks that require authentication
  '/init-db', // Database initialization page
  '/strava-admin',
  '/fix-auth',
  '/check-db',
  '/debug-images',
  '/check-mongodb',
];

// Paths that authenticated users should be redirected AWAY from
const authProtectedPaths = ['/login', '/register', '/forgot-password', '/reset'];

// The main dashboard path
const dashboardPath = '/dashboard';

// Authentication middleware
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and specific API routes (like webhook)
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/favicon.ico') || 
      pathname.startsWith('/icons/') || 
      pathname.startsWith('/images/') || 
      pathname === '/api/stripe/webhook') {
    return NextResponse.next();
  }

  // --- DEBUGGING: Log Request Info ---
  console.log(`[MIDDLEWARE] Processing request to: ${pathname}`);
  // ----------------------------------------

  // --- Get Token ---
  let token = null;
  let getTokenError = null;
  const cookieName = `next-auth.session-token`;
  const secureCookieName = `__Secure-next-auth.session-token`;
  // --- DEBUGGING: Check if secret is loaded just before getToken ---
  const loadedSecret = process.env.NEXTAUTH_SECRET;
  if (loadedSecret) {
    console.log(`[MIDDLEWARE] Path: ${pathname} | NEXTAUTH_SECRET CHECK (pre-getToken): Loaded (len: ${loadedSecret.length}), starts: ${loadedSecret.substring(0, 3)}, ends: ${loadedSecret.slice(-3)}`);
  } else {
    console.log(`[MIDDLEWARE] Path: ${pathname} | !!! NEXTAUTH_SECRET CHECK (pre-getToken): NOT LOADED !!!`);
  }
  // ------------------------------------------------------------------
  try {
    token = await getToken({
      req: request,
      cookieName: cookieName,
      secureCookie: process.env.NODE_ENV === 'production',
    });
    console.log(`[MIDDLEWARE] Auth Result for ${pathname}: ${token ? 'Authenticated' : 'Not Authenticated'}`);
  } catch (error: any) {
    getTokenError = error.message || 'Unknown error';
    console.error(`[MIDDLEWARE] Auth Error for ${pathname}:`, error);
  }
  const isAuthenticated = !!token;
  // ----------------

  // --- START ROUTING LOGIC ---

  // 1. Check if path is explicitly protected - both exact matches and any subpaths
  const isExplicitlyProtected = protectedPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  if (isExplicitlyProtected && !isAuthenticated) {
    console.log(`[MIDDLEWARE] Blocking access to protected path: ${pathname}`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', encodeURIComponent(pathname));
    return NextResponse.redirect(url);
  }

  // 2. Handle root path ('/')
  if (pathname === '/') {
    if (isAuthenticated) {
      // If authenticated, redirect from landing page to dashboard
      const url = request.nextUrl.clone();
      url.pathname = dashboardPath;
      console.log(`[MIDDLEWARE] Redirecting authenticated user from / to ${dashboardPath}`);
      return NextResponse.redirect(url);
    }
  }

  // 3. Handle authenticated users trying to access login/register
  if (isAuthenticated && authProtectedPaths.some(path => pathname === path)) {
    const url = request.nextUrl.clone();
    url.pathname = dashboardPath;
    console.log(`[MIDDLEWARE] Redirecting authenticated user from ${pathname} to ${dashboardPath}`);
    return NextResponse.redirect(url);
  }

  // 4. General protection for non-public paths
  const isPublic = publicPaths.some(path => {
    if (!path.endsWith('/')) {
      return pathname === path || pathname.startsWith(`${path}/`);
    }
    return pathname.startsWith(path);
  });

  // Default protection for any path not explicitly public
  // This is a catch-all to ensure any path not in the public list requires auth
  if (!isAuthenticated && !isPublic) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      console.log(`[MIDDLEWARE] Returning 401 for API route: ${pathname}`);
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Special case: allow root path (/) even if unauthenticated
    if (pathname === '/') {
      return NextResponse.next();
    }
    
    // Non-API routes redirect to login
    console.log(`[MIDDLEWARE] Redirecting unauthenticated user from ${pathname} to /login`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', encodeURIComponent(pathname));
    return NextResponse.redirect(url);
  }

  // --- END ROUTING LOGIC ---

  // Add standard headers to response
  const response = NextResponse.next();
  
  // Cache-busting headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  // Add version header
  response.headers.set('X-App-Version', VERSION);

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
// Exclude static assets, images, icons, auth routes, etc.
// Include root ('/') and specific app/api paths.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/stripe/webhook (Stripe webhook)
     * - api/auth/ (NextAuth internal routes)
     * - icons/ (app icons)
     * - images/ (public images)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/auth/|icons/|images/).*)',
    '/api/:path*'
  ],
} 