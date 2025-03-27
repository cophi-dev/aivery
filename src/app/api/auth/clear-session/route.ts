import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // This endpoint helps clear problematic cookies to fix the 431 error
  const response = NextResponse.json({ 
    success: true, 
    message: "Session cookies cleared for troubleshooting"
  });
  
  // Set expiration date in the past to clear all auth cookies
  const expires = new Date(0);
  
  // Clear NextAuth cookies
  response.cookies.set("next-auth.session-token", "", { 
    expires, 
    path: "/" 
  });
  
  response.cookies.set("next-auth.callback-url", "", {
    expires,
    path: "/"
  });
  
  response.cookies.set("next-auth.csrf-token", "", {
    expires,
    path: "/"
  });

  // Set headers to prevent caching
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  
  return response;
} 