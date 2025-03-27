import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// This middleware handles authentication for protected routes
export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname
  
  // Define public paths that don't require authentication
  const publicPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset',
    '/api/reset-session',
    '/api/auth',
    '/health',
  ]
  
  // Check if the current path is public
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || path.startsWith('/api/auth/') || path.startsWith('/api/health')
  )

  // Check for authentication token
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET,
  })
  
  // Simplify logic to prevent loops:
  // 1. If path is public and user is authenticated, let them access it (no redirects)
  // 2. If path is public and user is not authenticated, let them access it
  // 3. If path is protected and user is not authenticated, redirect to login
  // 4. If path is protected and user is authenticated, let them access it
  
  // Authenticated users can access all paths
  if (token) {
    return NextResponse.next()
  }
  
  // Unauthenticated users can access public paths
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Redirect unauthenticated users trying to access protected routes
  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
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