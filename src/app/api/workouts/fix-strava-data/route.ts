import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

// Ensure runtime is Node.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication first
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('No authenticated session');
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('User authenticated:', userId);

    // Connect to DB
    const { getDatabase } = await import('@/lib/db/mongodb');
    const db = await getDatabase();
    
    // Find all Strava workouts for the user with missing or zero distance
    console.log('Finding Strava workouts with missing distance...');
    const workouts = await db.collection('workouts').find({
      userId: new Types.ObjectId(userId),
      source: 'strava',
      $or: [
        { distance: { $exists: false } },
        { distance: null },
        { distance: 0 },
        { distance: { $lt: 0.01 } }
      ]
    }).toArray();
    
    console.log(`Found ${workouts.length} Strava workouts with missing distance`);
    
    // Track results
    const results = {
      total: workouts.length,
      updated: 0,
      noSourceData: 0,
      noDistanceFound: 0,
      errors: 0,
      errorDetails: [] as string[]
    };

    // Process each workout
    for (const workout of workouts) {
      try {
        console.log(`Processing workout ${workout._id}...`);
        
        // Check if we have sourceData
        if (!workout.sourceData) {
          console.log(`No sourceData for workout ${workout._id}`);
          results.noSourceData++;
          continue;
        }
        
        // Extract distance from sourceData (in meters, convert to km)
        let distanceKm = 0;
        if (workout.sourceData.distance) {
          distanceKm = workout.sourceData.distance / 1000; // Convert meters to km
        } else if (workout.cardioDetails?.distance) {
          distanceKm = workout.cardioDetails.distance;
        } else {
          console.log(`No distance found for workout ${workout._id}`);
          results.noDistanceFound++;
          continue;
        }
        
        // Format distance for workout name
        const distanceStr = distanceKm < 1 ? 
          `${(distanceKm * 1000).toFixed(0)}m` : 
          `${distanceKm.toFixed(2)}km`;

        // Generate a new workout name with distance if not already there
        let newName = workout.name || workout.subType || workout.type;
        if (!newName.includes(distanceStr) && !newName.match(/\d+(\.\d+)?\s*(km|m|miles)/i)) {
          newName = `${newName} (${distanceStr})`;
        }
        
        // Calculate pace and speed
        const durationMinutes = workout.duration || 0;
        const pace = distanceKm > 0 && durationMinutes > 0 ? (durationMinutes * 60) / distanceKm : 0; // seconds per km
        const speed = distanceKm > 0 && durationMinutes > 0 ? distanceKm / (durationMinutes / 60) : 0; // km/h
        
        // Prepare cardioDetails update
        const cardioDetails = workout.cardioDetails || {};
        cardioDetails.distance = distanceKm;
        cardioDetails.pace = pace;
        cardioDetails.speed = speed;
        
        // Update the workout
        await db.collection('workouts').updateOne(
          { _id: workout._id },
          { 
            $set: { 
              name: newName,
              distance: distanceKm,
              cardioDetails: cardioDetails
            } 
          }
        );
        
        // Update workout exercise to include distance
        await db.collection('workoutexercises').updateOne(
          { workoutId: workout._id },
          { $set: { distance: distanceKm } }
        );
        
        results.updated++;
        console.log(`Updated workout ${workout._id} with distance ${distanceKm}km`);
      } catch (error) {
        console.error(`Error updating workout ${workout._id}:`, error);
        results.errors++;
        results.errorDetails.push(`Error updating workout ${workout._id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Revalidate paths
    revalidatePath("/calendar");
    revalidatePath("/workout");
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${results.updated} workouts out of ${results.total}`,
      results
    });
  } catch (error) {
    console.error("Error fixing Strava data:", error);
    return NextResponse.json({
      success: false,
      error: `Error fixing Strava data: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
} 