import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AccountModel from '@/lib/db/models/account';
import WorkoutModel from '@/lib/db/models/workout';
import dbConnect from '@/lib/db/mongodb';
import { WorkoutData } from '@/types/db'; // Keep only WorkoutData import
import { Types } from 'mongoose'; 
import { getValidAccessToken } from "@/lib/services/stravaService"; // Keep only this one from service
import { getRecentStravaActivities } from '@/lib/strava'; // Add correct import
import { createWorkout } from '@/lib/workout-actions'
import { revalidatePath } from 'next/cache'

// Define the type directly as workaround for import issue
type InternalWorkoutType = "strength" | "running" | "swimming" | "cycling" | "hiit" | "flexibility" | "walking" | "yoga" | "pilates" | "other";

// Helper function to map Strava activity types to our system's workout types
const mapActivityType = (stravaType: string): InternalWorkoutType => { // Use internal type
    const typeLower = stravaType.toLowerCase();
    // Add mappings based on Strava's activity types
    if (typeLower.includes('run')) return 'running';
    if (typeLower.includes('ride') || typeLower.includes('bike')) return 'cycling';
    if (typeLower.includes('swim')) return 'swimming';
    if (typeLower.includes('walk')) return 'walking';
    if (typeLower.includes('yoga')) return 'yoga';
    if (typeLower.includes('strength') || typeLower.includes('weight')) return 'strength';
    if (typeLower.includes('hiit')) return 'hiit';
    // ... add other mappings as needed
    return 'other'; // Default fallback
};

// Restore local helper function definition
function transformStravaActivity(activity: any, userId: string): Partial<WorkoutData> {
  // Log the entire activity object to see all fields
  console.log(`STRAVA RAW ACTIVITY DATA for ${activity.id}:`, JSON.stringify({
    id: activity.id,
    type: activity.type,
    name: activity.name,
    raw_distance: activity.distance,
    distance_type: typeof activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    start_date: activity.start_date,
    average_speed: activity.average_speed,
    max_speed: activity.max_speed,
    total_elevation_gain: activity.total_elevation_gain,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate
  }));
  
  // Store distance directly in meters (as provided by Strava)
  const distanceInMeters = typeof activity.distance === 'number' ? activity.distance : 0;
  if (typeof activity.distance !== 'number' || activity.distance < 0) {
     console.warn(`Invalid or missing distance for activity ${activity.id}. Setting distance to 0.`);
  }
  console.log(`FINAL DISTANCE for activity ${activity.id}: ${distanceInMeters}m (source: strava)`);
  
  let paceMinPerKm = undefined;
  // Calculate pace using distance in meters
  if (activity.average_speed && activity.average_speed > 0 && activity.average_speed < 100) {
    // Pace (min/km) = (Time in seconds / 60) / (Distance in meters / 1000)
    // This can also be calculated from average_speed (m/s) directly: (1000 / speed_mps) / 60
    paceMinPerKm = parseFloat(((1000 / activity.average_speed) / 60).toFixed(2));
    console.log(`Calculated pace: ${paceMinPerKm} min/km from speed ${activity.average_speed} m/s`);
  } else if (distanceInMeters > 0 && (activity.moving_time || activity.elapsed_time) > 0) {
    // Fallback pace calculation if speed is missing but distance/time exist
    const durationForPace = activity.moving_time || activity.elapsed_time;
    paceMinPerKm = parseFloat(((durationForPace / 60) / (distanceInMeters / 1000)).toFixed(2));
    console.log(`Calculated pace: ${paceMinPerKm} min/km from distance ${distanceInMeters}m and time ${durationForPace}s`);
  }

  const workoutType: InternalWorkoutType = mapActivityType(activity.type);
  
  const durationSeconds = activity.moving_time || activity.elapsed_time || 0;
  console.log(`Duration from Strava: ${durationSeconds} seconds`);

  // Prepare the cardio details object separately
  const cardioDetailsObject: Partial<WorkoutData['cardioDetails']> = {
      distance: distanceInMeters, // Store distance in METERS
      duration: durationSeconds, 
      pace: paceMinPerKm, // Pace in min/km
      speed: activity.average_speed ? parseFloat((activity.average_speed * 3.6).toFixed(2)) : undefined, // Store speed in km/h
      maxSpeed: activity.max_speed ? parseFloat((activity.max_speed * 3.6).toFixed(2)) : undefined, // Store maxSpeed in km/h
      elevationGain: activity.total_elevation_gain,
      heartRate: activity.average_heartrate ? {
        average: activity.average_heartrate,
        max: activity.max_heartrate || activity.average_heartrate,
      } : undefined,
  };

  // Remove heartRate object if empty
  if (cardioDetailsObject.heartRate && 
      cardioDetailsObject.heartRate.average === undefined && 
      cardioDetailsObject.heartRate.max === undefined) {
    cardioDetailsObject.heartRate = undefined;
  }

  const transformedData: Partial<WorkoutData> = {
    userId: userId,
    name: activity.name || `${activity.type} Activity`,
    type: workoutType || 'other',
    date: new Date(activity.start_date),
    duration: durationSeconds, 
    distance: distanceInMeters, // Store distance in METERS
    intensity: activity.average_heartrate ? 'Medium' : 'Low', // Keep simple intensity logic for now
    // cardioDetails is added conditionally below
    stravaLink: `https://www.strava.com/activities/${activity.id}`,
    source: 'strava',
    sourceId: activity.id.toString(),
    importedFrom: 'strava-sync',
  };

  // Conditionally add cardioDetails if it contains meaningful data
  if (cardioDetailsObject.distance && cardioDetailsObject.distance > 0 || 
      cardioDetailsObject.duration && cardioDetailsObject.duration > 0) {
    transformedData.cardioDetails = cardioDetailsObject as WorkoutData['cardioDetails']; // Assert type here
  } else {
      console.log(`Skipping empty cardioDetails for activity ${activity.id}`);
  }
  
  console.log('Transformed workout data:', {
    id: transformedData.sourceId,
    name: transformedData.name,
    type: transformedData.type,
    distance: transformedData.distance,
    duration: transformedData.duration,
    pace: transformedData.cardioDetails?.pace
  });
  
  return transformedData;
}

