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
import { getCollection } from "@/lib/db/mongodb"
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
                    total_ascent: session.total_ascent
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
                    total_ascent: data.activity.total_ascent
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
        const collection = await getCollection("aivery", "workouts")
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

        const startTime = new Date(activityData.timestamp)
        const sport = activityData.sport || 'other'
        const mappedType = mapStravaType(sport, activityData.sub_sport)

        // Calculate average pace in min/km if we have distance and time
        let avgPace = undefined
        if (activityData.total_distance && activityData.total_elapsed_time) {
          // Convert speed from km/h to min/km
          const speedKmH = (activityData.total_distance / (activityData.total_elapsed_time / 3600))
          avgPace = speedKmH > 0 ? (60 / speedKmH) : undefined
        }

        // Convert the activity data to our workout format
        const workout = {
          name: `${mappedType} Activity`,
          date: startTime,
          type: mappedType,
          duration: Math.round(activityData.total_elapsed_time / 60),
          intensity: calculateIntensityFromSession(activityData),
          distance: typeof activityData.total_distance === 'number' ? activityData.total_distance : undefined,
          calories: activityData.total_calories ?? 0,
          notes: `Imported from Strava Archive\nActivity from ${startTime.toLocaleDateString()}`,
          exercises: [], // Required field, but empty for cardio activities
          cardioDetails: (typeof activityData.total_distance === 'number' || typeof activityData.avg_speed === 'number') ? {
            distance: activityData.total_distance ?? 0,
            duration: activityData.total_elapsed_time / 60,
            pace: avgPace ?? 0,
            speed: activityData.enhanced_avg_speed ?? activityData.avg_speed ?? 0,
            maxSpeed: activityData.enhanced_max_speed ?? 0,
            elevationGain: activityData.total_ascent ?? 0,
            heartRate: activityData.avg_heart_rate ? {
              average: Math.round(activityData.avg_heart_rate),
              max: Math.round(activityData.max_heart_rate || activityData.avg_heart_rate),
              zones: calculateHeartRateZones(activityData.avg_heart_rate, activityData.max_heart_rate)
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
          source: 'strava' as const
        }

        // Helper function to calculate heart rate zones
        function calculateHeartRateZones(avgHr?: number, maxHr?: number) {
          if (!avgHr || !maxHr) return undefined;
          
          return {
            easy: Math.round(maxHr * 0.6),    // 60% of max HR
            moderate: Math.round(maxHr * 0.7), // 70% of max HR
            hard: Math.round(maxHr * 0.8),     // 80% of max HR
            peak: Math.round(maxHr * 0.9)      // 90% of max HR
          };
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

    console.log('Import complete. Successfully imported:', importedCount, 'Failed:', failedCount)
    return NextResponse.json({ 
      success: true, 
      count: importedCount,
      failed: failedCount,
      message: `Successfully imported ${importedCount} activities, ${failedCount} failed`
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
    total_ascent: totalAscent
  }
} 