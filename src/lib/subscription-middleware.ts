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
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token?.sub) {
      return { hasAccess: false, tier: null, userId: null, error: 'Not authenticated' };
    }

    const userId = token.sub;

    // For middleware, we need to check the user's tier
    // We'll need to make a database call here
    // Note: In middleware, we need to be careful about database calls for performance
    
    // For now, we'll get the tier from the token if it's available
    // The token should include the user's tier (we'll need to update NextAuth config)
    const tier = (token as any).tier || 'free';
    
    const hasAccess = tier === 'premium' || tier === 'expert';
    
    console.log(`[SUBSCRIPTION-CHECK] User ${userId} has tier: ${tier}, hasAccess: ${hasAccess}`);
    
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

// Paths that don't require premium access (auth flow + payment flow + landing page)
export const publicPaths = [
  '/', // Landing page - public access
  '/login',
  '/register', 
  '/forgot-password',
  '/reset',
  '/api/auth/',
  '/api/stripe/webhook',
  '/api/stripe/create-checkout-session',
  '/api/stripe/create-portal-session',
  '/api/health',
  '/api/user', // User API needed for authentication
  '/api/debug-auth',
  '/api/debug-token',
  '/api/middleware-test',
  '/subscribe', // New subscription page
  '/payment-success',
  '/payment-canceled',
  '/pricing', // Pricing page
  '/debug-token', // Debug page for testing
  '/manifest.json', // PWA manifest
  '/icon.svg', // App icon
  '/.well-known/', // Well-known paths for various services
  '/favicon.ico' // Favicon
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
  return publicPaths.some(path => {
    if (path.endsWith('/')) {
      return pathname.startsWith(path);
    }
    // Exact match or starts with path + slash (but not root path)
    if (path === '/') {
      return pathname === '/';
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function requiresSubscription(pathname: string): boolean {
  return subscriptionRequiredPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
} 