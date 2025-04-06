import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';

// TODO: Implement logic to generate insightful comparison statement

export async function GET(
  req: NextRequest,
  { params }: { params: { workoutId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const workoutId = params.workoutId;

    if (!workoutId || !ObjectId.isValid(workoutId)) {
        return NextResponse.json({ error: "Valid Workout ID is required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Fetch the specific workout
    const workout = await WorkoutModel.findOne({
        _id: new ObjectId(workoutId),
        userId: new ObjectId(userId)
    }).lean<IWorkout>(); // Use lean for plain object

    if (!workout) {
        return NextResponse.json({ error: "Workout not found or not authorized" }, { status: 404 });
    }

    // 2. --- Logic to determine the insight ---
    //    - Analyze workout type (running, strength, etc.)
    //    - Choose a relevant metric (distance, duration, volume, pace)
    //    - Fetch comparison data (user average, previous record for this metric/type)
    //    - Generate a fun, comparative statement

    // Placeholder insight generation
    let insightStatement = `Great job on this ${workout.type} workout!`; // Default message

    // Example: Insight for a run based on distance
    if (workout.type === 'running' && workout.distance) {
        // Fetch user's average running distance for the last month (example)
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const avgResult = await WorkoutModel.aggregate([
            { $match: {
                userId: new ObjectId(userId),
                type: 'running',
                date: { $gte: oneMonthAgo },
                distance: { $exists: true, $ne: null }
            }},
            { $group: {
                _id: null,
                averageDistance: { $avg: '$distance' }
            }}
        ]);

        const avgDistance = avgResult[0]?.averageDistance;

        if (avgDistance && workout.distance > avgDistance) {
            const percentBetter = ((workout.distance - avgDistance) / avgDistance) * 100;
            insightStatement = `Awesome run! Your ${workout.distance.toFixed(2)}km was ${percentBetter.toFixed(0)}% longer than your average run this past month! Keep pushing! 🚀`;
        } else if (avgDistance) {
            insightStatement = `Solid ${workout.distance.toFixed(2)}km run! Consistent effort pays off. 👍`;
        } else {
             insightStatement = `That's a ${workout.distance.toFixed(2)}km run logged! Keep building that history!`;
        }
    }
    // TODO: Add more sophisticated logic for other workout types and metrics

    // 3. Return the generated statement
    return NextResponse.json({ insight: insightStatement });

  } catch (error) {
    console.error("API Insight Error:", error);
    // Provide a generic fallback insight on error
    return NextResponse.json(
      { insight: "Keep up the great work on your fitness journey!" },
      { status: 500 } // Keep internal server error status
    );
  }
} 