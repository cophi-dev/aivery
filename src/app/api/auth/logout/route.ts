import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Force clear all session cookies
async function clearAllCookies(request: Request) {
  try {
    // Get cookie domain options
    const url = new URL(request.url);
    const host = url.hostname;
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    
    console.log(`[LOGOUT] Processing logout request from ${url}`);
    console.log(`[LOGOUT] Host: ${host}, Cookie domain: ${cookieDomain || 'Not set'}`);
    
    // Get all current cookies to check what we need to clear
    const cookieStore = cookies();
    const currentCookies = cookieStore.getAll();
    console.log(`[LOGOUT] Current cookies: ${currentCookies.map(c => c.name).join(', ')}`);
    
    // Create Headers object with all Set-Cookie headers
    const headers = new Headers();
    
    // List of cookies to force clear
    const cookiesToClear = [
      'next-auth.session-token',
      'next-auth.callback-url',
      'next-auth.csrf-token',
      '__Secure-next-auth.callback-url',
      '__Host-next-auth.csrf-token',
      '__Secure-next-auth.session-token',
    ];
    
    // Add any auth cookies we found but didn't explicitly list
    currentCookies.forEach(cookie => {
      if ((cookie.name.toLowerCase().includes('auth') || 
           cookie.name.toLowerCase().includes('session')) && 
           !cookiesToClear.includes(cookie.name)) {
        cookiesToClear.push(cookie.name);
      }
    });
    
    // Clear cookies with 3 different approaches for maximum compatibility
    cookiesToClear.forEach(name => {
      // 1. Clear with domain and path
      if (cookieDomain) {
        headers.append('Set-Cookie', 
          `${name}=; Max-Age=0; Path=/; Domain=${cookieDomain}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}`);
      }
      
      // 2. Clear with only path
      headers.append('Set-Cookie', 
        `${name}=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}`);
      
      // 3. Clear with SameSite=None
      headers.append('Set-Cookie', 
        `${name}=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}`);
    });
    
    // Count how many Set-Cookie headers we have
    let cookieCount = 0;
    headers.forEach((_, name) => {
      if (name.toLowerCase() === 'set-cookie') cookieCount++;
    });
    
    console.log(`[LOGOUT] Added ${cookieCount} Set-Cookie headers`);
    console.log('[LOGOUT] Redirecting to login page');
    
    // Create response with headers and redirect
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login',
        ...Object.fromEntries(headers.entries())
      }
    });
  } catch (error) {
    console.error('[LOGOUT] Error in logout handler:', error);
    // Return redirect even if there was an error
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Handle GET requests
export async function GET(request: Request) {
  return clearAllCookies(request);
}

// Handle POST requests too for more direct access that might bypass middleware
export async function POST(request: Request) {
  return clearAllCookies(request);
} 