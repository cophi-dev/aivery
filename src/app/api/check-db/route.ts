import { NextResponse } from "next/server"
import { checkDatabaseConnection } from "@/lib/db/mongodb"

// Force dynamic execution, prevents static generation during build
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await checkDatabaseConnection()

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      environmentCheck: {
        nodeEnv: process.env.NODE_ENV || "not set",
      },
    })
  } catch (error) {
    console.error("Error checking database connection:", error)

    return NextResponse.json(
      {
        connected: false,
        message: "Error checking database connection",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        environmentCheck: {
          nodeEnv: process.env.NODE_ENV || "not set",
        },
      },
      { status: 500 },
    )
  }
}

