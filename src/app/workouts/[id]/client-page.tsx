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
  LucideExternalLink,
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import type { WorkoutData } from "@/types/db"
import { formatDuration } from "@/lib/utils"

export default function ActivityDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        const data = await fetchWorkout(id)
        setWorkout(data)
      } catch (error) {
        console.error("Failed to load workout:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
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

  // Format pace for running/swimming
  const formatPace = (pace: number) => {
    const minutes = Math.floor(pace)
    const seconds = Math.round((pace - minutes) * 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`
  }

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "running":
        return <LucideActivity className="h-5 w-5" />
      case "swimming":
        return <LucideActivity className="h-5 w-5" />
      case "cycling":
        return <LucideActivity className="h-5 w-5" />
      default:
        return <LucideDumbbell className="h-5 w-5" />
    }
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
          {workout.source === 'strava' && workout.sourceId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`https://strava.com/activities/${workout.sourceId}`} target="_blank" rel="noopener noreferrer">
                <LucideExternalLink className="h-4 w-4 mr-2" />
                View on Strava
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="ml-2"
            onClick={() => router.push(`/workouts/${workout._id}/edit`)}
          >
            <LucidePencil className="h-4 w-4" />
          </Button>
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
            <div className="text-2xl font-medium">{formatDate(new Date(workout.date))}</div>
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
            <div className="text-2xl font-medium">{workout.distance ? `${workout.distance} km` : "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="mb-8">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {workout.cardioDetails?.heartRate && <TabsTrigger value="heart-rate">Heart Rate</TabsTrigger>}
          {workout.cardioDetails?.laps && workout.cardioDetails.laps.length > 0 && (
            <TabsTrigger value="laps">Laps</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {workout.type === "running" && (
                  <>
                    <div className="flex items-center">
                      <div className="bg-primary/10 p-2 rounded-full mr-3">
                        <LucideActivity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Pace</p>
                        <p className="text-muted-foreground text-sm">
                          {workout.cardioDetails?.pace ? formatPace(workout.cardioDetails.pace) : "N/A"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <Link href="/workouts">Back to Workouts</Link>
        <div className="flex gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/workouts/${workout._id}/edit`)}
          >
            <LucidePencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
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
    </div>
  )
} 