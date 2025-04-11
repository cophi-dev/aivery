import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// This route is intentionally simple and just attempts deletion.
// It's called on error, so we don't want complex logic here.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Basic auth check
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pathname } = await request.json();

    if (!pathname || typeof pathname !== 'string') {
      return NextResponse.json({ error: 'Missing pathname' }, { status: 400 });
    }

    // Basic validation that the user is deleting their own file
    if (!pathname.startsWith(`strava-imports/${userId}/`)) {
      console.warn(`Attempt to delete unauthorized blob path by user ${userId}: ${pathname}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(`Attempting to clean up blob: ${pathname}`);
    await del(pathname);
    console.log(`Blob cleanup successful for: ${pathname}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    // Log the error but return success, as cleanup is best-effort
    console.error('Error during blob cleanup:', error);
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    // Return success even on error, as this is a non-critical cleanup step
    return NextResponse.json({ success: true, warning: message });
  }
} 