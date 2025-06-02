import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import WorkoutModel from '@/lib/db/models/workout';
import dbConnect from '@/lib/db/mongodb';
import { WorkoutData } from '@/types/db';
import { getValidAccessToken } from "@/lib/services/stravaService";
import { getRecentStravaActivities } from '@/lib/strava';
import { revalidatePath } from 'next/cache';

// Define the type directly as workaround for import issue
type InternalWorkoutType = "strength" | "running" | "swimming" | "cycling" | "hiit" | "flexibility" | "walking" | "yoga" | "pilates" | "other";

// Helper function to map Strava activity types to our system's workout types
const mapActivityType = (stravaType: string): InternalWorkoutType => {
    const typeLower = stravaType.toLowerCase();
    if (typeLower.includes('run')) return 'running';
    if (typeLower.includes('ride') || typeLower.includes('bike')) return 'cycling';
    if (typeLower.includes('swim')) return 'swimming';
    if (typeLower.includes('walk')) return 'walking';
    if (typeLower.includes('yoga')) return 'yoga';
    if (typeLower.includes('strength') || typeLower.includes('weight')) return 'strength';
    if (typeLower.includes('hiit')) return 'hiit';
    return 'other';
};

// Transform Strava activity to workout data
function transformStravaActivity(activity: any, userId: string): Partial<WorkoutData> {
    console.log(`[sync-last-5] Processing activity ${activity.id}: ${activity.name}`);
    
    const distanceInMeters = typeof activity.distance === 'number' ? activity.distance : 0;
    const durationSeconds = activity.moving_time || activity.elapsed_time || 0;
    const workoutType: InternalWorkoutType = mapActivityType(activity.type);
    
    // Calculate pace if possible
    let paceMinPerKm = undefined;
    if (activity.average_speed && activity.average_speed > 0) {
        paceMinPerKm = parseFloat(((1000 / activity.average_speed) / 60).toFixed(2));
    } else if (distanceInMeters > 0 && durationSeconds > 0) {
        paceMinPerKm = parseFloat(((durationSeconds / 60) / (distanceInMeters / 1000)).toFixed(2));
    }

    // Prepare cardio details
    const cardioDetailsObject: Partial<WorkoutData['cardioDetails']> = {
        distance: distanceInMeters,
        duration: durationSeconds,
        pace: paceMinPerKm,
        speed: activity.average_speed ? parseFloat((activity.average_speed * 3.6).toFixed(2)) : undefined,
        maxSpeed: activity.max_speed ? parseFloat((activity.max_speed * 3.6).toFixed(2)) : undefined,
        elevationGain: activity.total_elevation_gain,
        heartRate: activity.average_heartrate ? {
            average: activity.average_heartrate,
            max: activity.max_heartrate || activity.average_heartrate,
        } : undefined,
    };

    const transformedData: Partial<WorkoutData> = {
        userId: userId,
        name: activity.name || `${activity.type} Activity`,
        type: workoutType,
        date: new Date(activity.start_date),
        duration: durationSeconds,
        distance: distanceInMeters,
        intensity: activity.average_heartrate ? 'Medium' : 'Low',
        stravaLink: `https://www.strava.com/activities/${activity.id}`,
        source: 'strava',
        sourceId: activity.id.toString(),
        importedFrom: 'strava-sync-last-5',
    };

    // Add cardio details if meaningful
    if (distanceInMeters > 0 || durationSeconds > 0) {
        transformedData.cardioDetails = cardioDetailsObject as WorkoutData['cardioDetails'];
    }
    
    return transformedData;
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
            console.error("POST /api/strava/sync-last-5: Not authenticated");
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        
        const userId = session.user.id;
        console.log(`[sync-last-5] User ${userId} initiated last 5 workouts sync`);

        // Get valid access token
        let accessToken;
        try {
            accessToken = await getValidAccessToken(userId);
            if (!accessToken) {
                throw new Error("Failed to obtain valid Strava access token.");
            }
        } catch (error) {
            console.error(`[sync-last-5] Token error for user ${userId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Failed to validate Strava connection";
            return NextResponse.json({ error: errorMessage }, { status: 401 });
        }

        // Fetch recent activities from Strava (we'll take the first 5)
        console.log(`[sync-last-5] Fetching recent activities for user ${userId}`);
        const recentActivities = await getRecentStravaActivities(accessToken);
        
        // Limit to the 5 most recent activities
        const last5Activities = recentActivities.slice(0, 5);
        console.log(`[sync-last-5] Processing ${last5Activities.length} most recent activities`);

        let syncedCount = 0;
        let updatedCount = 0;
        const syncResults = [];

        for (const activity of last5Activities) {
            try {
                console.log(`[sync-last-5] Processing activity ${activity.id} - ${activity.name}`);
                
                // Check if workout already exists
                const existingWorkout = await WorkoutModel.findOne({
                    userId: userId,
                    source: 'strava',
                    sourceId: activity.id.toString()
                }).exec();

                // Transform activity data
                const workoutData = transformStravaActivity(activity, userId);
                
                if (existingWorkout) {
                    // Update existing workout
                    await WorkoutModel.findByIdAndUpdate(
                        existingWorkout._id,
                        { $set: workoutData },
                        { new: true }
                    );
                    updatedCount++;
                    syncResults.push({
                        id: activity.id,
                        name: activity.name,
                        type: activity.type,
                        action: 'updated'
                    });
                    console.log(`[sync-last-5] Updated existing workout for activity ${activity.id}`);
                } else {
                    // Create new workout
                    await WorkoutModel.create(workoutData);
                    syncedCount++;
                    syncResults.push({
                        id: activity.id,
                        name: activity.name,
                        type: activity.type,
                        action: 'created'
                    });
                    console.log(`[sync-last-5] Created new workout for activity ${activity.id}`);
                }
            } catch (activityError) {
                console.error(`[sync-last-5] Error processing activity ${activity.id}:`, activityError);
                syncResults.push({
                    id: activity.id,
                    name: activity.name,
                    type: activity.type,
                    action: 'error',
                    error: activityError instanceof Error ? activityError.message : 'Unknown error'
                });
            }
        }
        
        // Revalidate relevant pages
        revalidatePath("/calendar");
        revalidatePath("/activity");
        revalidatePath("/dashboard");
        revalidatePath("/workouts");

        console.log(`[sync-last-5] Completed for user ${userId}: ${syncedCount} new, ${updatedCount} updated`);
        
        return NextResponse.json({ 
            success: true, 
            newCount: syncedCount,
            updatedCount: updatedCount,
            totalProcessed: last5Activities.length,
            results: syncResults,
            message: `Processed ${last5Activities.length} recent activities: ${syncedCount} new, ${updatedCount} updated`
        });
        
    } catch (error: any) {
        console.error("[sync-last-5] Error:", error);
        const errorMessage = error.message || 'Failed to sync last 5 Strava activities';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 