import { NextRequest, NextResponse } from "next/server"
import { STRAVA_CONFIG } from "@/lib/strava/config"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check that required Strava config is present
  const configIssues = []
  
  if (!STRAVA_CONFIG.clientId) {
    configIssues.push("Missing STRAVA_CLIENT_ID environment variable")
  }
  
  if (!STRAVA_CONFIG.clientSecret) {
    configIssues.push("Missing STRAVA_CLIENT_SECRET environment variable")
  }
  
  const redirectUri = STRAVA_CONFIG.redirectUri
  if (!redirectUri || !redirectUri.startsWith('http')) {
    configIssues.push("Invalid redirect URI configuration")
  }
  
  // Create a list of available endpoints
  const availableEndpoints = [
    {
      path: "/api/strava/authorize",
      method: "GET",
      description: "Initiates Strava OAuth flow"
    },
    {
      path: "/api/strava/callback",
      method: "GET",
      description: "Callback endpoint for Strava OAuth flow"
    },
    {
      path: "/api/strava/import",
      method: "POST",
      description: "Import workouts from Strava archive"
    },
    {
      path: "/api/strava/webhook",
      method: "GET/POST",
      description: "Webhook endpoint for Strava events"
    },
    {
      path: "/api/strava/test",
      method: "GET",
      description: "Debug endpoint for Strava configuration (requires API key)"
    }
  ]
  
  return NextResponse.json({
    name: "Strava API",
    version: "1.0",
    status: configIssues.length === 0 ? "Ready" : "Configuration Issues",
    configIssues: configIssues.length > 0 ? configIssues : undefined,
    endpoints: availableEndpoints
  }, {
    status: configIssues.length === 0 ? 200 : 500
  })
} 