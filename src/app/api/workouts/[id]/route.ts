import { NextResponse } from "next/server";
import { getWorkoutById } from "@/lib/db/repositories/workoutRepository";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import WorkoutModel from "@/lib/db/models/workout";

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

export async function PATCH(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const { params } = routeContextSchema.parse(context);
    const workoutId = params.id;
    
    // Parse request body
    const body = await req.json();
    
    console.log(`[API PATCH /api/workouts/${workoutId}] Fetching session...`);
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error(`[API PATCH /api/workouts/${workoutId}] Unauthorized - Session or User ID missing`);
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    
    console.log(`[API PATCH /api/workouts/${workoutId}] Fetching workout...`);
    const workout = await getWorkoutById(workoutId);

    if (!workout) {
      console.warn(`[API PATCH /api/workouts/${workoutId}] Workout not found.`);
      return new NextResponse(JSON.stringify({ error: "Workout not found" }), { status: 404 });
    }
    
    if (workout.userId?.toString() !== session.user.id) {
      console.warn(`[API PATCH /api/workouts/${workoutId}] Forbidden - User ID mismatch.`);
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    
    // Update only allowed fields
    const updateData: any = {};
    
    // Allow updating Strava ID
    if (body.sourceId) {
      console.log(`[API PATCH /api/workouts/${workoutId}] Updating sourceId to ${body.sourceId}`);
      updateData.sourceId = body.sourceId;
    }
    
    // Allow updating Strava link
    if (body.stravaLink) {
      console.log(`[API PATCH /api/workouts/${workoutId}] Updating stravaLink to ${body.stravaLink}`);
      updateData.stravaLink = body.stravaLink;
    }
    
    // Update the workout
    const updatedWorkout = await WorkoutModel.findByIdAndUpdate(
      workoutId,
      { $set: updateData },
      { new: true } // Return the updated document
    );
    
    if (!updatedWorkout) {
      console.error(`[API PATCH /api/workouts/${workoutId}] Failed to update workout`);
      return new NextResponse(JSON.stringify({ error: "Failed to update workout" }), { status: 500 });
    }
    
    console.log(`[API PATCH /api/workouts/${workoutId}] Successfully updated workout`);
    return new NextResponse(JSON.stringify(updatedWorkout), { status: 200 });
    
  } catch (error) {
    console.error('[API PATCH /api/workouts] Error:', error);
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify({ error: "Invalid request parameters" }), { status: 400 });
    }
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
} 