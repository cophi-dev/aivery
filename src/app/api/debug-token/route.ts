import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkPremiumAccess } from '@/lib/subscription-middleware'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Get the JWT token directly
    const token = await getToken({
      req: request,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    // Check premium access
    const premiumCheck = await checkPremiumAccess(request);

    const debug = {
      timestamp: new Date().toISOString(),
      token: {
        exists: !!token,
        sub: token?.sub || 'Not set',
        tier: (token as any)?.tier || 'Not set',
        id: (token as any)?.id || 'Not set',
        nickname: (token as any)?.nickname || 'Not set',
        email: token?.email || 'Not set',
      },
      premiumCheck: {
        hasAccess: premiumCheck.hasAccess,
        tier: premiumCheck.tier,
        userId: premiumCheck.userId,
        error: premiumCheck.error,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasSecret: !!process.env.NEXTAUTH_SECRET,
      }
    }

    return NextResponse.json(debug)
  } catch (error) {
    console.error('Error in debug token API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve token debug info',
        errorMessage: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 