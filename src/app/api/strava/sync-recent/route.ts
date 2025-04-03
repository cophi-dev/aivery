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
  // Convert distance from meters to kilometers
  const distanceInKm = activity.distance / 1000;
  // Calculate pace in minutes per kilometer (if speed is available)
  const paceMinPerKm = activity.average_speed && activity.average_speed > 0 
    ? (1000 / activity.average_speed) / 60 
    : undefined;

  return {
    userId: userId,
    name: activity.name,
    type: activity.type, // Strava types might need mapping
    date: new Date(activity.start_date),
    duration: activity.moving_time, // seconds
    distance: distanceInKm, // Store distance in KM
    intensity: activity.average_heartrate ? 'Cardio' : undefined,
    cardioDetails: {
      distance: distanceInKm, // Use KM here too for consistency if needed by frontend
      duration: activity.moving_time,
      pace: paceMinPerKm, // Store correct pace in min/km
      speed: activity.average_speed, // m/s
      maxSpeed: activity.max_speed,
      elevationGain: activity.total_elevation_gain,
      heartRate: {
        average: activity.average_heartrate,
        max: activity.max_heartrate,
      },
    },
    stravaLink: `https://www.strava.com/activities/${activity.id}`,
    source: 'strava',
    sourceId: activity.id.toString(),
    importedFrom: 'strava-sync',
  };
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