import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  createCardioWorkout,
} from "@/lib/workout-actions"
import { revalidatePath } from "next/cache"
import JSZip from "jszip"
import { gunzip } from 'zlib'
import { promisify } from 'util'
import dbConnect from "@/lib/db/mongoose"
import { getCollection } from "@/lib/db/mongoose"
import { ObjectId } from "mongodb"
import { transformStravaActivity } from "@/lib/services/stravaService"
import AdmZip from "adm-zip"
import { Readable } from "stream"

const gunzipAsync = promisify(gunzip)

// Use Node.js runtime instead of Edge
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout
export const preferredRegion = 'auto'

// Configure the route to handle large files
export const fetchCache = 'force-no-store'

// Import the FitParser class
const { default: FitParser } = require('fit-file-parser')

interface FitActivity {
  timestamp: string | number;
  total_elapsed_time: number;
  total_distance: number;
  total_calories: number;
  sport: string;
  sub_sport?: string;  // Make sub_sport optional
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_power?: number;
  max_power?: number;
  enhanced_avg_speed?: number;
  enhanced_max_speed?: number;
  avg_speed?: number;
  total_ascent?: number;
  description?: string; // Description or notes from Strava
}

interface FitData {
  protocolVersion: number;
  profileVersion: number;
  activity: FitActivity;
}

interface ParsedActivity {
  activities: FitActivity[];
}

// Helper function to parse JSON files from the zip
async function parseJsonFromBuffer(buffer: Buffer): Promise<any> {
  try {
    const content = buffer.toString('utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    throw new Error("Invalid JSON file");
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check content length to ensure it's not too large (100MB limit)
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large, maximum size is 100MB" }, { status: 413 })
    }
    
    // Initialize database connection
    await dbConnect()
    console.log('Database connected successfully')

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error('Strava import: No authenticated session')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Store user ID for later use
    const userId = session.user.id
    console.log('Processing import for user:', userId)

    // Get the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.error('Strava import: No file provided in form data')
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file type
    if (!file.name.endsWith('.zip')) {
      console.error('Strava import: Please upload a zip file')
      return NextResponse.json({ error: "Please upload a zip file" }, { status: 400 })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Create zip instance
    const zip = new AdmZip(buffer)
    const zipEntries = zip.getEntries()

    // Get collections
    const workoutsCollection = await getCollection("workouts")
    
    const results = {
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Process each file in the zip
    for (const entry of zipEntries) {
      try {
        results.processed++

        // Skip non-JSON files and directories
        if (entry.isDirectory || !entry.entryName.endsWith('.json')) {
          results.skipped++
          continue
        }

        // Parse the JSON content
        const activityData = await parseJsonFromBuffer(entry.getData())
        
        // Transform to our workout format
        const workout = transformStravaActivity(activityData)
        
        // Check if workout already exists
        const existingWorkout = await workoutsCollection.findOne({
          userId: new ObjectId(userId),
          sourceId: workout.sourceId,
          source: "strava"
        })

        if (existingWorkout) {
          // Update existing workout
          await workoutsCollection.updateOne(
            { _id: existingWorkout._id },
            { 
              $set: {
                ...workout,
                updatedAt: new Date()
              }
            }
          )
          results.updated++
        } else {
          // Insert new workout
          await workoutsCollection.insertOne({
            ...workout,
            userId: new ObjectId(userId),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          results.imported++
        }
      } catch (error) {
        console.error(`Error processing file ${entry.entryName}:`, error)
        results.errors.push(`${entry.entryName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Revalidate relevant paths
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")

    // Return results
    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} files: ${results.imported} imported, ${results.updated} updated, ${results.skipped} skipped`,
      results
    })

  } catch (error) {
    console.error("Error processing zip file:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error processing zip file" 
    }, { status: 500 })
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

// Function to extract Strava ID from filename
function extractStravaIdFromFilename(filename: string): string | undefined {
  // Strava filenames follow the pattern: "activities/123456789.fit.gz"
  // Extract the numeric ID
  let activityId: string | undefined;
  
  // Match the standard pattern in filenames
  const match = filename.match(/activities\/(\d+)\.fit\.gz/);
  if (match && match[1]) {
    activityId = match[1];
  }
  
  // If no match in filename, try to look for a number that might be an activity ID
  if (!activityId) {
    const numericMatch = filename.match(/(\d{8,})/); // Find numbers that are 8+ digits (typical for Strava IDs)
    if (numericMatch && numericMatch[1]) {
      activityId = numericMatch[1];
    }
  }
  
  if (activityId) {
    // Verify that the ID is a reasonable length for a Strava ID (typically 9-10 digits)
    // Modern Strava IDs are around 9+ digits
    if (activityId.length >= 8) {
      return `https://www.strava.com/activities/${activityId}`;
    }
  }
  
  return undefined;
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

function calculateIntensity(activity: any): "Low" | "Medium" | "High" {
  // Calculate intensity based on heartrate zones if available
  if (activity.has_heartrate) {
    const maxHr = activity.max_heartrate
    const avgHr = activity.average_heartrate
    
    if (avgHr > maxHr * 0.85) return "High"
    if (avgHr > maxHr * 0.7) return "Medium"
    return "Low"
  }
  
  // Fallback to perceived exertion based on relative speed
  if (activity.average_speed && activity.max_speed) {
    const relativeEffort = activity.average_speed / activity.max_speed
    
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