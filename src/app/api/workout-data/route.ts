import { NextResponse } from "next/server"
import { fetchUserWorkouts, getWorkoutStats } from "@/lib/actions"

// This endpoint will be used by the AI to fetch workout data
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // In a real app, you would get the user ID from the session
    const userId = "user123"

    // Get the workout data
    const workouts = await fetchUserWorkouts(userId)
    const stats = await getWorkoutStats(userId)

    return NextResponse.json({ workouts, stats })
  } catch (error) {
    console.error("Error fetching workout data:", error)
    return NextResponse.json({ error: "Failed to fetch workout data" }, { status: 500 })
  }
}

