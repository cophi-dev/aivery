import { getDatabase } from "./mongodb"
import { ObjectId } from "mongodb"

// Test user email for development
const TEST_USER_EMAIL = "test@example.com"

// Sample workout data
const sampleWorkouts = [
  {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Lower Body",
    date: new Date("2025-06-10"),
    duration: 75,
    intensity: "Medium",
    type: "strength",
    volume: 2800,
    exercises: [
      {
        name: "Squats",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 105, reps: 6 },
          { weight: 110, reps: 4 },
        ],
      },
      {
        name: "Romanian Deadlifts",
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 8 },
          { weight: 90, reps: 6 },
        ],
      },
    ],
    notes: "Focusing on form today. Reduced weight to work on technique.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

export async function initializeDatabase() {
  try {
    const db = await getDatabase()
    const usersCollection = db.collection("users")
    const workoutsCollection = db.collection("workouts")

    // Create test user if it doesn't exist
    const testUser = await usersCollection.findOne({ email: TEST_USER_EMAIL })
    if (!testUser) {
      const result = await usersCollection.insertOne({
        email: TEST_USER_EMAIL,
        name: "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log("Created test user:", result.insertedId)
    }

    // Get test user ID
    const testUserDoc = await usersCollection.findOne({ email: TEST_USER_EMAIL })
    if (!testUserDoc) {
      throw new Error("Failed to create or find test user")
    }

    // Add user ID to workouts
    const workoutsWithUserId = sampleWorkouts.map(workout => ({
      ...workout,
      userId: testUserDoc._id,
    }))

    // Check if workouts already exist
    const existingWorkouts = await workoutsCollection.countDocuments({ userId: testUserDoc._id })
    if (existingWorkouts === 0) {
      const result = await workoutsCollection.insertMany(workoutsWithUserId)
      console.log(`Created ${result.insertedCount} sample workouts`)
    } else {
      console.log("Sample workouts already exist")
    }

    return true
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}

