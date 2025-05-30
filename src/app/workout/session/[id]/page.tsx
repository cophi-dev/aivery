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
  Share2,
  Trophy,
  Sparkles,
} from "lucide-react"
import { fetchWorkout, markWorkoutComplete } from "@/lib/workout-actions"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import { ShareModal } from "@/components/workout/ShareModal"
import { ShareCard } from "@/components/workout/ShareCard"
import type { WorkoutData, ExerciseData, Set, WorkoutExerciseData } from "@/types/db"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { generateDistanceComparisonText } from "@/lib/workout-distance-comparisons"
import { motion } from "framer-motion"

export default function WorkoutSessionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedExercises, setCompletedExercises] = useState<Record<number, boolean>>({})
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [showCompletionCard, setShowCompletionCard] = useState(false)
  const [workoutInsight, setWorkoutInsight] = useState<string>("")

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

  // Generate workout insight based on workout data
  const generateWorkoutInsight = (workout: WorkoutData, elapsedTimeSeconds: number) => {
    const insights = []

    // Distance-based insights
    if (workout.cardioDetails?.distance && workout.cardioDetails.distance > 0) {
      const comparison = generateDistanceComparisonText(workout.cardioDetails.distance)
      if (comparison) {
        insights.push(comparison)
      } else {
        if (workout.cardioDetails.distance >= 10) {
          insights.push(`Amazing ${workout.type}! You covered ${workout.cardioDetails.distance.toFixed(1)}km - that's like running across a city! 🏃‍♂️`)
        } else if (workout.cardioDetails.distance >= 5) {
          insights.push(`Great ${workout.type} session! ${workout.cardioDetails.distance.toFixed(1)}km is solid endurance building! 💪`)
        } else {
          insights.push(`Nice ${workout.type}! Every kilometer counts towards your fitness goals! ✨`)
        }
      }
    }

    // Volume-based insights (strength training)
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      const volumeInTons = (workout.calculatedVolume / 1000).toFixed(1)
      if (workout.calculatedVolume >= 5000) {
        insights.push(`Incredible strength session! You moved ${volumeInTons} tons - that's like lifting a car! 🚗💪`)
      } else if (workout.calculatedVolume >= 2000) {
        insights.push(`Solid strength work! ${volumeInTons} tons moved is serious muscle building! 💪`)
      } else {
        insights.push(`Great strength session! ${volumeInTons} tons total volume - building that foundation! 🏗️`)
      }
    }

    // Duration-based insights
    const durationMinutes = Math.round(elapsedTimeSeconds / 60)
    if (durationMinutes >= 60) {
      insights.push(`Epic ${durationMinutes}-minute session! Your dedication is next level! 🔥`)
    } else if (durationMinutes >= 30) {
      insights.push(`Solid ${durationMinutes}-minute workout! Building consistency! 📈`)
    } else if (durationMinutes >= 15) {
      insights.push(`Efficient ${durationMinutes}-minute session! Quality over quantity! ⚡`)
    }

    // Exercise count insights
    const exerciseCount = workout.workoutExercises?.length || 0
    if (exerciseCount >= 8) {
      insights.push(`Comprehensive workout with ${exerciseCount} exercises! Full-body power! 💥`)
    } else if (exerciseCount >= 5) {
      insights.push(`Well-rounded session with ${exerciseCount} exercises! Great variety! 🎯`)
    }

    // Default motivation if no specific insights
    if (insights.length === 0) {
      insights.push(`Another step forward in your fitness journey! Every workout counts! 🌟`)
    }

    return insights[0] // Return the first (most relevant) insight
  }

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
      setIsTimerRunning(false) // Stop the timer
      
      const result = await markWorkoutComplete(workout._id, {
        duration: Math.round(elapsedTime / 60), // Convert seconds to minutes
      })
      
      if (result.success && result.workout) {
        // Update local state to reflect completion
        const updatedWorkout = {
          ...result.workout,
          // Ensure we have the current elapsed time data
          duration: elapsedTime
        }
        setWorkout(updatedWorkout)
        
        // Generate workout insight
        const insight = generateWorkoutInsight(updatedWorkout, elapsedTime)
        setWorkoutInsight(insight)
        
        // Show completion animation and then share modal
        setShowCompletionCard(true)
        toast.success("🎉 Workout completed! Great job!")
        
        // Show share modal after a short delay
        setTimeout(() => {
          setIsShareModalOpen(true)
        }, 2000)
        
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
      {showCompletionCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCompletionCard(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.4, damping: 25 }}
            className="bg-background/95 backdrop-blur-sm border border-border/20 rounded-lg shadow-lg max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", duration: 0.5 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-100/80 to-green-100/80 dark:from-emerald-900/40 dark:to-green-900/40 flex items-center justify-center border border-emerald-200/30 dark:border-emerald-700/30"
            >
              <LucideCheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-medium text-foreground/90 mb-2">
                Workout Complete
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Great job! You've finished your {workout?.type} session.
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowCompletionCard(false);
                    setIsShareModalOpen(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 text-sm"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  onClick={() => setShowCompletionCard(false)}
                  variant="outline"
                  className="flex-1 text-sm"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
      {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          workout={{
            id: workout._id,
            type: workout.type,
            date: new Date(workout.date),
            duration: elapsedTime, // Use elapsed time in seconds
            distance: workout.cardioDetails?.distance,
            calculatedVolume: workout.calculatedVolume,
            name: workout.name
          }}
          insight={workoutInsight}
        />
      )}
    </>
  )
}

