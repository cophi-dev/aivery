import { NextResponse } from "next/server";
import { getWorkoutById } from "@/lib/db/repositories/workoutRepository";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const { params } = routeContextSchema.parse(context);
    const workoutId = params.id;

    console.log(`[API /api/workouts/${workoutId}] Fetching session...`);
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error(`[API /api/workouts/${workoutId}] Unauthorized - Session or User ID missing. Session:`, session);
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    console.log(`[API /api/workouts/${workoutId}] Session User ID: ${session.user.id}`);

    console.log(`[API /api/workouts/${workoutId}] Fetching workout...`);
    const workout = await getWorkoutById(workoutId);

    if (!workout) {
      console.warn(`[API /api/workouts/${workoutId}] Workout not found.`);
      return new NextResponse(JSON.stringify({ error: "Workout not found" }), { status: 404 });
    }
    console.log(`[API /api/workouts/${workoutId}] Workout User ID: ${workout.userId?.toString()}`);

    if (workout.userId?.toString() !== session.user.id) {
      console.warn(`[API /api/workouts/${workoutId}] Forbidden - User ID mismatch. Workout owned by ${workout.userId?.toString()}, session user is ${session.user.id}.`);
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    
    console.log(`[API /api/workouts/${workoutId}] Authorized. Returning workout.`);
    return new NextResponse(JSON.stringify(workout), { status: 200 });

  } catch (error) {
    console.error(`[API /api/workouts] Error:`, error);
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify({ error: "Invalid request parameters" }), { status: 400 });
    }
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
} 