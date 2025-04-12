import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';

// Export dynamic runtime
export const dynamic = 'force-dynamic';

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

    console.log(`Generating Blob storage URL for client-side upload to path: ${blobPath}`);

    // Generate a blob placeholder to get a presigned PUT URL
    // The contentType here should ideally match what the client will upload
    const blob = await put(blobPath, ' ', { // Use a single space as minimal placeholder content
      access: 'public', // Required for client-side PUT URL generation
      contentType: 'application/zip',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    console.log('Generated blob storage URL:', blob.url);
    console.log('Pathname:', blob.pathname);

    // Return the URL (which the client will PUT to) and the final pathname with CORS headers
    return NextResponse.json({ 
        url: blob.url, // The client PUTs to this URL
        pathname: blob.pathname,
        downloadUrl: blob.url // Keep downloadUrl consistent, it's the same
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*', // In production, set this to your specific domain
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Error generating client-side upload URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // In production, set this to your specific domain
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 