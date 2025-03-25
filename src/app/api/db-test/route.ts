import { NextResponse } from "next/server"
import clientPromise from "@/lib/db/mongodb"

export async function GET() {
  try {
    // Connect to MongoDB
    const client = await clientPromise

    // Test connection by listing databases
    const dbList = await client.db().admin().listDatabases()

    return NextResponse.json({
      status: "success",
      message: "MongoDB connection successful",
      databases: dbList.databases.map((db) => db.name),
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

