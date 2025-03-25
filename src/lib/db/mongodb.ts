import { MongoClient, ServerApiVersion } from "mongodb"

// Connection URI
const uri = process.env.MONGODB_URI

// Connection options
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
}

// Global variable to cache the MongoDB client
let client: MongoClient
let clientPromise: Promise<MongoClient>

// Function to validate MongoDB URI
function validateMongoURI(uri: string | undefined): boolean {
  if (!uri) return false

  // Basic validation - check if it starts with mongodb:// or mongodb+srv://
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://")
}

// Create a mock client for development without MongoDB
function createMockClient() {
  console.warn("Using mock MongoDB client because MONGODB_URI is not set or invalid")

  // Create a minimal mock client that won't throw errors
  const mockDb = {
    collection: () => ({
      find: () => ({
        toArray: async () => [],
        sort: () => ({
          limit: () => ({ toArray: async () => [] }),
          skip: () => ({ limit: () => ({ toArray: async () => [] }) }),
        }),
      }),
      findOne: async () => null,
      insertOne: async () => ({ insertedId: "mock-id" }),
      insertMany: async () => ({ insertedCount: 0 }),
      updateOne: async () => ({ modifiedCount: 0 }),
      findOneAndUpdate: async () => null,
      deleteOne: async () => ({ deletedCount: 0 }),
      countDocuments: async () => 0,
      aggregate: () => ({ toArray: async () => [] }),
    }),
    admin: () => ({
      command: async () => ({ ok: 1 }),
      listDatabases: async () => ({ databases: [] }),
    }),
    createCollection: async () => ({}),
    listCollections: () => ({
      toArray: async () => [],
    }),
  }

  return {
    db: () => mockDb,
    connect: async () => ({ db: () => mockDb }),
  } as unknown as MongoClient
}

try {
  if (!validateMongoURI(uri)) {
    // Use mock client if URI is invalid
    client = createMockClient()
    clientPromise = Promise.resolve(client)
  } else {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (process.env.NODE_ENV === "development") {
      // @ts-ignore
      if (!global._mongoClientPromise) {
        client = new MongoClient(uri!, options)
        // @ts-ignore
        global._mongoClientPromise = client.connect()
      }
      // @ts-ignore
      clientPromise = global._mongoClientPromise
    } else {
      // In production mode, it's best to not use a global variable.
      client = new MongoClient(uri!, options)
      clientPromise = client.connect()
    }
  }
} catch (error) {
  console.error("Error setting up MongoDB client:", error)
  client = createMockClient()
  clientPromise = Promise.resolve(client)
}

// Export a module-scoped MongoClient promise
export default clientPromise

// Helper function to get a database
export async function getDatabase(dbName = "aivery") {
  try {
    const client = await clientPromise
    return client.db(dbName)
  } catch (error) {
    console.error("Error getting database:", error)
    // Return a mock database that won't throw errors
    return createMockClient().db(dbName)
  }
}

// Helper function to get a collection
export async function getCollection(dbName: string, collectionName: string) {
  try {
    const db = await getDatabase(dbName)
    return db.collection(collectionName)
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error)
    // Return a mock collection that won't throw errors
    return createMockClient().db(dbName).collection(collectionName)
  }
}

// Function to check database connection
export async function checkDatabaseConnection() {
  try {
    if (!validateMongoURI(uri)) {
      return {
        connected: false,
        message: "Invalid MongoDB URI format",
        details: "The MONGODB_URI environment variable is not properly formatted",
      }
    }

    const client = await clientPromise
    const adminDb = client.db().admin()

    // Run a simple command to verify connection
    await adminDb.command({ ping: 1 })

    return {
      connected: true,
      message: "Successfully connected to MongoDB",
    }
  } catch (error) {
    console.error("Database connection error:", error)
    return {
      connected: false,
      message: "Failed to connect to MongoDB",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

