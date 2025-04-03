import { NextRequest, NextResponse } from "next/server"
import { STRAVA_CONFIG } from "@/lib/strava/config"
import { getStravaAuthUrl } from "@/lib/strava/config"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import AccountModel from "@/lib/db/models/account"
import dbConnect from "@/lib/db/mongodb"
import { refreshStravaToken } from "@/lib/strava"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // This is a diagnostic endpoint to check Strava configuration
  try {
    // Get the user's session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not authenticated',
        connected: false
      }, { status: 401 })
    }

    // Connect to DB
    await dbConnect()

    // Check if the user has a Strava account connected
    const stravaAccount = await AccountModel.findOne({
      userId: session.user.id,
      provider: 'strava'
    }).exec()

    if (!stravaAccount) {
      return NextResponse.json({ 
        success: true, 
        connected: false,
        message: 'No Strava account connected'
      })
    }

    // Verify token validity
    const nowInSeconds = Math.floor(Date.now() / 1000)
    let accessToken = stravaAccount.access_token
    let tokenValid = true

    // Check token expiration
    if (!accessToken || (stravaAccount.expires_at && stravaAccount.expires_at < nowInSeconds)) {
      console.log('Strava token expired, attempting refresh')
      
      try {
        accessToken = await refreshStravaToken(stravaAccount)
        if (!accessToken) {
          tokenValid = false
        }
      } catch (error) {
        console.error('Error refreshing token:', error)
        tokenValid = false
      }
    }

    // Test API call if token is valid
    let apiCallSuccess = false
    if (tokenValid && accessToken) {
      try {
        // Make a simple request to Strava API to check access
        const testResponse = await fetch('https://www.strava.com/api/v3/athlete', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        apiCallSuccess = testResponse.ok
        if (!testResponse.ok) {
          console.error('Strava API test failed:', await testResponse.text())
        }
      } catch (error) {
        console.error('Error making Strava API test call:', error)
      }
    }

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
    
    return NextResponse.json({
      success: true,
      message: "Strava integration status",
      connected: tokenValid && apiCallSuccess,
      account: {
        exists: !!stravaAccount,
        tokenValid,
        apiCallSuccess,
        athleteId: stravaAccount?.providerAccountId || null,
        expiryStatus: stravaAccount?.expires_at ? 
          { 
            expiresAt: new Date(stravaAccount.expires_at * 1000).toISOString(),
            expired: stravaAccount.expires_at < nowInSeconds 
          } : null
      },
      config: sanitizedConfig,
      authUrl: authUrl ? authUrl.split('?')[0] + '?...' : null,
    })
  } catch (error) {
    console.error("Error in Strava status endpoint:", error)
    
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
} 