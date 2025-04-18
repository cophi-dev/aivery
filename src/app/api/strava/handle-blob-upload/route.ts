import { put, type PutCommandOptions } from '@vercel/blob';
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Ensure Node.js runtime for stream/buffer handling
export const runtime = 'nodejs';

// Increase body size limit for this route specifically
// Note: This might require Vercel Pro/Enterprise for limits > 4.5MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow up to 10MB for Strava archives
    },
  },
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const filename = request.headers.get('x-vercel-filename') || 'strava-archive.zip';
  const contentType = request.headers.get('content-type') || 'application/zip';

  // Validate content type
  if (contentType !== 'application/zip') {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType}. Must be application/zip.` },
      { status: 400 },
    );
  }

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Generate a unique pathname
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;

    console.log(`Handling upload for user ${userId} to path: ${pathname}`);

    // 3. Get the request body stream/buffer
    // Check if request.blob() exists (newer Next.js/Web standard)
    let bodyStream: ReadableStream | Buffer;
    if (typeof request.blob === 'function') {
        const blobData = await request.blob();
        bodyStream = blobData.stream(); // Get a ReadableStream from the Blob
    } else if (request.body) {
        // Fallback for environments where .blob() isn't available but .body is
        bodyStream = request.body as unknown as ReadableStream; // Cast if necessary
    } else {
        // Last resort: try reading the buffer directly (might load all into memory)
        console.warn("Request.body stream not available, attempting to read buffer directly.");
        bodyStream = Buffer.from(await request.arrayBuffer());
    }
    
    if (!bodyStream) {
         return NextResponse.json({ error: 'Could not read request body.' }, { status: 400 });
    }

    // 4. Upload the stream/buffer using the basic put command
    const putOptions: PutCommandOptions = {
      contentType: contentType,
      access: 'public', 
      addRandomSuffix: false,
      // token: process.env.BLOB_READ_WRITE_TOKEN 
    };
    const blob = await put(pathname, bodyStream, putOptions);

    console.log('Upload successful:', blob.pathname, blob.url);

    // 5. Return the blob details (needed by the client helper)
    return NextResponse.json(blob);

  } catch (error) {
    console.error("Error handling direct blob upload:", error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }, // Use 500 for server-side errors during upload
    );
  }
} 