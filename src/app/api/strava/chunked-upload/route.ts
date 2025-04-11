import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put, del, list } from '@vercel/blob';
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
    
    // Create paths for storage
    const safeFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
    const timestamp = Date.now();
    const blobPathBase = `strava-imports/${userId}/${timestamp}-${safeFilename}`;
    
    // For each chunk, save it with its index
    const chunkPath = `${blobPathBase}.chunk${chunkIndex}`;
    const chunkBlob = await put(chunkPath, chunk, {
      access: 'public',
      contentType: 'application/octet-stream', // Use generic binary format for chunks
      addRandomSuffix: false,
    });
    
    console.log(`Saved chunk ${chunkIndex + 1}/${totalChunks} to ${chunkPath}`);
    
    // For the last chunk, assemble the complete file
    if (chunkIndex === totalChunks - 1) {
      try {
        console.log(`All chunks received. Assembling complete file...`);
        
        // Get all chunks
        const arrayBuffers: ArrayBuffer[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
          const currentChunkPath = `${blobPathBase}.chunk${i}`;
          console.log(`Fetching chunk ${i + 1}/${totalChunks} from ${currentChunkPath}`);
          
          // List to verify chunk exists
          const { blobs } = await list({
            prefix: currentChunkPath,
            limit: 1
          });
          
          if (!blobs.length) {
            throw new Error(`Missing chunk ${i + 1}/${totalChunks}`);
          }
          
          // Fetch the chunk
          const chunkResponse = await fetch(blobs[0].url);
          if (!chunkResponse.ok) {
            throw new Error(`Failed to download chunk ${i + 1}: ${chunkResponse.status}`);
          }
          
          // Add to our array of chunks
          arrayBuffers.push(await chunkResponse.arrayBuffer());
        }
        
        // Combine all chunks into a single ArrayBuffer
        let totalLength = 0;
        for (const buffer of arrayBuffers) {
          totalLength += buffer.byteLength;
        }
        
        const completeFile = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const buffer of arrayBuffers) {
          completeFile.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        }
        
        // Upload the complete file
        const blob = await put(blobPathBase, Buffer.from(completeFile), {
          access: 'public',
          contentType: 'application/zip',
          addRandomSuffix: false,
        });
        
        console.log(`Completed upload. Final size: ${totalLength} bytes. Path: ${blob.url}`);
        
        // Clean up chunk files
        for (let i = 0; i < totalChunks; i++) {
          const chunkToDelete = `${blobPathBase}.chunk${i}`;
          try {
            await del(chunkToDelete);
            console.log(`Deleted chunk ${i + 1}: ${chunkToDelete}`);
          } catch (deleteError) {
            console.warn(`Failed to delete chunk ${i + 1}: ${chunkToDelete}`, deleteError);
            // Continue despite deletion errors
          }
        }
        
        return NextResponse.json({
          success: true,
          fileId,
          blobPath: blob.pathname,
          url: blob.url,
          chunkIndex,
          totalChunks,
          isComplete: true
        });
      } catch (assemblyError) {
        console.error('Error assembling file from chunks:', assemblyError);
        const errorMessage = assemblyError instanceof Error 
          ? assemblyError.message 
          : 'Failed to assemble file from chunks';
          
        return NextResponse.json({ 
          error: errorMessage,
          fileId,
          chunkIndex,
          totalChunks,
          isComplete: false
        }, { status: 500 });
      }
    }
    
    // For first or intermediate chunks
    return NextResponse.json({
      success: true,
      fileId,
      blobPath: blobPathBase,
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