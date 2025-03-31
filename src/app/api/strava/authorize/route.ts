import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStravaAuthUrl } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Get the Strava authorization URL
    const authUrl = getStravaAuthUrl()
    
    // Redirect to Strava authorization page
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Strava authorization error:', error)
    return NextResponse.redirect(new URL('/integrations?error=strava_auth_failed', request.url))
  }
} 