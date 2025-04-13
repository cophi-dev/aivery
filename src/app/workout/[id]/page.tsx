// --- Server-Side Data Fetching Wrapper (Default Export) ---
// Remove unused imports if getWorkoutById is no longer used directly here
// import { getWorkoutById, getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
// Remove WorkoutData import if the type is handled by fetchWorkout or client component
// import { WorkoutData } from "@/types/db";

// Import the fetchWorkout action (which includes exercise fetching and serialization)
import { fetchWorkout } from "@/lib/workout-actions";

// Import the client component
import WorkoutDetailsClient from "@/components/workout-details-client";
import { getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository";
import mongoose from 'mongoose';

// Define the manual serialization function again if it was removed
// Helper function to deeply serialize Mongoose docs/objects with circular reference handling
function deepSerialize(obj: any, seen = new WeakSet()): any {
  // Handle null, undefined, and primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return null; // or some other sentinel value
  }
  seen.add(obj);

  // Handle ObjectId
  if (obj instanceof mongoose.Types.ObjectId) {
    return obj.toString();
  }

  // Handle Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item, seen));
  }

  // Handle Mongoose document
  if (typeof obj.toObject === 'function') {
    obj = obj.toObject();
  }

  // Handle plain object
  const serializedObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip internal Mongoose properties
      if (key === '__v' || key === '$__' || key === '$init') continue;
      
      if (key === '_id' && obj[key] instanceof mongoose.Types.ObjectId) {
        serializedObj[key] = obj[key].toString();
      } else {
        serializedObj[key] = deepSerialize(obj[key], seen);
      }
    }
  }
  return serializedObj;
}

export default async function WorkoutPageServerWrapper({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/workout/${params.id}`);
  }

  const workoutId = params.id;
  if (!workoutId) {
    console.error("Workout ID missing in params");
    notFound();
  }

  let workoutData: any | null = null; // Use any type temporarily as fetchWorkout returns serialized
  try {
    // --- Use the refactored fetchWorkout action --- 
    console.log(`SERVER WRAPPER: Calling fetchWorkout for ID: ${workoutId}`);
    workoutData = await fetchWorkout(workoutId);
    console.log(`SERVER WRAPPER: fetchWorkout returned data: ${!!workoutData}`);
  } catch (error) {
    console.error(`SERVER WRAPPER: Error calling fetchWorkout for ${workoutId}:`, error);
    // Decide how to handle fetch errors - show notFound or an error page?
    // For now, let's return notFound, but maybe a specific error state is better
    notFound(); 
  }

  // fetchWorkout already handles not found and ownership checks internally
  // so we just need to check if it returned null
  if (!workoutData) {
    console.log(`SERVER WRAPPER: Workout ${workoutId} not found or user ${session.user.id} unauthorized.`);
    notFound(); 
  }

  // Log the fetched data before passing it to the client
  console.log("SERVER WRAPPER: Raw workoutData fetched:", JSON.stringify(workoutData, null, 2));

  // --- Fetch and serialize previous workouts --- 
  let previousWorkoutsData: any[] = [];
  try {
    console.log(`SERVER WRAPPER: Fetching previous workouts for user ${session!.user!.id}, type ${workoutData.type}`);
    // Fetch previous workouts with minimal data
    previousWorkoutsData = await getPreviousWorkoutsByType(
      session!.user!.id, 
      workoutData.type, 
      new Date(workoutData.date),
      workoutId,
      10 
    );
    console.log(`SERVER WRAPPER: Found ${previousWorkoutsData.length} previous workouts with minimal data.`);
  } catch (error) {
    console.error(`SERVER WRAPPER: Error fetching previous workouts:`, error);
  }

  // Check if the current user is the owner of the workout
  const isOwner = workoutData.userId === session.user.id;

  // Pass the fetched data as props to the client component
  return <WorkoutDetailsClient 
    workout={workoutData} 
    previousWorkouts={previousWorkoutsData} 
    isOwner={isOwner} 
  />;
}

