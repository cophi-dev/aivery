import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db/mongoose"
import { Collection } from "mongodb"

export async function GET() {
  try {
    // Connect to MongoDB
    const db = await getDatabase()

    // Test connection by listing collections
    const collections = await db.listCollections().toArray()

    return NextResponse.json({
      status: "success",
      message: "MongoDB connection successful",
      collections: collections.map((collection: { name: string }) => collection.name),
    })
  } catch (error) {
    console.error("MongoDB connection error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "MongoDB connection failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

