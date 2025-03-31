import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { exchangeCodeForToken } from "@/lib/strava/config"
import { connectStrava } from "@/lib/services/stravaService"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('Strava callback: User not authenticated')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Get the authorization code from the URL
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('Strava callback: Error from Strava', error)
      return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(error)}`, request.url))
    }

    if (!code) {
      console.error('Strava callback: No code provided')
      return NextResponse.redirect(new URL('/integrations?error=no_code', request.url))
    }

    console.log('Strava callback: Processing code for user', session.user.id)

    try {
      // Connect to Strava with the auth code
      const result = await connectStrava(session.user.id, code)
      console.log('Strava connection successful:', result)

      // Redirect back to the integrations page with success
      return NextResponse.redirect(new URL('/integrations?success=strava_connected', request.url))
    } catch (connectionError) {
      console.error('Strava callback: Connection error:', connectionError)
      
      // Get a more specific error message
      const errorMessage = connectionError instanceof Error 
        ? connectionError.message 
        : 'strava_connection_failed'
      
      // Add more detailed error logging
      console.error('Strava connection error details:', {
        userId: session.user.id,
        error: errorMessage,
        stack: connectionError instanceof Error ? connectionError.stack : 'No stack trace'
      })
      
      // Categorize common errors for better user experience
      let userFriendlyError = 'strava_connection_failed';
      
      if (errorMessage.includes('Invalid authorization code')) {
        userFriendlyError = 'strava_invalid_code';
      } else if (errorMessage.includes('Authentication failed')) {
        userFriendlyError = 'strava_auth_failed';
      } else if (errorMessage.includes('Network error')) {
        userFriendlyError = 'strava_network_error';
      }
      
      // Encode the error for the URL
      const encodedError = encodeURIComponent(userFriendlyError)
      
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodedError}`, request.url)
      )
    }
  } catch (error) {
    // Handle any other unexpected errors
    console.error('Strava callback: Unexpected error:', error)
    
    // Add more detailed error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error('Strava callback unexpected error details:', {
      error: errorMessage,
      stack: errorStack
    })
    
    return NextResponse.redirect(
      new URL('/integrations?error=strava_callback_failed', request.url)
    )
  }
} 