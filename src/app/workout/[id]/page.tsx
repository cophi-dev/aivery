"use client"

import { useState, useEffect } from "react"
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
import { createWorkoutFromExisting, fetchWorkout } from "@/lib/workout-actions"
import { Header } from "@/components/header"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import { format } from "date-fns"

export default function WorkoutDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isCopying, setIsCopying] = useState(false)
  const [workout, setWorkout] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch real workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        setIsLoading(true)
        const workoutData = await fetchWorkout(params.id)
        
        if (workoutData) {
          setWorkout(workoutData)
        } else {
          console.error("Workout not found")
        }
      } catch (error) {
        console.error("Error loading workout:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id])

  // Function to copy workout to today and start it
  const handleStartWorkout = async () => {
    if (!workout) return

    try {
      setIsCopying(true)

      // Call the server action with the workout data
      const newWorkoutId = await createWorkoutFromExisting({
        ...workout,
        date: new Date(),
      })

      // Navigate to the workout session page
      router.push(`/workout/session/${newWorkoutId}`)
    } catch (error) {
      console.error("Failed to copy workout:", error)
      setIsCopying(false)
    }
  }

  if (isLoading) {
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
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-b pb-4">
                    <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-4"></div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="grid grid-cols-12 gap-2 py-2 border-t">
                          <div className="col-span-2 h-4 bg-gray-200 animate-pulse rounded"></div>
                          <div className="col-span-5 h-4 bg-gray-200 animate-pulse rounded"></div>
                          <div className="col-span-5 h-4 bg-gray-200 animate-pulse rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!workout) {
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
            <h1 className="text-3xl font-bold tracking-tight">Workout not found</h1>
          </div>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                The workout you are looking for could not be found or you don't have permission to view it.
              </p>
              <div className="flex justify-center mt-4">
                <Link href="/workouts">
                  <Button>View All Workouts</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const workoutDate = new Date(workout.date)
  const formattedDate = format(workoutDate, "MMMM d, yyyy")

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
          <h1 className="text-3xl font-bold tracking-tight">{workout.name || workout.type}</h1>
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
              <div className="text-2xl font-medium">{formattedDate}</div>
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
              <div className="text-2xl font-medium">{workout.duration} min</div>
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
              <div className="text-2xl font-medium">{workout.volume ? `${workout.volume} kg` : 'N/A'}</div>
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
                    <Link href={`/workout/edit/${workout._id}`}>
                      <Button variant="outline" size="sm">
                        <LucidePencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
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
                <CardDescription>{workout.exercises?.length || 0} exercises performed</CardDescription>
              </CardHeader>
              <CardContent>
                {workout.exercises && workout.exercises.length > 0 ? (
                  <div className="space-y-6">
                    {workout.exercises.map((exercise: any, index: number) => (
                      <div key={index} className="border-b pb-6 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">{exercise.name}</h3>
                          <div className="flex items-center">
                            <LucideDumbbell className="h-4 w-4 mr-1 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{exercise.sets?.length || 0} sets</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground mb-2">
                          <div className="col-span-2">Set</div>
                          <div className="col-span-5">Weight (kg)</div>
                          <div className="col-span-5">Reps</div>
                        </div>

                        {exercise.sets && exercise.sets.map((set: any, setIndex: number) => (
                          <div key={setIndex} className="grid grid-cols-12 gap-2 py-2 border-t">
                            <div className="col-span-2 font-medium">{setIndex + 1}</div>
                            <div className="col-span-5">{set.weight} kg</div>
                            <div className="col-span-5">{set.reps}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4">No exercise data available for this workout.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {workout.notes ? (
                  <p className="whitespace-pre-wrap">{workout.notes}</p>
                ) : (
                  <p className="text-muted-foreground">No notes for this workout.</p>
                )}
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

