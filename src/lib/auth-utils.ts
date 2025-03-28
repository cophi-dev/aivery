import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

/**
 * Helper function to check if a user is authenticated for API routes
 * Returns the session if authenticated, otherwise returns null and sends a 401 response
 */
export async function authenticateApiRoute(request: NextRequest) {
  try {
    // Try multiple authentication methods
    
    // Method 1: Server session (standard approach)
    const session = await getServerSession(authOptions);
    
    // Method 2: JWT token from request
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
    
    // Debug info for development environment
    let debugInfo: any = {};
    if (process.env.NODE_ENV === 'development') {
      debugInfo = {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id,
        hasToken: !!token,
        tokenSub: token?.sub,
      };
    }
    
    // Check if we have valid authentication from any method
    const isAuthenticated = (
      (!!session?.user?.id) || // Server session
      (!!token?.sub) // JWT token
    );
    
    // If no valid authentication, return 401
    if (!isAuthenticated) {
      // In development, include debug info
      if (process.env.NODE_ENV === 'development') {
        return {
          session: null,
          response: NextResponse.json(
            { 
              error: "Not authenticated", 
              debug: debugInfo 
            },
            { status: 401 }
          )
        };
      }
      
      // In production, just return the error message
      return {
        session: null,
        response: NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        )
      };
    }
    
    // Create a unified session from whatever auth info we have
    const unifiedSession = {
      user: {
        id: session?.user?.id || token?.sub || '',
        name: session?.user?.name || token?.name || '',
        email: session?.user?.email || token?.email || '',
        image: session?.user?.image || (token?.picture as string) || null,
      }
    };
    
    // User is authenticated, return the session
    return {
      session: unifiedSession,
      response: null
    };
  } catch (error) {
    console.error("Error authenticating API route:", error);
    
    // Add more debugging in development
    if (process.env.NODE_ENV === 'development') {
      return {
        session: null,
        response: NextResponse.json(
          { 
            error: "Authentication error", 
            details: String(error),
            stack: (error as Error).stack
          },
          { status: 500 }
        )
      };
    }
    
    // In production, just return a basic error
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentication error" },
        { status: 500 }
      )
    };
  }
}

/**
 * Wraps an API handler function with authentication
 * If authenticated, calls the handler function with the session
 * Otherwise, returns a 401 response
 */
export function withApiAuth(handler: (req: NextRequest, session: any) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const { session, response } = await authenticateApiRoute(request);
    
    // If there's an authentication error, return the error response
    if (response) {
      return response;
    }
    
    // Call the handler with the session
    return handler(request, session);
  };
} 