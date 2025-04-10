import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  createCardioWorkout,
} from "@/lib/workout-actions"
import { revalidatePath } from "next/cache"
import AdmZip from 'adm-zip'
import { gunzip as gunzipCb } from 'zlib'
import { promisify } from 'util'
import { transformStravaActivity } from "@/lib/services/stravaService"
import { Readable } from "stream"
import fs from 'fs'
import path from 'path'
import os from 'os'

// Configuration for this API route - should support up to 10MB file uploads
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Temporarily remove the config block for diagnostics
// export const config = {
//   api: {
//     bodyParser: {
//       sizeLimit: '50mb',
//     },
//   },
// };

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

// Helper function to wait for garbage collection
const waitForGC = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to clean up temporary files
async function cleanupTempFiles(tempDir: string | null) {
  if (tempDir) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temporary directory:', tempDir);
        } catch (error) {
      console.error('Error cleaning up temporary files:', error);
        }
      }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    // Log request details
    console.log('=== Starting Strava import process ===');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    console.log('Content-Type:', request.headers.get('content-type'));
    console.log('Content-Length:', request.headers.get('content-length'));

    // Check authentication first
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.error('No authenticated session');
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized" 
      }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('User authenticated:', session.user.id);

    // Get the raw request body
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file provided');
      return NextResponse.json({ 
        success: false,
        error: "No file provided" 
      }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file
    if (!file.name.endsWith('.zip')) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({ 
        success: false,
        error: "Please upload a ZIP file" 
      }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Processing file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Create temporary directory with unique name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    tempDir = path.join(os.tmpdir(), `strava-import-${timestamp}-${randomString}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    console.log('Created temporary directory:', tempDir);

    // Get file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File buffer size:', buffer.length);

    // Create ZIP instance
    console.log('Creating ZIP instance...');
    const zip = new AdmZip(buffer);
    
    // Get entries
    const entries = zip.getEntries();
    console.log(`Found ${entries.length} entries in ZIP`);
      
    // Log all entry names for debugging
    console.log('All ZIP Entries:', entries.map(e => e.entryName));
      
    // Track results
    const results = {
      processed: 0,
      imported: 0,
    errors: [] as string[],
    // Add fields for aggregate stats
    activityTypesCount: {} as Record<string, number>,
    earliestTimestamp: Infinity,
    latestTimestamp: -Infinity,
    totalDistance: 0,
    totalDuration: 0 // Assuming duration is in minutes or a consistent unit
  };

  // Process each entry
  for (const entry of entries) {
    // Log every entry being considered
    console.log(`Checking entry: ${entry.entryName}, isDirectory: ${entry.isDirectory}`);
    // Make the path check case-insensitive
    const isActivityPath = entry.entryName.toLowerCase().includes('activities/'); 
    console.log(`  -> Checking path includes 'activities/' (case-insensitive): ${isActivityPath}`);

    if (!entry.isDirectory && isActivityPath) {
      results.processed++; // Increment processed count here, even if parsing fails later
      console.log(`Processing: ${entry.entryName}`);
      
      try {
        let workout = null;
        let workoutTimestamp: number | null = null; // Use number for comparison
        let workoutDistance = 0;
        let workoutDuration = 0; // Store duration
        let workoutActivityType = 'unknown';
        
        if (entry.entryName.endsWith('.fit.gz')) {
          const content = entry.getData();
          const unzippedContent = await gunzipAsync(content);
          workout = await processFitFile(unzippedContent, entry.entryName);
        } else if (entry.entryName.endsWith('.gpx')) {
          const content = entry.getData();
          workout = await processGpxFile(Buffer.from(content), entry.entryName);
        } else if (entry.entryName.endsWith('.fit')) {
          const content = entry.getData();
          workout = await processFitFile(content, entry.entryName);
        }

        if (workout) {
          const transformedWorkout = transformStravaActivity(workout);
          
          // Prepare data for saving, store duration in SECONDS
          const workoutToSave = {
            ...transformedWorkout,
            distance: transformedWorkout.distance, // This should already be in KM
            duration: transformedWorkout.duration || 0, // Store duration directly in seconds
            userId: session.user.id,
            source: "strava",
            sourceId: extractStravaIdFromFilename(entry.entryName)
          };
          
          // Aggregate stats using the duration in seconds from workoutToSave
          workoutActivityType = workoutToSave.type || 'unknown'; 
          workoutTimestamp = new Date(workoutToSave.date).getTime();
          workoutDuration = workoutToSave.duration; // Use seconds
          workoutDistance = workoutToSave.distance || 0;

          results.activityTypesCount[workoutActivityType] = (results.activityTypesCount[workoutActivityType] || 0) + 1;
          if (!isNaN(workoutTimestamp)) {
               results.earliestTimestamp = Math.min(results.earliestTimestamp, workoutTimestamp);
               results.latestTimestamp = Math.max(results.latestTimestamp, workoutTimestamp);
          }
          results.totalDistance += workoutDistance;
          // Use the duration (already converted to seconds) from workoutToSave for aggregation
          results.totalDuration += workoutDuration; 

          // Save the workout with duration in seconds and distance in KM
          await createCardioWorkout(workoutToSave);
          results.imported++;
        } else {
          // Still counts as processed, but not imported
          console.log(`No workout data extracted from ${entry.entryName}, skipping import.`);
        }
        
        // Free up memory - consider if needed, maybe less frequently
        // await waitForGC(50);
        
      } catch (error) {
        console.error(`Error processing ${entry.entryName}:`, error);
        results.errors.push(entry.entryName); // Log the filename that failed
        // This file was processed but resulted in an error, don't increment imported
      }
    }
  }

  // Clean up temporary directory
  await cleanupTempFiles(tempDir);

  // Revalidate paths after processing all files
  revalidatePath("/calendar");
  revalidatePath("/activity");
  revalidatePath("/dashboard");

  // Convert timestamps back to ISO strings or keep as numbers?
  // Let's convert back to ISO strings for consistency, handle cases where no dates were found
  const finalResults = {
      ...results,
      earliestDate: results.earliestTimestamp === Infinity ? null : new Date(results.earliestTimestamp).toISOString(),
      latestDate: results.latestTimestamp === -Infinity ? null : new Date(results.latestTimestamp).toISOString(),
      totalDuration: Math.round(results.totalDuration / 60), // Convert seconds to minutes for display
  };
  // Remove intermediate timestamp numbers
  delete (finalResults as any).earliestTimestamp;
  delete (finalResults as any).latestTimestamp;

  console.log('Final import results:', finalResults);

  // Return results including aggregate stats
  return NextResponse.json({
    success: true,
    message: `Processed ${finalResults.processed} files, imported ${finalResults.imported} workouts`,
    results: finalResults
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
    
  } catch (error) {
    console.error('Error in Strava import:', error);
    
    // Clean up on error
    await cleanupTempFiles(tempDir);
    
    // Return error response
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "An error occurred during import",
      details: error instanceof Error ? error.stack : undefined
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
    case 'flexibility':
      return 'flexibility'
    case 'hiit':
    case 'circuit_training':
    case 'crossfit':
      return 'hiit'
    default:
      // Check sub_sport for additional context
      if (subSportLower === 'strength_training' || subSportLower === 'weight_training') {
        return 'strength'
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

// Add these helper functions for processing different file types
async function processFitFile(content: Buffer, fileName: string): Promise<any> {
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
      const transformedActivity = {
        id: id,
        name: generateActivityName({ total_distance: totalDistance / 1000, total_elapsed_time: totalElapsedTime, sport, sub_sport: subSport }, startTime, mappedType),
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

async function processGpxFile(content: Buffer, fileName: string): Promise<any> {
  try {
    console.log(`Processing GPX file: ${fileName}, size: ${content.length} bytes`);
    
    // Dynamically import gpxparser
    const { default: gpxParser } = await import('gpxparser');
    const parser = new gpxParser();
    parser.parse(content.toString('utf-8'));
    
    // Extract basic information from the GPX
    if (parser.tracks.length > 0) {
      const track = parser.tracks[0];
      
      // Calculate start time, end time, distance, and elevation
      let startTime = new Date();
      let endTime = new Date();
      let totalDistance = 0;
      let totalElevationGain = 0;
      let avgHeartRate: number | undefined = undefined;
      let maxHeartRate: number | undefined = undefined;
      let sport = 'other';
      
      if (track.points.length > 0) {
        startTime = new Date(track.points[0].time);
        endTime = new Date(track.points[track.points.length - 1].time);
        totalDistance = track.distance.total; // Meters
        totalElevationGain = track.elevation.pos; // Positive elevation gain in meters
        
        // Attempt to extract HR data from extensions (common Garmin format)
        const heartRates = track.points
            .map((p: any) => {
              const hrValue = p.extensions?.TrackPointExtension?.hr || p.extensions?.heart_rate || p.extensions?.['gpxtpx:hr'] || p.extensions?.hr;
              // Ensure it's a number before returning
              return typeof hrValue === 'string' ? parseInt(hrValue, 10) : hrValue;
            })
            .filter((hr: any): hr is number => hr !== undefined && hr !== null && !isNaN(hr));
            
        if (heartRates.length > 0) {
          avgHeartRate = heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length;
          maxHeartRate = Math.max(...heartRates);
        }
        
        // Try to determine sport type from filename
        if (fileName.toLowerCase().includes('run')) {
          sport = 'running';
        } else if (fileName.toLowerCase().includes('ride') || fileName.toLowerCase().includes('cycling')) {
          sport = 'cycling';
        } else if (fileName.toLowerCase().includes('walk')) {
          sport = 'walking';
        } else if (fileName.toLowerCase().includes('hike')) {
          sport = 'hiking';
        }
      }
      
      // Calculate duration in seconds
      const totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;
      
      // Calculate average speed in m/s
      const avgSpeed = totalElapsedTime > 0 ? (totalDistance / totalElapsedTime) : 0;
      
      // Extract ID from filename
      const idMatch = fileName.match(/\/(\d+)\.gpx$/);
      const id = idMatch ? idMatch[1] : `gpx_${Date.now()}`;
      
      // Extract detailed records
      const detailedRecords = track.points.map((p: any) => {
         const hrValue = p.extensions?.TrackPointExtension?.hr || p.extensions?.heart_rate || p.extensions?.['gpxtpx:hr'] || p.extensions?.hr;
         const lat = p.lat !== undefined ? Number(p.lat) : undefined;
         const lon = p.lon !== undefined ? Number(p.lon) : undefined;
         const ele = p.ele !== undefined ? Number(p.ele) : undefined;
         
         return {
           timestamp: new Date(p.time),
           heart_rate: typeof hrValue === 'string' ? parseInt(hrValue, 10) : (typeof hrValue === 'number' ? hrValue : undefined),
           latitude: lat,
           longitude: lon,
           altitude: ele,
           // GPX usually lacks these, set to undefined or null
           distance: undefined, // GPX distance is usually per-track, not per-point
           speed: undefined, 
           cadence: undefined,
           power: undefined 
         };
      }).filter((r: any) => r.timestamp); // Ensure valid timestamp
      
      // Convert GPX data to Strava-like format, including records
      const transformedActivity = {
        id: id,
        name: `${sport.charAt(0).toUpperCase() + sport.slice(1)} on ${startTime.toLocaleDateString()}`,
        type: sport,
        start_date: startTime.toISOString(),
        elapsed_time: totalElapsedTime, // seconds
        distance: totalDistance, // meters
        total_elevation_gain: totalElevationGain, // meters
        has_heartrate: !!avgHeartRate, // boolean
        average_heartrate: avgHeartRate, // bpm
        max_heartrate: maxHeartRate,     // bpm
        average_speed: avgSpeed,         // m/s
        records: detailedRecords,        // Add the detailed records here
        notes: generateActivityNotes({}, startTime, fileName) // Pass empty object for notes
      };
      
      // Clear GPX data to free memory
      parser.tracks = [];
      
      console.log(`Successfully processed GPX data from ${fileName}`);
      return transformedActivity;
    }
    
    return null;
  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    // Re-throw the error to be handled by the main POST handler's catch block
    throw error;
    // return null; // Removed: Don't suppress the error
  }
}

// Function to extract Strava ID from filename
function extractStravaIdFromFilename(filename: string): string | undefined {
  const pathMatch = filename.match(/activities\/(\d+)\.(?:fit\.gz|gpx|fit)/);
  if (pathMatch && pathMatch[1]) {
    return `https://www.strava.com/activities/${pathMatch[1]}`;
  }
  return undefined;
}

// Helper function to parse GPX files
async function parseGPX(gpxString: string): Promise<any> {
  // Dynamically import gpxparser only when needed
  const { default: gpxParser } = await import('gpxparser');
  const parser = new gpxParser();
  parser.parse(gpxString);
  return parser;
}