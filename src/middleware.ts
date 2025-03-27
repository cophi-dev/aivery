import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Super minimal middleware - just skip auth checks entirely until we fix the login loops
export function middleware(request: NextRequest) {
  // Always allow the request to proceed
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