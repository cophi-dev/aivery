import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { refreshStravaToken, getRecentStravaActivities } from '@/lib/strava'; 
import AccountModel, { IAccount } from '@/lib/db/models/account';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import dbConnect from '@/lib/db/mongodb';
import { WorkoutData } from '@/types/db'; // Assuming this type exists for workout structure

// Helper function to transform Strava activity to WorkoutData format
function transformStravaActivity(activity: any, userId: string): Partial<WorkoutData> {
  console.log('Transforming Strava activity:', {
    id: activity.id,
    type: activity.type,
    name: activity.name,
    raw_distance: activity.distance, // Log raw distance
    distance_type: typeof activity.distance // Check the data type
  });
  
  // Add validation for distance data
  let distanceInKm = 0;
  try {
    if (typeof activity.distance === 'number') {
      // If the activity.distance is already in kilometers (some activities might be)
      if (activity.distance < 1000 && activity.distance > 0) {
        distanceInKm = parseFloat(activity.distance.toFixed(2));
        console.log(`Distance appears to already be in km: ${activity.distance}km`);
      } else {
        // Convert distance from meters to kilometers (Strava provides distance in meters)
        distanceInKm = parseFloat((activity.distance / 1000).toFixed(2));
        console.log(`Converted distance: ${activity.distance}m → ${distanceInKm}km`);
      }
      
      // Additional sanity check - if distance is unreasonably large (>1000km)
      // and the original value is <1000, it might already be in km
      if (distanceInKm > 1000 && activity.distance < 1000) {
        console.log(`Distance conversion issue detected. Original: ${activity.distance}, Converted: ${distanceInKm}km`);
        // Use original value as it's likely already in km
        distanceInKm = parseFloat(activity.distance.toFixed(2));
        console.log(`Corrected to assume original value was already in km: ${distanceInKm}km`);
      }
    } else if (typeof activity.distance === 'string') {
      // Handle case where the distance might be a string
      const parsedDistance = parseFloat(activity.distance);
      if (!isNaN(parsedDistance)) {
        // Check if it's likely meters (large number) or already km (small number)
        if (parsedDistance > 1000) {
          distanceInKm = parseFloat((parsedDistance / 1000).toFixed(2));
          console.log(`Parsed string distance as meters: ${activity.distance}m → ${distanceInKm}km`);
        } else {
          distanceInKm = parseFloat(parsedDistance.toFixed(2));
          console.log(`Parsed string distance assumed already in km: ${distanceInKm}km`);
        }
      } else {
        console.error(`Invalid distance format: ${activity.distance}`);
      }
    } else {
      console.error(`Missing or invalid distance for activity ${activity.id}`);
    }
  } catch (error) {
    console.error(`Error processing distance for activity ${activity.id}:`, error);
  }
  
  // Final sanity check for unreasonable values
  if (distanceInKm > 1000) {
    console.error(`Unusually large distance detected: ${distanceInKm}km. Setting to reasonable value.`);
    // Instead of setting to 0, set to original value divided by 1000 as it might be in meters
    if (typeof activity.distance === 'number' && activity.distance > 0) {
      distanceInKm = parseFloat((activity.distance / 1000).toFixed(2));
      console.log(`Adjusted distance to: ${distanceInKm}km`);
    } else {
      distanceInKm = 0;
    }
  }
  
  // Calculate pace in minutes per kilometer (if speed is available and valid)
  let paceMinPerKm = undefined;
  if (activity.average_speed && activity.average_speed > 0 && activity.average_speed < 100) {
    // Convert m/s to min/km: 1000/(m/s) = seconds per km, then /60 for minutes per km
    paceMinPerKm = parseFloat(((1000 / activity.average_speed) / 60).toFixed(2));
    console.log(`Calculated pace: ${paceMinPerKm} min/km from speed ${activity.average_speed} m/s`);
  }

  const transformedData = {
    userId: userId,
    name: activity.name || `${activity.type} Activity`,
    type: mapActivityType(activity.type) || 'other', // Use helper function to map Strava types to our types
    date: new Date(activity.start_date),
    duration: activity.moving_time || activity.elapsed_time || 0, // seconds
    distance: distanceInKm, // Store distance in KM
    intensity: activity.average_heartrate ? 'Medium' : 'Low',
    cardioDetails: {
      distance: distanceInKm, // Use KM here too for consistency if needed by frontend
      duration: activity.moving_time || activity.elapsed_time || 0,
      pace: paceMinPerKm, // Store correct pace in min/km
      speed: activity.average_speed, // m/s
      maxSpeed: activity.max_speed,
      elevationGain: activity.total_elevation_gain,
      heartRate: activity.average_heartrate ? {
        average: activity.average_heartrate,
        max: activity.max_heartrate || activity.average_heartrate,
      } : undefined,
    },
    stravaLink: `https://www.strava.com/activities/${activity.id}`,
    source: 'strava',
    sourceId: activity.id.toString(),
    importedFrom: 'strava-sync',
  };
  
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

// Helper function to map Strava activity types to our system's workout types
function mapActivityType(stravaType: string): string | null {
  const typeMap: Record<string, string> = {
    'Run': 'running',
    'VirtualRun': 'running',
    'TrailRun': 'running',
    'Swim': 'swimming',
    'OpenWaterSwim': 'swimming',
    'Ride': 'cycling',
    'VirtualRide': 'cycling',
    'MountainBikeRide': 'cycling',
    'GravelRide': 'cycling',
    'EBikeRide': 'cycling',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'Yoga': 'flexibility',
    'Hiit': 'hiit',
  };
  
  if (!stravaType) return null;
  
  return typeMap[stravaType] || 'other';
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

    // 1. Fetch user's Strava account
    const stravaAccount = await AccountModel.findOne({
      userId: userId,
      provider: 'strava'
    }).exec();

    if (!stravaAccount) {
      console.error(`POST /api/strava/sync-recent: Strava account not found for user ${userId}`);
      return NextResponse.json({ error: 'Strava account not connected' }, { status: 400 });
    }

    // 2. Get a valid access token (refresh if necessary)
    let accessToken = stravaAccount.access_token;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    
    // Check if token exists and is expired (add a small buffer, e.g., 5 minutes)
    if (!accessToken || (stravaAccount.expires_at && stravaAccount.expires_at < (nowInSeconds + 300))) {
      console.log(`POST /api/strava/sync-recent: Access token expired or missing for user ${userId}. Refreshing...`);
      try {
        accessToken = await refreshStravaToken(stravaAccount);
        if (!accessToken) {
          return NextResponse.json({ 
            error: 'Failed to refresh Strava token. Please disconnect and reconnect your Strava account.' 
          }, { status: 401 });
        }
      } catch (tokenError) {
        console.error(`POST /api/strava/sync-recent: Token refresh error for user ${userId}:`, tokenError);
        return NextResponse.json({ 
          error: 'Your Strava authorization has expired. Please disconnect and reconnect your Strava account.' 
        }, { status: 401 });
      }
    } else {
      console.log(`POST /api/strava/sync-recent: Using existing access token for user ${userId}`);
    }

    // 3. Fetch recent Strava activities
    try {
      const activities = await getRecentStravaActivities(accessToken);
      if (!activities) { // Should return empty array on failure, but check null just in case
         return NextResponse.json({ error: 'Failed to fetch activities from Strava' }, { status: 500 });
      }

      let newActivitiesCount = 0;

      // 4. Process activities
      for (const activity of activities) {
        try {
          // Check if workout already exists
          const existingWorkout = await WorkoutModel.findOne({
            userId: userId,
            source: 'strava',
            sourceId: activity.id.toString()
          }).exec();

          if (!existingWorkout) {
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
    } catch (activitiesError) {
      console.error(`POST /api/strava/sync-recent: Error fetching activities for user ${userId}:`, activitiesError);
      return NextResponse.json({ 
        error: 'Failed to fetch activities from Strava. Your access may have been revoked. Please reconnect your account.' 
      }, { status: 401 });
    }

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