import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid file type, must be .zip' }, { status: 400 });
    }

    // Create a unique path including user ID and timestamp to prevent collisions
    const userId = session.user.id;
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;

    console.log(`Server uploading file to Blob storage path: ${blobPath}`);

    // Upload the file to Vercel Blob storage
    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: 'application/zip',
      addRandomSuffix: false,
    });

    console.log('Server-side upload successful:', blob.url);

    // Return the blob URL and pathname
    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error('Error during server-side upload:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 