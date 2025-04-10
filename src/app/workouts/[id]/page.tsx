"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LucideArrowLeft,
  LucideClock,
  LucideRuler,
  LucideHeartPulse,
  LucideActivity,
  LucideCalendarDays,
  LucidePencil,
  LucideTrash,
  LucideMapPin,
  LucideZap,
  LucideDumbbell,
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"

export default function ActivityDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Extract id directly since we're in a client component
  const { id } = params

  // Load workout data
  useEffect(() => {
    console.log("=======================================");
    console.log("CLIENT-SIDE: useEffect for ActivityDetailPage START");
    console.log(`CLIENT-SIDE: ID Parameter = ${id}`);
    console.log("=======================================");
    
    const loadWorkout = async () => {
      setIsLoading(true); 
      try {
        const data = await fetchWorkout(id)
        console.log('>>> Fetched workout data (should be plain object):', data);
        setWorkout(data)
      } catch (error) {
        console.error(">>> ERROR fetching workout:", error);
        setWorkout(null); 
      } finally {
        setIsLoading(false)
      }
    }

    if (id) { 
        loadWorkout()
    } else {
        console.log('>>> CLIENT-SIDE: ID missing, skipping loadWorkout');
        setIsLoading(false); 
    }
  }, [id])

  // Handle delete
  const handleDelete = async () => {
    if (!workout) return

    if (!confirm("Are you sure you want to delete this activity?")) return

    try {
      setIsDeleting(true)
      await deleteWorkout(workout._id)
      router.push("/planner")
    } catch (error) {
      console.error("Failed to delete workout:", error)
      setIsDeleting(false)
    }
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    const secs = Math.round((minutes % 1) * 60)

    return `${hours > 0 ? `${hours}h ` : ""}${mins}m${secs > 0 ? ` ${secs}s` : ""}`
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Activity not found</h1>
          <p className="mt-2 text-muted-foreground">
            The activity you're looking for doesn't exist or has been deleted.
          </p>
          <Button asChild className="mt-4">
            <Link href="/planner">Back to Planner</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/planner">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
          <div className="flex items-center mt-1">
            <Badge className="mr-2">{workout.type}</Badge>
            <Badge
              variant={
                workout.intensity === "High" ? "default" : workout.intensity === "Medium" ? "secondary" : "outline"
              }
            >
              {workout.intensity}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/workouts/${workout._id}/edit`)}
              >
                <LucidePencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            ) : (
              <LucideTrash className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
        </div>
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
            <div className="text-2xl font-medium">{formatDate(workout.date)}</div>
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
            <div className="text-2xl font-medium">{formatDuration(workout.duration)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <LucideRuler className="h-5 w-5 mr-2 text-primary" />
              Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">
              {workout.distance ? 
                `${workout.distance} km` : 
                (workout.cardioDetails?.distance ? 
                  `${workout.cardioDetails.distance} km` : 
                  "N/A")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Display Workout Exercises (Simplified) --- */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <LucideDumbbell className="h-5 w-5 mr-2 text-primary" />
            Exercises Performed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
            <ul className="space-y-4"> {/* Use a simple list */} 
              {workout.workoutExercises.map((exerciseDetail: any, index: number) => (
                <li key={exerciseDetail.exerciseId?._id || index} className="border-b pb-4 last:border-b-0">
                  <h3 className="text-lg font-medium mb-2">
                    {index + 1}. {exerciseDetail.exerciseId?.name || 'Unknown Exercise'}
                  </h3>
                  <div className="space-y-2 pl-4">
                    {/* Display Sets for Strength */}
                    {exerciseDetail.sets && exerciseDetail.sets.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-1">Sets:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          {exerciseDetail.sets.map((set: any, setIndex: number) => (
                            <li key={setIndex}>
                              Set {setIndex + 1}: 
                              {set.weight !== undefined ? ` ${set.weight}kg` : ''}
                              {set.reps !== undefined ? ` x ${set.reps} reps` : ''}
                              {set.duration !== undefined ? ` for ${set.duration}s` : ''}
                              {set.distance !== undefined ? ` for ${set.distance}m` : ''}
                              {set.notes ? ` (${set.notes})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Display Metrics for Cardio/Other */}
                    {exerciseDetail.duration !== undefined && exerciseDetail.duration > 0 && (!exerciseDetail.sets || exerciseDetail.sets.length === 0) && (
                      <div>
                        <h4 className="font-semibold mb-1">Performance:</h4>
                        <p className="text-sm text-muted-foreground">Duration: {formatDuration(exerciseDetail.duration / 60)}</p> 
                        {exerciseDetail.distance !== undefined && <p className="text-sm text-muted-foreground">Distance: {exerciseDetail.distance} m</p>} 
                      </div>
                    )}
                    {/* Display Notes */}
                    {exerciseDetail.notes && (
                      <div className="mt-2">
                         <h4 className="font-semibold mb-1">Notes:</h4>
                         <p className="text-sm text-muted-foreground">{exerciseDetail.notes}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific exercises were recorded for this workout.</p>
          )}
        </CardContent>
      </Card>

      {/* --- Existing Notes Section (Overall Workout Notes) --- */}
      {workout.notes && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{workout.notes}</p>
            </CardContent>
          </Card>
      )}

      <div className="flex justify-between items-center mb-8">
        <Link href="/workouts">Back to Workouts</Link>
        <div className="mt-2 text-right">
          <Link href={`/workouts/${workout.id}/edit`} className="text-sm text-blue-600 hover:underline">
            Edit Workout
          </Link>
        </div>
      </div>
    </div>
  )
}

