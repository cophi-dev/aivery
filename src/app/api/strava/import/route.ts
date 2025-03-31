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

const gunzipAsync = promisify(gunzip)

// Use Node.js runtime instead of Edge
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
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

export async function POST(request: NextRequest) {
  try {
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

    // Get selected workout types from form data
    const selectedWorkoutTypes = formData.getAll('workoutTypes').map(type => type.toString())
    console.log('Strava import: Selected workout types:', selectedWorkoutTypes)
    
    // If no workout types are selected, use all types
    if (selectedWorkoutTypes.length === 0) {
      console.log('Strava import: No workout types selected, using all types')
    }

    console.log('Strava import: Processing file:', file.name, 'size:', file.size)

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    console.log('Strava import: File converted to ArrayBuffer, size:', arrayBuffer.byteLength)

    // Load the ZIP file
    const zip = new JSZip()
    const zipContent = await zip.loadAsync(arrayBuffer)
    console.log('Strava import: ZIP entries found:', Object.keys(zipContent.files).length)

    // Find all .fit.gz files in the activities folder
    const activityFiles = Object.values(zipContent.files).filter(file => 
      file.name.startsWith('activities/') && 
      file.name.endsWith('.fit.gz')
    )

    console.log('Strava import: Found activity files:', activityFiles.map(f => f.name))

    if (activityFiles.length === 0) {
      console.error('Strava import: No .fit.gz files found in activities folder')
      return NextResponse.json({ 
        error: "No activity files found. Make sure your Strava archive contains .fit.gz files in the activities folder." 
      }, { status: 400 })
    }

    // Process each activity file
    let importedCount = 0
    let failedCount = 0
    let countedWorkoutTypes: Record<string, number> = {}
    let workouts: any[] = []

    for (const file of activityFiles) {
      try {
        console.log('Processing activity:', file.name)
        
        // Get the compressed data
        const compressedData = await file.async('nodebuffer')
        console.log('Got compressed data, size:', compressedData.length)
        
        // Decompress the .gz file
        const fitData = await gunzipAsync(compressedData)
        console.log('Decompressed data, size:', fitData.length)
        
        // Parse the FIT file
        const fitParser = new FitParser({
          force: true,
          speedUnit: 'km/h',
          lengthUnit: 'km',
          temperatureUnit: 'celsius',
          elapsedRecordField: true,
          mode: 'cascade',
          includeAllData: true,
          checkIntegrity: false,
        })

        console.log('Created FitParser instance, attempting to parse...')
        const activity = await new Promise<ParsedActivity>((resolve, reject) => {
          try {
            fitParser.parse(fitData, (error: Error | null, data: any) => {
              if (error) {
                console.error('Error parsing FIT file:', {
                  file: file.name,
                  error: error.message,
                  stack: error.stack
                })
                reject(error)
              } else {
                // Log the complete raw data structure
                console.log('Complete FIT data structure:', {
                  file: file.name,
                  keys: Object.keys(data),
                  hasActivity: !!data.activity,
                  hasSessions: !!data.activity?.sessions,
                  activity: data.activity ? {
                    timestamp: data.activity.timestamp,
                    total_timer_time: data.activity.total_timer_time,
                    type: data.activity.type,
                    sport: data.activity.sport,
                    sub_sport: data.activity.sub_sport,
                    sessions: data.activity.sessions?.map((s: any) => ({
                      sport: s.sport,
                      sub_sport: s.sub_sport,
                      total_elapsed_time: s.total_elapsed_time,
                      total_timer_time: s.total_timer_time,
                      total_distance: s.total_distance,
                      total_calories: s.total_calories,
                      avg_speed: s.avg_speed,
                      max_speed: s.max_speed,
                      avg_heart_rate: s.avg_heart_rate,
                      max_heart_rate: s.max_heart_rate
                    }))
                  } : null
                })

                // Try to get activity data from different sources
                let activityData = null

                // First try to get data from the first session
                if (data.activity?.sessions?.[0]) {
                  const session = data.activity.sessions[0]
                  activityData = {
                    timestamp: data.activity.timestamp,
                    total_elapsed_time: data.activity.total_timer_time || session.total_timer_time || 0,
                    total_distance: session.total_distance || 0,
                    total_calories: session.total_calories || 0,
                    sport: session.sport || data.activity.sport || 'other',
                    sub_sport: session.sub_sport || data.activity.sub_sport,
                    avg_heart_rate: session.avg_heart_rate,
                    max_heart_rate: session.max_heart_rate,
                    avg_power: session.avg_power,
                    max_power: session.max_power,
                    enhanced_avg_speed: session.enhanced_avg_speed || session.avg_speed,
                    enhanced_max_speed: session.enhanced_max_speed || session.max_speed,
                    avg_speed: session.avg_speed,
                    total_ascent: session.total_ascent,
                    description: data.activity.description || session.description || data.activity.notes || session.notes
                  }
                }
                // Then try the activity field
                else if (data.activity) {
                  activityData = {
                    timestamp: data.activity.timestamp,
                    total_elapsed_time: data.activity.total_timer_time || 0,
                    total_distance: data.activity.total_distance || 0,
                    total_calories: data.activity.total_calories || 0,
                    sport: data.activity.sport || 'other',
                    sub_sport: data.activity.sub_sport,
                    avg_heart_rate: data.activity.avg_heart_rate,
                    max_heart_rate: data.activity.max_heart_rate,
                    avg_power: data.activity.avg_power,
                    max_power: data.activity.max_power,
                    enhanced_avg_speed: data.activity.enhanced_avg_speed || data.activity.avg_speed,
                    enhanced_max_speed: data.activity.enhanced_max_speed || data.activity.max_speed,
                    avg_speed: data.activity.avg_speed,
                    total_ascent: data.activity.total_ascent,
                    description: data.activity.description || data.activity.notes
                  }
                }

                if (activityData) {
                  console.log('Found activity data:', activityData)
                  resolve({ activities: [activityData] } as ParsedActivity)
                } else {
                  console.log('No activity data found in any source')
                  resolve({ activities: [] } as ParsedActivity)
                }
              }
            })
          } catch (error) {
            console.error('Error in FIT parser callback:', {
              file: file.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            })
            reject(error)
          }
        })

        // Get the activity data
        const activityData = activity?.activities?.[0]
        if (!activityData) {
          console.log('Skipping activity - no activity data:', {
            file: file.name,
            hasActivity: !!activity?.activities?.[0],
            activityData: activity?.activities?.[0]
          })
          failedCount++
          continue
        }

        // Create a unique identifier based on timestamp and activity type
        const uniqueId = `${activityData.timestamp}_${activityData.sport}_${activityData.total_elapsed_time}`

        // Check if this workout has already been imported
        const collection = await getCollection("workouts")
        const existingWorkout = await collection.findOne({ 
          userId: new ObjectId(userId),
          importId: uniqueId,
          importedFrom: 'strava'
        })

        if (existingWorkout) {
          console.log('Skipping duplicate workout:', {
            file: file.name,
            uniqueId,
            existingWorkoutId: existingWorkout._id
          })
          continue
        }

        console.log('Processing activity:', {
          file: file.name,
          uniqueId,
          timestamp: activityData.timestamp,
          sport: activityData.sport,
          duration: activityData.total_elapsed_time,
          distance: {
            raw: activityData.total_distance,
            isNumber: typeof activityData.total_distance === 'number',
            isZero: activityData.total_distance === 0,
            isUndefined: activityData.total_distance === undefined,
            isNull: activityData.total_distance === null
          },
          calories: activityData.total_calories,
          raw_data: {
            total_distance: activityData.total_distance,
            enhanced_avg_speed: activityData.enhanced_avg_speed,
            avg_speed: activityData.avg_speed,
            total_elapsed_time: activityData.total_elapsed_time
          }
        })

        // Map Strava sport types to our workout types
        const mappedType = mapStravaType(activityData.sport, activityData.sub_sport)
        
        // Skip if not in selected workout types (if any are selected)
        if (selectedWorkoutTypes.length > 0 && !selectedWorkoutTypes.includes(mappedType)) {
          console.log('Skipping activity - type not selected:', {
            file: file.name,
            mappedType,
            selectedTypes: selectedWorkoutTypes
          })
          continue
        }

        // Calculate average pace in min/km if we have distance and time
        let avgPace = undefined
        if (activityData.total_distance && activityData.total_elapsed_time) {
          // Convert speed from km/h to min/km
          const speedKmH = (activityData.total_distance / (activityData.total_elapsed_time / 3600))
          avgPace = speedKmH > 0 ? (60 / speedKmH) : undefined
        }

        // Convert the activity data to our workout format
        const stravaLink = extractStravaIdFromFilename(file.name);
        const workout = {
          name: generateActivityName(activityData, new Date(activityData.timestamp), mappedType),
          date: new Date(activityData.timestamp),
          type: mappedType,
          duration: Math.round(activityData.total_elapsed_time / 60),
          intensity: calculateIntensityFromSession(activityData),
          distance: typeof activityData.total_distance === 'number' ? activityData.total_distance : undefined,
          calories: activityData.total_calories ?? 0,
          notes: generateActivityNotes(activityData, new Date(activityData.timestamp), file.name),
          exercises: [],
          cardioDetails: (typeof activityData.total_distance === 'number' || typeof activityData.avg_speed === 'number') ? {
            distance: activityData.total_distance ?? undefined,
            duration: activityData.total_elapsed_time / 60,
            pace: avgPace ?? undefined,
            speed: activityData.enhanced_avg_speed ?? activityData.avg_speed ?? undefined,
            maxSpeed: activityData.enhanced_max_speed ?? undefined,
            elevationGain: activityData.total_ascent ?? undefined,
            heartRate: activityData.avg_heart_rate ? {
              average: Math.round(activityData.avg_heart_rate),
              max: Math.round(activityData.max_heart_rate || activityData.avg_heart_rate),
              zones: activityData.avg_heart_rate && activityData.max_heart_rate ? 
                calculateHeartRateZones(
                  activityData.avg_heart_rate, 
                  activityData.max_heart_rate || Math.max(activityData.avg_heart_rate * 1.15, 185)
                ) : undefined
            } : undefined,
            power: activityData.avg_power ? {
              average: Math.round(activityData.avg_power),
              max: Math.round(activityData.max_power || activityData.avg_power)
            } : undefined,
            sportDetails: {
              sport: activityData.sport,
              subSport: activityData.sub_sport
            }
          } : undefined,
          importedFrom: 'strava',
          importId: uniqueId,
          userId: userId,
          source: 'strava' as const,
          stravaLink: stravaLink
        }

        try {
          console.log('Attempting to create workout:', {
            file: file.name,
            name: workout.name,
            date: workout.date,
            type: workout.type,
            duration: workout.duration,
            distance: {
              topLevel: workout.distance,
              cardioDetails: workout.cardioDetails?.distance,
              isNumber: typeof workout.distance === 'number',
              isZero: workout.distance === 0,
              isUndefined: workout.distance === undefined,
              isNull: workout.distance === null
            },
            cardioDetails: {
              distance: workout.cardioDetails?.distance,
              duration: workout.cardioDetails?.duration,
              pace: workout.cardioDetails?.pace,
              speed: workout.cardioDetails?.speed
            },
            exercises: workout.exercises.length
          })

          console.log('Full workout object:', JSON.stringify(workout, null, 2))
          
          await createCardioWorkout(workout)
          importedCount++
          workouts.push(workout)
          
          // Count workout types
          const type = workout.type || 'other'
          countedWorkoutTypes[type] = (countedWorkoutTypes[type] || 0) + 1
          
          console.log('Successfully imported activity:', file.name)
        } catch (error) {
          console.error('Error creating workout:', {
            file: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            workout: {
              name: workout.name,
              date: workout.date,
              type: workout.type,
              duration: workout.duration
            }
          })
          failedCount++
          continue
        }
      } catch (error) {
        console.error('Error processing activity:', {
          file: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        failedCount++
        continue
      }
    }

    // Revalidate relevant paths
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")

    // Import complete, return response with stats
    console.log(`Import complete. Successfully imported: ${importedCount} Failed: ${failedCount}`)
    
    // Calculate statistics about imported workouts
    const stats = {
      count: importedCount,
      types: countedWorkoutTypes,
      earliestDate: workouts.length > 0 ? workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date : null,
      latestDate: workouts.length > 0 ? workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : null,
      totalDistance: workouts.reduce((sum, workout) => sum + (workout.distance || 0), 0),
      totalDuration: workouts.reduce((sum, workout) => sum + (workout.duration || 0), 0)
    }
    
    return NextResponse.json({
      success: true,
      count: importedCount,
      failed: failedCount,
      message: `Successfully imported ${importedCount} activities${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      stats
    })

  } catch (error) {
    console.error('Strava import: Fatal error:', error)
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    return NextResponse.json(
      { 
        error: "Failed to process Strava archive", 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
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