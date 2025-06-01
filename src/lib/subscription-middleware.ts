import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { parse } from 'cookie';

// JWT secret for production
const secret = process.env.NEXTAUTH_SECRET;

// Check if user has a valid premium subscription
export async function checkPremiumAccess(request: NextRequest): Promise<{
  hasAccess: boolean;
  tier: string | null;
  userId: string | null;
  error?: string;
}> {
  try {
    // Debug: Check if we have cookies
    const cookieHeader = request.headers.get('cookie');
    console.log(`[SUBSCRIPTION-CHECK] Cookie header present: ${!!cookieHeader}`);
    console.log(`[SUBSCRIPTION-CHECK] NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}, SECRET: ${!!process.env.NEXTAUTH_SECRET}`);
    console.log(`[SUBSCRIPTION-CHECK] Environment: ${process.env.NODE_ENV}`);
    
    // Debug: Check for session token cookie
    if (cookieHeader) {
      const hasSessionToken = cookieHeader.includes('next-auth.session-token');
      const hasSecureSessionToken = cookieHeader.includes('__Secure-next-auth.session-token');
      console.log(`[SUBSCRIPTION-CHECK] Session token cookie: ${hasSessionToken}, Secure: ${hasSecureSessionToken}`);
      
      // Parse cookies to see what we have
      const cookies = parse(cookieHeader);
      const cookieNames = Object.keys(cookies);
      console.log(`[SUBSCRIPTION-CHECK] All cookies: ${cookieNames.join(', ')}`);
      
      // Check for any auth-related cookies
      const authCookies = cookieNames.filter(name => name.includes('auth'));
      console.log(`[SUBSCRIPTION-CHECK] Auth-related cookies: ${authCookies.join(', ')}`);
    }
    
    // Get the authentication token
    const token = await getToken({
      req: request,
      secret: secret,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    console.log(`[SUBSCRIPTION-CHECK] Token found: ${!!token}, Token sub: ${token?.sub || 'none'}`);
    
    // If no token but we have cookies, try without secure cookie
    if (!token && cookieHeader && process.env.NODE_ENV === 'production') {
      console.log(`[SUBSCRIPTION-CHECK] Trying without secureCookie flag`);
      const tokenRetry = await getToken({
        req: request,
        secret: secret,
        secureCookie: false,
      });
      console.log(`[SUBSCRIPTION-CHECK] Token retry result: ${!!tokenRetry}`);
      if (tokenRetry) {
        console.log(`[SUBSCRIPTION-CHECK] Token found without secure flag, using it`);
        return {
          hasAccess: (tokenRetry as any).tier === 'premium' || (tokenRetry as any).tier === 'expert',
          tier: (tokenRetry as any).tier || 'free',
          userId: tokenRetry.sub as string,
        };
      }
    }

    if (!token?.sub) {
      return { hasAccess: false, tier: null, userId: null, error: 'Not authenticated' };
    }

    const userId = token.sub;
    
    // Use tier from token - this gets updated on login and can be refreshed
    const tier = (token as any).tier || 'free';
    const hasAccess = tier === 'premium' || tier === 'expert';
    
    console.log(`[SUBSCRIPTION-CHECK] User ${userId} tier: ${tier}, hasAccess: ${hasAccess}`);
    
    return {
      hasAccess,
      tier,
      userId,
    };
  } catch (error) {
    console.error('Error checking premium access:', error);
    return { 
      hasAccess: false, 
      tier: null, 
      userId: null, 
      error: 'Failed to check subscription status' 
    };
  }
}

// Paths that don't require premium access (ONLY auth flow + payment flow + landing page)
export const publicPaths = [
  '/', // Landing page - public access
  '/login',
  '/register', 
  '/forgot-password',
  '/reset',
  '/subscribe', // New subscription page
  '/payment-success',
  '/payment-canceled',
  '/pricing', // Pricing page
  '/debug-token', // Debug page for testing
  '/debug-access', // Debug access page
  '/auth-test', // Auth test page
  '/manifest.json', // PWA manifest
  '/icon.svg', // App icon
  '/favicon.ico', // Favicon
  // Static assets
  '/uploads/',
  '/icons/'
];

// Paths that should redirect to subscription page (instead of blocking)
export const subscriptionRequiredPaths = [
  '/dashboard',
  '/workouts',
  '/workout',
  '/exercises',
  '/exercise',
  '/chat',
  '/challenges',
  '/calendar',
  '/integrations',
  '/my-story',
  '/plan',
  '/planner',
  '/settings',
  '/analytics',
  '/activity',
  '/profile',
  // API endpoints that require premium access
  '/api/dashboard',
  '/api/workout',
  '/api/workouts',
  '/api/exercises',
  '/api/chat',
  '/api/challenges',
  '/api/analytics',
  '/api/insight',
  '/api/my-story',
  '/api/ai'
];

export function isPublicPath(pathname: string): boolean {
  // Explicit list of paths that should be public (no premium required)
  const exactPaths = [
    '/',
    '/login', 
    '/register',
    '/forgot-password',
    '/reset',
    '/subscribe',
    '/payment-success', 
    '/payment-canceled',
    '/pricing',
    '/debug-token',
    '/debug-access',
    '/auth-test',
    '/manifest.json',
    '/icon.svg',
    '/favicon.ico'
  ];
  
  // Check exact matches first
  if (exactPaths.includes(pathname)) {
    console.log(`[isPublicPath] ${pathname} is explicitly public`);
    return true;
  }
  
  // Check path prefixes for static assets
  const publicPrefixes = ['/uploads/', '/icons/'];
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) {
      console.log(`[isPublicPath] ${pathname} matches public prefix ${prefix}`);
      return true;
    }
  }
  
  // Everything else is protected
  console.log(`[isPublicPath] ${pathname} is PROTECTED (not in public paths)`);
  return false;
}

export function requiresSubscription(pathname: string): boolean {
  const requiresSub = subscriptionRequiredPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  console.log(`💰 [requiresSubscription] Checking ${pathname}: ${requiresSub ? 'REQUIRES_PREMIUM' : 'NO_PREMIUM_REQUIRED'}`);
  if (requiresSub) {
    const matchingPath = subscriptionRequiredPaths.find(path => 
      pathname === path || pathname.startsWith(`${path}/`)
    );
    console.log(`💰 [requiresSubscription] Matched premium path: ${matchingPath}`);
  }
  
  return requiresSub;
} 