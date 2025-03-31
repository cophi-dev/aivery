import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStravaAuthUrl, STRAVA_CONFIG } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('🔄 Strava authorize: Starting authorization process', {
    url: request.url,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log('🔐 Strava authorize: Auth check', {
      isAuthenticated: !!session?.user,
      userId: session?.user?.id || 'not authenticated'
    })
    
    if (!session?.user) {
      console.log('❌ Strava authorize: User not authenticated')
      return NextResponse.json({ 
        error: "Authentication required", 
        redirectTo: '/login'
      }, { status: 401 })
    }
    
    // Check that Strava config exists
    if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
      console.error('⚠️ Strava authorize: Missing API credentials', {
        hasClientId: !!STRAVA_CONFIG.clientId,
        hasClientSecret: !!STRAVA_CONFIG.clientSecret
      })
      return NextResponse.json({
        error: "Strava API credentials are not configured",
        missing: !STRAVA_CONFIG.clientId ? "clientId" : "clientSecret"
      }, { status: 500 })
    }
    
    // Get the Strava authorization URL
    const authUrl = getStravaAuthUrl()
    console.log('✅ Strava authorize: Generated auth URL', {
      authUrlBase: authUrl.split('?')[0],
      clientIdPrefix: STRAVA_CONFIG.clientId.substring(0, 4) + '...',
      redirectUri: STRAVA_CONFIG.redirectUri,
      scopes: STRAVA_CONFIG.scopes
    })
    
    // Redirect directly to Strava instead of returning the URL
    console.log('🔀 Strava authorize: Redirecting to Strava authorization page')
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('❌ Strava authorize: Error generating auth URL:', error)
    
    // Add detailed error context
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : "No stack trace"
    
    console.error('🔍 Strava authorize error details:', {
      error: errorMessage,
      stack: errorStack,
      stravaConfig: {
        hasClientId: !!STRAVA_CONFIG.clientId,
        hasClientSecret: !!STRAVA_CONFIG.clientSecret,
        redirectUri: STRAVA_CONFIG.redirectUri,
        scopes: STRAVA_CONFIG.scopes
      }
    })
    
    return NextResponse.json({
      error: "Failed to generate Strava authorization URL",
      message: errorMessage
    }, { status: 500 })
  }
} 