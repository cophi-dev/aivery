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
        console.log(`All chunks received. Assembling complete file from ${totalChunks} chunks...`);
        
        // Get all chunks
        const arrayBuffers: ArrayBuffer[] = [];
        let missingChunks = false;
        
        // First verify all chunks exist before attempting to read them
        for (let i = 0; i < totalChunks; i++) {
          const currentChunkPath = `${blobPathBase}.chunk${i}`;
          console.log(`Verifying chunk ${i + 1}/${totalChunks} at ${currentChunkPath}`);
          
          // List to verify chunk exists
          const { blobs } = await list({
            prefix: currentChunkPath,
            limit: 1
          });
          
          if (!blobs.length) {
            console.error(`Missing chunk ${i + 1}/${totalChunks} at path ${currentChunkPath}`);
            missingChunks = true;
            
            // Continue checking for all missing chunks rather than immediately failing
            continue;
          }
        }
        
        // If any chunks are missing, fail early
        if (missingChunks) {
          throw new Error(`One or more chunks are missing. Please try uploading again.`);
        }
        
        // Now collect all chunks
        console.log(`All chunks verified. Collecting ${totalChunks} chunks...`);
        for (let i = 0; i < totalChunks; i++) {
          const currentChunkPath = `${blobPathBase}.chunk${i}`;
          console.log(`Fetching chunk ${i + 1}/${totalChunks} from ${currentChunkPath}`);
          
          const { blobs } = await list({
            prefix: currentChunkPath,
            limit: 1
          });
          
          // Fetch the chunk (we already verified it exists)
          const chunkResponse = await fetch(blobs[0].url);
          if (!chunkResponse.ok) {
            throw new Error(`Failed to download chunk ${i + 1}: ${chunkResponse.status}`);
          }
          
          // Get the array buffer and log its size to debug
          const chunkBuffer = await chunkResponse.arrayBuffer();
          console.log(`Chunk ${i + 1}/${totalChunks} size: ${chunkBuffer.byteLength} bytes`);
          
          // Add to our array of chunks
          arrayBuffers.push(chunkBuffer);
        }
        
        // Combine all chunks into a single ArrayBuffer
        console.log(`Combining ${arrayBuffers.length} chunks into complete file...`);
        let totalLength = 0;
        for (const buffer of arrayBuffers) {
          totalLength += buffer.byteLength;
        }
        
        console.log(`Total combined size will be: ${totalLength} bytes`);
        
        // Create a variable to hold the blob reference outside the inner try block
        let completedBlob;
        
        try {
          const completeFile = new Uint8Array(totalLength);
          let offset = 0;
          
          for (let i = 0; i < arrayBuffers.length; i++) {
            const buffer = arrayBuffers[i];
            console.log(`Setting chunk ${i + 1} at offset ${offset}, size ${buffer.byteLength} bytes`);
            completeFile.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
          }
          
          // Upload the complete file
          console.log(`Uploading complete assembled file (${totalLength} bytes) to ${blobPathBase}`);
          completedBlob = await put(blobPathBase, Buffer.from(completeFile), {
            access: 'public',
            contentType: 'application/zip',
            addRandomSuffix: false,
          });
          
          console.log(`Completed upload. Final size: ${totalLength} bytes. Path: ${completedBlob.url}`);
        } catch (assembleError) {
          console.error('Error during final file assembly:', assembleError);
          throw new Error(`Failed to assemble file: ${assembleError instanceof Error ? assembleError.message : 'Unknown error'}`);
        }
        
        // Clean up chunk files
        console.log(`Cleaning up ${totalChunks} chunk files...`);
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
          blobPath: completedBlob.pathname,
          url: completedBlob.url,
          chunkIndex,
          totalChunks,
          isComplete: true
        });
      } catch (assemblyError) {
        console.error('Error assembling file from chunks:', assemblyError);
        const errorMessage = assemblyError instanceof Error 
          ? assemblyError.message 
          : 'Failed to assemble file from chunks';
          
        // In case of assembly error, try to clean up chunks to avoid leaving orphaned chunks
        try {
          console.log(`Attempting cleanup after assembly error for path base: ${blobPathBase}`);
          for (let i = 0; i < totalChunks; i++) {
            const chunkToDelete = `${blobPathBase}.chunk${i}`;
            try {
              await del(chunkToDelete);
              console.log(`Cleaned up chunk ${i + 1}: ${chunkToDelete} after error`);
            } catch (e) {
              // Ignore deletion errors during cleanup
            }
          }
        } catch (cleanupError) {
          console.error('Failed to clean up chunks after assembly error:', cleanupError);
        }
          
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