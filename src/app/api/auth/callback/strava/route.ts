import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
// ... other imports ...

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
// ... existing code ...
} 