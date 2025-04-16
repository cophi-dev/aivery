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
  LucidePlay,
  LucidePause,
} from "lucide-react"
import { fetchWorkout, markWorkoutComplete } from "@/lib/workout-actions"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import type { WorkoutData, ExerciseData, Set, WorkoutExerciseData } from "@/types/db"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

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
        if (data) {
          setWorkout(data)
          // Initialize all exercises as not completed
          const initialCompletedState: Record<number, boolean> = {}
          data.workoutExercises?.forEach((exercise: WorkoutExerciseData, index: number) => {
            initialCompletedState[index] = false
          })
          setCompletedExercises(initialCompletedState)
        } else {
          // Handle case where workout is not found
          console.error("Workout not found")
          router.push("/workouts") // Redirect to workouts list
        }
      } catch (error) {
        console.error("Failed to load workout:", error)
        router.push("/workouts") // Redirect to workouts list on error
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id, router])

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

  // Format time helper
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Toggle exercise completion
  const toggleExerciseCompletion = (index: number) => {
    if (!workout) return
    setCompletedExercises(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  // Calculate progress
  const calculateProgress = () => {
    if (!workout?.workoutExercises) return 0
    const totalExercises = workout.workoutExercises.length
    if (totalExercises === 0) return 0
    const completedCount = Object.values(completedExercises).filter(Boolean).length
    return (completedCount / totalExercises) * 100
  }

  // Handle workout completion
  const handleCompleteWorkout = async () => {
    if (!workout) return

    try {
      setIsCompleting(true)
      const result = await markWorkoutComplete(workout._id, {
        duration: Math.round(elapsedTime / 60), // Convert seconds to minutes
      })
      
      if (result.success && result.workout) {
        // Update local state to reflect completion
        setWorkout(result.workout)
        setIsCompleting(false)
        toast.success("Workout marked as complete!")
      } else {
        console.error("Failed to complete workout:", result.error)
        toast.error(`Error: ${result.error || 'Failed to complete workout.'}`)
      }
    } catch (error) {
      console.error("Error completing workout:", error)
      toast.error("An unexpected error occurred while completing the workout.")
    } finally {
      setIsCompleting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return <LoadingIndicator />
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
              <Link href="/workouts">Back to Workouts</Link>
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
              <CardContent className="space-y-4">
                {(workout.workoutExercises || []).map((exercise: WorkoutExerciseData, index: number) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`exercise-${index}`}
                          checked={completedExercises[index]}
                          onCheckedChange={() => toggleExerciseCompletion(index)}
                        />
                        <Label htmlFor={`exercise-${index}`} className="text-lg">
                          {exercise.exerciseId.name}
                        </Label>
                      </div>
                      <Badge variant={completedExercises[index] ? "default" : "secondary"}>
                        {completedExercises[index] ? "Completed" : "Pending"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {(exercise.sets || []).map((set: Set, setIndex: number) => (
                        <div key={setIndex} className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label>Weight (kg)</Label>
                            <div className="text-lg font-medium">{set.weight ?? 'N/A'}</div>
                          </div>
                          <div className="flex-1">
                            <Label>Reps</Label>
                            <div className="text-lg font-medium">{set.reps ?? 'N/A'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {completedExercises[index] ? (
                              <LucideCheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <LucideDumbbell className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

