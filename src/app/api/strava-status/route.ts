import { NextRequest, NextResponse } from "next/server"
import { STRAVA_CONFIG } from "@/lib/strava/config"
import { getStravaAuthUrl } from "@/lib/strava/config"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import { getValidAccessToken, getStravaIntegration } from "@/lib/services/stravaService"

export const dynamic = "force-dynamic"

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
    const integration = await getStravaIntegration(session.user.id);

    if (!integration) {
      return NextResponse.json({ 
        success: true, 
        connected: false,
        message: 'No Strava account connected'
      })
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
    
    // Verify token validity
    let accessToken = null;
    let tokenValid = false;
    let apiCallSuccess = false;
    let athleteId = null;
    let expiryStatus = null;

    try {
      accessToken = await getValidAccessToken(session.user.id);
      tokenValid = true;
      athleteId = integration.athleteId;

      // Test API call if token is valid, but only if the URL includes ?test=true parameter
      const url = new URL(request.url)
      const shouldTest = url.searchParams.get('test') === 'true'

      if (shouldTest && accessToken) {
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
            tokenValid = false;
          }
        } catch (error) {
          console.error('Error making Strava API test call:', error)
          apiCallSuccess = false;
          tokenValid = false;
        }
      } else if (accessToken) {
        apiCallSuccess = true;
      }

    } catch (error) {
      console.error('Error validating Strava token via getValidAccessToken:', error)
      tokenValid = false;
    }

    return NextResponse.json({
      success: true,
      message: "Strava integration status",
      connected: tokenValid && apiCallSuccess,
      account: {
        exists: !!integration,
        tokenValid,
        apiCallSuccess,
        athleteId: athleteId,
        expiryStatus: tokenValid ? { expired: false } : { expired: true }
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