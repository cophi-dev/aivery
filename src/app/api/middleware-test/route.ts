import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries())
  
  return NextResponse.json({
    path: request.nextUrl.pathname,
    hasVersionHeader: !!headers['x-app-version'],
    allHeaders: headers,
    timestamp: new Date().toISOString()
  })
} 