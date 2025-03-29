import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    // Set cache control headers to prevent caching
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401, headers }
      );
    }

    await dbConnect();
    const userId = session.user.id;
    
    // Get all user workouts
    const workoutsCollection = await getCollection('workouts');
    const workouts = await workoutsCollection
      .find({ 
        userId: new ObjectId(userId),
        type: "strength" // Only consider strength workouts that have exercises
      })
      .sort({ date: -1 }) // Sort by date descending (newest first)
      .toArray();
    
    // Build exercise history map
    const exerciseHistory: {
      [key: string]: {
        lastDate: Date, 
        lastWeight: number, 
        lastReps: number,
        totalSets: number,
        motivationalNote?: string
      }
    } = {};
    
    // Collection of motivational notes
    const motivationalNotes = [
      "Time to beat your personal best!",
      "You've improved a lot since you started!",
      "Let's push a little harder today!",
      "You're getting stronger every day!",
      "You've got this! Keep pushing!",
      "Challenge yourself to go heavier today!",
      "Focus on form and beat your last performance!",
      "Progress takes consistency - you're doing great!",
      "Remember how far you've come!",
      "One more rep than last time!"
    ];
    
    // Process each workout
    workouts.forEach(workout => {
      if (!workout.exercises) return;
      
      workout.exercises.forEach((exercise: any) => {
        const exerciseName = exercise.name;
        
        // Skip if we already have history for this exercise (since workouts are ordered by date)
        if (exerciseHistory[exerciseName]) return;
        
        // Find the heaviest weight used in this workout for this exercise
        if (exercise.sets && exercise.sets.length > 0) {
          // Sort sets by weight (heaviest first)
          const sortedSets = [...exercise.sets].sort((a, b) => b.weight - a.weight);
          const heaviestSet = sortedSets[0];
          
          // Find the set with most reps
          const mostRepSet = [...exercise.sets].sort((a, b) => b.reps - a.reps)[0];
          
          // Get a random motivational note
          const randomNote = motivationalNotes[Math.floor(Math.random() * motivationalNotes.length)];
          
          // Store exercise history
          exerciseHistory[exerciseName] = {
            lastDate: workout.date,
            lastWeight: heaviestSet.weight,
            lastReps: heaviestSet.reps,
            totalSets: exercise.sets.length,
            motivationalNote: randomNote
          };
        }
      });
    });
    
    // Add a timestamp to ensure freshness
    console.log(`[EXERCISE-HISTORY] Generating history at ${new Date().toISOString()}`);
    
    return NextResponse.json(exerciseHistory, { headers });
    
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    return NextResponse.json(
      { error: 'Failed to fetch exercise history' },
      { status: 500, headers }
    );
  }
} 