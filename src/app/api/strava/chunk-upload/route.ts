import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import path from 'path'
import { promises as fs } from 'fs'
import os from 'os'

// Use Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * API route for handling chunked uploads of large Strava exports
 * This route receives chunks of a file and reconstructs it on the server
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error('Strava chunk upload: No authenticated session')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body
    const formData = await request.formData()
    
    // Get chunk metadata
    const chunkData = formData.get('chunk') as Blob
    const chunkIndex = parseInt(formData.get('chunkIndex')?.toString() || '0')
    const totalChunks = parseInt(formData.get('totalChunks')?.toString() || '0')
    const fileId = formData.get('fileId')?.toString()
    const fileName = formData.get('fileName')?.toString()
    
    // Validate inputs
    if (!chunkData || !fileId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0) {
      return NextResponse.json({ 
        error: "Invalid request. Missing required parameters." 
      }, { status: 400 })
    }

    // Create temporary directory for this user's chunks if it doesn't exist
    const userId = session.user.id
    const userTempDir = path.join(os.tmpdir(), 'strava-uploads', userId)
    
    try {
      await fs.mkdir(userTempDir, { recursive: true })
    } catch (err) {
      console.error('Error creating temp directory:', err)
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
    
    // Save the chunk to disk
    const chunkFilePath = path.join(userTempDir, `${fileId}-chunk-${chunkIndex}`)
    const buffer = Buffer.from(await chunkData.arrayBuffer())
    
    try {
      await fs.writeFile(chunkFilePath, buffer)
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} saved for file ${fileId}`)
    } catch (err) {
      console.error('Error saving chunk:', err)
      return NextResponse.json({ error: "Failed to save chunk" }, { status: 500 })
    }
    
    // If this is the last chunk, combine all chunks
    if (chunkIndex === totalChunks - 1) {
      // Output file path
      const outputFilePath = path.join(userTempDir, `${fileId}-complete${fileName ? path.extname(fileName) : '.zip'}`)
      
      try {
        // Create a write stream for the output file
        const writeStream = await fs.open(outputFilePath, 'w')
        
        // Combine all chunks in order
        for (let i = 0; i < totalChunks; i++) {
          const currentChunkPath = path.join(userTempDir, `${fileId}-chunk-${i}`)
          const chunkContent = await fs.readFile(currentChunkPath)
          await writeStream.write(chunkContent)
          
          // Delete the chunk file after it's been added to the complete file
          await fs.unlink(currentChunkPath)
        }
        
        await writeStream.close()
        
        console.log(`All chunks combined for file ${fileId}. Complete file saved at ${outputFilePath}`)
        
        // Return the path to the complete file
        return NextResponse.json({ 
          success: true, 
          message: "File upload complete", 
          filePath: outputFilePath,
          fileName: fileName || `${fileId}.zip`,
          complete: true
        })
      } catch (err) {
        console.error('Error combining chunks:', err)
        return NextResponse.json({ error: "Failed to combine chunks" }, { status: 500 })
      }
    }
    
    // If not the last chunk, just return success for this chunk
    return NextResponse.json({ 
      success: true, 
      message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
      chunkIndex,
      totalChunks,
      complete: false
    })
  } catch (error) {
    console.error('Error processing chunk upload:', error)
    return NextResponse.json({ 
      error: "An unexpected error occurred" 
    }, { status: 500 })
  }
}

// API route to get status of a chunked upload
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Get fileId from query parameters
  const fileId = request.nextUrl.searchParams.get('fileId')
  
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId parameter" }, { status: 400 })
  }
  
  const userId = session.user.id
  const userTempDir = path.join(os.tmpdir(), 'strava-uploads', userId)
  
  try {
    // Check if complete file exists
    const completeFilePath = path.join(userTempDir, `${fileId}-complete.zip`)
    try {
      await fs.access(completeFilePath)
      return NextResponse.json({ 
        success: true, 
        status: "complete",
        filePath: completeFilePath
      })
    } catch {
      // File doesn't exist, count chunks
      const dirContents = await fs.readdir(userTempDir)
      const chunks = dirContents.filter(filename => filename.startsWith(`${fileId}-chunk-`))
      
      return NextResponse.json({ 
        success: true, 
        status: "in-progress",
        chunksReceived: chunks.length
      })
    }
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to get upload status" 
    }, { status: 500 })
  }
} 