export async function POST(request: Request) {
  try {
    await dbConnect(); // Ensure DB connection
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error("POST /api/strava/sync-recent: Not authenticated");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`POST /api/strava/sync-recent: User ${userId} initiated sync.`);

    // 2. Get a valid access token (refresh if necessary) - REPLACE this section
    let accessToken;
    try {
        console.log(`POST /api/strava/sync-recent: Getting valid access token for user ${userId}`);
        accessToken = await getValidAccessToken(userId);
        if (!accessToken) {
          throw new Error("Failed to obtain valid Strava access token.");
        }
        console.log(`POST /api/strava/sync-recent: Obtained valid access token for user ${userId}`);
    } catch (error) {
        console.error(`POST /api/strava/sync-recent: Error getting valid token for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Failed to validate Strava connection";
        return NextResponse.json({ error: errorMessage }, { status: 401 }); // Use 401 for auth issues
    }

    // 3. Fetch recent activities from Strava using the valid token
    console.log(`POST /api/strava/sync-recent: Fetching recent activities for user ${userId}`);
    const recentActivities = await getRecentStravaActivities(accessToken); // Use imported function
    console.log(`POST /api/strava/sync-recent: Found ${recentActivities.length} recent activities for user ${userId}`);

    let newActivitiesCount = 0;
    
    // 4. Process activities
    for (const activity of recentActivities) {
      try {
         // Check if workout already exists
        const existingWorkout = await WorkoutModel.findOne({
           userId: userId,
           source: 'strava',
           sourceId: activity.id.toString()
         }).exec();

         if (!existingWorkout) {
           // ---> ADD DETAILED LOGGING HERE <---
           console.log(`[SYNC PROCESSING] Raw Activity ${activity.id} Received from Strava API:`, JSON.stringify({
             id: activity.id,
             name: activity.name,
             type: activity.type,
             sport_type: activity.sport_type, // Include sport_type
             start_date: activity.start_date,
             distance: activity.distance, // <<< THE KEY VALUE
             distance_type: typeof activity.distance,
             moving_time: activity.moving_time,
             elapsed_time: activity.elapsed_time,
             average_speed: activity.average_speed,
             max_speed: activity.max_speed,
             total_elevation_gain: activity.total_elevation_gain,
             average_heartrate: activity.average_heartrate,
             max_heartrate: activity.max_heartrate,
             // Add any other potentially relevant fields if needed
           }));
           // ---> END LOGGING <---
           
           // Transform and create new workout
           const workoutData = transformStravaActivity(activity, userId);
           await WorkoutModel.create(workoutData);
           newActivitiesCount++;
           console.log(`POST /api/strava/sync-recent: Imported Strava activity ${activity.id} for user ${userId}`);
        } else {
           // console.log(`POST /api/strava/sync-recent: Skipping existing Strava activity ${activity.id} for user ${userId}`);
        }
       } catch (activityError) {
         console.error(`POST /api/strava/sync-recent: Error processing activity ${activity.id} for user ${userId}:`, activityError);
         // Decide if you want to stop the whole sync or just skip this activity
      }
    }
    
    console.log(`POST /api/strava/sync-recent: Sync completed for user ${userId}. Imported ${newActivitiesCount} new activities.`);
    return NextResponse.json({ success: true, count: newActivitiesCount });
  } catch (error: any) {
    console.error("POST /api/strava/sync-recent Error:", error);
    const errorMessage = error.message || 'Failed to sync Strava activities';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Optional OPTIONS handler...
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', // Adjust as needed for security
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 