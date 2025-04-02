import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env")
}

declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
  console.log('Connecting to MongoDB...');
  
  if (cached.conn) {
    console.log('Using cached MongoDB connection');
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: true,
    }

    console.log('Creating new MongoDB connection...');
    console.log('MongoDB URI:', MONGODB_URI!.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')); // Log URI with hidden credentials
    
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose
    })
  }
  
  try {
    cached.conn = await cached.promise
    console.log('MongoDB connection established');
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name);
  } catch (e) {
    console.error('MongoDB connection error:', e);
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect 