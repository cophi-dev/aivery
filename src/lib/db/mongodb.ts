import mongoose from "mongoose"
import { MongoClient } from "mongodb"

// Clean up MONGODB_URI to ensure it doesn't have unwanted quotes
const MONGODB_URI = process.env.MONGODB_URI 
  ? process.env.MONGODB_URI.replace(/^["'](.*)["']$/, '$1')
  : undefined

if (!MONGODB_URI) {
  console.warn("Please define the MONGODB_URI environment variable")
}

// Log the connection string format for debugging (hide credentials)
const logUri = MONGODB_URI 
  ? MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') 
  : 'undefined'
console.log(`MongoDB URI format: ${logUri.substring(0, 15)}...`)

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

let cached: MongooseCache = (global as any).mongoose

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null }
}

let client: MongoClient | null = null

async function dbConnect() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    if (!MONGODB_URI || !MONGODB_URI.startsWith('mongodb')) {
      throw new Error(`Invalid MongoDB URI: ${MONGODB_URI?.substring(0, 10)}... 
        URI must start with mongodb:// or mongodb+srv://`)
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error('MongoDB connection error:', e)
    throw e
  }

  return cached.conn
}

export async function getDatabase() {
  if (!client) {
    if (!MONGODB_URI || !MONGODB_URI.startsWith('mongodb')) {
      throw new Error(`Invalid MongoDB URI: ${MONGODB_URI?.substring(0, 10)}... 
        URI must start with mongodb:// or mongodb+srv://`)
    }
    
    client = new MongoClient(MONGODB_URI)
  }
  
  try {
    await client.connect()
    return client.db()
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    throw error
  }
}

export async function getCollection(collectionName: string) {
  const db = await getDatabase()
  return db.collection(collectionName)
}

/**
 * Recursively converts MongoDB objects with toJSON method (like ObjectId)
 * to plain JavaScript objects or strings to avoid serialization issues
 * when passing to client components
 */
export function serializeMongoData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Convert ObjectId to string
  if (obj && obj.toString && (obj._bsontype === "ObjectID" || obj._bsontype === "ObjectId")) {
    return obj.toString();
  }
  
  // Handle buffer values (often in _id fields)
  if (obj && typeof obj === 'object' && obj.buffer && obj.buffer instanceof Buffer) {
    return obj.toString();
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle arrays by recursively processing each item
  if (Array.isArray(obj)) {
    return obj.map(item => serializeMongoData(item));
  }
  
  // Handle objects recursively
  if (typeof obj === 'object') {
    const serialized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeMongoData(obj[key]);
      }
    }
    return serialized;
  }
  
  // Return primitive values as is
  return obj;
}

export async function checkDatabaseConnection() {
  try {
    await dbConnect()
    return {
      status: "success",
      message: "Successfully connected to MongoDB",
      connected: true
    }
  } catch (error) {
    console.error("MongoDB connection error:", error)
    return {
      status: "error",
      message: "Failed to connect to MongoDB",
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export default dbConnect 