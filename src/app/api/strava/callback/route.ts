import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { exchangeCodeForToken, STRAVA_CONFIG } from "@/lib/strava/config"
import { connectStrava } from "@/lib/services/stravaService"

export const dynamic = "force-dynamic"

// Helper function to check for Strava configuration issues
function checkStravaConfig() {
  const issues = []

  if (!STRAVA_CONFIG.clientId) {
    issues.push("STRAVA_CLIENT_ID is not configured")
  } else if (STRAVA_CONFIG.clientId.trim() === '') {
    issues.push("STRAVA_CLIENT_ID is empty")
  }

  if (!STRAVA_CONFIG.clientSecret) {
    issues.push("STRAVA_CLIENT_SECRET is not configured")
  } else if (STRAVA_CONFIG.clientSecret.trim() === '') {
    issues.push("STRAVA_CLIENT_SECRET is empty")
  }

  const redirectUri = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/api/strava/callback'
    : 'https://aivery2.vercel.app/api/strava/callback'
    
  if (!redirectUri) {
    issues.push("Redirect URI is not configured")
  } else if (!redirectUri.startsWith('http')) {
    issues.push(`Redirect URI '${redirectUri}' appears to be invalid`)
  }

  return issues
}

export async function GET(request: NextRequest) {
  console.log('🔄 Strava callback: Received callback request', {
    url: request.url,
    timestamp: new Date().toISOString(),
    headers: Array.from(request.headers.entries())
      .filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase()))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
  })

  // Store debugging information
  const debugData: any = {
    timestamp: new Date().toISOString(),
    url: request.url,
    headers: Object.fromEntries(
      Array.from(request.headers.entries())
        .filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase()))
    ),
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    configIssues: [],
    sessionStatus: 'pending',
    environment: process.env.NODE_ENV || 'unknown',
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set'
  }

  try {
    // Check for Strava configuration issues
    const configIssues = checkStravaConfig()
    debugData.configIssues = configIssues
    
    if (configIssues.length > 0) {
      console.error('⚠️ Strava callback: Configuration issues detected:', configIssues)
      return NextResponse.redirect(
        new URL(`/integrations?error=strava_config_error&details=${encodeURIComponent(configIssues.join(', '))}`, request.url)
      )
    }

    // Get the authorization code from the URL
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')
    
    console.log('📝 Strava callback: URL parameters', {
      hasCode: !!code,
      codePrefix: code ? code.substring(0, 4) + '...' : 'none',
      error: error || 'none',
      state: state || 'none',
      allParams: Object.fromEntries(searchParams.entries())
    })

    if (error) {
      console.error('❌ Strava callback: Error from Strava', error)
      return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(error)}`, request.url))
    }

    if (!code) {
      console.error('❌ Strava callback: No code provided')
      return NextResponse.redirect(new URL('/integrations?error=no_code', request.url))
    }

    // Check authentication - try without failing if session not found
    let session = null
    try {
      session = await getServerSession(authOptions)
      debugData.sessionStatus = session?.user ? 'authenticated' : 'not authenticated'
      debugData.userId = session?.user?.id
      
      console.log('🔐 Strava callback: Auth check', {
        isAuthenticated: !!session?.user,
        userId: session?.user?.id || 'not authenticated',
        sessionKeys: session ? Object.keys(session) : []
      })
    } catch (sessionError) {
      console.error('❌ Strava callback: Session error:', sessionError)
      debugData.sessionStatus = 'error'
      debugData.sessionError = sessionError instanceof Error ? sessionError.message : String(sessionError)
    }

    // If no authenticated user, redirect to login with return URL to come back here
    if (!session?.user) {
      console.log('❌ Strava callback: User not authenticated')
      
      // Store the code and state in query params to use after login
      let returnUrl = `/api/strava/callback?code=${encodeURIComponent(code)}`
      if (state) {
        returnUrl += `&state=${encodeURIComponent(state)}`
      }
      
      // Encode the return URL
      const encodedReturnUrl = encodeURIComponent(returnUrl)
      
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodedReturnUrl}`, request.url)
      )
    }

    console.log('✅ Strava callback: Processing code for user', session.user.id)

    try {
      // Connect to Strava with the auth code - wrap this in a try block to handle specific errors
      console.log('🔄 Strava callback: Attempting to exchange code for token...')
      
      // Connect to Strava with the auth code
      const result = await connectStrava(session.user.id, code)
      console.log('🎉 Strava connection successful:', result)

      // Redirect back to the integrations page with success
      return NextResponse.redirect(new URL('/integrations?success=strava_connected', request.url))
    } catch (connectionError) {
      console.error('❌ Strava callback: Connection error:', connectionError)
      
      // Get a more specific error message
      const errorMessage = connectionError instanceof Error 
        ? connectionError.message 
        : 'strava_connection_failed'
      
      // Add more detailed error logging
      console.error('🔍 Strava connection error details:', {
        userId: session.user.id,
        error: errorMessage,
        stack: connectionError instanceof Error ? connectionError.stack : 'No stack trace',
        clientId: STRAVA_CONFIG.clientId ? STRAVA_CONFIG.clientId.substring(0, 4) + '...' : 'not set',
        hasClientSecret: !!STRAVA_CONFIG.clientSecret,
        redirectUri: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/api/strava/callback'
          : 'https://aivery2.vercel.app/api/strava/callback',
        callbackUrl: request.url
      })
      
      // Categorize common errors for better user experience
      let userFriendlyError = 'strava_connection_failed';
      
      if (errorMessage.includes('Invalid authorization code')) {
        userFriendlyError = 'strava_invalid_code';
      } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('credentials')) {
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
    console.error('❌ Strava callback: Unexpected error:', error)
    
    // Add more detailed error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error('🔍 Strava callback unexpected error details:', {
      error: errorMessage,
      stack: errorStack,
      requestUrl: request.url,
      stravaConfig: {
        hasClientId: !!STRAVA_CONFIG.clientId,
        hasClientSecret: !!STRAVA_CONFIG.clientSecret,
        redirectUri: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/api/strava/callback'
          : 'https://aivery2.vercel.app/api/strava/callback'
      },
      debugData: debugData
    })
    
    return NextResponse.redirect(
      new URL('/integrations?error=strava_callback_failed', request.url)
    )
  }
} 