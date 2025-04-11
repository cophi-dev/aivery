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
  prefix: "@upstash/ratelimit_strava_upload_edge", // Use a different prefix for edge
});

// --- Use Edge Runtime ---
export const runtime = 'edge';
// No maxDuration needed for Edge (defaults are usually sufficient)

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Apply rate limiting (using edge-compatible KV and Ratelimit)
  const identifier = userId;
  const { success: rateLimitSuccess, limit, remaining, reset } = await ratelimit.limit(identifier);

  if (!rateLimitSuccess) {
    console.warn(`Rate limit exceeded for user ${userId} on Strava upload (Edge).`);
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { 
      status: 429, 
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      }
    });
  }
  
  console.log(`Strava upload attempt by user ${userId} (Edge). Rate limit remaining: ${remaining}`);

  // Check for content type to ensure it's form data
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    console.error('Invalid content type for file upload (Edge): ', contentType);
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
    
    // Validate file size server-side (e.g., 10MB limit)
    const MAX_FILE_SIZE_MB = 10;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
       console.warn(`Upload rejected for user ${userId} (Edge). File size ${file.size} exceeds limit ${MAX_FILE_SIZE_BYTES}`);
       return NextResponse.json({ error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.` }, { status: 413 });
    }
    
    console.log(`Received file for upload (Edge): ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Create a unique path including user ID and timestamp
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;
    
    // Pass the File object (Blob) directly to put()
    console.log(`Uploading file blob directly to Vercel Blob at path (Edge): ${blobPath}`);
    
    const blob = await put(blobPath, file, { // Pass File object directly
      access: 'public', // Blob needs to be public for the subsequent import step to fetch it
      contentType: 'application/zip', // Specify expected type
      addRandomSuffix: false
    });
    
    console.log(`Successfully uploaded file to Vercel Blob for user ${userId} (Edge): ${blob.url}`);
    
    // Return ONLY the blob information needed by the client (pathname)
    return NextResponse.json({
      success: true,
      pathname: blob.pathname,
      url: blob.url // Include URL for potential debugging or direct access if needed
    });
    
  } catch (error) {
    console.error('Error uploading file to Vercel Blob (Edge): ', error);
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    if (error instanceof Error && error.message.includes('body size is too large')) {
        return NextResponse.json({ error: 'File processing failed due to size limits.' }, { status: 413 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 