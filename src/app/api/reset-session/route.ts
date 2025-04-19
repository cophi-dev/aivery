import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get the cookies
    const cookieStore = cookies()
    
    // Delete all auth-related cookies
    const allCookies = cookieStore.getAll()
    allCookies.forEach(cookie => {
      if (cookie.name.includes('next-auth') || 
          cookie.name.includes('token') || 
          cookie.name.includes('session')) {
        cookieStore.delete(cookie.name)
      }
    })
    
    // Create an array of cookie reset headers
    const cookieResetHeaders = [
      'next-auth.session-token=; Path=/; Max-Age=0; HttpOnly',
      'next-auth.csrf-token=; Path=/; Max-Age=0; HttpOnly',
      'next-auth.callback-url=; Path=/; Max-Age=0; HttpOnly',
      '__Secure-next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; Secure',
      '__Host-next-auth.csrf-token=; Path=/; Max-Age=0; HttpOnly; Secure',
    ];
    
    // Create response with multiple Set-Cookie headers
    const response = NextResponse.json({ 
      success: true, 
      message: 'Session reset successful' 
    });
    
    // Add each cookie reset header individually
    cookieResetHeaders.forEach(header => {
      response.headers.append('Set-Cookie', header);
    });
    
    // Add other headers
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Clear-Site-Data', '"cookies", "storage"');
    
    return response;
  } catch (error) {
    console.error('Error resetting session:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to reset session' },
      { status: 500 }
    )
  }
} 