import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { parse } from 'cookie';

const secret = process.env.NEXTAUTH_SECRET;

/** @deprecated Use checkAuthAccess — kept for import compatibility */
export const checkPremiumAccess = checkAuthAccess;

/** Returns whether the request has a valid signed-in user. All features are free once authenticated. */
export async function checkAuthAccess(request: NextRequest): Promise<{
  hasAccess: boolean;
  tier: string | null;
  userId: string | null;
  error?: string;
}> {
  try {
    const token = await getToken({
      req: request,
      secret,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token?.sub) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader && process.env.NODE_ENV === 'production') {
        const tokenRetry = await getToken({
          req: request,
          secret,
          secureCookie: false,
        });
        if (tokenRetry?.sub) {
          return {
            hasAccess: true,
            tier: (tokenRetry as { tier?: string }).tier || 'free',
            userId: tokenRetry.sub,
          };
        }
      }
      return { hasAccess: false, tier: null, userId: null, error: 'Not authenticated' };
    }

    return {
      hasAccess: true,
      tier: (token as { tier?: string }).tier || 'free',
      userId: token.sub,
    };
  } catch (error) {
    console.error('Error checking auth:', error);
    return {
      hasAccess: false,
      tier: null,
      userId: null,
      error: 'Failed to check authentication',
    };
  }
}

/** Paths accessible without signing in */
export const publicPaths = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset',
  '/debug-token',
  '/debug-access',
  '/auth-test',
  '/share-test',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/api/strava/webhook',
  '/api/stripe/webhook',
  '/uploads/',
  '/icons/',
];

/** App routes that require a signed-in user */
export const authRequiredPaths = [
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
  '/api/dashboard',
  '/api/workout',
  '/api/workouts',
  '/api/exercises',
  '/api/chat',
  '/api/challenges',
  '/api/analytics',
  '/api/insight',
  '/api/my-story',
  '/api/ai',
];

/** @deprecated Use authRequiredPaths */
export const subscriptionRequiredPaths = authRequiredPaths;

export function isPublicPath(pathname: string): boolean {
  const exactPaths = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset',
    '/debug-token',
    '/debug-access',
    '/auth-test',
    '/share-test',
    '/manifest.json',
    '/icon.svg',
    '/favicon.ico',
    '/api/strava/webhook',
    '/api/stripe/webhook',
  ];

  if (exactPaths.includes(pathname)) {
    return true;
  }

  const publicPrefixes = ['/uploads/', '/icons/'];
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function requiresAuth(pathname: string): boolean {
  return authRequiredPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/** @deprecated Use requiresAuth */
export function requiresSubscription(pathname: string): boolean {
  return requiresAuth(pathname);
}
