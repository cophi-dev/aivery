import { NextResponse } from "next/server"
import dbConnect from "@/lib/db/mongodb"
import UserModel from "@/lib/db/models/user"
import { getCollection } from "@/lib/db/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

// This endpoint will sync all workouts in the workouts collection with their respective users
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }
    
    // Connect to database
    await dbConnect()
    
    // Get all workouts
    const workoutsCollection = await getCollection("aivery", "workouts")
    const workouts = await workoutsCollection.find({}).toArray()
    
    // Group workouts by userId
    const workoutsByUser: Record<string, string[]> = {}
    workouts.forEach(workout => {
      const userId = workout.userId.toString()
      if (!workoutsByUser[userId]) {
        workoutsByUser[userId] = []
      }
      workoutsByUser[userId].push(workout._id.toString())
    })
    
    // Update each user with their workouts
    const updates = []
    for (const [userId, workoutIds] of Object.entries(workoutsByUser)) {
      updates.push(
        UserModel.findByIdAndUpdate(
          userId,
          { $addToSet: { workouts: { $each: workoutIds } } },
          { new: true }
        )
      )
    }
    
    const results = await Promise.allSettled(updates)
    const successful = results.filter(r => r.status === 'fulfilled').length
    
    return NextResponse.json({
      success: true,
      message: `Successfully synchronized workouts for ${successful} users`,
      totalUsers: Object.keys(workoutsByUser).length,
      totalWorkouts: workouts.length
    })
  } catch (error) {
    console.error("Error syncing user workouts:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 