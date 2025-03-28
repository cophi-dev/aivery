import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import WorkoutModel from "@/lib/db/models/workout";

// Define interfaces for type safety
interface WorkoutDoc {
  _id?: any;
  name?: string;
  type?: string;
  date?: Date;
  duration?: number;
  userId?: any;
  exercises?: any[];
  notes?: string;
  cardioDetails?: {
    distance?: number;
    duration?: number;
    heartRate?: {
      average?: number;
      max?: number;
      zones?: any;
    }
  };
}

// Client-safe workout interface
interface SafeWorkout {
  _id: string;
  name: string;
  type: string;
  date: string;
  duration: number;
  userId: string;
  exercises: any[];
  notes: string;
  cardioDetails?: {
    distance: number;
    duration: number;
    heartRate?: {
      average: number;
      max: number;
    }
  };
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // First check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const { userId } = params;
    
    // Validate userId
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Make sure user can only access their own workouts
    if (session.user.id !== userId && !process.env.DISABLE_AUTH_CHECK) {
      return NextResponse.json(
        { error: "Unauthorized to access this user's workouts" }, 
        { status: 403 }
      );
    }
    
    await dbConnect();
    
    try {
      // Find all workouts for the user
      const workoutDocs = await WorkoutModel.find({ 
        userId: new ObjectId(userId) 
      }).sort({ date: -1 }).lean();
      
      // Process documents to ensure they're safe for client components
      // Without sacrificing essential data needed for rendering
      const processedWorkouts = workoutDocs.map((doc: any): SafeWorkout => {
        // Ensure required top-level fields exist
        const safeWorkout: SafeWorkout = {
          _id: doc._id ? doc._id.toString() : "",
          userId: doc.userId ? doc.userId.toString() : "",
          type: doc.type || '',
          name: doc.name || '',
          date: doc.date instanceof Date ? doc.date.toISOString() : 
                (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString()),
          duration: doc.duration || 0,
          exercises: Array.isArray(doc.exercises) ? doc.exercises.map((exercise: any) => ({
            _id: exercise._id ? exercise._id.toString() : undefined,
            name: exercise.name || '',
            sets: Array.isArray(exercise.sets) ? exercise.sets.map((set: any) => ({
              weight: set.weight || 0,
              reps: set.reps || 0,
              // Skip any _id fields with buffer properties
            })) : []
          })) : [],
          notes: doc.notes || ''
        };
        
        // If there's cardio details, create a safe version
        if (doc.cardioDetails) {
          safeWorkout.cardioDetails = {
            distance: doc.cardioDetails.distance || 0,
            duration: doc.cardioDetails.duration || 0,
          };
          
          // Safely include heart rate data if available
          if (doc.cardioDetails.heartRate) {
            safeWorkout.cardioDetails.heartRate = {
              average: doc.cardioDetails.heartRate.average || 0,
              max: doc.cardioDetails.heartRate.max || 0
            };
          }
        }
        
        return safeWorkout;
      });
      
      // Return the processed workouts
      return NextResponse.json({ workouts: processedWorkouts });
    } catch (error) {
      console.error("Error processing workouts:", error);
      
      // Emergency fallback with absolutely minimal data
      try {
        // Find workouts with just IDs
        const basicDocs = await WorkoutModel.find(
          { userId: new ObjectId(userId) },
          { _id: 1, name: 1, type: 1, date: 1, duration: 1 }
        ).lean();
        
        // Create minimal objects with guaranteed valid date
        const minimalWorkouts = basicDocs.map((doc: any) => ({
          _id: doc._id.toString(),
          name: doc.name || "Workout",
          type: doc.type || "workout",
          date: doc.date instanceof Date ? doc.date.toISOString() : new Date().toISOString(),
          duration: doc.duration || 0
        }));
        
        return NextResponse.json({
          workouts: minimalWorkouts,
          warning: "Only minimal workout data available due to processing errors"
        });
      } catch (finalError) {
        console.error("Complete failure fetching workouts:", finalError);
        return NextResponse.json({
          workouts: [],
          error: "Failed to retrieve workout data"
        });
      }
    }
  } catch (error) {
    console.error("Error in workouts API:", error);
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
} 