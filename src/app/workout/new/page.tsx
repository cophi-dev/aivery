"use client"

import { useState, useEffect } from "react"
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
import { fetchExercises } from "@/lib/exercise-actions"
import { addExerciseToWorkout } from "@/lib/workout-exercise-actions"
import type { ExerciseData } from "@/types/db"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

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
      name: "",
      sets: [{ weight: 0, reps: 0 }],
    }
  ])

  const [dbExercises, setDbExercises] = useState<ExerciseData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null)

  // Fetch exercises from database
  useEffect(() => {
    const loadExercises = async () => {
      const exercises = await fetchExercises()
      setDbExercises(exercises)
    }
    loadExercises()
  }, [])

  // Get unique muscle groups from exercises
  const uniqueMuscleGroups = Array.from(
    new Set(dbExercises.flatMap(exercise => exercise.muscleGroups))
  ).sort()

  // Filter exercises based on selection
  const filteredExercises = dbExercises
    .filter(exercise => selectedCategory === "all" || exercise.category === selectedCategory)
    .filter(exercise => selectedMuscleGroup === "all" || 
            exercise.muscleGroups.includes(selectedMuscleGroup))
    .sort((a, b) => a.name.localeCompare(b.name))

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

  const selectExercise = (exercise: ExerciseData) => {
    if (activeExerciseIndex === null) return

    const newExercises = [...exercises]
    newExercises[activeExerciseIndex].name = exercise.name
    setExercises(newExercises)
    setDialogOpen(false)
  }

  const openExerciseDialog = (index: number) => {
    setActiveExerciseIndex(index)
    setDialogOpen(true)
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
        type: "strength",
      }
      
      // Save to database
      const workout = await createWorkout(workoutData)
      
      // Get exercise IDs and add them to the workout
      for (const exercise of exercises) {
        const dbExercise = dbExercises.find(ex => ex.name === exercise.name)
        if (dbExercise) {
          await addExerciseToWorkout(
            workout._id,
            dbExercise._id,
            exercise.sets
          )
        }
      }
      
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
                    defaultValue="medium"
                    onValueChange={(value) => setWorkoutIntensity(value)}
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

                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label htmlFor="workout-notes">Notes (optional)</Label>
                  <Textarea 
                    id="workout-notes" 
                    placeholder="Any additional notes about this workout"
                    value={workoutNotes}
                    onChange={(e) => setWorkoutNotes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exercises</CardTitle>
              <CardDescription>Add the exercises you performed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {exercises.map((exercise, exerciseIndex) => (
                  <div key={exerciseIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Dialog open={dialogOpen && activeExerciseIndex === exerciseIndex} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full text-left justify-start"
                            onClick={() => openExerciseDialog(exerciseIndex)}
                          >
                            <LucideDumbbell className="h-4 w-4 mr-2" />
                            {exercise.name || "Select Exercise"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Select Exercise</DialogTitle>
                            <DialogDescription>
                              Choose an exercise from the database or create a new one
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-4 py-4">
                            <div>
                              <Label htmlFor="category-filter">Category</Label>
                              <Select 
                                value={selectedCategory} 
                                onValueChange={setSelectedCategory}
                              >
                                <SelectTrigger id="category-filter">
                                  <SelectValue placeholder="Filter by category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Categories</SelectItem>
                                  <SelectItem value="strength">Strength</SelectItem>
                                  <SelectItem value="cardio">Cardio</SelectItem>
                                  <SelectItem value="flexibility">Flexibility</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label htmlFor="muscle-filter">Muscle Group</Label>
                              <Select 
                                value={selectedMuscleGroup} 
                                onValueChange={setSelectedMuscleGroup}
                              >
                                <SelectTrigger id="muscle-filter">
                                  <SelectValue placeholder="Filter by muscle" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Muscle Groups</SelectItem>
                                  {uniqueMuscleGroups.map(muscle => (
                                    <SelectItem key={muscle} value={muscle} className="capitalize">
                                      {muscle}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <ScrollArea className="h-[300px] rounded-md border p-4">
                            <div className="grid grid-cols-1 gap-2">
                              {filteredExercises.length > 0 ? (
                                filteredExercises.map(dbExercise => (
                                  <Button
                                    key={dbExercise._id}
                                    variant="outline"
                                    className="justify-start h-auto py-3"
                                    onClick={() => selectExercise(dbExercise)}
                                  >
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium">{dbExercise.name}</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {dbExercise.muscleGroups.map(muscle => (
                                          <Badge key={muscle} variant="secondary" className="text-xs capitalize">
                                            {muscle}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </Button>
                                ))
                              ) : (
                                <p className="text-center text-muted-foreground p-4">
                                  No exercises found. Try different filters or add a new exercise.
                                </p>
                              )}
                            </div>
                          </ScrollArea>
                          
                          <div className="mt-4 flex justify-between">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Link href="/exercises/new" target="_blank">
                              <Button>Add New Exercise</Button>
                            </Link>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="ml-2"
                        onClick={() => removeExercise(exerciseIndex)}
                      >
                        <LucideTrash className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Sets */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 mb-2">
                        <div className="col-span-2">
                          <Label className="text-sm">Set</Label>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-sm">Weight</Label>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-sm">Reps</Label>
                        </div>
                        <div className="col-span-2"></div>
                      </div>
                      
                      {exercise.sets.map((set, setIndex) => (
                        <div key={setIndex} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-2">
                            <div className="text-center font-medium">{setIndex + 1}</div>
                          </div>
                          <div className="col-span-4">
                            <Input 
                              type="number" 
                              value={set.weight || ''} 
                              onChange={(e) => updateSetValue(exerciseIndex, setIndex, "weight", Number(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-4">
                            <Input 
                              type="number" 
                              value={set.reps || ''} 
                              onChange={(e) => updateSetValue(exerciseIndex, setIndex, "reps", Number(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-2 flex justify-end">
                            {exercise.sets.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeSet(exerciseIndex, setIndex)}
                              >
                                <LucideMinus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => addSet(exerciseIndex)}
                        >
                          <LucidePlus className="h-4 w-4 mr-2" />
                          Add Set
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  onClick={addExercise}
                  className="w-full"
                >
                  <LucidePlus className="h-4 w-4 mr-2" />
                  Add Exercise
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-8">
            <Button 
              size="lg" 
              onClick={saveWorkout}
              disabled={isSubmitting}
            >
              <LucideSave className="h-5 w-5 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Workout'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="template" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>From Template</CardTitle>
              <CardDescription>Choose a workout template to start with</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Templates coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

