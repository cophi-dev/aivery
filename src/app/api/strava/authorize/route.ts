import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStravaAuthUrl, STRAVA_CONFIG } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

// Test that we can reach Strava API
async function testStravaConnectivity() {
  try {
    // Try a HEAD request to the Strava authorization endpoint to check connectivity
    const response = await fetch("https://www.strava.com", {
      method: "HEAD",
      cache: "no-cache",
    });
    
    return {
      reachable: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    console.error("❌ Cannot reach Strava:", error);
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function GET(request: NextRequest) {
  console.log('🔄 Strava authorize: Starting authorization process', {
    url: request.url,
    timestamp: new Date().toISOString(),
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV
  })
  
  try {
    // Test Strava connectivity first
    const connectivityTest = await testStravaConnectivity();
    console.log("🔍 Strava connectivity test:", connectivityTest);
    
    if (!connectivityTest.reachable) {
      return NextResponse.json({ 
        error: "Cannot connect to Strava API", 
        details: connectivityTest 
      }, { status: 502 });
    }
    
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log('🔐 Strava authorize: Auth check', {
      isAuthenticated: !!session?.user,
      userId: session?.user?.id || 'not authenticated',
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      } : null
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
        hasClientSecret: !!STRAVA_CONFIG.clientSecret,
        clientId: STRAVA_CONFIG.clientId || 'missing',
        clientIdLength: STRAVA_CONFIG.clientId ? STRAVA_CONFIG.clientId.length : 0,
        hasClientSecretValue: !!STRAVA_CONFIG.clientSecret,
        secretLength: STRAVA_CONFIG.clientSecret ? STRAVA_CONFIG.clientSecret.length : 0
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
      redirectUri: process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/strava/callback'
        : 'https://aivery2.vercel.app/api/strava/callback',
      scopes: STRAVA_CONFIG.scopes
    })
    
    // Redirect directly to Strava instead of returning the URL
    console.log('🔀 Strava authorize: Redirecting to Strava authorization page')
    return NextResponse.redirect(authUrl)
  } catch (error) {
    // Log any errors
    console.error('⚠️ Strava authorize: Error', error)
    
    // Return error response
    return NextResponse.json({ 
      error: "Failed to generate Strava authorization URL", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
} 