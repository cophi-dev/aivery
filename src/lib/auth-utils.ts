import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Helper function to check if a user is authenticated for API routes
 * Returns the session if authenticated, otherwise returns null and sends a 401 response
 */
export async function authenticateApiRoute(request: NextRequest) {
  try {
    // Get the session using the request
    const session = await getServerSession(authOptions);
    
    // If no session or no user, the user is not authenticated
    if (!session?.user) {
      return {
        session: null,
        response: NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        )
      };
    }
    
    // User is authenticated, return the session
    return {
      session,
      response: null
    };
    
  } catch (error) {
    console.error("Error authenticating API route:", error);
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentication error", details: String(error) },
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