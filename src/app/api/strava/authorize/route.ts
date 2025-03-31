import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStravaAuthUrl, STRAVA_CONFIG } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ 
        error: "Authentication required", 
        redirectTo: '/login'
      }, { status: 401 })
    }
    
    // Check that Strava config exists
    if (!STRAVA_CONFIG.clientId || !STRAVA_CONFIG.clientSecret) {
      return NextResponse.json({
        error: "Strava API credentials are not configured",
        missing: !STRAVA_CONFIG.clientId ? "clientId" : "clientSecret"
      }, { status: 500 })
    }
    
    // Get the Strava authorization URL
    const authUrl = getStravaAuthUrl()
    
    // Return the auth URL instead of redirecting
    return new NextResponse(authUrl)
  } catch (error) {
    console.error('Strava authorization error:', error)
    return NextResponse.json({
      error: "Failed to generate Strava authorization URL",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 