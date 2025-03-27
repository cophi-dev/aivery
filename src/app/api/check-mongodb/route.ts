import { NextResponse } from "next/server"
import dbConnect from "@/lib/db/mongodb"

export async function GET() {
  try {
    // Test database connection
    const mongoose = await dbConnect()
    const connectionState = mongoose.connection.readyState
    
    // Connection states: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const stateMap = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting"
    }
    
    // Check if MONGODB_URI is set
    const mongoUri = process.env.MONGODB_URI
    const hasUriConfig = !!mongoUri
    
    // Return connection state and basic info
    return NextResponse.json({
      status: "success",
      connection: {
        state: connectionState,
        stateText: stateMap[connectionState as keyof typeof stateMap] || "unknown",
        hasConfig: hasUriConfig,
        uri: hasUriConfig ? mongoUri!.substring(0, mongoUri!.indexOf('?') > 0 ? mongoUri!.indexOf('?') : 15) + '...' : null,
      }
    })
  } catch (error) {
    console.error("MongoDB connection check failed:", error)
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: process.env.NODE_ENV === "development" ? error instanceof Error ? error.stack : null : null
    }, { status: 500 })
  }
} 