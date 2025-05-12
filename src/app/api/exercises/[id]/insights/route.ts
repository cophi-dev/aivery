import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongoose";
import Exercise from "@/lib/db/models/exercise";
import ExercisePR from "@/lib/db/models/exercisePR";
import WorkoutExercise from "@/lib/db/models/workoutExercise";
import ActivityInsight from "@/lib/db/models/activityInsight";

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
    // 2. Fetch all PRs for this exercise for the user
    const prs = await ExercisePR.find({ userId: userId, exerciseId: exerciseId }).sort({ date: -1 }).lean();
    // 3. Fetch recent workout logs for this exercise
    const workoutExercises = await WorkoutExercise.find({ userId: userId, exerciseId: exerciseId }).sort({ createdAt: -1 }).limit(30).lean();
    // 4. Quick stats
    let totalVolume = 0, totalReps = 0, maxWeight = 0, maxReps = 0, lastSession = null;
    let totalSessions = workoutExercises.length;
    workoutExercises.forEach(we => {
      if (we.sets && we.sets.length > 0) {
        we.sets.forEach((set: any) => {
          const w = set.weight || 0;
          const r = set.reps || 0;
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
        totalSessions
      },
      recentInsights
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch exercise insights", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 