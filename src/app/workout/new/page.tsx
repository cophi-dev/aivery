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
  LucideListChecks,
  AlertCircle,
  InfoIcon,
  X
} from "lucide-react"
import { createWorkout } from "@/lib/workout-actions"
import { fetchExercises } from "@/lib/exercise-actions"
import { addExerciseToWorkout } from "@/lib/workout-exercise-actions"
import { createExerciseAction } from "@/lib/exercise-actions"
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
import { generateExerciseDetails } from "@/lib/ai-exercise-generator"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreatingExercise, setIsCreatingExercise] = useState(false)
  const [newExerciseData, setNewExerciseData] = useState<Partial<ExerciseData>>({
    name: "",
    description: "",
    muscleGroups: [],
    category: "strength",
    equipment: "",
    instructions: ""
  })
  const [muscleGroupInput, setMuscleGroupInput] = useState("")
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false)

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

  // Filter exercises based on search query as well
  const filteredExercises = dbExercises
    .filter(exercise => selectedCategory === "all" || exercise.category === selectedCategory)
    .filter(exercise => selectedMuscleGroup === "all" || 
            exercise.muscleGroups.includes(selectedMuscleGroup))
    .filter(exercise => 
      !searchQuery.trim() || 
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.muscleGroups.some(group => group.toLowerCase().includes(searchQuery.toLowerCase()))
    )
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

  const createNewExercise = async () => {
    if (!newExerciseData.name) {
      window.alert("Please enter an exercise name")
      return
    }

    try {
      setIsSubmitting(true)
      
      const created = await createExerciseAction({
        name: newExerciseData.name,
        description: newExerciseData.description,
        muscleGroups: newExerciseData.muscleGroups || [],
        category: newExerciseData.category || "strength",
        equipment: newExerciseData.equipment,
        instructions: newExerciseData.instructions
      })
      
      if (created && activeExerciseIndex !== null) {
        // Update local exercise list
        const updatedExercises = [...exercises]
        updatedExercises[activeExerciseIndex].name = created.name
        setExercises(updatedExercises)
        
        // Add to local DB exercises list
        setDbExercises([...dbExercises, created])
        
        // Reset creating state
        setIsCreatingExercise(false)
        setNewExerciseData({
          name: "",
          description: "",
          muscleGroups: [],
          category: "strength",
          equipment: "",
          instructions: ""
        })
        
        // Close dialog
        setDialogOpen(false)
      }
    } catch (error) {
      console.error("Error creating exercise:", error)
      window.alert(error instanceof Error ? error.message : "Failed to create exercise")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNewExerciseNameChange = async (name: string) => {
    setNewExerciseData({ ...newExerciseData, name })
    
    // Only generate when name is at least 3 characters and not already generating
    if (name.length >= 3 && !isGeneratingDetails) {
      setIsGeneratingDetails(true)
      try {
        const details = await generateExerciseDetails(name)
        setNewExerciseData({
          ...newExerciseData,
          ...details,
          name
        })
      } catch (error) {
        console.error("Error generating exercise details:", error)
      } finally {
        setIsGeneratingDetails(false)
      }
    }
  }

  const handleCreateMode = () => {
    setIsCreatingExercise(true)
    setNewExerciseData({
      ...newExerciseData,
      name: searchQuery
    })
  }

  const addMuscleGroup = (group: string) => {
    if (!group.trim()) return
    if (newExerciseData.muscleGroups?.includes(group.toLowerCase().trim())) return
    
    setNewExerciseData({
      ...newExerciseData,
      muscleGroups: [...(newExerciseData.muscleGroups || []), group.toLowerCase().trim()]
    })
  }

  const removeMuscleGroup = (group: string) => {
    setNewExerciseData({
      ...newExerciseData,
      muscleGroups: newExerciseData.muscleGroups?.filter(g => g !== group)
    })
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
            <DialogTitle>
              {isCreatingExercise ? "Create New Exercise" : "Select Exercise"}
            </DialogTitle>
            <DialogDescription>
              {isCreatingExercise 
                ? "Add a new exercise to your database" 
                : "Choose from our database or create your own"}
            </DialogDescription>
          </DialogHeader>

          {isCreatingExercise ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="exercise-name">Exercise Name</Label>
                <Input
                  id="exercise-name"
                  value={newExerciseData.name}
                  onChange={(e) => handleNewExerciseNameChange(e.target.value)}
                  placeholder="e.g., Bench Press"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="category">Category</Label>
                  {isGeneratingDetails && <span className="text-xs text-muted-foreground italic">(Auto-filling...)</span>}
                </div>
                <Select 
                  value={newExerciseData.category as string || "strength"} 
                  onValueChange={(value: "strength" | "cardio" | "flexibility") => 
                    setNewExerciseData({...newExerciseData, category: value})
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="muscleGroups">Muscle Groups</Label>
                <div className="flex gap-2">
                  <Input
                    id="muscleGroups"
                    value={muscleGroupInput}
                    onChange={(e) => setMuscleGroupInput(e.target.value)}
                    placeholder="e.g., chest, shoulders"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addMuscleGroup(muscleGroupInput)
                        setMuscleGroupInput("")
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    onClick={() => {
                      addMuscleGroup(muscleGroupInput)
                      setMuscleGroupInput("")
                    }}
                    variant="secondary"
                  >
                    Add
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {newExerciseData.muscleGroups?.map((group) => (
                    <Badge key={group} className="flex items-center gap-1 capitalize">
                      {group}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeMuscleGroup(group)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment (Optional)</Label>
                <Input
                  id="equipment"
                  value={newExerciseData.equipment || ""}
                  onChange={(e) => setNewExerciseData({...newExerciseData, equipment: e.target.value})}
                  placeholder="e.g., Barbell, Dumbbells"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newExerciseData.description || ""}
                  onChange={(e) => setNewExerciseData({...newExerciseData, description: e.target.value})}
                  placeholder="Briefly describe the exercise"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Optional)</Label>
                <Textarea
                  id="instructions"
                  value={newExerciseData.instructions || ""}
                  onChange={(e) => setNewExerciseData({...newExerciseData, instructions: e.target.value})}
                  placeholder="Step-by-step instructions for performing the exercise"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => setIsCreatingExercise(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  onClick={createNewExercise}
                  disabled={isSubmitting || !newExerciseData.name?.trim() || (newExerciseData.muscleGroups?.length || 0) === 0}
                >
                  {isSubmitting ? "Creating..." : "Create Exercise"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 py-4">
                <Input
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setSearchQuery("")}
                      >
                        <InfoIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">Search by exercise name or muscle group</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2">
                <div>
                  <Label htmlFor="category" className="mb-1 block">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
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
                  {filteredExercises.length === 0 && searchQuery.trim() && (
                    <div className="p-4 text-center">
                      <p className="text-muted-foreground mb-2">No exercises found for "{searchQuery}"</p>
                      <Button onClick={handleCreateMode}>
                        Create "{searchQuery}" Exercise
                      </Button>
                    </div>
                  )}
                  {filteredExercises.length === 0 && !searchQuery.trim() && (
                    <p className="text-center text-muted-foreground py-4">
                      No exercises found. Try a different filter.
                    </p>
                  )}
                </div>
              </ScrollArea>
              {searchQuery.trim() && filteredExercises.length > 0 && (
                <div className="mt-2 pt-2 border-t flex justify-center">
                  <Button variant="outline" onClick={handleCreateMode}>
                    Create New Exercise
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

