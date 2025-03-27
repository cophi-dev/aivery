'use server'

import { getWorkoutsByDate, getWorkoutDatesForMonth } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ObjectId } from "mongodb"

interface Workout {
  _id: ObjectId
  type: string
  duration: number
  distance?: number
  cardioDetails?: any
  intensity: string
  date: Date
}

export async function getWorkoutsForDate(date: Date) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { workouts: [], workoutDates: [] }
  }

  const [workouts, workoutDates] = await Promise.all([
    getWorkoutsByDate(session.user.id, date),
    getWorkoutDatesForMonth(session.user.id, date)
  ])

  return {
    workouts: (workouts as unknown as Workout[]).map(workout => ({
      id: workout._id.toString(),
      type: workout.type,
      duration: workout.duration,
      distance: workout.distance,
      cardioDetails: workout.cardioDetails,
      intensity: workout.intensity,
      date: workout.date
    })),
    workoutDates
  }
} 