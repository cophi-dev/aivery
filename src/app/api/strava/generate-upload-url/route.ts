import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUploadUrl } from '@vercel/blob/client';

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

    console.log(`Generating URL for client-side upload to path: ${blobPath}`);

    // Generate upload URL using @vercel/blob/client generateUploadUrl
    const { url, uploadUrl, pathname } = await generateUploadUrl({
      pathname: blobPath,
      // Access and CORS settings
      contentType: 'application/zip',
      access: 'public',
      maxSize: 50 * 1024 * 1024, // 50MB max size
    });

    console.log('Generated client-side upload URL:', uploadUrl);
    console.log('Generated client-side upload pathname:', pathname);

    // Return the upload URL, pathname, and additional info for client use
    return NextResponse.json({ 
        url: uploadUrl,
        pathname,
        downloadUrl: url 
    });

  } catch (error) {
    console.error('Error generating client-side upload URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 