"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Header } from "@/components/header"
import {
  LucideArrowLeft,
  LucideClock,
  LucideDumbbell,
  LucideCheck,
  LucideX,
  LucideTimer,
  LucideCheckCircle,
} from "lucide-react"
import { fetchWorkout, completeWorkout } from "@/lib/workout-actions"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import type { WorkoutData } from "@/types/db"

export default function WorkoutSessionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedExercises, setCompletedExercises] = useState<Record<number, boolean>>({})
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        const data = await fetchWorkout(params.id)
        setWorkout(data)

        // Initialize all exercises as not completed
        const initialCompletedState: Record<number, boolean> = {}
        data.exercises.forEach((_, index) => {
          initialCompletedState[index] = false
        })
        setCompletedExercises(initialCompletedState)
      } catch (error) {
        console.error("Failed to load workout:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning])

  // Format time (seconds to MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Toggle exercise completion
  const toggleExerciseCompletion = (index: number) => {
    setCompletedExercises((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!workout) return 0
    const totalExercises = workout.exercises.length
    if (totalExercises === 0) return 100

    const completedCount = Object.values(completedExercises).filter(Boolean).length
    return Math.round((completedCount / totalExercises) * 100)
  }

  // Complete workout
  const handleCompleteWorkout = async () => {
    if (!workout) return

    try {
      setIsCompleting(true)

      // Update workout with completion data
      await completeWorkout(workout.id, {
        duration: Math.round(elapsedTime / 60), // Convert seconds to minutes
        completedExercises: Object.entries(completedExercises).map(([index, completed]) => ({
          index: Number.parseInt(index),
          completed,
        })),
      })

      router.push(`/workout/${workout.id}?completed=true`)
    } catch (error) {
      console.error("Failed to complete workout:", error)
      setIsCompleting(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </>
    )
  }

  if (!workout) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Workout not found</h1>
            <p className="mt-2 text-muted-foreground">
              The workout you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild className="mt-4">
              <Link href="/planner">Back to Planner</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href={`/workout/${params.id}`}>
              <Button variant="ghost" size="sm" className="mr-4">
                <LucideArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
            <Badge className="ml-4">{workout.intensity}</Badge>
          </div>
          <Button
            variant={isTimerRunning ? "outline" : "default"}
            size="sm"
            onClick={() => setIsTimerRunning(!isTimerRunning)}
          >
            <LucideTimer className="h-4 w-4 mr-2" />
            {isTimerRunning ? "Pause Timer" : "Resume Timer"}
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <LucideClock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Elapsed Time</p>
                  <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <LucideDumbbell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <div className="flex items-center gap-2">
                    <Progress value={calculateProgress()} className="w-32 h-2" />
                    <span className="text-sm font-medium">{calculateProgress()}%</span>
                  </div>
                </div>
              </div>

              <Button onClick={handleCompleteWorkout} disabled={isCompleting} className="w-full md:w-auto">
                {isCompleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing...
                  </>
                ) : (
                  <>
                    <LucideCheckCircle className="h-4 w-4 mr-2" />
                    Complete Workout
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Exercise Checklist</CardTitle>
                <CardDescription>Check off exercises as you complete them</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {workout.exercises.map((exercise, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`exercise-${index}`}
                            checked={completedExercises[index]}
                            onCheckedChange={() => toggleExerciseCompletion(index)}
                          />
                          <label
                            htmlFor={`exercise-${index}`}
                            className={`text-lg font-semibold ${completedExercises[index] ? "line-through text-muted-foreground" : ""}`}
                          >
                            {exercise.name}
                          </label>
                        </div>
                        <Badge variant={completedExercises[index] ? "default" : "outline"}>
                          {completedExercises[index] ? (
                            <LucideCheck className="h-3 w-3 mr-1" />
                          ) : (
                            <LucideX className="h-3 w-3 mr-1" />
                          )}
                          {completedExercises[index] ? "Completed" : "Pending"}
                        </Badge>
                      </div>

                      <Separator className="my-2" />

                      <div className="mt-3">
                        <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground mb-2">
                          <div className="col-span-2">Set</div>
                          <div className="col-span-5">Weight (kg)</div>
                          <div className="col-span-5">Reps</div>
                        </div>

                        {exercise.sets.map((set, setIndex) => (
                          <div key={setIndex} className="grid grid-cols-12 gap-2 py-2 border-t">
                            <div className="col-span-2 font-medium">{setIndex + 1}</div>
                            <div className="col-span-5">{set.weight} kg</div>
                            <div className="col-span-5">{set.reps}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <WorkoutAnalysis workout={workout} />
          </div>
        </div>
      </div>
    </>
  )
}

