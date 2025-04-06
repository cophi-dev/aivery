// --- Server-Side Data Fetching Wrapper (Default Export) ---
import { getWorkoutById, getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { WorkoutData } from "@/types/db";

// Import the client component (assuming it exists, even with potential errors for now)
import WorkoutDetailsClient from "@/components/workout-details-client";

export default async function WorkoutPageServerWrapper({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Redirect happens server-side before rendering the client component
    redirect(`/login?callbackUrl=/workout/${params.id}`);
  }

  const workoutId = params.id;
  if (!workoutId) {
    console.error("Workout ID missing in params");
    notFound();
  }

  let workout: WorkoutData | null = null;
  try {
    // Ensure you are passing the ID correctly based on your repository function
    workout = await getWorkoutById(workoutId);
  } catch (error) {
    console.error(`Error fetching workout ${workoutId}:`, error);
    // Decide how to handle DB errors - show notFound or an error page?
    notFound(); 
  }

  if (!workout) {
    notFound(); // Workout not found in DB
  }

  // Verify user ownership
  // Make sure workout.userId exists and is comparable
  if (!workout.userId || workout.userId.toString() !== session.user.id) {
     console.warn(`Unauthorized access attempt: User ${session.user.id} tried to access workout ${workoutId}`);
     notFound(); 
  }

  // Fetch previous workouts for context
  let previousWorkouts: WorkoutData[] = [];
  try {
     // Ensure userId is passed as string if expected by the function
     previousWorkouts = await getPreviousWorkoutsByType(
       session.user.id, // Pass user ID string
    workout.type, 
    workout.date, 
       10 // Limit context
     );
  } catch (error) {
     console.error(`Error fetching previous workouts for user ${session.user.id}, type ${workout.type}:`, error);
     // Proceed without previous workouts if fetch fails, component should handle empty array
  }

  // Pass the fetched data as props to the client component
  return <WorkoutDetailsClient workout={workout} previousWorkouts={previousWorkouts} />;
}

// Note: All previous helper functions and JSX rendering logic have been removed 
// from this file and are now expected to be in WorkoutDetailsClient.

