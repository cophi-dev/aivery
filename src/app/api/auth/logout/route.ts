import { NextResponse } from 'next/server';

// Custom logout handler to explicitly clear all NextAuth cookies
export async function GET(request: Request) {
  // Get the domain from environment variable or extract from host
  const url = new URL(request.url);
  const cookieDomain = process.env.COOKIE_DOMAIN || url.hostname;
  
  console.log(`[LOGOUT] Processing logout, cookie domain: ${cookieDomain}`);
  
  // Create response with redirect to login page
  const response = NextResponse.redirect(new URL('/login', request.url));
  
  // Explicitly clear all NextAuth cookies
  const cookiesToClear = [
    'next-auth.session-token',
    'next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.callback-url',
    '__Host-next-auth.csrf-token',
    '__Secure-next-auth.session-token',
  ];
  
  // Clear each cookie with proper attributes
  cookiesToClear.forEach(name => {
    // Set the cookie with expiration in the past to clear it
    response.cookies.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/',
      domain: cookieDomain || undefined,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    });
    console.log(`[LOGOUT] Cleared cookie: ${name}`);
  });
  
  console.log('[LOGOUT] Redirecting to login page');
  return response;
} 