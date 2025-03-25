"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { LucideArrowLeft, LucideDumbbell, LucideMinus, LucidePlus, LucideSave, LucideTrash } from "lucide-react"
import { createWorkout } from "@/lib/workout-actions"

export default function NewWorkoutPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workoutName, setWorkoutName] = useState("New Workout")
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split("T")[0])
  const [workoutDuration, setWorkoutDuration] = useState<number | undefined>(undefined)
  const [workoutIntensity, setWorkoutIntensity] = useState("medium")
  const [workoutNotes, setWorkoutNotes] = useState("")
  
  const [exercises, setExercises] = useState([
    {
      name: "Bench Press",
      sets: [{ weight: 80, reps: 10 }],
    },
    {
      name: "Lat Pulldown",
      sets: [{ weight: 70, reps: 12 }],
    },
  ])

  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: [{ weight: 0, reps: 0 }] }])
  }

  const removeExercise = (index: number) => {
    const newExercises = [...exercises]
    newExercises.splice(index, 1)
    setExercises(newExercises)
  }

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises]
    const lastSet = newExercises[exerciseIndex].sets[newExercises[exerciseIndex].sets.length - 1]
    newExercises[exerciseIndex].sets.push({ ...lastSet })
    setExercises(newExercises)
  }

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises]
    newExercises[exerciseIndex].sets.splice(setIndex, 1)
    setExercises(newExercises)
  }

  const updateExerciseName = (index: number, name: string) => {
    const newExercises = [...exercises]
    newExercises[index].name = name
    setExercises(newExercises)
  }

  const updateSetValue = (exerciseIndex: number, setIndex: number, field: "weight" | "reps", value: number) => {
    const newExercises = [...exercises]
    newExercises[exerciseIndex].sets[setIndex][field] = value
    setExercises(newExercises)
  }

  const saveWorkout = async () => {
    try {
      setIsSubmitting(true)
      
      // Validate required fields
      if (!workoutName) {
        window.alert("Please enter a workout name")
        setIsSubmitting(false)
        return
      }
      
      // Check if any exercises don't have names
      const hasEmptyExercise = exercises.some(ex => !ex.name.trim())
      if (hasEmptyExercise) {
        window.alert("Please name all exercises")
        setIsSubmitting(false)
        return
      }
      
      // Format the workout data
      const workoutData = {
        name: workoutName,
        date: new Date(workoutDate),
        duration: workoutDuration,
        intensity: workoutIntensity,
        notes: workoutNotes,
        exercises: exercises.map(exercise => ({
          name: exercise.name,
          sets: exercise.sets.map(set => ({
            weight: set.weight,
            reps: set.reps
          }))
        }))
      }
      
      // Save to database
      await createWorkout(workoutData)
      
      // Redirect to the dashboard
      router.push("/dashboard")
    } catch (error) {
      console.error("Error saving workout:", error)
      window.alert("Failed to save workout. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/workouts">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">New Workout</h1>
      </div>

      <Tabs defaultValue="manual" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="template">From Template</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Workout Details</CardTitle>
              <CardDescription>Enter the basic information about your workout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="workout-name">Workout Name</Label>
                  <Input 
                    id="workout-name" 
                    placeholder="e.g., Upper Body, Leg Day" 
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-type">Type</Label>
                  <Select 
                    defaultValue="strength"
                    onValueChange={(value) => {
                      // Redirect to the appropriate activity page if not strength
                      if (value !== "strength") {
                        router.push(`/activity/${value}/new`);
                      }
                    }}
                  >
                    <SelectTrigger id="workout-type">
                      <SelectValue placeholder="Select workout type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength Training</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="cycling">Cycling</SelectItem>
                      <SelectItem value="swimming">Swimming</SelectItem>
                      <SelectItem value="hiit">HIIT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-date">Date</Label>
                  <Input 
                    id="workout-date" 
                    type="date" 
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-duration">Duration (minutes)</Label>
                  <Input 
                    id="workout-duration" 
                    type="number" 
                    placeholder="e.g., 60" 
                    value={workoutDuration || ''}
                    onChange={(e) => setWorkoutDuration(Number(e.target.value) || undefined)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-intensity">Intensity</Label>
                  <Select 
                    value={workoutIntensity}
                    onValueChange={setWorkoutIntensity}
                  >
                    <SelectTrigger id="workout-intensity">
                      <SelectValue placeholder="Select intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
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
              <CardDescription>Add the exercises you performed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {exercises.map((exercise, exerciseIndex) => (
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

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Add any additional notes about your workout</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="How did you feel? Any PRs? Areas to improve?" 
                className="min-h-[100px]" 
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/dashboard">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={saveWorkout} disabled={isSubmitting}>
              <LucideSave className="h-4 w-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Workout"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="template" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Workout Templates</CardTitle>
              <CardDescription>Choose a template to start your workout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["Upper Body", "Lower Body", "Push", "Pull", "Legs", "Full Body", "Core & Cardio"].map((template) => (
                  <Card key={template} className="cursor-pointer hover:bg-accent transition-colors">
                    <CardContent className="p-4 flex items-center">
                      <div className="bg-primary/10 p-2 rounded-full mr-3">
                        <LucideDumbbell className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{template}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

