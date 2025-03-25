import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createWorkout } from "@/lib/workout-actions"
import { revalidatePath } from "next/cache"
import JSZip from "jszip"
import { FitParser, FitData, FitSession } from 'fit-file-parser'
import { gunzip } from 'zlib'
import { promisify } from 'util'

const gunzipAsync = promisify(gunzip)

// New App Router configuration
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error('Strava import: No authenticated session')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Store user ID for later use
    const userId = session.user.id

    // Get the form data using the ReadableStream API
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      console.error('Strava import: No file provided in form data')
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log('Strava import: Processing file:', file.name, 'size:', file.size)

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

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
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'km',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'cascade',
    })

    for (const file of activityFiles) {
      try {
        console.log('Processing activity:', file.name)
        
        // Get the compressed data
        const compressedData = await file.async('nodebuffer')
        
        // Decompress the .gz file
        const fitData = await gunzipAsync(compressedData)
        
        // Parse the FIT file
        const activity = await new Promise<FitData>((resolve, reject) => {
          fitParser.parse(fitData, (error: Error | null, data: FitData) => {
            if (error) {
              reject(error)
            } else {
              resolve(data)
            }
          })
        })

        if (!activity?.sessions?.[0]) {
          console.log('Skipping activity - no session data:', file.name)
          continue
        }

        const session = activity.sessions[0]
        const startTime = new Date(session.start_time)
        const sport = session.sport || 'other'

        // Convert the activity data to our workout format
        const workout = {
          name: `${sport} Activity`,
          date: startTime,
          type: mapStravaType(sport),
          duration: Math.round(session.total_elapsed_time / 60), // Convert seconds to minutes
          intensity: calculateIntensityFromSession(session),
          distance: session.total_distance, // Already in kilometers
          calories: session.total_calories,
          notes: `Imported from Strava Archive\nActivity from ${startTime.toLocaleDateString()}`,
          cardioDetails: {
            distance: session.total_distance,
            duration: session.total_elapsed_time / 60,
            pace: session.enhanced_avg_speed || session.avg_speed,
            elevationGain: session.total_ascent,
            heartRate: session.avg_heart_rate ? {
              average: session.avg_heart_rate,
              max: session.max_heart_rate
            } : undefined,
            power: session.avg_power ? {
              average: session.avg_power,
              max: session.max_power
            } : undefined
          },
          importedFrom: 'strava',
          importId: file.name, // Use filename as unique identifier
          userId: userId // Use the authenticated user's ID
        }

        await createWorkout(workout)
        importedCount++
        console.log('Successfully imported activity:', file.name)
      } catch (error) {
        console.error('Error processing activity:', file.name, error)
        // Continue with next activity even if one fails
      }
    }

    // Revalidate relevant paths
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")

    console.log('Successfully imported', importedCount, 'activities')
    return NextResponse.json({ success: true, count: importedCount })

  } catch (error) {
    console.error('Strava import: Fatal error:', error)
    return NextResponse.json(
      { error: "Failed to process Strava archive" },
      { status: 500 }
    )
  }
}

function calculateIntensityFromSession(session: FitSession): "Low" | "Medium" | "High" {
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

function mapStravaType(stravaType: string): string {
  const typeMap: { [key: string]: string } = {
    'Run': 'running',
    'Ride': 'cycling',
    'Swim': 'swimming',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'Yoga': 'flexibility',
    'Walk': 'other',
    'Hike': 'other',
    'RockClimbing': 'strength',
    'CrossFit': 'hiit',
    'HIIT': 'hiit',
    'CircuitTraining': 'hiit',
    'VirtualRide': 'cycling',
    'VirtualRun': 'running',
    'EBikeRide': 'cycling',
    'MountainBikeRide': 'cycling',
    'TrailRun': 'running',
    'Snowboard': 'other',
    'Ski': 'other',
    'Skateboard': 'other',
    'RollerSki': 'other',
    'NordicSki': 'other',
    'BackcountrySki': 'other',
    'AlpineSki': 'other',
    'Surfing': 'other',
    'Kitesurf': 'other',
    'Windsurf': 'other',
    'Rowing': 'other',
    'Canoe': 'other',
    'Kayaking': 'other',
    'StandUpPaddling': 'other',
    'Sailing': 'other',
    'Wheelchair': 'other',
    'Handcycle': 'other',
    'InlineSkate': 'other',
    'IceSkate': 'other',
    'Golf': 'other',
    'Tennis': 'other',
    'TableTennis': 'other',
    'Badminton': 'other',
    'Soccer': 'other',
    'Rugby': 'other',
    'Cricket': 'other',
    'Baseball': 'other',
    'Softball': 'other',
    'Volleyball': 'other',
    'Basketball': 'other',
    'Football': 'other',
    'Lacrosse': 'other',
    'Hockey': 'other',
    'FieldHockey': 'other',
    'IceHockey': 'other',
    'Boxing': 'other',
    'MartialArts': 'other',
    'Dance': 'other',
    'Pilates': 'flexibility',
    'Stretching': 'flexibility',
    'Meditation': 'other',
    'Other': 'other'
  }
  return typeMap[stravaType] || 'other'
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