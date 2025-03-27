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

// Initialize the MongoDB connection promise
if (!global.mongoose) {
  try {
    if (!uri) {
      console.warn("MONGODB_URI not set, will use mock client");
      global.mongoose = { conn: null, promise: null };
    } else {
      global.mongoose = { conn: null, promise: null };
      // Don't try to connect immediately, wait for the first request
    }
  } catch (error) {
    console.error("Error initializing MongoDB connection:", error);
    global.mongoose = { conn: null, promise: null };
  }
}

async function dbConnect() {
  try {
    if (global.mongoose.conn) {
      return global.mongoose.conn;
    }

    if (!global.mongoose.promise) {
      const opts = {
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 5,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        family: 4,
      };

      // Check if we have a valid MongoDB URI
      if (!uri || !validateMongoURI(uri)) {
        console.warn("Invalid MONGODB_URI, falling back to mock client");
        return null;
      }

      console.log('Creating new MongoDB connection pool');
      global.mongoose.promise = MongoClient.connect(uri, opts)
        .then((mongoClient) => {
          console.log('MongoDB connected successfully');
          return mongoClient;
        })
        .catch((error) => {
          console.error("MongoDB connection error:", error);
          global.mongoose.promise = null;
          return null;
        });
    }

    try {
      global.mongoose.conn = await global.mongoose.promise;
      return global.mongoose.conn;
    } catch (e) {
      console.error("Error awaiting MongoDB connection:", e);
      global.mongoose.promise = null;
      return null;
    }
  } catch (outerError) {
    console.error("Unexpected error in dbConnect:", outerError);
    return null;
  }
}

// Export a module-scoped MongoClient promise
export default dbConnect()

// Helper function to get a database
export async function getDatabase(dbName = "aivery") {
  try {
    const client = await dbConnect()
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
    // Wrap in try-catch to gracefully handle errors
    try {
      const db = await getDatabase(dbName)
      // Check if db is valid and has collections method
      if (!db) {
        console.error(`Database ${dbName} not available, using mock collection`);
        return createMockClient().db(dbName).collection(collectionName);
      }
      return db.collection(collectionName)
    } catch (error) {
      console.error(`Error getting collection ${collectionName}:`, error)
      return createMockClient().db(dbName).collection(collectionName)
    }
  } catch (outerError) {
    // Fallback to mock in case of any unexpected errors
    console.error(`Unexpected error getting collection ${collectionName}:`, outerError)
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

    const client = await dbConnect()
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

