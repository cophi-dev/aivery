'use client'

import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { DatePicker } from "@/components/calendar/date-picker"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutCard } from "@/components/calendar/workout-card"
import { getWorkoutsForDate } from "@/app/actions/workout"

interface PageProps {
  searchParams: { date?: string }
}

interface Workout {
  id: string
  type: string
  duration: number
  distance?: number
  cardioDetails?: {
    distance?: number
    pace?: number
  }
  intensity: string
  date: Date
}

export default function CalendarPage({ searchParams }: PageProps) {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutDates, setWorkoutDates] = useState<Date[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const selectedDate = searchParams.date ? new Date(searchParams.date) : new Date()

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const data = await getWorkoutsForDate(selectedDate)
        setWorkouts(data.workouts)
        setWorkoutDates(data.workoutDates)
      } catch (error) {
        console.error('Error fetching workouts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedDate])

  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Plan and schedule your workouts</p>
        </div>
        <Button asChild>
          <Link href="/workout/new">+ New Workout</Link>
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Select a date to view or plan workouts</h2>
          <div className="border rounded-lg p-4 bg-card">
            <DatePicker 
              initialDate={selectedDate} 
              workoutDates={workoutDates}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Workouts for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
            </div>
          ) : workouts.length > 0 ? (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
              <p className="text-sm text-muted-foreground">
                {workouts.length} workout{workouts.length === 1 ? '' : 's'} scheduled
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No workouts scheduled for this date</p>
          )}
        </div>
      </div>
    </div>
  )
} 