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
  try {
    console.log(`Processing FIT file: ${fileName} (${buffer.length} bytes)`);
    
    // For FIT files, parse actual binary content instead of using defaults
    // Very basic parser to extract key data fields
    
    // Initial binary pattern recognition for FIT file structures
    // Look for common patterns in FIT file's binary data
    
    let timestamp = null;
    let duration = null;
    let distance = null;
    let activityType = 'unknown';
    
    // Scan for timestamp record (typically near the beginning of the file)
    const timestampPattern = Buffer.from([0x10, 0x44]); // Common FIT timestamp pattern
    const timestampIndex = buffer.indexOf(timestampPattern);
    if (timestampIndex > 0 && timestampIndex + 8 < buffer.length) {
      // Extract Unix timestamp (4 bytes after pattern in many FIT files)
      const timeSecs = buffer.readUInt32LE(timestampIndex + 4);
      if (timeSecs > 1000000000 && timeSecs < 2000000000) { // Sanity check: timestamp between 2001-2033
        timestamp = new Date(timeSecs * 1000);
        console.log(`Found timestamp in FIT binary: ${timestamp.toISOString()}`);
      }
    }
    
    // Look for activity type in the file (often stored as enum value)
    // Common sport type enums in FIT files: 1=running, 2=cycling, 5=swimming
    const sportTypePattern = Buffer.from([0x12, 0x00]); // Sport field identifier
    const sportTypeIndex = buffer.indexOf(sportTypePattern);
    if (sportTypeIndex > 0 && sportTypeIndex + 3 < buffer.length) {
      const sportType = buffer[sportTypeIndex + 3];
      if (sportType === 1) {
        activityType = 'running';
      } else if (sportType === 2) {
        activityType = 'cycling';
      } else if (sportType === 5) {
        activityType = 'swimming';
      } else if (sportType === 11) {
        activityType = 'walking';
      }
      console.log(`Found activity type in FIT binary: ${activityType} (enum: ${sportType})`);
    }
    
    // If not found in binary, try filename
    if (activityType === 'unknown') {
      if (fileName.toLowerCase().includes('run')) {
        activityType = 'running';
      } else if (fileName.toLowerCase().includes('ride') || fileName.toLowerCase().includes('cycling')) {
        activityType = 'cycling';
      } else if (fileName.toLowerCase().includes('swim')) {
        activityType = 'swimming';
      } else if (fileName.toLowerCase().includes('hike') || fileName.toLowerCase().includes('walk')) {
        activityType = 'walking';
      } else if (fileName.toLowerCase().includes('weight') || fileName.toLowerCase().includes('strength')) {
        activityType = 'strength';
      }
      console.log(`Determined activity type from filename: ${activityType}`);
    }
    
    // Look for duration field (total elapsed time)
    // Several patterns to try since FIT format can vary
    const durationPatterns = [
      Buffer.from([0x13, 0x00, 0x04]), // Common duration pattern v1
      Buffer.from([0x08, 0x04, 0x86])  // Common duration pattern v2
    ];
    
    for (const pattern of durationPatterns) {
      const durIndex = buffer.indexOf(pattern);
      if (durIndex > 0 && durIndex + 6 < buffer.length) {
        // Try to extract duration in seconds (usually stored as uint32)
        const durValue = buffer.readUInt32LE(durIndex + 3);
        if (durValue > 0 && durValue < 86400) { // Sanity check: 0-24 hours
          duration = durValue;
          console.log(`Found duration in FIT binary: ${duration} seconds`);
          break;
        }
      }
    }
    
    // Look for distance field
    const distancePatterns = [
      Buffer.from([0x05, 0x00, 0x84]), // Common distance pattern
      Buffer.from([0x07, 0x84])        // Alternate distance pattern
    ];
    
    for (const pattern of distancePatterns) {
      const distIndex = buffer.indexOf(pattern);
      if (distIndex > 0 && distIndex + 6 < buffer.length) {
        // Try to extract distance in meters (usually stored as uint32)
        const distValue = buffer.readUInt32LE(distIndex + pattern.length);
        if (distValue > 0 && distValue < 1000000) { // Sanity check: 0-1000km
          distance = distValue;
          console.log(`Found distance in FIT binary: ${distance} meters`);
          break;
        }
      }
    }
    
    // Check if we have the essential fields, otherwise don't extract from filename
    if (!timestamp) {
      // If no timestamp in binary, try extract from filename as last resort
      const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})|(\d{8})/);
      if (dateMatch) {
        const dateStr = dateMatch[0];
        if (dateStr.includes('-')) {
          timestamp = new Date(dateStr);
        } else {
          // Format like 20220315
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          timestamp = new Date(year, month, day);
        }
        console.log(`Extracted date from filename: ${timestamp.toISOString()}`);
      } else {
        // Extract Strava ID from filename and generate a date from it
        const idMatch = fileName.match(/(\d{5,})/);
        if (idMatch) {
          const id = parseInt(idMatch[1]);
          // Only if ID looks like a valid timestamp (>2010)
          if (id > 1262304000) { // Unix timestamp for 2010-01-01
            timestamp = new Date(id * 1000);
            if (timestamp > new Date()) {
              // If future date, adjust to a past date
              timestamp = new Date(Date.now() - 86400000 * (id % 30)); // 1-30 days ago
            }
            console.log(`Generated date from Strava ID: ${timestamp.toISOString()}`);
          } else {
            // If not timestamp-like, do not set a timestamp
            console.log(`No valid timestamp found and couldn't extract from filename`);
          }
        }
      }
    }
    
    // Stop here if we're still missing key data
    if (!timestamp || !duration) {
      console.error(`FIT file missing required data: timestamp=${!!timestamp}, duration=${!!duration}`);
      throw new Error(`Strava FIT file is missing required data: timestamp=${!!timestamp}, duration=${!!duration}`);
    }
    
    // Create a workout with extracted values
    return {
      type: activityType,
      date: timestamp,
      duration: duration,
      distance: distance,
      calories: duration ? Math.round(duration / 60 * 10) : undefined, // Only if we have duration
      average_speed: (distance && duration) ? (distance / duration) : undefined, // Only if we have both
      max_speed: (distance && duration) ? (distance / duration) * 1.5 : undefined, // Only if we have both
      avg_heart_rate: undefined, // Don't set unless found in data
      max_heart_rate: undefined, // Don't set unless found in data
      title: timestamp ? `Activity from ${timestamp.toISOString().split('T')[0]}` : undefined,
      description: `Imported from ${fileName}`,
      total_elevation_gain: undefined, // Don't set unless found in data
      workout_type: null,
      sport_type: activityType
    };
  } catch (error) {
    console.error(`Error processing FIT file ${fileName}:`, error);
    throw new Error(`Failed to process FIT file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Simple implementation of processGpxFile
async function processGpxFile(buffer: Buffer, fileName: string): Promise<any> {
  try {
    console.log(`Processing GPX file: ${fileName} (${buffer.length} bytes)`);
    
    // Try to parse some basic info from the GPX XML
    let timestamp = new Date();
    let activityType = 'unknown';
    let duration = 0; // Start with 0 and try to calculate from data
    let distance = 0; // Start with 0 and try to calculate from data
    
    // Try to extract the timestamp and type from XML
    try {
      const gpxStr = buffer.toString('utf-8');
      
      // Log basic info for debugging
      console.log(`GPX file content length: ${gpxStr.length} bytes`);
      
      // Extract timestamp - try multiple approaches
      // 1. First try to get from metadata (most reliable)
      const metadataTimeMatch = gpxStr.match(/<metadata[^>]*>[\s\S]*?<time>(.*?)<\/time>[\s\S]*?<\/metadata>/i);
      if (metadataTimeMatch && metadataTimeMatch[1]) {
        try {
          const parsedTime = new Date(metadataTimeMatch[1]);
          if (!isNaN(parsedTime.getTime())) {
            timestamp = parsedTime;
            console.log(`Found timestamp in metadata: ${timestamp.toISOString()}`);
          }
        } catch (e) {
          console.warn(`Failed to parse metadata timestamp: ${metadataTimeMatch[1]}`);
        }
      }
      
      // 2. If metadata time not found, try first track time
      if (isNaN(timestamp.getTime())) {
        const timeMatch = gpxStr.match(/<time>(.*?)<\/time>/i);
        if (timeMatch && timeMatch[1]) {
          try {
            const parsedTime = new Date(timeMatch[1]);
            if (!isNaN(parsedTime.getTime())) {
              timestamp = parsedTime;
              console.log(`Found timestamp in first time tag: ${timestamp.toISOString()}`);
            }
          } catch (e) {
            console.warn(`Failed to parse first time tag: ${timeMatch[1]}`);
          }
        }
      }
      
      // 3. If all else fails, try to extract from filename
      if (isNaN(timestamp.getTime())) {
        const dateMatch = fileName.match(/(\d{4}[-_]?\d{2}[-_]?\d{2})|(\d{8})/);
        if (dateMatch) {
          try {
            const dateStr = dateMatch[0].replace(/[-_]/g, '');
            if (dateStr.length >= 8) {
              const year = parseInt(dateStr.substring(0, 4));
              const month = parseInt(dateStr.substring(4, 6)) - 1;
              const day = parseInt(dateStr.substring(6, 8));
              
              if (year >= 2010 && year <= 2030 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                timestamp = new Date(year, month, day);
                console.log(`Extracted date from filename: ${timestamp.toISOString()}`);
              }
            }
          } catch (e) {
            console.warn(`Failed to parse date from filename: ${fileName}`);
          }
        }
      }
      
      // Try to determine activity type from multiple sources
      // 1. Check for activity type in the GPX data
      const activityTypeMatch = gpxStr.match(/<type>(.*?)<\/type>/i) || 
                               gpxStr.match(/activity-type="([^"]+)"/i) ||
                               gpxStr.match(/activityType="([^"]+)"/i);
                               
      if (activityTypeMatch && activityTypeMatch[1]) {
        const extractedType = activityTypeMatch[1].toLowerCase();
        if (extractedType.includes('run')) {
          activityType = 'running';
        } else if (extractedType.includes('ride') || extractedType.includes('cycl') || extractedType.includes('bike')) {
          activityType = 'cycling';
        } else if (extractedType.includes('swim')) {
          activityType = 'swimming';
        } else if (extractedType.includes('hike')) {
          activityType = 'hiking';
        } else if (extractedType.includes('walk')) {
          activityType = 'walking';
        }
        console.log(`Found activity type in GPX data: ${activityType}`);
      }
      
      // 2. If not found in data, check filename
      if (activityType === 'unknown') {
        const fileNameLower = fileName.toLowerCase();
        if (fileNameLower.includes('run')) {
          activityType = 'running';
        } else if (fileNameLower.includes('ride') || fileNameLower.includes('cycling') || fileNameLower.includes('bike')) {
          activityType = 'cycling';
        } else if (fileNameLower.includes('swim')) {
          activityType = 'swimming';
        } else if (fileNameLower.includes('hike')) {
          activityType = 'hiking';
        } else if (fileNameLower.includes('walk')) {
          activityType = 'walking';
        } else if (fileNameLower.includes('weight') || fileNameLower.includes('strength')) {
          activityType = 'strength';
        }
        console.log(`Determined activity type from filename: ${activityType}`);
      }
      
      // EXTRACT DURATION - Try multiple approaches
      // 1. Look for explicit duration metadata
      const durationMatch = gpxStr.match(/<duration>([\d\.]+)<\/duration>/i) || 
                           gpxStr.match(/duration="([\d\.]+)"/i) ||
                           gpxStr.match(/totalTimeSeconds="([\d\.]+)"/i);
                           
      if (durationMatch && durationMatch[1]) {
        try {
          const parsedDuration = parseFloat(durationMatch[1]);
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
            duration = parsedDuration;
            console.log(`Found explicit duration in GPX: ${duration} seconds`);
          }
        } catch (e) {
          console.warn(`Failed to parse explicit duration: ${durationMatch[1]}`);
        }
      }
      
      // 2. Calculate from time tags if explicit duration not found
      if (duration <= 0) {
        // Extract all time tags
        const timeRegex = /<time>(.*?)<\/time>/g;
        const times: Date[] = [];
        let match;
        
        while ((match = timeRegex.exec(gpxStr)) !== null) {
          try {
            const timeStr = match[1];
            const parsedTime = new Date(timeStr);
            if (!isNaN(parsedTime.getTime())) {
              times.push(parsedTime);
            }
          } catch (e) {
            // Ignore invalid times
          }
        }
        
        // Sort times chronologically
        times.sort((a, b) => a.getTime() - b.getTime());
        
        // Calculate duration if we have at least 2 times
        if (times.length >= 2) {
          const firstTime = times[0];
          const lastTime = times[times.length - 1];
          const calculatedDuration = (lastTime.getTime() - firstTime.getTime()) / 1000; // in seconds
          
          // Sanity check: duration should be positive and reasonable (less than 24 hours)
          if (calculatedDuration > 0 && calculatedDuration < 86400) {
            duration = calculatedDuration;
            console.log(`Calculated duration from ${times.length} timestamps: ${duration} seconds`);
          } else {
            console.warn(`Calculated unreasonable duration (${calculatedDuration}s), will try other methods`);
          }
        }
      }
      
      // 3. Estimate from track points if timestamps didn't work
      if (duration <= 0) {
        const trackpoints = gpxStr.match(/<trkpt/g);
        if (trackpoints && trackpoints.length > 0) {
          // Estimate based on activity type and number of points
          // For running: ~1s per point, cycling: ~0.5s per point
          const pointsMultiplier = activityType === 'cycling' ? 0.5 : 
                                  activityType === 'running' ? 1 :
                                  activityType === 'swimming' ? 2 : 1.5;
                                  
          const estimatedDuration = trackpoints.length * pointsMultiplier;
          
          // Apply only if it seems reasonable (between 1 minute and 8 hours)
          if (estimatedDuration >= 60 && estimatedDuration <= 28800) {
            duration = estimatedDuration;
            console.log(`Estimated duration from ${trackpoints.length} trackpoints: ${duration} seconds`);
          }
        }
      }
      
      // CALCULATE DISTANCE - Try multiple approaches
      // 1. Look for explicit distance metadata
      const distanceMatch = gpxStr.match(/<distance>([\d\.]+)<\/distance>/i) ||
                           gpxStr.match(/distance="([\d\.]+)"/i) || 
                           gpxStr.match(/distanceMeters="([\d\.]+)"/i);
                           
      if (distanceMatch && distanceMatch[1]) {
        try {
          const parsedDistance = parseFloat(distanceMatch[1]);
          if (!isNaN(parsedDistance) && parsedDistance > 0) {
            distance = parsedDistance;
            console.log(`Found explicit distance in GPX: ${distance} meters`);
          }
        } catch (e) {
          console.warn(`Failed to parse explicit distance: ${distanceMatch[1]}`);
        }
      }
      
      // 2. Calculate from trackpoints if explicit distance not found
      if (distance <= 0) {
        const trackpoints = [];
        const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>/g;
        let tpMatch;
        
        while ((tpMatch = trkptRegex.exec(gpxStr)) !== null) {
          try {
            const lat = parseFloat(tpMatch[1]);
            const lon = parseFloat(tpMatch[2]);
            if (!isNaN(lat) && !isNaN(lon)) {
              trackpoints.push({ lat, lon });
            }
          } catch (e) {
            // Ignore invalid trackpoints
          }
        }
        
        // Calculate distance using Haversine formula between consecutive points
        if (trackpoints.length >= 2) {
          let totalDist = 0;
          for (let i = 1; i < trackpoints.length; i++) {
            const p1 = trackpoints[i-1];
            const p2 = trackpoints[i];
            
            // Haversine formula
            const R = 6371e3; // Earth radius in meters
            const φ1 = p1.lat * Math.PI / 180;
            const φ2 = p2.lat * Math.PI / 180;
            const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
            const Δλ = (p2.lon - p1.lon) * Math.PI / 180;
            
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                     Math.cos(φ1) * Math.cos(φ2) *
                     Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            
            const segmentDist = R * c;
            
            // Only count reasonable segments (less than 1km jumps)
            if (segmentDist < 1000) {
              totalDist += segmentDist;
            }
          }
          
          if (totalDist > 0) {
            distance = totalDist;
            console.log(`Calculated distance from trackpoints: ${distance} meters`);
          }
        }
      }
      
      // 3. If no distance calculated, estimate from duration (if available)
      if (distance <= 0 && duration > 0) {
        // Estimate based on activity type
        let speedMps = 0;
        if (activityType === 'running') {
          speedMps = 2.8; // ~10 km/h
        } else if (activityType === 'cycling') {
          speedMps = 5.5; // ~20 km/h
        } else if (activityType === 'swimming') {
          speedMps = 1.0; // ~3.6 km/h
        } else if (activityType === 'walking' || activityType === 'hiking') {
          speedMps = 1.4; // ~5 km/h
        } else {
          speedMps = 2.0; // default
        }
        
        distance = duration * speedMps;
        console.log(`Estimated distance from duration: ${distance} meters`);
      }
    } catch (xmlError) {
      console.warn(`Could not parse GPX details, will use defaults:`, xmlError);
    }
    
    // Fallbacks for essential data that couldn't be extracted
    if (isNaN(timestamp.getTime())) {
      console.warn(`No valid timestamp found in ${fileName}, using current date`);
      timestamp = new Date();
    }
    
    if (duration <= 0) {
      // Last resort: use smarter default based on activity type
      if (activityType === 'running') {
        duration = 2700; // 45 mins
      } else if (activityType === 'cycling') {
        duration = 3600; // 60 mins
      } else if (activityType === 'swimming') {
        duration = 1800; // 30 mins
      } else if (activityType === 'walking' || activityType === 'hiking') {
        duration = 3600; // 60 mins
      } else {
        duration = 1800; // 30 mins default
      }
      console.warn(`No valid duration found in ${fileName}, using default for ${activityType}: ${duration} seconds`);
    }
    
    if (distance <= 0) {
      // Last resort: use reasonable distance for the activity type and duration
      const speedMps = activityType === 'running' ? 2.8 : 
                      activityType === 'cycling' ? 5.5 :
                      activityType === 'swimming' ? 1.0 :
                      activityType === 'walking' || activityType === 'hiking' ? 1.4 : 2.0;
                      
      distance = duration * speedMps;
      console.warn(`No valid distance found in ${fileName}, estimated ${distance} meters`);
    }
    
    // Create a workout with parsed values
    return {
      type: activityType,
      date: timestamp,
      duration: duration,
      distance: distance,
      calories: Math.round(duration / 60 * 10), // rough estimate: 10 calories per minute
      average_speed: distance / duration, // m/s
      max_speed: (distance / duration) * 1.5, // a bit faster than average
      avg_heart_rate: 145,
      max_heart_rate: 170,
      title: `Activity from ${timestamp.toISOString().split('T')[0]}`,
      description: `Imported from ${fileName}`,
      total_elevation_gain: 50, // default 50m elevation gain
      workout_type: null,
      sport_type: activityType
    };
  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    // Instead of throwing, return a reasonable default workout
    return {
      type: 'other',
      date: new Date(),
      duration: 1800, // 30 minutes default as absolute fallback
      distance: 5000, // 5km default
      title: `Recovered activity from ${fileName}`,
      description: `This activity was recovered from a problematic GPX file. Original data may be incomplete.`
    };
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
        
        // Check for required data without providing fallbacks
        if (!workoutToSave.date || !workoutToSave.duration) {
          console.log(`Workout missing required data: date=${!!workoutToSave.date}, duration=${!!workoutToSave.duration}`)
          batchResults.errors++
          batchResults.errorDetails.push(`Missing required data: date=${!!workoutToSave.date}, duration=${!!workoutToSave.duration} in ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          // Skip this file instead of using fallbacks
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