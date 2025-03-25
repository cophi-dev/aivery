import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (session && session.user) {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email
        }
      });
    } else {
      return NextResponse.json({
        authenticated: false,
        message: "Not authenticated"
      });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({
      authenticated: false,
      error: "An error occurred checking authentication"
    }, { status: 500 });
  }
} 