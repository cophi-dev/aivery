import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  createCardioWorkout,
} from "@/lib/workout-actions"
import { revalidatePath } from "next/cache"
import { gunzip as gunzipCb } from 'zlib'
import { promisify } from 'util'
import { transformStravaActivity } from "@/lib/services/stravaService"
import { head, del } from '@vercel/blob'
import yauzl from 'yauzl'
import { Readable } from 'stream'
import { getDatabase } from '@/lib/db/mongodb'
import extract from 'extract-zip';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Keep runtime (Node.js needed for streaming and ZIP handling)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Set max duration to 60s (Hobby plan limit)

// Define FitActivity interface
interface FitActivity {
  timestamp: string | number;
  total_elapsed_time: number;
  total_distance: number;
  total_calories: number;
  sport: string;
  sub_sport?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_power?: number;
  max_power?: number;
  enhanced_avg_speed?: number;
  enhanced_max_speed?: number;
  avg_speed?: number;
  total_ascent?: number;
  description?: string;
}

const gunzipAsync = promisify(gunzipCb)

// Helper function to open a ZIP file using promises
function openZipFromBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Failed to open ZIP file'));
      resolve(zipfile);
    });
  });
}

// Helper function to read an entry from a ZIP file
function readEntryAsync(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    console.log(`Opening read stream for entry: ${entry.fileName} (size: ${entry.uncompressedSize})`);
    
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) {
        console.error(`Error opening read stream for ${entry.fileName}:`, err);
        return reject(err);
      }
      
      if (!readStream) {
        console.error(`No read stream available for ${entry.fileName}`);
        return reject(new Error('Failed to open read stream - stream is null'));
      }
      
      // Stream to buffer
      const chunks: Buffer[] = [];
      let bytesRead = 0;
      
      readStream.on('data', (chunk) => {
        chunks.push(chunk);
        bytesRead += chunk.length;
        // Log progress for large files (>1MB)
        if (entry.uncompressedSize > 1024 * 1024 && chunks.length % 10 === 0) {
          console.log(`Reading ${entry.fileName}: ${Math.round(bytesRead / entry.uncompressedSize * 100)}% complete`);
        }
      });
      
      readStream.on('end', () => {
        console.log(`Successfully read ${entry.fileName} (${bytesRead} bytes)`);
        resolve(Buffer.concat(chunks));
      });
      
      readStream.on('error', (streamErr) => {
        console.error(`Stream error reading ${entry.fileName}:`, streamErr);
        reject(streamErr);
      });
    });
  });
}

