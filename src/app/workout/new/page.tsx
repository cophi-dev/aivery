"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  LucideArrowLeft, 
  LucideDumbbell, 
  LucideMinus, 
  LucidePlus, 
  LucideSave, 
  LucideTrash,
  LucideArrowRight,
  LucideCalendar,
  LucideListChecks
} from "lucide-react"
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
import { format } from "date-fns"
import { Steps, StepContent, StepActions } from "@/components/ui/steps"

export default function NewWorkoutPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workoutName, setWorkoutName] = useState("")
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

  const handleNextStep = () => {
    setCurrentStep(prev => prev + 1)
  }

  const handlePreviousStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const isExercisesValid = () => {
    return exercises.every(ex => ex.name.trim() !== "" && ex.sets.length > 0)
  }

  const saveWorkout = async () => {
    try {
      setIsSubmitting(true)
      
      // Check if any exercises don't have names
      const hasEmptyExercise = exercises.some(ex => !ex.name.trim())
      if (hasEmptyExercise) {
        window.alert("Please name all exercises")
        setIsSubmitting(false)
        return
      }
      
      // Default name to "Strength workout" if not provided
      const finalWorkoutName = workoutName.trim() || `Strength workout - ${format(new Date(workoutDate), "MMM d")}`;
      
      // Format the workout data
      const workoutData = {
        name: finalWorkoutName,
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
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center mb-4">
        <Link href="/activity/new">
          <Button variant="ghost" size="sm" className="mr-2">
            <LucideArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Strength Training</h1>
      </div>

      <Steps current={currentStep} total={3} onStepClick={goToStep} />

      <StepContent step={0} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideCalendar className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">When did you work out?</h2>
            </div>
            
            <div className="space-y-4">
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
                <Label htmlFor="workout-intensity">How intense was your workout?</Label>
                <Select 
                  value={workoutIntensity}
                  onValueChange={setWorkoutIntensity}
                >
                  <SelectTrigger id="workout-intensity">
                    <SelectValue placeholder="Select intensity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Light - I could easily talk</SelectItem>
                    <SelectItem value="medium">Moderate - I was breathing harder</SelectItem>
                    <SelectItem value="high">Intense - I was really pushing myself</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workout-duration">How long did you work out? (minutes)</Label>
                <Input 
                  id="workout-duration" 
                  type="number" 
                  placeholder="e.g., 60" 
                  value={workoutDuration || ""}
                  onChange={(e) => setWorkoutDuration(parseInt(e.target.value) || undefined)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <StepActions 
          hasPrevious={false} 
          onNext={handleNextStep}
        />
      </StepContent>

      <StepContent step={1} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideDumbbell className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">What exercises did you do?</h2>
            </div>
            
            <div className="space-y-4">
              {exercises.map((exercise, exerciseIndex) => (
                <div 
                  key={exerciseIndex} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <Input
                        value={exercise.name}
                        onChange={(e) => updateExerciseName(exerciseIndex, e.target.value)}
                        placeholder="Exercise name"
                        className="border-none p-0 h-auto text-base font-medium shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openExerciseDialog(exerciseIndex)}
                      >
                        <LucideListChecks className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExercise(exerciseIndex)}
                        disabled={exercises.length === 1}
                      >
                        <LucideTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2 text-sm text-muted-foreground font-medium">
                          Set {setIndex + 1}
                        </div>
                        <div className="col-span-4">
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              value={set.weight}
                              onChange={(e) => updateSetValue(exerciseIndex, setIndex, "weight", parseInt(e.target.value) || 0)}
                              className="text-right"
                            />
                            <span className="text-xs text-muted-foreground">kg</span>
                          </div>
                        </div>
                        <div className="col-span-4">
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              value={set.reps}
                              onChange={(e) => updateSetValue(exerciseIndex, setIndex, "reps", parseInt(e.target.value) || 0)}
                              className="text-right"
                            />
                            <span className="text-xs text-muted-foreground">reps</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSet(exerciseIndex, setIndex)}
                            disabled={exercise.sets.length === 1}
                            className="h-8 w-8"
                          >
                            <LucideMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSet(exerciseIndex)}
                    size="sm"
                    className="w-full"
                  >
                    <LucidePlus className="h-4 w-4 mr-2" />
                    Add Set
                  </Button>
                </div>
              ))}

              <Button 
                type="button" 
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

        <StepActions 
          onPrevious={handlePreviousStep} 
          onNext={handleNextStep}
          isNextDisabled={!isExercisesValid()}
        />
      </StepContent>

      <StepContent step={2} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideSave className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Finalize your workout</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workout-name" className="flex items-center">
                  Name your workout <span className="text-xs text-muted-foreground ml-2">(optional)</span>
                </Label>
                <Input 
                  id="workout-name" 
                  placeholder="E.g., Upper Body, Leg Day" 
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {!workoutName && `Will be saved as "Strength workout - ${format(new Date(workoutDate), "MMM d")}"`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workout-notes">Any notes about this workout?</Label>
                <Textarea 
                  id="workout-notes" 
                  placeholder="How did you feel? Any achievements?" 
                  className="min-h-[100px] resize-none"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <StepActions 
          onPrevious={handlePreviousStep} 
          hasNext={false}
        />

        <div className="mt-4">
          <Button 
            onClick={saveWorkout} 
            disabled={isSubmitting} 
            className="w-full"
          >
            {isSubmitting ? (
              <>Saving...</>
            ) : (
              <>
                <LucideSave className="h-4 w-4 mr-2" />
                Save Workout
              </>
            )}
          </Button>
        </div>
      </StepContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Exercise</DialogTitle>
            <DialogDescription>
              Choose from our exercise database or enter your own
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label htmlFor="category" className="mb-1 block">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="compound">Compound</SelectItem>
                  <SelectItem value="isolation">Isolation</SelectItem>
                  <SelectItem value="bodyweight">Bodyweight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="muscle-group" className="mb-1 block">Muscle Group</Label>
              <Select value={selectedMuscleGroup} onValueChange={setSelectedMuscleGroup}>
                <SelectTrigger id="muscle-group">
                  <SelectValue placeholder="All muscles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All muscles</SelectItem>
                  {uniqueMuscleGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise._id}
                  className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground rounded-md flex items-center justify-between"
                  onClick={() => selectExercise(exercise)}
                >
                  <span>{exercise.name}</span>
                  {exercise.muscleGroups.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {exercise.muscleGroups[0]}
                    </Badge>
                  )}
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No exercises found. Try a different filter.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

