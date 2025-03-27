import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable")
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongoose: MongooseCache | undefined
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4,
    }

    console.log('Creating new MongoDB connection pool')
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      mongoose.connection.on('error', err => {
        console.error('MongoDB connection error:', err)
      })
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected')
      })
      
      mongoose.connection.on('connected', () => {
        console.log('MongoDB connected successfully')
      })
      
      // Setup connection monitoring
      setInterval(() => {
        try {
          // Use any type to bypass TypeScript's strict type checking for MongoDB internals
          const mongoConnection = mongoose.connection as any;
          const pool = mongoConnection?.db?.serverConfig?.s?.pool;
          
          if (pool) {
            const numConnections = pool.totalConnectionCount || 0;
            const availableConnections = pool.availableConnectionCount || 0;
            console.log(`MongoDB connections - active: ${numConnections - availableConnections}, available: ${availableConnections}, total: ${numConnections}`);
          } else {
            console.log('MongoDB connection pool information not available');
          }
        } catch (err) {
          console.error('Error monitoring MongoDB connections:', err);
        }
      }, 60000); // Log every minute
      
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

export default dbConnect

