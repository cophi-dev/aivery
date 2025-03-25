import { getDatabase } from "./mongodb"
import { ObjectId } from "mongodb"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Sample workout data
const sampleWorkouts = [
  {
    userId: new ObjectId(MOCK_USER_ID),
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
    userId: new ObjectId(MOCK_USER_ID),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Sample user data
const sampleUser = {
  _id: new ObjectId(MOCK_USER_ID),
  name: "John Doe",
  email: "john.doe@example.com",
  height: 180,
  weight: 82,
  age: 32,
  gender: "Male",
  activityLevel: "Moderate",
  goals: ["Build muscle", "Improve strength"],
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Initialize the database with sample data
export async function initializeDatabase() {
  try {
    const db = await getDatabase("aivery")

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map((c) => c.name)

    if (!collectionNames.includes("users")) {
      await db.createCollection("users")
    }

    if (!collectionNames.includes("workouts")) {
      await db.createCollection("workouts")
    }

    // Check if user exists
    const usersCollection = db.collection("users")
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(MOCK_USER_ID) })

    if (!existingUser) {
      await usersCollection.insertOne(sampleUser)
      console.log("Sample user created")
    }

    // Check if workouts exist
    const workoutsCollection = db.collection("workouts")
    const existingWorkouts = await workoutsCollection.countDocuments({ userId: new ObjectId(MOCK_USER_ID) })

    if (existingWorkouts === 0) {
      await workoutsCollection.insertMany(sampleWorkouts)
      console.log("Sample workouts created")
    }

    return {
      success: true,
      message: "Database initialized successfully",
      details: {
        collections: collectionNames,
        userCreated: !existingUser,
        workoutsCreated: existingWorkouts === 0,
      },
    }
  } catch (error) {
    console.error("Error initializing database:", error)
    // Make sure we return a proper object, not a string
    return {
      success: false,
      message: "Failed to initialize database",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

