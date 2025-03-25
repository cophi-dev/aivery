import { MongoClient, ServerApiVersion } from "mongodb"

// Simple mock data for when database is unavailable
const mockData = {
  workouts: [],
  users: [],
  integrations: [],
}

// Global for caching the MongoDB connection
let cachedClient: MongoClient | null = null
let cachedDb: any = null

// Simple interface for database operations
export interface DbClient {
  findWorkouts: () => Promise<any[]>
  findWorkoutById: (id: string) => Promise<any | null>
  insertWorkout: (workout: any) => Promise<{ id: string }>
  updateWorkout: (id: string, workout: any) => Promise<boolean>
  deleteWorkout: (id: string) => Promise<boolean>
  // Add more methods as needed
}

// Create a real MongoDB client
async function createMongoClient(): Promise<DbClient | null> {
  try {
    // Check if MongoDB URI is available
    if (!process.env.MONGODB_URI) {
      console.warn("MONGODB_URI not set, using mock client")
      return null
    }

    // Use cached client if available
    if (cachedClient && cachedDb) {
      console.log("Using cached database connection")
      return createDbInterface(cachedClient, cachedDb)
    }

    // Connect to MongoDB with improved options
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    })

    // Connect and store in cache
    await client.connect()
    const db = client.db("aivery")
    
    // Verify connection
    await db.command({ ping: 1 })
    console.log("Connected successfully to MongoDB server")
    
    // Cache the client and db connection
    cachedClient = client
    cachedDb = db

    return createDbInterface(client, db)
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error)
    return null
  }
}

// Create DB interface
function createDbInterface(client: MongoClient, db: any): DbClient {
  return {
    findWorkouts: async () => {
      return await db.collection("workouts").find().toArray()
    },
    findWorkoutById: async (id: string) => {
      return await db.collection("workouts").findOne({ _id: id })
    },
    insertWorkout: async (workout: any) => {
      const result = await db.collection("workouts").insertOne(workout)
      return { id: result.insertedId.toString() }
    },
    updateWorkout: async (id: string, workout: any) => {
      const result = await db.collection("workouts").updateOne({ _id: id }, { $set: workout })
      return result.modifiedCount > 0
    },
    deleteWorkout: async (id: string) => {
      const result = await db.collection("workouts").deleteOne({ _id: id })
      return result.deletedCount > 0
    },
    // Add more methods as needed
  }
}

// Create a mock client for when MongoDB is unavailable
function createMockClient(): DbClient {
  // Initialize with empty array - no need to map since mockData.workouts is empty
  let workouts: Array<{_id: string, [key: string]: any}> = [];
  console.warn("Using mock database client - no real database connection")

  return {
    findWorkouts: async () => {
      return workouts
    },
    findWorkoutById: async (id: string) => {
      return workouts.find((w) => w._id === id) || null
    },
    insertWorkout: async (workout: any) => {
      const id = Date.now().toString()
      workouts.push({ ...workout, _id: id })
      return { id }
    },
    updateWorkout: async (id: string, workout: any) => {
      const index = workouts.findIndex((w) => w._id === id)
      if (index === -1) return false
      workouts[index] = { ...workouts[index], ...workout }
      return true
    },
    deleteWorkout: async (id: string) => {
      const initialLength = workouts.length
      workouts = workouts.filter((w) => w._id !== id)
      return workouts.length < initialLength
    },
    // Add more methods as needed
  }
}

// Get a database client (real or mock)
export async function getDbClient(): Promise<DbClient> {
  try {
    const client = await createMongoClient()
    if (client) return client
    return createMockClient()
  } catch (error) {
    console.error("Error getting database client:", error)
    return createMockClient()
  }
}

// Check database connection
export async function checkDbConnection(): Promise<{
  connected: boolean
  message: string
  error?: string
  dbInfo?: any
}> {
  try {
    // Check if MongoDB URI is available
    if (!process.env.MONGODB_URI) {
      return {
        connected: false,
        message: "MONGODB_URI environment variable is not set",
      }
    }

    // Try to connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    })
    
    await client.connect()

    // Test database access
    const db = client.db("aivery")
    const result = await db.command({ ping: 1 })
    
    // Get database info
    const dbInfo = {
      version: await db.command({ buildInfo: 1 }).then(info => info.version),
      collections: await db.listCollections().toArray().then(cols => cols.map(c => c.name)),
      isReplica: await db.command({ isMaster: 1 }).then(info => !!info.setName)
    }

    // Close connection if not cached
    if (!cachedClient) {
      await client.close()
    }

    return {
      connected: true,
      message: "Successfully connected to MongoDB",
      dbInfo
    }
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error)
    return {
      connected: false,
      message: "Failed to connect to MongoDB",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

