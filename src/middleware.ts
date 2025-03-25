import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Array of paths that are public (don't require authentication)
const publicPaths = ['/', '/login', '/register', '/forgot-password', '/api/auth', '/check-db', '/init-db']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get the token to check authentication status
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  
  // Redirect authenticated users visiting the home page to dashboard
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Check if the path is public
  if (publicPaths.some(path => 
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )) {
    return NextResponse.next()
  }
  
  // For API routes (except auth API), verify the session
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    // You could implement API authentication here
    return NextResponse.next()
  }

  // If not authenticated, redirect to login
  if (!token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('callbackUrl', encodeURI(request.url))
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Add paths that need to be protected or to exclude from middleware
export const config = {
  matcher: [
    // Match all paths except for these:
    // - static files (/_next/, /images/, /favicon.ico, etc)
    // - API routes are handled separately within the middleware
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 