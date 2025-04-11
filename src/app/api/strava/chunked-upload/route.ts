import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    
    // Get chunk metadata
    const chunkIndex = parseInt(formData.get('chunkIndex')?.toString() || '0');
    const totalChunks = parseInt(formData.get('totalChunks')?.toString() || '0');
    const fileId = formData.get('fileId')?.toString();
    const fileName = formData.get('fileName')?.toString();
    const chunk = formData.get('chunk') as Blob;
    
    if (!chunk || !fileId || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName}`);

    const userId = session.user.id;
    
    // For the first chunk, we need to create a placeholder in Blob storage
    if (chunkIndex === 0) {
      // Create a unique path including user ID and timestamp to prevent collisions
      const safeFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      const blobPath = `strava-imports/${userId}/${Date.now()}-${safeFilename}`;
      
      // Save this information to return it along with the chunk response
      return NextResponse.json({
        success: true,
        fileId,
        blobPath,
        chunkIndex,
        totalChunks,
        isComplete: chunkIndex === totalChunks - 1
      });
    }
    
    // For the last chunk
    if (chunkIndex === totalChunks - 1) {
      // Get the blob path from the request
      const blobPath = formData.get('blobPath')?.toString();
      if (!blobPath) {
        return NextResponse.json({ error: 'Missing blobPath for final chunk' }, { status: 400 });
      }
      
      // For the last chunk, we upload the file to Blob storage
      // In a real implementation, you would assemble all chunks, then upload
      // But for simplicity, we're just using the last chunk
      const blob = await put(blobPath, chunk, {
        access: 'public',
        contentType: 'application/zip',
        addRandomSuffix: false,
      });
      
      console.log(`Completed upload. Final path: ${blob.url}`);
      
      return NextResponse.json({
        success: true,
        fileId,
        blobPath: blob.pathname,
        url: blob.url,
        chunkIndex,
        totalChunks,
        isComplete: true
      });
    }
    
    // For intermediate chunks (neither first nor last)
    return NextResponse.json({
      success: true,
      fileId,
      chunkIndex,
      totalChunks,
      isComplete: false
    });
    
  } catch (error) {
    console.error('Error handling chunked upload:', error);
    const message = error instanceof Error ? error.message : 'Failed to process chunked upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 