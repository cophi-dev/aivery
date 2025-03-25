import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { exchangeCodeForToken } from "@/lib/strava/config"
import { connectStrava } from "@/lib/services/stravaService"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Get the authorization code from the URL
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL('/integrations?error=strava_auth_failed', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/integrations?error=no_code', request.url))
    }

    // Exchange the code for tokens
    const tokens = await exchangeCodeForToken(code)

    // Store the tokens in the database
    await connectStrava(session.user.id, tokens)

    // Redirect back to the integrations page
    return NextResponse.redirect(new URL('/integrations?success=strava_connected', request.url))
  } catch (error) {
    console.error('Strava callback error:', error)
    return NextResponse.redirect(new URL('/integrations?error=strava_callback_failed', request.url))
  }
} 