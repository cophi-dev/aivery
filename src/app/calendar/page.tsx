"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { LucideClock, LucideDumbbell, LucidePlus, LucideTrash, LucideEdit, LucidePencil, LucideTrash2 } from "lucide-react"
import { fetchWorkouts, createWorkout, deleteWorkout } from "@/lib/workout-actions"
import type { WorkoutData } from "@/types/db"
import { EditWorkoutForm } from "@/components/forms/edit-workout-form"

export default function CalendarPage() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [workoutName, setWorkoutName] = useState("")
  const [workoutType, setWorkoutType] = useState("strength")
  const [workoutDuration, setWorkoutDuration] = useState("60")
  const [workoutIntensity, setWorkoutIntensity] = useState("Medium")
  const [workoutNotes, setWorkoutNotes] = useState("")

  // Load workouts
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

  // Get workouts for selected date
  const workoutsForSelectedDate = selectedDate
    ? workouts.filter((workout) => {
        const workoutDate = new Date(workout.date)
        return workoutDate.toDateString() === selectedDate.toDateString()
      })
    : []

  // Handle create workout
  const handleCreateWorkout = async () => {
    if (!selectedDate || !workoutName) return

    try {
      setIsLoading(true)

      const newWorkout: Partial<WorkoutData> = {
        name: workoutName,
        date: selectedDate,
        duration: Number.parseInt(workoutDuration),
        intensity: workoutIntensity as "Low" | "Medium" | "High",
        type: workoutType,
        notes: workoutNotes,
        exercises: [],
      }

      const createdWorkout = await createWorkout(newWorkout)
      setWorkouts([...workouts, createdWorkout])

      // Reset form
      setWorkoutName("")
      setWorkoutType("strength")
      setWorkoutDuration("60")
      setWorkoutIntensity("Medium")
      setWorkoutNotes("")
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Failed to create workout:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle delete workout
  const handleDeleteWorkout = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workout?")) return

    try {
      setIsLoading(true)
      await deleteWorkout(id)
      setWorkouts(workouts.filter((workout) => workout._id !== id))
    } catch (error) {
      console.error("Failed to delete workout:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-2">Plan and schedule your workouts</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <LucidePlus className="mr-2 h-5 w-5" />
                New Workout
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Workout</DialogTitle>
                <DialogDescription>
                  Plan a new workout for {selectedDate ? formatDate(selectedDate) : "today"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workout-name" className="col-span-4">
                    Workout Name
                  </Label>
                  <Input
                    id="workout-name"
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                    className="col-span-4"
                    placeholder="e.g., Upper Body, Leg Day"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workout-type" className="col-span-4">
                    Workout Type
                  </Label>
                  <Select value={workoutType} onValueChange={setWorkoutType}>
                    <SelectTrigger className="col-span-4">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength Training</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="hiit">HIIT</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workout-duration" className="col-span-4">
                    Duration (minutes)
                  </Label>
                  <Input
                    id="workout-duration"
                    type="number"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(e.target.value)}
                    className="col-span-4"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workout-intensity" className="col-span-4">
                    Intensity
                  </Label>
                  <Select value={workoutIntensity} onValueChange={setWorkoutIntensity}>
                    <SelectTrigger className="col-span-4">
                      <SelectValue placeholder="Select intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workout-notes" className="col-span-4">
                    Notes
                  </Label>
                  <Textarea
                    id="workout-notes"
                    value={workoutNotes}
                    onChange={(e) => setWorkoutNotes(e.target.value)}
                    className="col-span-4"
                    placeholder="Any additional notes about this workout"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWorkout} disabled={!workoutName}>
                  Create Workout
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Select a date to view or plan workouts</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              // Highlight dates with workouts
              modifiers={{
                workout: workouts.map((workout) => new Date(workout.date)),
              }}
              modifiersStyles={{
                workout: {
                  fontWeight: "bold",
                  backgroundColor: "hsl(var(--primary) / 0.1)",
                  color: "hsl(var(--primary))",
                },
              }}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              Workouts for {selectedDate ? formatDate(selectedDate) : "Today"}
            </CardTitle>
            <CardDescription>
              {workoutsForSelectedDate.length
                ? `${workoutsForSelectedDate.length} workout${workoutsForSelectedDate.length > 1 ? "s" : ""} scheduled`
                : "No workouts scheduled for this day"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : workoutsForSelectedDate.length > 0 ? (
              <div className="space-y-4">
                {workoutsForSelectedDate.map((workout) => (
                  <Card key={workout._id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{workout.name}</CardTitle>
                          <CardDescription className="flex items-center mt-1">
                            <LucideDumbbell className="mr-1 h-4 w-4" />
                            <span className="capitalize">{workout.type}</span>
                            <span className="mx-2">•</span>
                            <LucideClock className="mr-1 h-4 w-4" />
                            <span>{workout.duration} minutes</span>
                          </CardDescription>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/workout/edit/${workout._id}`)}
                          >
                            <LucidePencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWorkout(workout._id)}
                          >
                            <LucideTrash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 pt-1">
                      {workout.notes && (
                        <div className="mt-2 text-sm text-muted-foreground">{workout.notes}</div>
                      )}

                      {workout.exercises && workout.exercises.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Exercises:</h4>
                          <ul className="space-y-1">
                            {workout.exercises.map((exercise, idx) => (
                              <li key={idx} className="text-sm">
                                <span className="font-medium">{exercise.name}</span>:{" "}
                                {exercise.sets && exercise.sets.length > 0
                                  ? `${exercise.sets.length} sets`
                                  : "No details"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 flex justify-between items-center">
                        <Badge variant={workout.intensity === "High" ? "destructive" : workout.intensity === "Medium" ? "default" : "secondary"}>
                          {workout.intensity} Intensity
                        </Badge>
                        
                        <Button onClick={() => router.push(`/workout/start/${workout._id}`)}>
                          Start Workout
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No workouts scheduled for this day</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <LucidePlus className="mr-2 h-4 w-4" />
                  Plan a Workout
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 