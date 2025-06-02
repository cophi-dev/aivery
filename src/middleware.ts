import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { VERSION } from '@/app/version'
import { 
  checkPremiumAccess, 
  isPublicPath, 
  requiresSubscription 
} from '@/lib/subscription-middleware'

// Premium-only middleware - path configurations are now handled in subscription-middleware.ts

// Premium-only middleware
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and specific API routes
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/favicon.ico') || 
      pathname.startsWith('/icons/') || 
      pathname.startsWith('/images/') || 
      pathname.startsWith('/api/auth/') ||
      pathname === '/api/stripe/webhook' ||
      pathname === '/api/stripe/create-checkout-session' ||
      pathname === '/api/stripe/create-portal-session' ||
      pathname === '/api/strava/webhook' ||
      pathname === '/api/health' ||
      pathname === '/api/user' ||
      pathname === '/api/user/avatar' ||
      pathname === '/api/middleware-test') {
    return NextResponse.next();
  }

  console.log(`[PREMIUM-MIDDLEWARE] Processing request to: ${pathname}`);

  // 1. For truly public paths (auth/payment), allow immediate access
  // Special handling for root path - redirect logged-in users appropriately
  if (pathname === '/') {
    const premiumCheck = await checkPremiumAccess(request);
    
    if (premiumCheck.userId) {
      // User is logged in - redirect based on subscription tier
      if (premiumCheck.hasAccess) {
        // Premium user - redirect to dashboard
        console.log(`[PREMIUM-MIDDLEWARE] Redirecting logged-in premium user from / to /dashboard`);
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      } else {
        // Free user - redirect to subscription page
        console.log(`[PREMIUM-MIDDLEWARE] Redirecting logged-in free user from / to /subscribe`);
        const url = request.nextUrl.clone();
        url.pathname = '/subscribe';
        return NextResponse.redirect(url);
      }
    } else {
      // Anonymous user - show landing page
      console.log(`[PREMIUM-MIDDLEWARE] Anonymous user accessing landing page`);
      return NextResponse.next();
    }
  }
  
  // 2. Check authentication for all non-root paths
  const premiumCheck = await checkPremiumAccess(request);
  
  // 3. Handle authenticated users trying to access auth pages
  if (['login', 'register', 'forgot-password', 'reset'].some(path => pathname === `/${path}`)) {
    if (premiumCheck.userId) {
      if (premiumCheck.hasAccess) {
        // Premium user - redirect to dashboard
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        console.log(`[PREMIUM-MIDDLEWARE] Redirecting premium user from ${pathname} to /dashboard`);
        return NextResponse.redirect(url);
      } else {
        // Free user - redirect to subscription page
        const url = request.nextUrl.clone();
        url.pathname = '/subscribe';
        console.log(`[PREMIUM-MIDDLEWARE] Redirecting free user from ${pathname} to /subscribe`);
        return NextResponse.redirect(url);
      }
    } else {
      // Anonymous user - allow access to auth pages
      console.log(`[PREMIUM-MIDDLEWARE] Anonymous user accessing auth page: ${pathname}`);
      return NextResponse.next();
    }
  }

  // 3.5. Handle authenticated premium users trying to access subscribe page
  if (pathname === '/subscribe') {
    if (premiumCheck.userId && premiumCheck.hasAccess) {
      // Premium user - redirect to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      console.log(`[PREMIUM-MIDDLEWARE] Redirecting premium user from /subscribe to /dashboard`);
      return NextResponse.redirect(url);
    } else {
      // Non-premium or anonymous user - allow access to subscribe page
      console.log(`[PREMIUM-MIDDLEWARE] Allowing access to subscribe page for non-premium user`);
      return NextResponse.next();
    }
  }

  // 4. For other public paths, allow immediate access
  if (isPublicPath(pathname)) {
    console.log(`[PREMIUM-MIDDLEWARE] Public path allowed: ${pathname}`);
    return NextResponse.next();
  }
  // 5. For protected paths, check authentication and premium access
  console.log(`[PREMIUM-MIDDLEWARE] Premium check result for ${pathname}:`, {
    hasAccess: premiumCheck.hasAccess,
    tier: premiumCheck.tier,
    userId: premiumCheck.userId,
    error: premiumCheck.error
  });
  
  if (!premiumCheck.userId) {
    // Not authenticated - redirect to subscribe page to encourage signup
    console.log(`[PREMIUM-MIDDLEWARE] Not authenticated, redirecting to subscribe: ${pathname}`);
    const url = request.nextUrl.clone();
    url.pathname = '/subscribe';
    url.searchParams.set('from', encodeURIComponent(pathname));
    return NextResponse.redirect(url);
  }

  // 6. For all authenticated users, check if path requires premium access
  if (requiresSubscription(pathname)) {
    if (!premiumCheck.hasAccess) {
      // Authenticated but no premium access - redirect to subscription page
      console.log(`[PREMIUM-MIDDLEWARE] No premium access for ${pathname}, tier: ${premiumCheck.tier}`);
      const url = request.nextUrl.clone();
      url.pathname = '/subscribe';
      url.searchParams.set('from', encodeURIComponent(pathname));
      return NextResponse.redirect(url);
    }
    
    console.log(`[PREMIUM-MIDDLEWARE] Premium access granted for ${pathname}, tier: ${premiumCheck.tier}`);
    return NextResponse.next();
  }

  // 7. For API routes, return 402 Payment Required for non-premium users
  if (pathname.startsWith('/api/') && requiresSubscription(pathname)) {
    if (!premiumCheck.hasAccess) {
      console.log(`[PREMIUM-MIDDLEWARE] Blocking API access for non-premium user: ${pathname}`);
      return new NextResponse('Payment Required', { status: 402 });
    }
  }

  // 8. If user is authenticated but doesn't have premium access, redirect to subscribe
  if (!premiumCheck.hasAccess) {
    console.log(`[PREMIUM-MIDDLEWARE] Non-premium user accessing ${pathname}, redirecting to /subscribe`);
    const url = request.nextUrl.clone();
    url.pathname = '/subscribe';
    url.searchParams.set('from', encodeURIComponent(pathname));
    return NextResponse.redirect(url);
  }

  // --- END PREMIUM ROUTING LOGIC ---

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
// Simplified matcher to ensure it works
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth/ (NextAuth internal routes)
     * - api/stripe/webhook (Stripe webhook)
     * - api/strava/webhook (Strava webhook)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/stripe/webhook|api/strava/webhook).*)',
  ],
} 