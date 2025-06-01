import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Check if user has a valid premium subscription
export async function checkPremiumAccess(request: NextRequest): Promise<{
  hasAccess: boolean;
  tier: string | null;
  userId: string | null;
  error?: string;
}> {
  try {
    // Get the authentication token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

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