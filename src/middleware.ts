import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { VERSION } from '@/app/version'
import {
  checkAuthAccess,
  isPublicPath,
  requiresAuth,
} from '@/lib/subscription-middleware'

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset']
const LEGACY_BILLING_PATHS = ['/subscribe', '/pricing', '/payment-success', '/payment-canceled']

function redirectTo(request: NextRequest, pathname: string, search?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = search ?? ''
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
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
    pathname === '/api/middleware-test'
  ) {
    return NextResponse.next()
  }

  const auth = await checkAuthAccess(request)

  if (LEGACY_BILLING_PATHS.includes(pathname)) {
    return redirectTo(request, auth.userId ? '/dashboard' : '/register')
  }

  if (pathname === '/') {
    if (auth.userId) {
      return redirectTo(request, '/dashboard')
    }
    return NextResponse.next()
  }

  if (AUTH_PAGES.includes(pathname)) {
    if (auth.userId) {
      return redirectTo(request, '/dashboard')
    }
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (!auth.userId) {
    const callback = encodeURIComponent(pathname)
    return redirectTo(request, '/login', `callbackUrl=${callback}`)
  }

  if (pathname.startsWith('/api/') && requiresAuth(pathname)) {
    return NextResponse.next()
  }

  if (requiresAuth(pathname)) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('X-App-Version', VERSION)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/stripe/webhook|api/strava/webhook).*)',
  ],
}
