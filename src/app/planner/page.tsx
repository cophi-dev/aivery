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
import { format } from "date-fns"
import { Pencil } from "lucide-react"
import { IWorkout } from "@/lib/db/models/workout"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

// Define the expected exercise input structure based on createWorkout signature
type ExerciseInput = {
  name: string;
  notes?: string;
  // Assuming InputSetData is defined elsewhere or can be simplified for this context
  sets?: any[]; // Use 'any[]' or a more specific type if InputSetData is available
  duration?: number;
  distance?: number;
};

export default function WorkoutPlannerPage() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setError("Failed to load workouts. Please try again later.")
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

      const newWorkout: Partial<WorkoutData> & { exercises?: ExerciseInput[] } = {
        name: workoutName,
        date: selectedDate,
        duration: Number.parseInt(workoutDuration),
        intensity: workoutIntensity as "Low" | "Medium" | "High",
        type: workoutType,
        notes: workoutNotes,
        exercises: [],
      }

      const createdWorkout: IWorkout = await createWorkout(newWorkout)
      
      // Convert the IWorkout to a WorkoutData type
      const workoutDataToAdd: WorkoutData = {
        _id: createdWorkout._id ? createdWorkout._id.toString() : '',
        userId: createdWorkout.userId ? createdWorkout.userId.toString() : '',
        name: createdWorkout.name,
        date: createdWorkout.date,
        duration: createdWorkout.duration,
        intensity: createdWorkout.intensity as WorkoutData['intensity'],
        type: createdWorkout.type as WorkoutData['type'],
        notes: createdWorkout.notes,
        cardioDetails: createdWorkout.cardioDetails ? {
          distance: createdWorkout.cardioDetails.distance,
        } : undefined,
        calculatedVolume: createdWorkout.calculatedVolume,
        createdAt: createdWorkout.createdAt ? createdWorkout.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: createdWorkout.updatedAt ? createdWorkout.updatedAt.toISOString() : new Date().toISOString(),
      }
      
      // Only add cardioDetails if they exist
      if (createdWorkout.cardioDetails) {
        workoutDataToAdd.cardioDetails = {
          distance: createdWorkout.cardioDetails.distance,
          duration: createdWorkout.cardioDetails.duration,
          pace: createdWorkout.cardioDetails.pace,
        };
        
        // Add heart rate data if it exists
        if (createdWorkout.cardioDetails.heartRate) {
          workoutDataToAdd.cardioDetails.heartRate = {
            average: createdWorkout.cardioDetails.heartRate.average,
            max: createdWorkout.cardioDetails.heartRate.max,
          };
        }
      }
      
      setWorkouts([...workouts, workoutDataToAdd])

      // Reset form
      setWorkoutName("")
      setWorkoutType("strength")
      setWorkoutDuration("60")
      setWorkoutIntensity("Medium")
      setWorkoutNotes("")
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Failed to create workout:", error)
      setError("Failed to create workout. Please try again later.")
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
      setError("Failed to delete workout. Please try again later.")
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

  if (isLoading) {
    return <LoadingIndicator />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workout Planner</h1>
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
            <CardTitle>{selectedDate ? formatDate(selectedDate) : "Today"}</CardTitle>
            <CardDescription>
              {workoutsForSelectedDate.length === 0
                ? "No workouts scheduled for this day"
                : `${workoutsForSelectedDate.length} workout(s) scheduled`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workoutsForSelectedDate.length === 0 ? (
              <div className="text-center py-8">
                <LucideDumbbell className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-medium">No workouts planned</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Click the "New Workout" button to plan a workout for this day.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" className="mt-4">
                  <LucidePlus className="mr-2 h-4 w-4" />
                  Add Workout
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {workoutsForSelectedDate.map((workout) => (
                  <div key={workout._id} className="border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{workout.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <LucideClock className="h-4 w-4 mr-1" />
                            <span>{workout.duration} min</span>
                          </div>
                          <div className="flex items-center">
                            <LucideDumbbell className="h-4 w-4 mr-1" />
                            <span>{workout.type}</span>
                          </div>
                        </div>
                        <Badge
                          className="mt-2"
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
                        {workout.notes && <p className="mt-2 text-sm text-muted-foreground">{workout.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="ml-2"
                          onClick={() => router.push(`/workouts/${workout._id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteWorkout(workout._id)}
                          disabled={isLoading}
                        >
                          <LucideTrash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="default" size="sm" onClick={() => router.push(`/workouts/${workout._id}`)}>
                        View Details
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => router.push(`/workout/start/${workout._id}`)}>
                        Start Workout
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

