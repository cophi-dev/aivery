import { NextRequest, NextResponse } from "next/server"
import { STRAVA_CONFIG } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check for API key authentication
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Create a sanitized version of the config (without full secrets)
    const sanitizedConfig = {
      clientId: STRAVA_CONFIG.clientId ? `${STRAVA_CONFIG.clientId.substring(0, 4)}...` : 'not set',
      clientSecret: STRAVA_CONFIG.clientSecret ? `${STRAVA_CONFIG.clientSecret.substring(0, 4)}...` : 'not set',
      redirectUri: STRAVA_CONFIG.redirectUri,
      scopes: STRAVA_CONFIG.scopes,
      authUrl: STRAVA_CONFIG.authUrl,
      tokenUrl: STRAVA_CONFIG.tokenUrl,
      apiUrl: STRAVA_CONFIG.apiUrl,
      
      // Additional checks
      clientIdExists: !!STRAVA_CONFIG.clientId,
      clientSecretExists: !!STRAVA_CONFIG.clientSecret,
      redirectUriValid: STRAVA_CONFIG.redirectUri && STRAVA_CONFIG.redirectUri.startsWith('http'),
      
      // Environment info
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    }
    
    // Environment variable keys
    const envKeys = Object.keys(process.env).filter(key => 
      key.includes('STRAVA') || 
      key.includes('URL') || 
      key === 'NODE_ENV'
    ).sort()
    
    return NextResponse.json({
      success: true,
      config: sanitizedConfig,
      environmentVariables: envKeys,
      fullRedirectUri: STRAVA_CONFIG.redirectUri
    })
  } catch (error) {
    console.error('Error in Strava test endpoint:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 