import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.warn("Please define the MONGODB_URI environment variable")
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
    console.log('Using existing MongoDB connection')
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

    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined")
    }

    console.log('Creating new MongoDB connection pool')
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      mongoose.connection.on('error', err => {
        console.error('MongoDB connection error:', err)
      })
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected')
        // Clear the cache on disconnection
        cached.conn = null
        cached.promise = null
      })
      
      mongoose.connection.on('connected', () => {
        console.log('MongoDB connected successfully')
      })
      
      // Setup connection monitoring
      const monitorInterval = setInterval(() => {
        try {
          const mongoConnection = mongoose.connection;
          if (mongoConnection && mongoConnection.readyState === 1) {
            const db = mongoConnection.db as any;
            if (db?.serverConfig?.s?.pool) {
              const pool = db.serverConfig.s.pool;
              const numConnections = pool.totalConnectionCount || 0;
              const availableConnections = pool.availableConnectionCount || 0;
              console.log(`MongoDB pool - active: ${numConnections - availableConnections}, available: ${availableConnections}, total: ${numConnections}`);
            }
          }
        } catch (err) {
          // Silently handle monitoring errors
        }
      }, 60000);

      // Clear monitoring on disconnection
      mongoose.connection.on('disconnected', () => {
        clearInterval(monitorInterval);
      });
      
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

