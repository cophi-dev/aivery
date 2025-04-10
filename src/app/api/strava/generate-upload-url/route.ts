import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Config: Set maxDuration if needed, although this should be fast
// export const runtime = 'edge'; // Edge runtime is suitable for this

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { filename } = await request.json();

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    
    // Basic sanitization/validation
    if (!filename.toLowerCase().endsWith('.zip')) {
        return NextResponse.json({ error: 'Invalid file type, must be .zip' }, { status: 400 });
    }
    
    // Create a unique path including user ID and timestamp to prevent collisions
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;

    console.log(`Generating presigned URL for path: ${blobPath}`);

    const blob = await put(blobPath, '', {
      access: 'public', // Required for put, file itself won't be public if bucket isn't
      contentType: 'application/zip', // Set the expected content type
      addRandomSuffix: false, // We created a unique path already
      // Consider adding clientPayload: JSON.stringify({ userId }) if needed later
    });

    console.log('Generated presigned URL:', blob.url);

    // Return the presigned URL and the final path stored
    return NextResponse.json({ 
        url: blob.url, 
        pathname: blob.pathname // The actual path in the blob store
    });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 