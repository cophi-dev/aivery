import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";

// Rate limiting: Allow 5 uploads per 10 minutes per user
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  analytics: true,
  prefix: "@upstash/ratelimit_strava_upload",
});

// Config for App Router to handle large requests potentially
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60 seconds for the upload to Blob

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Apply rate limiting
  const identifier = userId;
  const { success: rateLimitSuccess, limit, remaining, reset } = await ratelimit.limit(identifier);

  if (!rateLimitSuccess) {
    console.warn(`Rate limit exceeded for user ${userId} on Strava upload.`);
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { 
      status: 429, 
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      }
    });
  }
  
  console.log(`Strava upload attempt by user ${userId}. Rate limit remaining: ${remaining}`);

  // Check for content type to ensure it's form data
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    console.error('Invalid content type for file upload:', contentType);
    return NextResponse.json({ error: 'Invalid request format. Expected multipart/form-data.' }, { status: 400 });
  }

  try {
    // Get file from the FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }
    
    // Validate file is a zip file
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid file type, must be .zip' }, { status: 400 });
    }
    
    // Validate file size server-side before reading into buffer (e.g., 10MB limit)
    const MAX_FILE_SIZE_MB = 10;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
       console.warn(`Upload rejected for user ${userId}. File size ${file.size} exceeds limit ${MAX_FILE_SIZE_BYTES}`);
       return NextResponse.json({ error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.` }, { status: 413 });
    }
    
    console.log(`Received file for upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Create a unique path including user ID and timestamp
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;
    
    // Convert the file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`Uploading ${buffer.length} bytes to Vercel Blob at path: ${blobPath}`);
    
    // Upload directly to Vercel Blob from the server
    const blob = await put(blobPath, buffer, {
      access: 'public', // Blob needs to be public for the subsequent import step to fetch it
      contentType: 'application/zip',
      addRandomSuffix: false
    });
    
    console.log(`Successfully uploaded file to Vercel Blob for user ${userId}: ${blob.url}`);
    
    // Return ONLY the blob information needed by the client (pathname)
    return NextResponse.json({
      success: true,
      pathname: blob.pathname,
      url: blob.url // Include URL for potential debugging or direct access if needed
    });
    
  } catch (error) {
    console.error('Error uploading file to Vercel Blob:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    // Check for potential specific errors like payload size if put fails unexpectedly
    if (error instanceof Error && error.message.includes('body size is too large')) {
        return NextResponse.json({ error: 'File processing failed due to size limits.' }, { status: 413 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 