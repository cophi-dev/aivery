import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Extremely simplified middleware to prevent redirect loops
export async function middleware(request: NextRequest) {
  // Get the token but don't throw errors if it fails
  let token
  try {
    token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET,
    })
  } catch (error) {
    // If token verification fails, just proceed without a token
    console.error('Error in middleware token verification:', error)
    token = null
  }
  
  // Get the pathname
  const path = request.nextUrl.pathname
  
  // Public paths that don't need authentication
  if (
    path === '/login' || 
    path === '/register' || 
    path === '/forgot-password' || 
    path === '/reset' || 
    path.startsWith('/api/auth/') || 
    path.startsWith('/api/reset-session') ||
    path === '/health'
  ) {
    // Public path - always proceed
    return NextResponse.next()
  }
  
  // For protected paths, redirect to login if not authenticated
  if (!token) {
    const url = new URL('/login', request.url)
    // Don't carry over any query parameters to avoid loops
    return NextResponse.redirect(url)
  }
  
  // If authenticated, allow access to protected routes
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 