export async function POST(request: NextRequest) {
  let blobUrlToDelete: string | null = null;

  try {
    console.log('=== Starting Strava import process (from Blob Storage) ===');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    // Content-Type should be application/json now
    console.log('Content-Type:', request.headers.get('content-type'));

    // Check authentication first
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('No authenticated session');
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('User authenticated:', userId);

    // 1. Get blob pathname from the request body
    let blobPathname: string | undefined;
    let originalFilename: string | undefined;
    try {
        const body = await request.json();
        blobPathname = body.blobPathname;
        originalFilename = body.originalFilename;
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    if (!blobPathname || typeof blobPathname !== 'string') {
      console.error('No blobPathname provided in request body');
      return NextResponse.json({ success: false, error: "Missing blobPathname" }, { status: 400 });
    }
    
    // Optional: Validate if the blob path belongs to the authenticated user
    if (!blobPathname.startsWith(`strava-imports/${userId}/`)) {
        console.error('Blob path does not match authenticated user:', { userId, blobPathname });
        return NextResponse.json({ success: false, error: "Unauthorized access to blob" }, { status: 403 });
    }

    console.log('Processing file from blob storage:', { blobPathname, originalFilename });

    // 2. Fetch the file content from Vercel Blob
    console.log('Fetching file metadata from Blob storage...');
    const blobHead = await head(blobPathname); // Use head with pathname directly

    if (!blobHead || !blobHead.url) {
        console.error('Blob not found or URL missing:', blobPathname);
        // Try deleting the placeholder if it exists
        try { await del(blobPathname); } catch { /* Ignore delete error */ }
        return NextResponse.json({ success: false, error: "Uploaded file not found in storage." }, { status: 404 });
    }
    
    blobUrlToDelete = blobHead.url; // Store URL for potential deletion later
    console.log('File metadata fetched:', { size: blobHead.size, contentType: blobHead.contentType });
    
    // Check if the size is just 1 (our placeholder)
    if (blobHead.size === 1) {
        console.error('Error: Blob size indicates placeholder was not overwritten by upload.');
        try { await del(blobUrlToDelete); } catch { /* Ignore delete error */ }
        return NextResponse.json({ success: false, error: "File upload seems to have failed. Please try again." }, { status: 400 });
    }

    console.log('Downloading file content from Blob storage URL:', blobHead.url);
    const blobResponse = await fetch(blobHead.url);
    if (!blobResponse.ok) {
        console.error('Failed to download file from blob storage:', { status: blobResponse.status, url: blobHead.url });
        // Don't delete blob here, might be temporary issue
        return NextResponse.json({ success: false, error: `Failed to download file from storage (status ${blobResponse.status})` }, { status: 500 });
    }
    
    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File buffer size from blob:', buffer.length);

    // 3. Process the ZIP buffer
    console.log('Processing ZIP file...');
    
    // First, save the file to a temporary location for extraction
    const tempFilePath = path.join(os.tmpdir(), `strava-import-${uuidv4()}.zip`);
    await fs.writeFile(tempFilePath, buffer);
    console.log(`Saved ZIP file to temp location: ${tempFilePath}`);
    
    try {
        // Use the new extraction method that just queues files for processing
        const results = await processZipFileMoreReliably(tempFilePath, originalFilename || null);
        
        // 4. Delete the file from Blob storage after successful queuing
        try {
            console.log('Deleting successfully processed file from Blob storage:', blobUrlToDelete);
            if (blobUrlToDelete) {
                await del(blobUrlToDelete); // Use del with the blob URL
                console.log('Blob deleted successfully.');
            } else {
                console.warn('Could not delete blob, URL not available.');
            }
        } catch (deleteError) {
            console.error('Failed to delete file from blob storage after processing:', deleteError);
            // Log error but don't fail the entire request
        }

        // Clean up the temporary ZIP file, but NOT the extracted files directory
        try {
            await fs.unlink(tempFilePath);
            console.log('Temporary ZIP file deleted.');
        } catch (cleanupError) {
            console.error('Failed to clean up temporary ZIP file:', cleanupError);
        }

        // Return the process results to the client
        return NextResponse.json({
          success: true,
          processingId: results.processingId,
          totalFiles: results.totalFiles,
          batchSize: results.batchSize,
          fileTypes: {
            gpx: results.gpxFilesFound,
            fit: results.fitFilesFound,
            fitGz: results.fitGzFilesFound
          },
          message: "File extracted successfully and queued for batch processing"
        });
    } catch (zipError) {
        console.error('Failed to process ZIP file:', zipError);
        
        // Clean up temp file
        try {
            await fs.unlink(tempFilePath);
        } catch (cleanupError) {
            console.error('Failed to clean up temp file:', cleanupError);
        }
        
        // If the error is "unexpected EOF", provide a more helpful message
        if (zipError instanceof Error && zipError.message && zipError.message.includes('EOF')) {
            return NextResponse.json({
              success: false,
              error: "The ZIP file appears to be corrupted or incomplete. Please try downloading the archive from Strava again.",
              details: zipError.message
            }, { status: 400 });
        }
        
        // For other errors, throw to be caught by the outer catch block
        throw zipError;
    }

  } catch (error) {
    console.error("Strava import error (Blob Storage):", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process Strava archive.";
    
    // Attempt to delete the blob if an error occurred during processing
    if (blobUrlToDelete) {
      try {
        console.warn('Attempting to delete blob due to processing error:', blobUrlToDelete);
        await del(blobUrlToDelete);
        console.log('Blob deleted after error.');
      } catch (deleteError) {
        console.error('Failed to delete blob after processing error:', deleteError);
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Map Strava sport types to our workout types
function mapStravaType(sport: string, subSport?: string): string {
  if (!sport) return 'other'
  
  const sportLower = sport.toLowerCase()
  const subSportLower = subSport?.toLowerCase()

  // Map common sport types
  switch (sportLower) {
    case 'running':
    case 'run':
    case 'trail_running':
    case 'treadmill_running':
      return 'running'
    case 'cycling':
    case 'bike':
    case 'ride':
    case 'virtual_ride':
    case 'indoor_cycling':
      return 'cycling'
    case 'swimming':
    case 'swim':
    case 'pool_swimming':
    case 'open_water_swimming':
      return 'swimming'
    case 'walking':
    case 'walk':
      return 'walking'
    case 'hiking':
    case 'hike':
      return 'hiking'
    case 'training':
    case 'workout':
    case 'strength_training':
    case 'weight_training':
    case 'functional_strength':
      return 'strength'
    case 'yoga':
      return 'yoga'
    case 'pilates':
      return 'pilates'
    case 'flexibility':
    case 'stretching':
      return 'flexibility'
    case 'hiit':
    case 'circuit_training':
    case 'crossfit':
      return 'hiit'
    default:
      // Check sub_sport for additional context
      if (subSportLower === 'strength_training' || subSportLower === 'weight_training') {
        return 'strength'
      } else if (subSportLower === 'yoga') {
        return 'yoga'
      } else if (subSportLower === 'pilates') {
        return 'pilates'
      }
      return 'other'
  }
}

// Helper function to calculate heart rate zones
function calculateIntensity(activity: any): "Low" | "Medium" | "High" {
  // Calculate intensity based on heartrate zones if available
  if (activity.has_heartrate || activity.avg_heart_rate) {
    const maxHr = activity.max_heartrate || activity.max_heart_rate || 0;
    const avgHr = activity.average_heartrate || activity.avg_heart_rate || 0;
    
    if (avgHr > maxHr * 0.85) return "High";
    if (avgHr > maxHr * 0.7) return "Medium";
    return "Low";
  }
  
  // Fallback to perceived exertion based on relative speed
  if ((activity.average_speed && activity.max_speed) || 
      (activity.avg_speed && activity.enhanced_max_speed)) {
    const avgSpeed = activity.average_speed || activity.avg_speed || 0;
    const maxSpeed = activity.max_speed || activity.enhanced_max_speed || 0;
    const relativeEffort = avgSpeed / maxSpeed;
    
    if (relativeEffort > 0.8) return "High";
    if (relativeEffort > 0.6) return "Medium";
    return "Low";
  }
  
  return "Medium"; // Default to medium if no data available
}

// Helper function to calculate heart rate zones
function calculateHeartRateZones(avgHr?: number, maxHr?: number) {
  if (!avgHr || !maxHr) return undefined;
  
  const distribution = estimateZoneDistribution(avgHr, maxHr);
  
  // Only return zones if we have a valid distribution
  if (!distribution) return undefined;
  
  // Now we know distribution is defined, TypeScript will be happy
  return {
    thresholds: {
      easy: Math.round(maxHr * 0.6),    // 60% of max HR - Zone 1
      moderate: Math.round(maxHr * 0.7), // 70% of max HR - Zone 2
      hard: Math.round(maxHr * 0.8),     // 80% of max HR - Zone 3
      peak: Math.round(maxHr * 0.9)      // 90% of max HR - Zone 4
    },
    distribution // This is guaranteed to be defined
  };
}

// Estimate time distribution in heart rate zones based on average HR
function estimateZoneDistribution(avgHr?: number, maxHr?: number) {
  if (!avgHr || !maxHr) return undefined;
  
  // Define zone boundaries as percentages of max HR
  const zoneBoundaries = [
    0.6,  // Zone 1 starts at 60% of max HR
    0.7,  // Zone 2 starts at 70% of max HR
    0.8,  // Zone 3 starts at 80% of max HR
    0.9   // Zone 4 starts at 90% of max HR
  ];
  
  // Calculate which zone the average HR falls into
  const avgHrPercentage = avgHr / maxHr;
  let primaryZone = 0;
  
  for (let i = 0; i < zoneBoundaries.length; i++) {
    if (avgHrPercentage >= zoneBoundaries[i]) {
      primaryZone = i + 1;
    } else {
      break;
    }
  }
  
  // Create a distribution that emphasizes the primary zone
  // but also allocates some time to adjacent zones
  const distribution = {
    easy: 0,      // Zone 1
    moderate: 0,  // Zone 2
    hard: 0,      // Zone 3
    peak: 0       // Zone 4
  };
  
  const zoneNames = ['easy', 'moderate', 'hard', 'peak'];
  
  // Allocate percentages based on the primary zone
  // This is an estimation - we assume the athlete spent most time in the zone
  // where their average HR falls, with some time in adjacent zones
  switch (primaryZone) {
    case 0: // Below Zone 1
      distribution.easy = 100;
      break;
    case 1: // Zone 1 (easy)
      distribution.easy = 70;
      distribution.moderate = 30;
      break;
    case 2: // Zone 2 (moderate)
      distribution.easy = 20;
      distribution.moderate = 60;
      distribution.hard = 20;
      break;
    case 3: // Zone 3 (hard)
      distribution.moderate = 20;
      distribution.hard = 60;
      distribution.peak = 20;
      break;
    case 4: // Zone 4 (peak)
      distribution.hard = 30;
      distribution.peak = 70;
      break;
  }
  
  return distribution;
}

// Function to generate a meaningful activity name
function generateActivityName(activityData: any, startTime: Date, mappedType: string): string {
  // Format date as "Jun 15" or similar
  const formattedDate = startTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  // Get time of day
  const hour = startTime.getHours();
  let timeOfDay = '';
  if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
  else timeOfDay = 'Night';
  
  // Generate type-specific description
  let detail = '';
  const distanceKm = activityData.total_distance;
  const durationMin = activityData.total_elapsed_time / 60;
  
  if (mappedType === 'running' || mappedType === 'cycling' || mappedType === 'swimming') {
    if (distanceKm && distanceKm > 0) {
      // Round to 1 decimal place
      const formattedDistance = Math.round(distanceKm * 10) / 10;
      detail = `${formattedDistance}km`;
    } else if (durationMin && durationMin > 0) {
      const formattedDuration = Math.round(durationMin);
      detail = `${formattedDuration}min`;
    }
  }
  
  // Combine into final name
  let name = `${timeOfDay} ${mappedType}`;
  if (detail) name += ` (${detail})`;
  if (activityData.sub_sport && activityData.sub_sport !== 'generic') {
    name += ` - ${activityData.sub_sport.replace(/_/g, ' ')}`;
  }
  name += ` - ${formattedDate}`;
  
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Function to generate comprehensive notes for AI queries
function generateActivityNotes(activityData: any, startTime: Date, fileName: string): string {
  // Extract Strava link
  const stravaLink = extractStravaIdFromFilename(fileName);
  
  // Create notes with only the Strava link
  let notes = "";
  
  // Include Strava link if available
  if (stravaLink) {
    notes += `View on Strava: ${stravaLink}`;
  }
  
  // Add original description if it exists
  if (activityData.description) {
    notes += notes ? `\n\n${activityData.description}` : activityData.description;
  }
  
  return notes;
}

function calculateIntensityFromSession(session: any): "Low" | "Medium" | "High" {
  // Calculate intensity based on heart rate if available
  if (session.avg_heart_rate && session.max_heart_rate) {
    const maxHr = session.max_heart_rate
    const avgHr = session.avg_heart_rate
    
    if (avgHr > maxHr * 0.85) return "High"
    if (avgHr > maxHr * 0.7) return "Medium"
    return "Low"
  }
  
  // Fallback to speed-based intensity
  if (session.enhanced_avg_speed && session.enhanced_max_speed) {
    const relativeEffort = session.enhanced_avg_speed / session.enhanced_max_speed
    
    if (relativeEffort > 0.8) return "High"
    if (relativeEffort > 0.6) return "Medium"
    return "Low"
  }
  
  return "Medium" // Default to medium if no data available
}

function extractActivityFromRecords(data: any): FitActivity | null {
  if (!data.records || data.records.length === 0) {
    return null
  }

  // Get the first and last record to calculate duration
  const firstRecord = data.records[0]
  const lastRecord = data.records[data.records.length - 1]

  // Calculate total elapsed time from first and last record timestamps
  const startTime = new Date(firstRecord.timestamp)
  const endTime = new Date(lastRecord.timestamp)
  const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000 // Convert to seconds

  // Calculate total distance by summing distance from each record
  const totalDistance = data.records.reduce((sum: number, record: any) => 
    sum + (record.distance || 0), 0) / 1000 // Convert meters to kilometers

  // Calculate average speed
  const avgSpeed = totalDistance / (totalElapsedTime / 3600) // km/h

  // Find max speed from records
  const maxSpeed = Math.max(...data.records.map((r: any) => r.speed || 0)) * 3.6 // Convert m/s to km/h

  // Calculate total calories if available
  const totalCalories = data.records.reduce((sum: number, record: any) => 
    sum + (record.calories || 0), 0)

  // Calculate total ascent
  const totalAscent = data.records.reduce((sum: number, record: any) => 
    sum + (record.altitude || 0), 0)

  // Calculate average heart rate if available
  const heartRates = data.records.map((r: any) => r.heart_rate).filter(Boolean)
  const avgHeartRate = heartRates.length > 0 
    ? heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length 
    : undefined
  const maxHeartRate = heartRates.length > 0 
    ? Math.max(...heartRates)
    : undefined

  // Calculate average power if available
  const powers = data.records.map((r: any) => r.power).filter(Boolean)
  const avgPower = powers.length > 0 
    ? powers.reduce((a: number, b: number) => a + b, 0) / powers.length 
    : undefined
  const maxPower = powers.length > 0 
    ? Math.max(...powers)
    : undefined

  // Extract description if available from the session or activity
  const description = data.session?.description || data.activity?.description || data.session?.notes || data.activity?.notes

  return {
    timestamp: startTime.getTime(),
    total_elapsed_time: totalElapsedTime,
    total_distance: totalDistance,
    total_calories: totalCalories,
    sport: firstRecord.sport || 'other',
    avg_heart_rate: avgHeartRate,
    max_heart_rate: maxHeartRate,
    avg_power: avgPower,
    max_power: maxPower,
    enhanced_avg_speed: avgSpeed,
    enhanced_max_speed: maxSpeed,
    avg_speed: avgSpeed,
    total_ascent: totalAscent,
    description: description
  }
}

// Export these functions so they can be imported from other files
export async function processFitFile(content: Buffer, fileName: string): Promise<any> {
  let fitParser: any; // Define parser instance variable
  try {
    console.log(`Processing FIT file: ${fileName}, size: ${content.length} bytes`);
    
    // Use dynamic import instead of require
    const fitFileParserModule = await import('fit-file-parser');
    console.log('Dynamically imported fit-file-parser module:', typeof fitFileParserModule, Object.keys(fitFileParserModule));

    // Attempt to access FitParser constructor, check common export patterns
    const FitParserConstructor = fitFileParserModule.FitParser || fitFileParserModule.default || fitFileParserModule;
    if (typeof FitParserConstructor !== 'function') {
      console.error('FitParser constructor is not a function. Type:', typeof FitParserConstructor);
      throw new Error('Failed to load FitParser constructor.');
    }
    console.log('Using FitParser constructor of type:', typeof FitParserConstructor);

    fitParser = new FitParserConstructor({ // Assign to the parser instance variable
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list'
    });

    // Promisify the parse method
    const data = await new Promise<any>((resolve, reject) => {
      console.log('Starting FIT parse...');
      fitParser.parse(content, (error: any, parsedData: any) => {
        if (error) {
          console.error(`FIT parse error for ${fileName}:`, error);
          reject(error);
        } else {
          console.log('FIT parse successful, resolving promise...');
          resolve(parsedData);
        }
      });
    });
    
    // Clear the content buffer after parsing is complete (success or error handled by promise)
    // @ts-ignore - intentionally clearing buffer
    content = null;
    
    // --- Process the parsed data --- 
    try {
      console.log('Processing parsed FIT data...');
      
      // Extract ID from filename
      const idMatch = fileName.match(/\/(\d+)\.fit(?:\.gz)?$/);
      const id = idMatch ? idMatch[1] : `fit_${Date.now()}`;
      console.log('Extracted ID:', id);
      
      // Extract activity data but with minimal data usage
      const rawRecords = data.records || [];
      const sessions = data.sessions || [];
      
      console.log(`Found ${rawRecords.length} records and ${sessions.length} sessions`);
      
      if (rawRecords.length === 0) {
        console.warn(`No record data in ${fileName}`);
        return null; // Return null directly, no need to resolve promise here
      }
      
      // Get the first and last record to calculate duration
      const firstRecord = rawRecords[0];
      const lastRecord = rawRecords[rawRecords.length - 1];
      
      // Calculate total elapsed time from first and last record timestamps
      const startTime = new Date(firstRecord.timestamp);
      const endTime = new Date(lastRecord.timestamp);
      const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000; // Seconds
      
      console.log('Time data:', {
        start: startTime,
        end: endTime,
        elapsed: totalElapsedTime
      });
      
      // Calculate summary stats from session or records
      let totalDistance = 0; // meters
      let sport = 'other';
      let subSport: string | undefined = undefined;
      let totalElevationGain = 0; // meters
      let avgHeartRate: number | undefined = undefined;
      let maxHeartRate: number | undefined = undefined;
      let avgSpeed = 0; // m/s
      let maxSpeed = 0; // m/s
      let avgCadence: number | undefined = undefined;
      let maxCadence: number | undefined = undefined;
      let avgPower: number | undefined = undefined;
      let maxPower: number | undefined = undefined;

      if (sessions.length > 0) {
        const session = sessions[0];
        totalDistance = session.total_distance || 0; // Assume meters
        sport = session.sport || 'other';
        subSport = session.sub_sport;
        totalElevationGain = session.total_ascent || 0;
        avgHeartRate = session.avg_heart_rate;
        maxHeartRate = session.max_heart_rate;
        avgSpeed = session.avg_speed || session.enhanced_avg_speed || 0; // m/s
        maxSpeed = session.max_speed || session.enhanced_max_speed || 0; // m/s
        avgCadence = session.avg_cadence;
        maxCadence = session.max_cadence;
        avgPower = session.avg_power;
        maxPower = session.max_power;
        console.log('Using session data:', { totalDistance, sport, totalElevationGain, avgHeartRate, maxHeartRate, avgSpeed, maxSpeed });
      } else {
        // Calculate from records if no session data
        totalDistance = rawRecords.reduce((sum: number, record: any) => 
          sum + (record.distance || 0), 0); // Assume meters
        sport = firstRecord.sport || 'other';
        
        // Elevation Gain from records (handle potential null/undefined)
        const altitudes = rawRecords.map((r: any) => r.altitude).filter((a: any): a is number => a !== undefined && a !== null);
        if (altitudes.length > 1) {
          totalElevationGain = altitudes.reduce((gain: number, current: number, i: number, arr: number[]) => {
            if (i > 0 && current > arr[i - 1]) {
              return gain + (current - arr[i - 1]);
            }
            return gain;
          }, 0);
        }
        
        // HR from records (handle potential null/undefined)
        const heartRates = rawRecords.map((r: any) => r.heart_rate).filter((hr: any): hr is number => hr !== undefined && hr !== null);
        if (heartRates.length > 0) {
          avgHeartRate = heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length;
          maxHeartRate = Math.max(...heartRates);
        }
        
        // Speed from records (handle potential null/undefined)
        const speeds = rawRecords.map((r: any) => r.speed).filter((s: any): s is number => s !== undefined && s !== null);
        if (speeds.length > 0) {
            avgSpeed = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length; // m/s
            maxSpeed = Math.max(...speeds); // m/s
        } else {
            avgSpeed = totalElapsedTime > 0 ? (totalDistance / totalElapsedTime) : 0; // Fallback: calculate from total distance/time
        }
        
        // Cadence from records
        const cadences = rawRecords.map((r: any) => r.cadence).filter((c: any): c is number => c !== undefined && c !== null);
        if (cadences.length > 0) {
          avgCadence = cadences.reduce((a: number, b: number) => a + b, 0) / cadences.length;
          maxCadence = Math.max(...cadences);
        }
        
        // Power from records
        const powers = rawRecords.map((r: any) => r.power).filter((p: any): p is number => p !== undefined && p !== null);
        if (powers.length > 0) {
          avgPower = powers.reduce((a: number, b: number) => a + b, 0) / powers.length;
          maxPower = Math.max(...powers);
        }
        
        console.log('Calculated from records:', { totalDistance, sport, totalElevationGain, avgHeartRate, maxHeartRate, avgSpeed, maxSpeed });
      }
      
      const mappedType = mapStravaType(sport, subSport);
      
      // Extract detailed records for storage
      const detailedRecords = rawRecords.map((rec: any) => ({
        timestamp: new Date(rec.timestamp),
        heart_rate: rec.heart_rate,
        distance: rec.distance, // Cumulative distance in meters
        speed: rec.speed, // Speed in m/s
        altitude: rec.altitude,
        latitude: rec.position_lat,
        longitude: rec.position_long,
        cadence: rec.cadence,
        power: rec.power
        // Filter out undefined values before saving? Maybe not, keep sparse data
      }));
      
      // Create the activity object including the records
      const stravaId = extractStravaIdFromFilename(fileName);
      const transformedActivity = {
        id: id,
        name: generateActivityName({ total_distance: totalDistance / 1000, total_elapsed_time: totalElapsedTime, sport, sub_sport: subSport }, startTime, mappedType) + 
              (stravaId ? ` (Strava: ${stravaId})` : ''),
        type: mappedType,
        start_date: startTime.toISOString(),
        elapsed_time: totalElapsedTime, // seconds
        distance: totalDistance, // meters
        total_elevation_gain: totalElevationGain, // meters
        has_heartrate: !!avgHeartRate,
        average_heartrate: avgHeartRate,
        max_heartrate: maxHeartRate,
        average_speed: avgSpeed, // m/s
        max_speed: maxSpeed, // m/s
        average_cadence: avgCadence,
        max_cadence: maxCadence,
        average_power: avgPower,
        max_power: maxPower,
        records: detailedRecords, // Add the detailed records here
        notes: generateActivityNotes({}, startTime, fileName) // Pass empty object if session description isn't used
      };
      
      console.log('Created transformed activity with records:', transformedActivity.id, `(${transformedActivity.records.length} records)`);
      
      // Clear data to free memory
      // data = null; // data is already scoped locally to the promise result
      
      return transformedActivity; // Return the processed activity

    } catch (processError) {
      console.error(`Error processing parsed FIT data from ${fileName}:`, processError);
      throw processError; // Re-throw processing error to be caught by outer catch
    }

  } catch (error) {
    console.error(`Error processing FIT file ${fileName}:`, error);
    // Ensure content buffer is cleared even on initial parsing error or constructor error
    // @ts-ignore
    content = null; 
    throw error; // Re-throw the error
  }
}

export async function processGpxFile(content: Buffer, fileName: string): Promise<any> {
  try {
    console.log(`Processing GPX file: ${fileName}, size: ${content.length} bytes`);
    
    // Use xml2js instead of gpxparser (which has browser dependencies)
    const xml2js = await import('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    // Parse the GPX data
    const gpxData = await parser.parseStringPromise(content.toString('utf-8'));
    console.log('Successfully parsed GPX data');
    
    if (!gpxData.gpx || !gpxData.gpx.trk) {
      console.warn(`No track data found in GPX file: ${fileName}`);
      return null;
    }
    
    // Extract track data
    const track = gpxData.gpx.trk;
    const trackName = track.name || '';
    
    // Handle different track point structures
    let trackPoints = track.trkseg && track.trkseg.trkpt ? 
                     (Array.isArray(track.trkseg.trkpt) ? track.trkseg.trkpt : [track.trkseg.trkpt]) : 
                     [];
    
    // Handle case where there might be multiple track segments
    if (track.trkseg && Array.isArray(track.trkseg)) {
      trackPoints = track.trkseg.reduce((points: any[], seg: any) => {
        if (seg.trkpt) {
          const segPoints = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
          return points.concat(segPoints);
        }
        return points;
      }, []);
    }
    
    console.log(`Found ${trackPoints.length} track points in GPX file`);
    
    if (trackPoints.length === 0) {
      console.warn(`No track points found in GPX file: ${fileName}`);
      return null;
    }
    
    // Try to get start and end times - fallback to current time if necessary
    const currentTime = new Date();
    // Using a fake date based on the filename if we can get an ID-like value
    let fallbackDate: Date;
    const idMatch = fileName.match(/(\d+)/);
    if (idMatch) {
      // Try to derive a date from the filename number
      const numericValue = parseInt(idMatch[1]);
      if (!isNaN(numericValue) && numericValue > 1000000000) {
        // Looks like a unix timestamp or big number
        fallbackDate = new Date(numericValue * 1000);
        if (fallbackDate > currentTime || fallbackDate < new Date('2005-01-01')) {
          fallbackDate = new Date(); // Reset if clearly invalid
        }
      } else {
        fallbackDate = new Date();
      }
    } else {
      fallbackDate = new Date();
    }
    
    // Check if any track points have valid time
    const hasValidTimes = trackPoints.some((p: any) => {
      try {
        return p.time && !isNaN(new Date(p.time).getTime());
      } catch {
        return false;
      }
    });
    
    let startTime: Date = fallbackDate;
    let endTime: Date = new Date(fallbackDate.getTime() + 3600000); // 1 hour later
    
    if (hasValidTimes) {
      // Find first valid time point
      for (const point of trackPoints) {
        try {
          if (point.time) {
            const pointTime = new Date(point.time);
            if (!isNaN(pointTime.getTime())) {
              startTime = pointTime;
              break;
            }
          }
        } catch {
          // Ignore invalid times
        }
      }
      
      // Find last valid time point
      for (let i = trackPoints.length - 1; i >= 0; i--) {
        try {
          if (trackPoints[i].time) {
            const pointTime = new Date(trackPoints[i].time);
            if (!isNaN(pointTime.getTime())) {
              endTime = pointTime;
              break;
            }
          }
        } catch {
          // Ignore invalid times
        }
      }
    }
    
    let totalDistance = 0;
    let totalElevationGain = 0;
    let sport = 'other';
    let heartRates: number[] = [];
    
    // Function to calculate distance between two points using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // Earth radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      
      return R * c; // Distance in meters
    };
    
    // Calculate distance and elevation gain from track points
    if (trackPoints.length > 0) {
      // Calculate distance by summing distances between consecutive points
      for (let i = 1; i < trackPoints.length; i++) {
        const prevPoint = trackPoints[i-1];
        const currPoint = trackPoints[i];
        
        if (prevPoint.$ && currPoint.$ && 
            prevPoint.$.lat && prevPoint.$.lon && 
            currPoint.$.lat && currPoint.$.lon) {
          totalDistance += calculateDistance(
            parseFloat(prevPoint.$.lat), 
            parseFloat(prevPoint.$.lon),
            parseFloat(currPoint.$.lat), 
            parseFloat(currPoint.$.lon)
          );
        }
        
        // Calculate elevation gain (only positive changes)
        if (prevPoint.ele && currPoint.ele) {
          const prevEle = parseFloat(prevPoint.ele);
          const currEle = parseFloat(currPoint.ele);
          if (!isNaN(prevEle) && !isNaN(currEle) && currEle > prevEle) {
            totalElevationGain += (currEle - prevEle);
          }
        }
        
        // Extract heart rate data from extensions
        if (currPoint.extensions) {
          const extensionsData = currPoint.extensions;
          let hr: number | undefined;
          
          // Try different extension formats
          if (extensionsData.TrackPointExtension && extensionsData.TrackPointExtension.hr) {
            hr = parseInt(extensionsData.TrackPointExtension.hr, 10);
          } else if (extensionsData['gpxtpx:TrackPointExtension'] && extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr']) {
            hr = parseInt(extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr'], 10);
          } else if (extensionsData.heart_rate) {
            hr = parseInt(extensionsData.heart_rate, 10);
          }
          
          if (hr && !isNaN(hr)) {
            heartRates.push(hr);
          }
        }
      }
      
      // Try to determine sport type from filename or track name
      const checkName = (fileName + ' ' + trackName).toLowerCase();
      if (checkName.includes('run')) {
        sport = 'running';
      } else if (checkName.includes('ride') || checkName.includes('cycling')) {
        sport = 'cycling';
      } else if (checkName.includes('walk')) {
        sport = 'walking';
      } else if (checkName.includes('hike')) {
        sport = 'hiking';
      } else if (fileName.includes('route')) {
        // Special case for route files
        console.log('This appears to be a route file rather than an activity, using "other" type');
        sport = 'other';
      }
    }
    
    // Calculate duration in seconds
    const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;
    
    // Calculate average speed in m/s
    const avgSpeed = totalElapsedTime > 0 ? (totalDistance / totalElapsedTime) : 0;
    
    // Calculate average and max heart rate
    let avgHeartRate: number | undefined = undefined;
    let maxHeartRate: number | undefined = undefined;
    
    if (heartRates.length > 0) {
      avgHeartRate = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
      maxHeartRate = Math.max(...heartRates);
    }
    
    // Extract ID from filename
    const idMatch2 = fileName.match(/\/(\d+)\.gpx$/);
    const id = idMatch2 ? idMatch2[1] : `gpx_${Date.now()}`;
    
    // Build detailed records from track points - but handle invalid times
    const detailedRecords = trackPoints.map((point: any, index: number) => {
      const lat = point.$ ? parseFloat(point.$.lat) : undefined;
      const lon = point.$ ? parseFloat(point.$.lon) : undefined;
      const ele = point.ele ? parseFloat(point.ele) : undefined;
      
      // Extract heart rate
      let hr: number | undefined;
      if (point.extensions) {
        const extensionsData = point.extensions;
        if (extensionsData.TrackPointExtension && extensionsData.TrackPointExtension.hr) {
          hr = parseInt(extensionsData.TrackPointExtension.hr, 10);
        } else if (extensionsData['gpxtpx:TrackPointExtension'] && extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr']) {
          hr = parseInt(extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr'], 10);
        } else if (extensionsData.heart_rate) {
          hr = parseInt(extensionsData.heart_rate, 10);
        }
      }
      
      // Handle time value safely
      let timestamp = startTime;
      try {
        if (point.time) {
          const pointTime = new Date(point.time);
          if (!isNaN(pointTime.getTime())) {
            timestamp = pointTime;
          }
        } else {
          // No time provided, estimate based on index
          timestamp = new Date(startTime.getTime() + index * (totalElapsedTime * 1000 / trackPoints.length));
        }
      } catch {
        // Use fallback if time parsing fails
        timestamp = new Date(startTime.getTime() + index * (totalElapsedTime * 1000 / trackPoints.length));
      }
      
      return {
        timestamp,
        heart_rate: hr,
        latitude: lat,
        longitude: lon,
        altitude: ele,
        // These are typically not available in GPX
        distance: undefined,
        speed: undefined,
        cadence: undefined,
        power: undefined
      };
    }).filter((r: any) => r.timestamp);
    
    // Format the final activity data
    const name = track.name || `${sport.charAt(0).toUpperCase() + sport.slice(1)} on ${startTime.toLocaleDateString()}`;
    console.log(`Creating activity with name: ${name}, type: ${sport}, date: ${startTime.toISOString()}`);
    
    const transformedActivity = {
      id,
      name,
      type: sport,
      start_date: startTime.toISOString(),
      elapsed_time: totalElapsedTime, // seconds
      distance: totalDistance, // meters
      total_elevation_gain: totalElevationGain, // meters
      has_heartrate: heartRates.length > 0,
      average_heartrate: avgHeartRate,
      max_heartrate: maxHeartRate,
      average_speed: avgSpeed, // m/s
      records: detailedRecords,
      notes: generateActivityNotes({}, startTime, fileName)
    };
    
    console.log(`Successfully processed GPX data from ${fileName}, ${transformedActivity.records.length} records`);
    return transformedActivity;
  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    throw error;
  }
}

// Function to extract Strava ID from filename
function extractStravaIdFromFilename(filename: string): string | undefined {
  if (!filename) return undefined;
  
  // Normalize path separators for consistent handling
  const normalizedFilename = filename.replace(/\\/g, '/');
  console.log(`Extracting Strava ID from filename: ${normalizedFilename}`);
  
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
  ];
  
  // Try each pattern in order
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = normalizedFilename.match(pattern);
    if (match && match[1]) {
      console.log(`  -> Found ID (pattern ${i + 1}): ${match[1]}`);
      return match[1];
    }
  }
  
  console.log(`  -> No valid Strava ID found in filename: ${normalizedFilename}`);
  return undefined;
}

// Helper function to parse GPX files
async function parseGPX(gpxString: string): Promise<any> {
  const xml2js = await import('xml2js');
  const parser = new xml2js.Parser({ explicitArray: false });
  return parser.parseStringPromise(gpxString);
}

// Function to create base exercise types when they don't exist
async function createBaseExerciseForType(type: string): Promise<void> {
  try {
    console.log(`Creating base exercise for type: ${type}`);
    
    // Clean up the exercise name - capitalize first letter
    const exerciseName = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    
    // Get database connection
    const db = await getDatabase();
    
    // Check if the exercise already exists
    const existingExercise = await db.collection('exercises').findOne({
      name: exerciseName,
      category: 'cardio'
    });
    
    if (existingExercise) {
      console.log(`Exercise '${exerciseName}' already exists in the database.`);
      return;
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
    };
    
    // Insert the exercise
    const result = await db.collection('exercises').insertOne(exerciseDoc);
    console.log(`Created base exercise '${exerciseName}' with ID: ${result.insertedId}`);
  } catch (error) {
    console.error(`Error creating base exercise for type '${type}':`, error);
    throw new Error(`Failed to create base exercise: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process a ZIP archive more reliably by extracting to temp dir first
async function processZipFileMoreReliably(zipFilePath: string, originalFilename: string | null): Promise<any> {
  console.log('Processing Strava ZIP file with extract-zip for better nested folder support');
  
  // Create a temporary directory for extraction
  const processingId = uuidv4();
  const tempDir = path.join(os.tmpdir(), `strava-import-${processingId}`);
  console.log(`Creating temp directory for extraction: ${tempDir}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Extract all files
    console.log(`Extracting ZIP file to: ${tempDir}`);
    await extract(zipFilePath, { dir: tempDir });
    console.log('ZIP extraction complete');
    
    // Set up tracking variables
    const results = {
      processed: 0,
      imported: 0,
      errors: [] as string[],
      activityTypesCount: {} as Record<string, number>,
      earliestTimestamp: Infinity,
      latestTimestamp: -Infinity,
      totalDistance: 0,
      totalDuration: 0,
      activitiesFound: 0,
      gpxFilesFound: 0,
      fitFilesFound: 0,
      fitGzFilesFound: 0,
      tcxFilesFound: 0,
      processingId: processingId,
      totalFiles: 0,
      batchSize: 10
    };
    
    // First, get a recursive list of all files
    const allFiles: string[] = await getFilesRecursively(tempDir);
    console.log(`Found ${allFiles.length} total files in extracted ZIP`);
    
    // Count activity files by type and filter out non-activity files
    const activityFiles = allFiles.filter(file => {
      const lowerFile = file.toLowerCase();
      const normalizedPath = lowerFile.replace(/\\/g, '/');
      
      // Exclude files from the routes directory
      if (normalizedPath.includes('/routes/') || normalizedPath.includes('\\routes\\')) {
        console.log(`Skipping file in routes directory: ${file}`);
        return false;
      }
      
      // Include only files that are in the activities directory or have an activity file extension
      const isActivityFile = 
        (normalizedPath.includes('/activities/') || normalizedPath.includes('\\activities\\')) &&
        (lowerFile.endsWith('.gpx') || lowerFile.endsWith('.fit') || lowerFile.endsWith('.fit.gz') || lowerFile.endsWith('.tcx'));
      
      // If not in activities directory, check if it has the right extension and is in the root
      const isRootActivityFile = 
        !normalizedPath.includes('/') && 
        (lowerFile.endsWith('.gpx') || lowerFile.endsWith('.fit') || lowerFile.endsWith('.fit.gz') || lowerFile.endsWith('.tcx'));
      
      return isActivityFile || isRootActivityFile;
    });
    
    console.log(`Found ${activityFiles.length} potential activity files after filtering`);
    results.activitiesFound = activityFiles.length;
    results.totalFiles = activityFiles.length;
    
    // Count by extension
    activityFiles.forEach(file => {
      const lowerFile = file.toLowerCase();
      if (lowerFile.endsWith('.gpx')) results.gpxFilesFound++;
      else if (lowerFile.endsWith('.fit.gz')) results.fitGzFilesFound++;
      else if (lowerFile.endsWith('.fit')) results.fitFilesFound++;
      else if (lowerFile.endsWith('.tcx')) results.tcxFilesFound++;
    });
    
    // Get the current session for user ID
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    // Create processing state
    const processingState = {
      processingId,
      userId: session.user.id,
      status: 'pending',
      createdAt: new Date(),
      lastUpdated: new Date(),
      activityFiles: activityFiles.map(file => path.relative(tempDir, file)),
      processedFiles: [] as string[],
      importedFiles: [] as string[],
      errorFiles: [] as string[],
      totalFiles: activityFiles.length,
      gpxFilesCount: results.gpxFilesFound,
      fitFilesCount: results.fitFilesFound,
      fitGzFilesCount: results.fitGzFilesFound,
      tcxFilesCount: results.tcxFilesFound,
      originalFilename: originalFilename || 'strava-export.zip'
    };
    
    // Save state to both file system and MongoDB for reliability
    const processingStatePath = path.join(tempDir, 'processing-state.json');
    await fs.writeFile(processingStatePath, JSON.stringify(processingState));
    
    // Save to MongoDB as the reliable source
    try {
      const db = await (await import('@/lib/db/mongodb')).getDatabase();
      await db.collection('strava_import_state').insertOne(processingState);
      console.log('Saved initial processing state to MongoDB');
    } catch (dbError) {
      console.error('Error saving processing state to MongoDB:', dbError);
      throw new Error('Failed to save processing state to database: ' + (dbError instanceof Error ? dbError.message : String(dbError)));
    }
    
    console.log(`Successfully prepared ${activityFiles.length} files for batch processing with ID: ${processingId}`);
    
    // Return the results with processing ID but without actually processing files
    return {
      ...results,
      processingId,
      totalFiles: activityFiles.length,
      message: `Files extracted and queued for batch processing`
    };
    
  } catch (error) {
    console.error('Error processing ZIP with extract-zip:', error);
    throw error;
  }
}

// Helper function to recursively get all files in a directory
async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFilesRecursively(res) : res;
  }));
  return Array.prototype.concat(...files);
}