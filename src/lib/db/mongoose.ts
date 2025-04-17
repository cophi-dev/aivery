import mongoose, { Mongoose } from "mongoose"

// Remove top-level check
// const MONGODB_URI = process.env.MONGODB_URI
// if (!MONGODB_URI) {
//   throw new Error("Please define the MONGODB_URI environment variable inside .env")
// }

// Define an interface for the mongoose cache
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // Use the interface for the global variable
  var mongooseCache: MongooseCache | undefined;
}

// Use the interface for the cached variable
let cached: MongooseCache | undefined = global.mongooseCache

// Remove initialization from module scope
// if (!cached) {
//   cached = global.mongooseCache = { conn: null, promise: null }
// }

async function dbConnect(): Promise<Mongoose> {
  // Initialize cache inside the function if needed
  if (!cached) {
    console.log("Initializing Mongoose cache...");
    cached = global.mongooseCache = { conn: null, promise: null };
  }

  // Add check inside the function
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment variables.");
    throw new Error("Please define the MONGODB_URI environment variable.");
  }
  
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
    // Use the MONGODB_URI fetched inside the function
    console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')); 
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('MongoDB connected successfully');
      return mongooseInstance
    })
  }
  
  try {
    cached.conn = await cached.promise
    console.log('MongoDB connection established');
    if (cached.conn) {
        console.log('Connection state:', cached.conn.connection.readyState);
        console.log('Database name:', cached.conn.connection.name);
    }
  } catch (e) {
    console.error('MongoDB connection error:', e);
    cached.promise = null
    throw e
  }

  if (!cached.conn) {
    throw new Error("Failed to establish MongoDB connection after awaiting promise.");
  }

  return cached.conn
}

export default dbConnect 