"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideChevronRight } from "lucide-react"
import { fetchWorkouts } from "@/lib/workout-actions"
import { format } from "date-fns"
import type { WorkoutData } from "@/types/db"

export default function RecentWorkouts() {
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        const data = await fetchWorkouts()
        setWorkouts(data)
      } catch (error) {
        console.error("Failed to load workouts:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkouts()
  }, [])

  // Sort workouts by date (newest first) and take the 3 most recent
  const recentWorkouts = [...workouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  const formatDate = (date: Date) => {
    const now = new Date()
    const workoutDate = new Date(date)
    const diffTime = Math.abs(now.getTime() - workoutDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return format(workoutDate, "MMM d, yyyy")
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Workouts</CardTitle>
          <CardDescription>Your latest training sessions</CardDescription>
        </div>
        <Link href="/workouts">
          <Button variant="outline" size="sm">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Loading...</div>
        ) : recentWorkouts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No workouts found</p>
            <Link href="/workout/new">
              <Button variant="outline" size="sm" className="mt-2">
                Create Workout
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentWorkouts.map((workout) => (
              <div key={workout._id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{workout.name}</h3>
                    <Badge
                      variant={
                        workout.intensity === "High"
                          ? "default"
                          : workout.intensity === "Medium"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {workout.intensity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(workout.date)} • {workout.duration} min
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {workout.exercises?.slice(0, 4).map((exercise, i) => (
                      <Badge key={i} variant="outline" className="font-normal">
                        {exercise.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Link href={`/workout/${workout._id}`}>
                  <Button variant="ghost" size="icon">
                    <LucideChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

