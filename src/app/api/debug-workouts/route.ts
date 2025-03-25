import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db/mongodb"

export async function GET() {
  try {
    const collection = await getCollection("aivery", "workouts")
    
    // Get all workouts
    const workouts = await collection.find({}).toArray()
    
    return NextResponse.json({
      success: true,
      count: workouts.length,
      workouts: workouts
    })
  } catch (error) {
    console.error("Error fetching debug workouts:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
} 