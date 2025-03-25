"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  LucideArrowLeft,
  LucideClock,
  LucideDumbbell,
  FlameIcon as LucideFire,
  LucidePencil,
  LucideCalendarDays,
  LucideCopy,
} from "lucide-react"
import { createWorkoutFromExisting } from "@/lib/workout-actions"
import { Header } from "@/components/header"
import { WorkoutAnalysis } from "@/components/workout-analysis"

export default function WorkoutDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isCopying, setIsCopying] = useState(false)

  // Mock data for a workout
  const workout = {
    id: params.id,
    name: "Upper Body",
    date: "June 8, 2025",
    duration: "65 min",
    intensity: "High",
    volume: "3,240 kg",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 8 },
          { weight: 90, reps: 6 },
          { weight: 85, reps: 8 },
        ],
      },
      {
        name: "Incline Dumbbell Press",
        sets: [
          { weight: 30, reps: 12 },
          { weight: 32, reps: 10 },
          { weight: 34, reps: 8 },
        ],
      },
      {
        name: "Lat Pulldown",
        sets: [
          { weight: 70, reps: 12 },
          { weight: 75, reps: 10 },
          { weight: 80, reps: 8 },
        ],
      },
      {
        name: "Seated Cable Row",
        sets: [
          { weight: 65, reps: 12 },
          { weight: 70, reps: 10 },
          { weight: 75, reps: 8 },
        ],
      },
      {
        name: "Shoulder Press",
        sets: [
          { weight: 60, reps: 10 },
          { weight: 65, reps: 8 },
          { weight: 70, reps: 6 },
        ],
      },
      {
        name: "Lateral Raises",
        sets: [
          { weight: 12, reps: 15 },
          { weight: 14, reps: 12 },
          { weight: 16, reps: 10 },
        ],
      },
      {
        name: "Bicep Curls",
        sets: [
          { weight: 20, reps: 12 },
          { weight: 22, reps: 10 },
          { weight: 24, reps: 8 },
        ],
      },
      {
        name: "Tricep Pushdowns",
        sets: [
          { weight: 25, reps: 12 },
          { weight: 30, reps: 10 },
          { weight: 35, reps: 8 },
        ],
      },
    ],
    notes: "Felt strong today. Increased weight on bench press and hit a new PR.",
  }

  // Function to copy workout to today and start it
  const handleStartWorkout = async () => {
    try {
      setIsCopying(true)

      // Since we're using mock data in this component, create a copy directly
      // This is a workaround for the demo - in a real app, you'd use the server action
      const workoutData = {
        name: workout.name,
        date: new Date(),
        duration: Number.parseInt(workout.duration),
        intensity: workout.intensity,
        volume: Number.parseInt(workout.volume.replace(/,/g, "")),
        exercises: workout.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
        })),
        notes: workout.notes,
      }

      // Call the server action with the workout data
      const newWorkoutId = await createWorkoutFromExisting(workoutData)

      // Navigate to the workout session page
      router.push(`/workout/session/${newWorkoutId}`)
    } catch (error) {
      console.error("Failed to copy workout:", error)
      setIsCopying(false)
    }
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/workouts">
            <Button variant="ghost" size="sm" className="mr-4">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
          <Badge className="ml-4">{workout.intensity}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <LucideCalendarDays className="h-5 w-5 mr-2 text-primary" />
                Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{workout.date}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <LucideClock className="h-5 w-5 mr-2 text-primary" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{workout.duration}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <LucideFire className="h-5 w-5 mr-2 text-primary" />
                Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{workout.volume}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Exercises</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <LucidePencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" onClick={handleStartWorkout} disabled={isCopying}>
                      {isCopying ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Copying...
                        </>
                      ) : (
                        <>
                          <LucideCopy className="h-4 w-4 mr-2" />
                          Start Today
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription>{workout.exercises.length} exercises performed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {workout.exercises.map((exercise, index) => (
                    <div key={index} className="border-b pb-6 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{exercise.name}</h3>
                        <div className="flex items-center">
                          <LucideDumbbell className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{exercise.sets.length} sets</span>
                        </div>
                      </div>

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
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{workout.notes}</p>
              </CardContent>
            </Card>
          </div>

          <div>
            <WorkoutAnalysis
              workout={{
                _id: workout.id,
                userId: "user123", // This should be replaced with actual user ID
                type: "strength",
                name: workout.name,
                date: new Date(workout.date),
                duration: Number(workout.duration),
                intensity: workout.intensity,
                volume: Number(workout.volume),
                exercises: workout.exercises.map(exercise => ({
                  name: exercise.name,
                  sets: exercise.sets.length,
                  reps: exercise.sets[0]?.reps || 0,
                  weight: exercise.sets[0]?.weight || 0,
                  notes: ""
                })),
                notes: workout.notes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

