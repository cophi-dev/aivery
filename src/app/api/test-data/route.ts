import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';

// This endpoint creates test workout data for a user
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'No userId provided' }, { status: 400 });
    }
    
    // Create test workouts for this user for various dates
    const workoutsCollection = await getCollection('workouts');
    
    // Get current date for calculations
    const now = new Date();
    
    // Create workouts for different time periods
    const testWorkouts = [
      // Last week workouts
      {
        userId: new ObjectId(userId),
        type: 'running',
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7), // 7 days ago
        distance: 5.2,
        duration: 30,
        calories: 350,
        notes: 'Easy morning run'
      },
      {
        userId: new ObjectId(userId),
        type: 'running',
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 9), // 9 days ago
        distance: 3.1,
        duration: 22,
        calories: 210,
        notes: 'Quick run before work'
      },
      // This week workouts
      {
        userId: new ObjectId(userId),
        type: 'running',
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2), // 2 days ago
        distance: 4.0,
        duration: 25,
        calories: 270,
        notes: 'Evening jog'
      },
      // Last month workouts
      {
        userId: new ObjectId(userId),
        type: 'swimming',
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15), // Middle of last month
        distance: 1.5,
        duration: 45,
        calories: 400,
        notes: 'Pool workout'
      },
      // Various cycling workouts
      {
        userId: new ObjectId(userId),
        type: 'cycling',
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14), // 2 weeks ago
        distance: 20.5,
        duration: 65,
        calories: 550,
        notes: 'Long weekend ride'
      }
    ];
    
    // Clear existing workouts first
    await workoutsCollection.deleteMany({ userId: new ObjectId(userId) });
    
    // Insert all test workouts
    const result = await workoutsCollection.insertMany(testWorkouts);
    
    return NextResponse.json({
      message: `Created ${result.insertedCount} test workouts for user ${userId}`,
      workouts: testWorkouts
    });
  } catch (error) {
    console.error('[TEST-DATA] Error creating test data:', error);
    return NextResponse.json({ error: 'Failed to create test data' }, { status: 500 });
  }
} 