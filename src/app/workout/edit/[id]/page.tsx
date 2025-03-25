"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { LucideArrowLeft, LucideMinus, LucidePlus, LucideSave, LucideTrash } from "lucide-react"
import { fetchWorkout, updateWorkout } from "@/lib/workout-actions"
import type { WorkoutData, Set } from "@/types/db"

export default function EditWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        const data = await fetchWorkout(params.id)
        setWorkout(data)
      } catch (error) {
        console.error("Failed to load workout:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id])

  // Handle form changes
  const updateWorkoutField = (field: keyof WorkoutData, value: any) => {
    if (!workout) return
    setWorkout({ ...workout, [field]: value })
  }

  // Handle exercise changes
  const updateExerciseName = (index: number, name: string) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    newExercises[index].name = name
    updateWorkoutField("exercises", newExercises)
  }

  // Handle set changes
  const updateSetValue = (exerciseIndex: number, setIndex: number, field: keyof Set, value: number) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    newExercises[exerciseIndex].sets[setIndex][field] = value
    updateWorkoutField("exercises", newExercises)
  }

  // Add exercise
  const addExercise = () => {
    if (!workout) return
    const newExercises = [...workout.exercises, { name: "", sets: [{ weight: 0, reps: 0 }] }]
    updateWorkoutField("exercises", newExercises)
  }

  // Remove exercise
  const removeExercise = (index: number) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    newExercises.splice(index, 1)
    updateWorkoutField("exercises", newExercises)
  }

  // Add set
  const addSet = (exerciseIndex: number) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    const lastSet = newExercises[exerciseIndex].sets[newExercises[exerciseIndex].sets.length - 1]
    newExercises[exerciseIndex].sets.push({ ...lastSet })
    updateWorkoutField("exercises", newExercises)
  }

  // Remove set
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    newExercises[exerciseIndex].sets.splice(setIndex, 1)
    updateWorkoutField("exercises", newExercises)
  }

  // Save workout
  const handleSave = async () => {
    if (!workout) return

    try {
      setIsSaving(true)
      await updateWorkout(workout)
      router.push(`/workout/${params.id}`)
    } catch (error) {
      console.error("Failed to update workout:", error)
    } finally {
      setIsSaving(false)
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
          <h1 className="text-2xl font-bold">Workout not found</h1>
          <p className="mt-2 text-muted-foreground">
            The workout you're looking for doesn't exist or has been deleted.
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
        <Link href={`/workout/${params.id}`}>
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Workout</h1>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Workout Details</CardTitle>
          <CardDescription>Edit the basic information about your workout</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="workout-name">Workout Name</Label>
              <Input
                id="workout-name"
                value={workout.name}
                onChange={(e) => updateWorkoutField("name", e.target.value)}
                placeholder="e.g., Upper Body, Leg Day"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={new Date(workout.date).toISOString().split("T")[0]}
                onChange={(e) => updateWorkoutField("date", new Date(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workout-duration">Duration (minutes)</Label>
              <Input
                id="workout-duration"
                type="number"
                value={workout.duration}
                onChange={(e) => updateWorkoutField("duration", Number.parseInt(e.target.value))}
                placeholder="e.g., 60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workout-intensity">Intensity</Label>
              <Select value={workout.intensity} onValueChange={(value) => updateWorkoutField("intensity", value)}>
                <SelectTrigger id="workout-intensity">
                  <SelectValue placeholder="Select intensity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workout-notes">Notes</Label>
              <Textarea
                id="workout-notes"
                value={workout.notes || ""}
                onChange={(e) => updateWorkoutField("notes", e.target.value)}
                placeholder="Any additional notes about this workout"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Exercises</CardTitle>
            <Button onClick={addExercise}>
              <LucidePlus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>
          </div>
          <CardDescription>Edit the exercises for this workout</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {workout.exercises.map((exercise, exerciseIndex) => (
              <div key={exerciseIndex} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 mr-4">
                    <Label htmlFor={`exercise-${exerciseIndex}`} className="mb-2 block">
                      Exercise Name
                    </Label>
                    <Input
                      id={`exercise-${exerciseIndex}`}
                      value={exercise.name}
                      onChange={(e) => updateExerciseName(exerciseIndex, e.target.value)}
                      placeholder="e.g., Bench Press, Squats"
                    />
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => removeExercise(exerciseIndex)}>
                    <LucideTrash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                    <div className="col-span-2">Set</div>
                    <div className="col-span-4">Weight (kg)</div>
                    <div className="col-span-4">Reps</div>
                    <div className="col-span-2"></div>
                  </div>

                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 font-medium">{setIndex + 1}</div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          value={set.weight}
                          onChange={(e) =>
                            updateSetValue(exerciseIndex, setIndex, "weight", Number.parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          value={set.reps}
                          onChange={(e) =>
                            updateSetValue(exerciseIndex, setIndex, "reps", Number.parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        {exercise.sets.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeSet(exerciseIndex, setIndex)}>
                            <LucideMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={() => addSet(exerciseIndex)} className="mt-2">
                    <LucidePlus className="h-4 w-4 mr-2" />
                    Add Set
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push(`/workout/${params.id}`)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <LucideSave className="h-4 w-4 mr-2" />
              Save Workout
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

