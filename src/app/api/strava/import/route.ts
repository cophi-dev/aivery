import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createWorkout } from "@/lib/workout-actions"
import { revalidatePath } from "next/cache"
import AdmZip from "adm-zip"

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract the ZIP file
    const zip = new AdmZip(buffer)
    const zipEntries = zip.getEntries()

    // Find the activities.json file
    const activitiesEntry = zipEntries.find(entry => entry.entryName.includes('activities.json'))
    if (!activitiesEntry) {
      return NextResponse.json({ error: "No activities.json found in archive" }, { status: 400 })
    }

    // Parse the activities JSON
    const activitiesJson = JSON.parse(activitiesEntry.getData().toString('utf8'))
    
    // Process each activity
    let importedCount = 0
    for (const activity of activitiesJson) {
      try {
        // Convert Strava activity to our workout format
        const workout = {
          name: activity.name,
          date: new Date(activity.start_date),
          type: mapStravaType(activity.type),
          duration: Math.round(activity.elapsed_time / 60), // Convert seconds to minutes
          intensity: calculateIntensity(activity),
          distance: activity.distance / 1000, // Convert meters to kilometers
          notes: `Imported from Strava Archive\nOriginal activity: ${activity.name}\nDistance: ${(activity.distance / 1000).toFixed(2)}km`,
          cardioDetails: {
            distance: activity.distance / 1000,
            duration: activity.elapsed_time / 60,
            pace: activity.average_speed,
            elevationGain: activity.total_elevation_gain,
            heartRate: activity.has_heartrate ? {
              average: activity.average_heartrate,
              max: activity.max_heartrate
            } : undefined
          },
          importedFrom: 'strava',
          importId: activity.id.toString()
        }

        await createWorkout(workout)
        importedCount++
      } catch (error) {
        console.error('Error importing activity:', error)
        // Continue with next activity even if one fails
      }
    }

    // Revalidate relevant paths
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")

    return NextResponse.json({ success: true, count: importedCount })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: "Failed to process Strava archive" },
      { status: 500 }
    )
  }
}

function mapStravaType(stravaType: string): string {
  const typeMap: { [key: string]: string } = {
    'Run': 'running',
    'Ride': 'cycling',
    'Swim': 'swimming',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'Yoga': 'flexibility',
    'Walk': 'other'
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