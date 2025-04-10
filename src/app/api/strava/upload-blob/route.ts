import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';

// Config for App Router to handle large requests
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Give this function extra time (60 seconds)

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  
  try {
    // Get file from the FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file is a zip file
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid file type, must be .zip' }, { status: 400 });
    }
    
    console.log(`Processing file upload: ${file.name} (${file.size} bytes)`);
    
    // Create a unique path including user ID and timestamp to prevent collisions
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;
    
    // Convert the file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`Uploading ${buffer.length} bytes to Vercel Blob at path: ${blobPath}`);
    
    // Upload directly to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'application/zip',
      addRandomSuffix: false
    });
    
    console.log('Uploaded file to Vercel Blob:', blob.url);
    
    // Return the blob information
    return NextResponse.json({
      success: true,
      pathname: blob.pathname,
      url: blob.url
    });
    
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 