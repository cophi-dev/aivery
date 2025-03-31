import { NextRequest, NextResponse } from "next/server"
import { STRAVA_CONFIG } from "@/lib/strava/config"
import { getStravaAuthUrl } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // This is a diagnostic endpoint to check Strava configuration
  try {
    // Sanitize the config to not expose sensitive data
    const sanitizedConfig = {
      hasClientId: !!STRAVA_CONFIG.clientId,
      clientIdPrefix: STRAVA_CONFIG.clientId ? `${STRAVA_CONFIG.clientId.substring(0, 4)}...` : 'not set',
      hasClientSecret: !!STRAVA_CONFIG.clientSecret,
      redirectUri: STRAVA_CONFIG.redirectUri,
      scopes: STRAVA_CONFIG.scopes,
      authUrl: STRAVA_CONFIG.authUrl,
    }
    
    // Generate a test auth URL without redirecting
    let authUrl = null
    try {
      authUrl = getStravaAuthUrl()
    } catch (error) {
      authUrl = `Error generating URL: ${error instanceof Error ? error.message : String(error)}`
    }
    
    // Get all request headers for debugging
    const headers = Object.fromEntries(
      Array.from(request.headers.entries())
        .filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase()))
    )
    
    // Get all URL parameters for debugging
    const urlParams = Object.fromEntries(
      Array.from(new URL(request.url).searchParams.entries())
    )
    
    return NextResponse.json({
      success: true,
      message: "Strava integration status",
      config: sanitizedConfig,
      authUrl: authUrl ? authUrl.split('?')[0] + '?...' : null,
      fullAuthUrl: authUrl,
      request: {
        url: request.url,
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        headers: headers,
        urlParams: urlParams,
      },
      environmentInfo: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      }
    })
  } catch (error) {
    console.error("Error in Strava status endpoint:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 