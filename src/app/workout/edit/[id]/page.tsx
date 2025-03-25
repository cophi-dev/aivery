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
import { LucideArrowLeft, LucideMinus, LucidePlus, LucideSave, LucideTrash, LucideTrash2 } from "lucide-react"
import { fetchWorkout, updateWorkout } from "@/lib/workout-actions"
import type { WorkoutData, Set } from "@/types/db"

export default function EditWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData>({
    _id: params.id,
    userId: "user123", // This should be replaced with actual user ID
    type: "strength",
    name: "",
    date: new Date(),
    duration: 0,
    intensity: "medium",
    volume: 0,
    exercises: [],
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        const data = await fetchWorkout(params.id)
        if (data) {
          setWorkout(data)
        } else {
          // Handle case where workout is not found
          console.error("Workout not found")
          router.push("/workout") // Redirect to workouts list
        }
      } catch (error) {
        console.error("Failed to load workout:", error)
        router.push("/workout") // Redirect to workouts list on error
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id, router])

  // Handle form changes
  const updateWorkoutField = (field: keyof WorkoutData, value: any) => {
    setWorkout(prev => ({ ...prev, [field]: value }))
  }

  // Handle exercise changes
  const updateExerciseName = (index: number, name: string) => {
    setWorkout(prev => {
      const exercises = prev.exercises || []
      const newExercises = [...exercises]
      newExercises[index] = { ...newExercises[index], name }
      return { ...prev, exercises: newExercises }
    })
  }

  // Handle set changes
  const updateSetValue = (exerciseIndex: number, setIndex: number, field: keyof Set, value: number) => {
    setWorkout(prev => {
      const exercises = prev.exercises || []
      const newExercises = [...exercises]
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: newExercises[exerciseIndex].sets.map((set, i) =>
          i === setIndex ? { ...set, [field]: value } : set
        )
      }
      return { ...prev, exercises: newExercises }
    })
  }

  // Add exercise
  const addExercise = () => {
    setWorkout(prev => ({
      ...prev,
      exercises: [...(prev.exercises || []), { name: "", sets: [] }]
    }))
  }

  // Remove exercise
  const removeExercise = (index: number) => {
    setWorkout(prev => ({
      ...prev,
      exercises: (prev.exercises || []).filter((_, i) => i !== index)
    }))
  }

  // Add set
  const addSet = (exerciseIndex: number) => {
    setWorkout(prev => {
      const exercises = prev.exercises || []
      const newExercises = [...exercises]
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: [...(newExercises[exerciseIndex].sets || []), { weight: 0, reps: 0 }]
      }
      return { ...prev, exercises: newExercises }
    })
  }

  // Remove set
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setWorkout(prev => {
      const exercises = prev.exercises || []
      const newExercises = [...exercises]
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: newExercises[exerciseIndex].sets.filter((_, i) => i !== setIndex)
      }
      return { ...prev, exercises: newExercises }
    })
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
            <Link href="/calendar">Back to Calendar</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/workout">
          <Button variant="ghost" size="icon">
            <LucideArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Workout</h1>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workout Details</CardTitle>
              <CardDescription>Edit your workout information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={workout.name || ""}
                    onChange={(e) => updateWorkoutField("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={workout.type}
                    onValueChange={(value) => updateWorkoutField("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={workout.notes || ""}
                  onChange={(e) => updateWorkoutField("notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exercises</CardTitle>
              <CardDescription>Manage your workout exercises</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(workout.exercises || []).map((exercise, exerciseIndex) => (
                <div key={exerciseIndex} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`exercise-${exerciseIndex}`}>Exercise Name</Label>
                      <Input
                        id={`exercise-${exerciseIndex}`}
                        value={exercise.name}
                        onChange={(e) => updateExerciseName(exerciseIndex, e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExercise(exerciseIndex)}
                    >
                      <LucideTrash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Sets</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => addSet(exerciseIndex)}
                      >
                        <LucidePlus className="h-4 w-4" />
                      </Button>
                    </div>
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label>Weight (kg)</Label>
                          <Input
                            type="number"
                            value={set.weight}
                            onChange={(e) =>
                              updateSetValue(exerciseIndex, setIndex, "weight", parseFloat(e.target.value))
                            }
                          />
                        </div>
                        <div className="flex-1">
                          <Label>Reps</Label>
                          <Input
                            type="number"
                            value={set.reps}
                            onChange={(e) =>
                              updateSetValue(exerciseIndex, setIndex, "reps", parseInt(e.target.value))
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSet(exerciseIndex, setIndex)}
                        >
                          <LucideMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button onClick={addExercise} className="w-full">
                <LucidePlus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center mb-4">
            <Link href="/calendar">Back to Calendar</Link>
            <Button 
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LucideTrash className="mr-2 h-4 w-4" />
              Delete Workout
            </Button>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/workout")}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <LucideSave className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

