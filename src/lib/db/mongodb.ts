import mongoose from "mongoose"
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.warn("Please define the MONGODB_URI environment variable")
}

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

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export async function getCollection(collectionName: string) {
  if (!client) {
    client = new MongoClient(MONGODB_URI!)
  }
  
  try {
    await client.connect()
    const db = client.db()
    return db.collection(collectionName)
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    throw error
  }
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