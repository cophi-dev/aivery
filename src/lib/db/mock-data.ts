import { ObjectId } from "mongodb"
import type { WorkoutData } from "@/types/db"

// Mock user ID for demo purposes
export const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Mock workouts data
export const mockWorkouts: WorkoutData[] = [
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

// Mock user data
export const mockUser = {
  _id: new ObjectId(MOCK_USER_ID),
  name: "John Doe",
  email: "john.doe@example.com",
  height: 180,
  weight: 82,
  age: 32,
  gender: "Male",
  activityLevel: "Moderate",
  goals: ["Build muscle", "Improve strength"],
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
}

// Mock integrations data
export const mockIntegrations = [
  {
    _id: new ObjectId(),
    userId: new ObjectId(MOCK_USER_ID),
    provider: "strava",
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
    expiresAt: new Date(Date.now() + 3600 * 1000),
    lastSynced: new Date(Date.now() - 86400 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Function to create a mock workout
export function createMockWorkout(workoutData: Partial<WorkoutData>): WorkoutData {
  // Calculate volume based on exercises
  let volume = workoutData.volume || 0
  if (!volume && workoutData.exercises) {
    for (const exercise of workoutData.exercises) {
      for (const set of exercise.sets) {
        volume += set.weight * set.reps
      }
    }
  }

  return {
    id: Date.now().toString(),
    userId: MOCK_USER_ID,
    name: workoutData.name || "Untitled Workout",
    date: workoutData.date || new Date(),
    duration: workoutData.duration || 60,
    intensity: workoutData.intensity || "Medium",
    type: workoutData.type || "strength",
    volume,
    exercises: workoutData.exercises || [],
    notes: workoutData.notes || "",
  }
}

