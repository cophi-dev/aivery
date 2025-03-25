import { getDbClient } from "../db/connection"
import type { WorkoutData } from "@/types/db"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Mock workouts for fallback
const mockWorkouts: WorkoutData[] = [
  {
    id: "1",
    userId: MOCK_USER_ID,
    name: "Upper Body",
    date: new Date("2025-06-08"),
    duration: 65,
    intensity: "High",
    type: "strength",
    volume: 3240,
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 8 },
          { weight: 90, reps: 6 },
          { weight: 85, reps: 8 },
        ],
      },
      {
        name: "Incline Dumbbell Press",
        sets: [
          { weight: 30, reps: 12 },
          { weight: 32, reps: 10 },
          { weight: 34, reps: 8 },
        ],
      },
      {
        name: "Lat Pulldown",
        sets: [
          { weight: 70, reps: 12 },
          { weight: 75, reps: 10 },
          { weight: 80, reps: 8 },
        ],
      },
    ],
    notes: "Felt strong today. Increased weight on bench press and hit a new PR.",
  },
  {
    id: "2",
    userId: MOCK_USER_ID,
    name: "Lower Body",
    date: new Date("2025-06-10"),
    duration: 75,
    intensity: "High",
    type: "strength",
    volume: 4560,
    exercises: [
      {
        name: "Squats",
        sets: [
          { weight: 100, reps: 10 },
          { weight: 110, reps: 8 },
          { weight: 120, reps: 6 },
        ],
      },
      {
        name: "Deadlifts",
        sets: [
          { weight: 120, reps: 8 },
          { weight: 130, reps: 6 },
          { weight: 140, reps: 4 },
        ],
      },
    ],
    notes: "Focus on form for deadlifts.",
  },
]

// Get all workouts
export async function getWorkouts(): Promise<WorkoutData[]> {
  try {
    const dbClient = await getDbClient()
    const workouts = await dbClient.findWorkouts()

    if (workouts.length === 0) {
      return mockWorkouts
    }

    return workouts as WorkoutData[]
  } catch (error) {
    console.error("Error getting workouts:", error)
    return mockWorkouts
  }
}

// Get a workout by ID
export async function getWorkout(id: string): Promise<WorkoutData | null> {
  try {
    const dbClient = await getDbClient()
    const workout = await dbClient.findWorkoutById(id)

    if (!workout) {
      return mockWorkouts.find((w) => w.id === id) || null
    }

    return workout as WorkoutData
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    return mockWorkouts.find((w) => w.id === id) || null
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    // Calculate volume based on exercises
    let volume = 0
    if (workoutData.exercises) {
      for (const exercise of workoutData.exercises) {
        for (const set of exercise.sets) {
          volume += set.weight * set.reps
        }
      }
    }

    const workout = {
      ...workoutData,
      userId: MOCK_USER_ID,
      volume,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const dbClient = await getDbClient()
    const result = await dbClient.insertWorkout(workout)

    return {
      ...workout,
      id: result.id,
    } as WorkoutData
  } catch (error) {
    console.error("Error creating workout:", error)

    // Create a mock workout
    const newWorkout = {
      id: Date.now().toString(),
      userId: MOCK_USER_ID,
      name: workoutData.name || "Untitled Workout",
      date: workoutData.date || new Date(),
      duration: workoutData.duration || 60,
      intensity: workoutData.intensity || "Medium",
      type: workoutData.type || "strength",
      volume: 0,
      exercises: workoutData.exercises || [],
      notes: workoutData.notes || "",
    }

    return newWorkout
  }
}

// Update a workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<boolean> {
  try {
    const dbClient = await getDbClient()
    return await dbClient.updateWorkout(id, {
      ...workoutData,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error(`Error updating workout ${id}:`, error)
    return false
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<boolean> {
  try {
    const dbClient = await getDbClient()
    return await dbClient.deleteWorkout(id)
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    return false
  }
}

