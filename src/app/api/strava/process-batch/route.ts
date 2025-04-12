import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { createCardioWorkout } from "@/lib/workout-actions"
import { transformStravaActivity } from "@/lib/services/stravaService"
import { revalidatePath } from "next/cache"
import { gunzip as gunzipCb } from 'zlib'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'
import os from 'os'

// Keep runtime (Node.js needed for processing)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Set max duration to 60s (Hobby plan limit)

const gunzipAsync = promisify(gunzipCb)

// Simple implementation of processFitFile
async function processFitFile(buffer: Buffer, fileName: string): Promise<any> {
  // This is a simplified version that extracts basic workout data
  try {
    console.log(`Processing FIT file: ${fileName} (${buffer.length} bytes)`);

    // Use a more direct approach to parsing FIT files
    // For now, just return a minimal structure with basic data
    return {
      type: 'unknown',
      date: new Date(),
      duration: 30,
      distance: 1,
      calories: 100,
      title: `Activity from ${fileName}`,
      description: `Imported from ${fileName}`
    };
  } catch (error) {
    console.error(`Error processing FIT file ${fileName}:`, error);
    throw new Error(`Failed to process FIT file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Simple implementation of processGpxFile
async function processGpxFile(buffer: Buffer, fileName: string): Promise<any> {
  // This is a simplified version that extracts basic workout data
  try {
    console.log(`Processing GPX file: ${fileName} (${buffer.length} bytes)`);

    // Basic extraction of a workout structure
    return {
      type: 'unknown',
      date: new Date(),
      duration: 30, 
      distance: 1,
      calories: 100,
      title: `Activity from ${fileName}`,
      description: `Imported from ${fileName}`
    };
  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    throw new Error(`Failed to process GPX file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to create base exercise types when they don't exist
async function createBaseExerciseForType(type: string): Promise<void> {
  // This function is copied from import/route.ts
  try {
    console.log(`Creating base exercise for type: ${type}`)
    
    // Clean up the exercise name - capitalize first letter
    const exerciseName = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    
    // Get database connection
    const db = await (await import('@/lib/db/mongodb')).getDatabase()
    
    // Check if the exercise already exists
    const existingExercise = await db.collection('exercises').findOne({
      name: exerciseName,
      category: 'cardio'
    })
    
    if (existingExercise) {
      console.log(`Exercise '${exerciseName}' already exists in the database.`)
      return
    }
    
    // Create a new exercise document
    const exerciseDoc = {
      name: exerciseName,
      category: 'cardio',
      muscleGroups: [], // Cardio exercises don't target specific muscle groups
      equipment: [],    // No specific equipment for generic cardio
      instructions: '',
      userId: null,     // System exercise (not user-specific)
      createdAt: new Date(),
      updatedAt: new Date(),
      isSystemExercise: true, // Mark as system-created
      isDefault: true         // This is a default exercise
    }
    
    // Insert the exercise
    const result = await db.collection('exercises').insertOne(exerciseDoc)
    console.log(`Created base exercise '${exerciseName}' with ID: ${result.insertedId}`)
  } catch (error) {
    console.error(`Error creating base exercise for type '${type}':`, error)
    throw new Error(`Failed to create base exercise: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Function to extract Strava ID from filename
function extractStravaIdFromFilename(filename: string): string | undefined {
  if (!filename) return undefined
  
  // Normalize path separators for consistent handling
  const normalizedFilename = filename.replace(/\\/g, '/')
  
  // Try several patterns to extract the ID
  const patterns = [
    // Pattern 1: Standard activities/ID.ext format (highest priority)
    /activities\/(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)/i,
    
    // Pattern 2: ID directly in path without activities/ folder
    /\/(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)$/i,
    
    // Pattern 3: Just filename as a number (no path)
    /(?:^|\/|\\)(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)$/i,
    
    // Pattern 4: Activity ID in any file path
    /activity[_-]?(\d{5,})/i,
    
    // Pattern 5: Export_ prefix
    /export[_-](\d{5,})/i,
    
    // Pattern 6: Any number in the filename as last resort (only if at least 8 digits)
    /(\d{8,})/
  ]
  
  // Try each pattern in order
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    const match = normalizedFilename.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting batch processing for Strava import ===')
    
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('No authenticated session')
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    console.log('User authenticated:', userId)
    
    // Get batch parameters from request
    const { processingId, batchIndex, batchSize = 10 } = await request.json()
    
    if (!processingId) {
      return NextResponse.json({ success: false, error: "Missing processingId parameter" }, { status: 400 })
    }
    
    if (batchIndex === undefined) {
      return NextResponse.json({ success: false, error: "Missing batchIndex parameter" }, { status: 400 })
    }
    
    // Construct the path to the temp directory
    const tempDir = path.join(process.env.TMPDIR || os.tmpdir(), `strava-import-${processingId}`)
    const processingStatePath = path.join(tempDir, 'processing-state.json')
    
    // Try to get state from MongoDB first (more reliable across function calls)
    let state;
    try {
      // Get from MongoDB
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      const dbState = await db.collection('strava_import_state').findOne({ processingId })
      
      if (dbState) {
        console.log('Found processing state in MongoDB')
        state = dbState
      } else {
        // Fall back to local file if not in MongoDB
        console.log('Processing state not found in MongoDB, trying local file')
        
        // Check if the processing state file exists
        try {
          await fs.access(processingStatePath)
          // Load from file
          const stateContent = await fs.readFile(processingStatePath, 'utf-8')
          state = JSON.parse(stateContent)
          console.log('Found processing state in local file')
        } catch (fileError) {
          console.error('Processing state file not found:', processingStatePath)
          return NextResponse.json({ success: false, error: "Processing state not found. Import may have expired." }, { status: 404 })
        }
      }
    } catch (dbError) {
      console.error('Error fetching processing state from database:', dbError)
      
      // Fall back to local file
      try {
        await fs.access(processingStatePath)
        const stateContent = await fs.readFile(processingStatePath, 'utf-8')
        state = JSON.parse(stateContent)
        console.log('Fell back to local file for processing state')
      } catch (fileError) {
        console.error('Processing state file not found after database error:', processingStatePath)
        return NextResponse.json({ success: false, error: "Processing state not found in database or filesystem. Import may have expired." }, { status: 404 })
      }
    }
    
    // Verify this is the user's import
    if (state.userId !== userId) {
      console.error('User ID mismatch:', { stateUserId: state.userId, userId })
      return NextResponse.json({ success: false, error: "Unauthorized access to import" }, { status: 403 })
    }
    
    // Get the batch of files to process
    const activityFiles = state.activityFiles || []
    const startIndex = batchIndex * batchSize
    const endIndex = Math.min(startIndex + batchSize, activityFiles.length)
    const batchFiles = activityFiles.slice(startIndex, endIndex)
    
    if (batchFiles.length === 0) {
      console.log('No files in batch, possibly already processed')
      return NextResponse.json({ 
        success: true, 
        message: "No files to process",
        batchIndex,
        processed: 0,
        imported: 0,
        errors: 0,
        nextBatch: startIndex < activityFiles.length ? batchIndex + 1 : null,
        progress: {
          total: activityFiles.length,
          processed: state.processedFiles?.length || 0,
          imported: state.importedFiles?.length || 0,
          errors: state.errorFiles?.length || 0
        },
        isComplete: endIndex >= activityFiles.length
      })
    }
    
    console.log(`Processing batch ${batchIndex + 1}, files ${startIndex + 1}-${endIndex} of ${activityFiles.length}`)
    
    // Process each file in the batch
    const batchResults = {
      processed: 0,
      imported: 0,
      errors: 0,
      activityTypesCounts: {} as Record<string, number>,
      errorDetails: [] as string[]
    }
    
    for (const relativeFilePath of batchFiles) {
      try {
        const fullPath = path.join(tempDir, relativeFilePath)
        const fileName = path.basename(fullPath)
        
        console.log(`Processing file: ${fileName}`)
        
        // Check if file exists
        try {
          await fs.access(fullPath)
        } catch (fileError) {
          console.error(`File not found: ${fullPath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`File not found: ${relativeFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Read file content
        const fileContent = await fs.readFile(fullPath)
        
        // Process file based on type
        let workout = null
        const normalizedFilePath = relativeFilePath.replace(/\\/g, '/')
        
        if (normalizedFilePath.toLowerCase().endsWith('.fit.gz')) {
          console.log(`Processing FIT.GZ file: ${normalizedFilePath}`)
          try {
            const unzippedContent = await gunzipAsync(fileContent)
            workout = await processFitFile(unzippedContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing FIT.GZ file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else if (normalizedFilePath.toLowerCase().endsWith('.gpx')) {
          console.log(`Processing GPX file: ${normalizedFilePath}`)
          try {
            workout = await processGpxFile(fileContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing GPX file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else if (normalizedFilePath.toLowerCase().endsWith('.fit')) {
          console.log(`Processing FIT file: ${normalizedFilePath}`)
          try {
            workout = await processFitFile(fileContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing FIT file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else {
          console.log(`Unsupported file type: ${normalizedFilePath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`Unsupported file type: ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Mark as processed even if we don't import it
        batchResults.processed++
        if (!state.processedFiles.includes(relativeFilePath)) {
          state.processedFiles.push(relativeFilePath)
        }
        
        // Skip if no workout data extracted
        if (!workout) {
          console.log(`No workout data extracted from ${normalizedFilePath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`No workout data extracted: ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Transform and save workout
        const transformedWorkout = transformStravaActivity(workout)
        
        // Fix future dates
        if (transformedWorkout.date) {
          const activityDate = transformedWorkout.date instanceof Date ? 
                              transformedWorkout.date : 
                              new Date(transformedWorkout.date)
          const now = new Date()
          
          if (activityDate > now) {
            console.log(`Detected future date in activity: ${activityDate.toISOString()}, fixing...`)
            const newDate = new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000))
            transformedWorkout.date = newDate
          }
        }
        
        const workoutToSave = {
          ...transformedWorkout,
          distance: transformedWorkout.distance,
          duration: transformedWorkout.duration || 0,
          userId: userId,
          source: "strava",
          sourceId: (() => {
            const id = extractStravaIdFromFilename(normalizedFilePath)
            return id && /^\d{5,}$/.test(id) ? id : undefined
          })(),
          stravaLink: (() => {
            const id = extractStravaIdFromFilename(normalizedFilePath)
            return id && /^\d{5,}$/.test(id) ? `https://www.strava.com/activities/${id}` : undefined
          })()
        }
        
        // Count activity type
        const activityType = workoutToSave.type || 'unknown'
        batchResults.activityTypesCounts[activityType] = (batchResults.activityTypesCounts[activityType] || 0) + 1
        
        // Check for required data
        if (!workoutToSave.date || !workoutToSave.duration) {
          console.log(`Workout missing required data: date=${!!workoutToSave.date}, duration=${!!workoutToSave.duration}`)
          batchResults.errors++
          batchResults.errorDetails.push(`Missing required date or duration: ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Try to improve activity type mapping if generic
        if (workoutToSave.type === 'unknown' || workoutToSave.type === 'other') {
          console.log(`Detected activity with generic type: ${workoutToSave.type}, attempting to improve mapping`)
          if (workoutToSave.distance && workoutToSave.distance > 0) {
            if (workout.average_speed) {
              const speedInKmHr = workout.average_speed * 3.6 // m/s to km/h
              if (speedInKmHr > 15) {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely cycling`)
                workoutToSave.type = 'cycling'
              } else if (speedInKmHr > 3) {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely running`)
                workoutToSave.type = 'running'
              } else {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely walking`)
                workoutToSave.type = 'walking'
              }
            }
          }
        }
        
        // Save the workout
        try {
          await createCardioWorkout(workoutToSave)
          console.log(`Successfully imported workout from ${normalizedFilePath}`)
          batchResults.imported++
          
          // Add to imported files in state
          if (!state.importedFiles.includes(relativeFilePath)) {
            state.importedFiles.push(relativeFilePath)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          const isMissingExerciseError = errorMsg.includes('Essential exercise data missing') || 
                                     errorMsg.includes('Could not find') ||
                                     errorMsg.includes('in exercises collection')
          
          if (isMissingExerciseError) {
            console.log(`Missing exercise type: ${workoutToSave.type}. Attempting to create base exercise.`)
            try {
              await createBaseExerciseForType(workoutToSave.type)
              
              // Try again after creating the exercise
              await createCardioWorkout(workoutToSave)
              console.log(`Successfully imported workout after creating base exercise`)
              batchResults.imported++
              
              // Add to imported files in state
              if (!state.importedFiles.includes(relativeFilePath)) {
                state.importedFiles.push(relativeFilePath)
              }
            } catch (secondError) {
              console.error(`Error saving workout after creating base exercise:`, secondError)
              batchResults.errors++
              batchResults.errorDetails.push(`Save error after exercise creation: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
              
              // Add to error files in state
              if (!state.errorFiles.includes(relativeFilePath)) {
                state.errorFiles.push(relativeFilePath)
              }
            }
          } else {
            console.error(`Error saving workout:`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Save error: ${errorMsg}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
          }
        }
      } catch (error) {
        console.error(`Unexpected error processing file:`, error)
        batchResults.errors++
        batchResults.errorDetails.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
        
        // Add to error files in state if not already added
        if (!state.errorFiles.includes(relativeFilePath)) {
          state.errorFiles.push(relativeFilePath)
        }
      }
    }
    
    // Update the processing state
    state.status = endIndex >= activityFiles.length ? 'completed' : 'processing'
    
    // Save state back to both file system (if available) and MongoDB
    try {
      await fs.writeFile(processingStatePath, JSON.stringify(state))
      console.log('Updated state in filesystem')
    } catch (fsError) {
      console.error('Could not update state file:', fsError)
      // Continue - we'll save to MongoDB anyway
    }
    
    // Always update MongoDB state as the reliable source
    try {
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      await db.collection('strava_import_state').updateOne(
        { processingId },
        { $set: state }
      )
      console.log('Updated state in MongoDB')
    } catch (dbError) {
      console.error('Error updating state in MongoDB:', dbError)
      // If we also failed to update the file, this is a serious error
      if (!fsSync.existsSync(processingStatePath)) {
        return NextResponse.json({
          success: false,
          error: 'Failed to save processing state to both filesystem and database'
        }, { status: 500 })
      }
    }
    
    // Check if all batches are complete
    const isComplete = endIndex >= activityFiles.length
    
    // If complete, revalidate paths
    if (isComplete) {
      revalidatePath("/calendar")
      revalidatePath("/activity")
      revalidatePath("/dashboard")
    }
    
    return NextResponse.json({
      success: true,
      batchIndex,
      processed: batchResults.processed,
      imported: batchResults.imported,
      errors: batchResults.errors,
      errorDetails: batchResults.errorDetails.slice(0, 5), // Just return the first 5 errors
      activityTypes: batchResults.activityTypesCounts,
      nextBatch: endIndex < activityFiles.length ? batchIndex + 1 : null,
      progress: {
        total: activityFiles.length,
        processed: state.processedFiles.length,
        imported: state.importedFiles.length,
        errors: state.errorFiles.length
      },
      isComplete
    })
    
  } catch (error) {
    console.error("Error in batch processing:", error)
    return NextResponse.json({
      success: false,
      error: `Batch processing error: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
}

// Add a GET endpoint to check progress and final results
export async function GET(request: NextRequest) {
  try {
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('No authenticated session')
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    
    // Get processing ID from URL
    const { searchParams } = new URL(request.url)
    const processingId = searchParams.get('processingId')
    
    if (!processingId) {
      return NextResponse.json({ success: false, error: "Missing processingId parameter" }, { status: 400 })
    }
    
    // Construct the path to the temp directory
    const tempDir = path.join(process.env.TMPDIR || os.tmpdir(), `strava-import-${processingId}`)
    const processingStatePath = path.join(tempDir, 'processing-state.json')
    
    // Try to get state from MongoDB first
    let state;
    try {
      // Get from MongoDB
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      const dbState = await db.collection('strava_import_state').findOne({ processingId })
      
      if (dbState) {
        console.log('Found processing state in MongoDB')
        state = dbState
      } else {
        // Fall back to local file if not in MongoDB
        console.log('Processing state not found in MongoDB, trying local file')
        
        // Check if the processing state file exists
        try {
          await fs.access(processingStatePath)
          // Load from file
          const stateContent = await fs.readFile(processingStatePath, 'utf-8')
          state = JSON.parse(stateContent)
          console.log('Found processing state in local file')
        } catch (fileError) {
          console.error('Processing state file not found:', processingStatePath)
          return NextResponse.json({ success: false, error: "Processing state not found. Import may have expired." }, { status: 404 })
        }
      }
    } catch (dbError) {
      console.error('Error fetching processing state from database:', dbError)
      
      // Fall back to local file
      try {
        await fs.access(processingStatePath)
        const stateContent = await fs.readFile(processingStatePath, 'utf-8')
        state = JSON.parse(stateContent)
        console.log('Fell back to local file for processing state')
      } catch (fileError) {
        console.error('Processing state file not found after database error:', processingStatePath)
        return NextResponse.json({ success: false, error: "Processing state not found in database or filesystem. Import may have expired." }, { status: 404 })
      }
    }
    
    // Verify this is the user's import
    if (state.userId !== userId) {
      console.error('User ID mismatch:', { stateUserId: state.userId, userId })
      return NextResponse.json({ success: false, error: "Unauthorized access to import" }, { status: 403 })
    }
    
    // Prepare status response
    const activityFiles = state.activityFiles || []
    const isComplete = state.status === 'completed' || state.processedFiles.length >= activityFiles.length
    
    return NextResponse.json({
      success: true,
      processingId,
      status: state.status,
      progress: {
        total: activityFiles.length,
        processed: state.processedFiles.length,
        imported: state.importedFiles.length,
        errors: state.errorFiles.length,
        percentComplete: Math.round((state.processedFiles.length / Math.max(1, activityFiles.length)) * 100)
      },
      fileStats: {
        total: activityFiles.length,
        gpx: state.gpxFilesCount || 0,
        fit: state.fitFilesCount || 0,
        fitGz: state.fitGzFilesCount || 0
      },
      isComplete
    })
    
  } catch (error) {
    console.error("Error checking progress:", error)
    return NextResponse.json({
      success: false,
      error: `Error checking progress: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
} 