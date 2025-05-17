import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongoose";
import Exercise from "@/lib/db/models/exercise";
import ExercisePR from "@/lib/db/models/exercisePR";
import WorkoutExercise from "@/lib/db/models/workoutExercise";
import ActivityInsight from "@/lib/db/models/activityInsight";
import { estimateBodyweightForExercise } from "@/lib/utils";

// Define types for workout exercise and set
interface WorkoutExerciseData {
  _id: string;
  workoutId: string;
  exerciseId: string;
  userId: string;
  sets?: SetData[];
  createdAt: Date | string;
  [key: string]: any; // Allow for other properties
}

interface SetData {
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  notes?: string;
  [key: string]: any; // Allow for other properties
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const exerciseId = params.id;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  await dbConnect();
  const userId = session.user.id;
  try {
    // 1. Fetch exercise metadata
    const exercise = await Exercise.findById(exerciseId).lean();
    if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    
    // Detect if this is a bodyweight exercise
    const bodyweightNames = [
      'pull-up', 'pull up', 'push-up', 'push up', 'chin-up', 'chin up', 'dips', 'sit-up', 'sit up', 
      'crunch', 'plank', 'burpee', 'lunge', 'squat', 'jumping jack', 'mountain climber', 
      'bodyweight row', 'inverted row', 'leg raise', 'pushup', 'pullup', 'pushups', 'pullups', 
      'dips', 'situps', 'crunches', 'planks', 'lunges', 'squats', 'burpees', 'mountain climbers', 
      'bodyweight rows', 'inverted rows', 'leg raises', 'air squat'
    ];
    
    const isBodyweight = exercise.tags?.includes('trackMaxReps') || 
      (exercise.name && bodyweightNames.some(name => exercise.name.toLowerCase().includes(name)));
    
    // Debug log for bodyweight detection in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Exercise ${exercise.name} is ${isBodyweight ? 'detected as bodyweight' : 'not a bodyweight exercise'}`);
      if (isBodyweight) {
        console.log(`[DEBUG] Estimated bodyweight: ${estimateBodyweightForExercise(exercise.name || '')}`);
      }
    }
    
    // 2. Fetch all PRs for this exercise for the user
    const prs = await ExercisePR.find({ userId: userId, exerciseId: exerciseId }).sort({ date: -1 }).lean();
    
    // 3. Fetch recent workout logs for this exercise
    const rawWorkoutExercises = await WorkoutExercise.find({ 
      userId: userId, 
      exerciseId: exerciseId 
    }).sort({ createdAt: -1 }).limit(100).lean() as unknown as WorkoutExerciseData[];

    // Debug log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Found ${rawWorkoutExercises.length} raw workout exercises for ${exercise.name}`);
      
      // Group by date to check for duplicates
      const byDate: Record<string, WorkoutExerciseData[]> = {};
      rawWorkoutExercises.forEach(we => {
        const date = new Date(we.createdAt).toISOString().split('T')[0];
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(we);
      });
      
      // Check for multiple entries on the same day
      Object.entries(byDate).forEach(([date, entries]) => {
        if (entries.length > 1) {
          console.log(`[DEBUG] Found ${entries.length} entries for ${date}`);
          
          // Group by workoutId to see if they're from the same workout
          const byWorkout: Record<string, WorkoutExerciseData[]> = {};
          entries.forEach(e => {
            const wid = e.workoutId ? e.workoutId.toString() : 'unknown';
            if (!byWorkout[wid]) byWorkout[wid] = [];
            byWorkout[wid].push(e);
          });
          
          Object.entries(byWorkout).forEach(([wid, wEntries]) => {
            if (wEntries.length > 1) {
              console.log(`[DEBUG] Found ${wEntries.length} entries for workout ${wid}`);
              // Log the sets for each entry
              wEntries.forEach((entry, i) => {
                console.log(`[DEBUG] Entry ${i+1} sets:`, entry.sets?.map(s => ({ reps: s.reps, weight: s.weight })));
              });
            }
          });
        }
      });
    }
    
    // Deduplicate the workout exercises to handle duplicates in the database
    // First group by workoutId to identify exercises from the same workout
    const byWorkoutId: Record<string, WorkoutExerciseData[]> = {};
    rawWorkoutExercises.forEach(we => {
      const workoutId = we.workoutId ? we.workoutId.toString() : 'unknown';
      if (!byWorkoutId[workoutId]) {
        byWorkoutId[workoutId] = [];
      }
      byWorkoutId[workoutId].push(we);
    });
    
    // For each workoutId, filter out duplicates by comparing set data
    const workoutExercises: WorkoutExerciseData[] = [];
    Object.values(byWorkoutId).forEach(entries => {
      if (entries.length === 1) {
        // Only one entry for this workout, keep it
        workoutExercises.push(entries[0]);
      } else {
        // Multiple entries, potential duplicates
        // Choose the entry with the most sets, or if equal, the most recent one
        const mostComplete = entries.reduce((best, current) => {
          const bestSetsCount = best.sets?.length || 0;
          const currentSetsCount = current.sets?.length || 0;
          
          if (currentSetsCount > bestSetsCount) {
            return current;
          } else if (currentSetsCount === bestSetsCount) {
            // If same number of sets, take the newest one
            return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
          }
          return best;
        }, entries[0]);
        
        workoutExercises.push(mostComplete);
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] After deduplication: ${workoutExercises.length} workout exercises`);
    }
    
    // 4. Quick stats
    let totalVolume = 0, totalReps = 0, maxWeight = 0, maxReps = 0, lastSession = null;
    let totalSessions = workoutExercises.length;
    workoutExercises.forEach(we => {
      if (we.sets && we.sets.length > 0) {
        we.sets.forEach((set: SetData) => {
          let w = set.weight || 0;
          const r = set.reps || 0;
          
          // For bodyweight exercises with zero weight, use estimated weight
          if (isBodyweight && w === 0) {
            w = estimateBodyweightForExercise(exercise.name || '');
          }
          
          totalVolume += w * r;
          totalReps += r;
          if (w > maxWeight) maxWeight = w;
          if (r > maxReps) maxReps = r;
        });
      }
    });
    if (workoutExercises.length > 0) {
      lastSession = workoutExercises[0].createdAt;
    }
    // 5. Optionally, fetch recent insights
    const recentInsights = await ActivityInsight.find({ userId: userId }).sort({ generatedAt: -1 }).limit(2).lean();
    return NextResponse.json({
      exercise,
      prs,
      workoutExercises,
      stats: {
        totalVolume,
        totalReps,
        maxWeight,
        maxReps,
        lastSession,
        totalSessions,
        isBodyweight // Include this flag for the frontend
      },
      recentInsights
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch exercise insights", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 