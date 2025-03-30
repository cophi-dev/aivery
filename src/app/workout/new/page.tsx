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
import { fetchExercises, getExerciseHistory } from "@/lib/exercise-actions"
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
import { generateExerciseInsights } from "@/lib/ai-workout-insights"
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
  
  const [exercises, setExercises] = useState<Array<{name: string, sets: Array<{weight: number, reps: number}>}>>([])

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
  const [activeExerciseHistory, setActiveExerciseHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [exerciseInsights, setExerciseInsights] = useState<Record<string, { insight: string; suggestion: string }>>({})

  const [workoutSteps, setWorkoutSteps] = useState({
    selectExercises: 0,
    setsAndReps: 1,
    finalize: 2
  });

  // Track history for each exercise
  const [exerciseHistories, setExerciseHistories] = useState<Record<string, any[]>>({});

  // Fetch exercises from database
  useEffect(() => {
    const loadExercises = async () => {
      const exercises = await fetchExercises()
      setDbExercises(exercises)
    }
    loadExercises()
  }, [])

  // Auto-open exercise dialog when there's a blank exercise
  useEffect(() => {
    // Disable this auto-opening behavior for now since it's causing issues
    // Only run this when on step 1 and there's a blank exercise
    // if (currentStep === 1 && exercises.length === 1 && !exercises[0].name && !dialogOpen) {
    //   // Small timeout to ensure UI is rendered first
    //   const timer = setTimeout(() => {
    //     openExerciseDialog(0);
    //   }, 300);
      
    //   return () => clearTimeout(timer);
    // }
  }, [currentStep, exercises, dialogOpen]);

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

  const selectExercise = async (exercise: ExerciseData) => {
    // Check if exercise is already added
    const existingIndex = exercises.findIndex(e => e.name === exercise.name);
    
    if (existingIndex >= 0) {
      // Exercise already exists, just close dialog
      setDialogOpen(false);
      return;
    }
    
    // Get exercise history data first to prefill sets
    try {
      setIsLoadingHistory(true);
      
      const history = await getExerciseHistory(exercise._id);
      
      // Store history for this specific exercise
      const updatedHistories = { ...exerciseHistories };
      updatedHistories[exercise.name] = history;
      setExerciseHistories(updatedHistories);
      
      // Add this exercise to the list with previous set data if available
      const newExercises = [...exercises];
      const newExercise = {
        name: exercise.name,
        sets: [{ weight: 0, reps: 0 }]
      };
      
      // If there is history, prefill with the last workout's sets
      if (history && history.length > 0) {
        const lastWorkout = history[0];
        if (lastWorkout.sets && lastWorkout.sets.length > 0) {
          newExercise.sets = lastWorkout.sets.map(set => ({
            weight: set.weight,
            reps: set.reps
          }));
        }
        
        // Generate AI insights if there's workout history
        try {
          const insights = await generateExerciseInsights(history);
          const updatedInsights = { ...exerciseInsights };
          updatedInsights[exercise.name] = insights;
          setExerciseInsights(updatedInsights);
        } catch (insightError) {
          console.error("Error generating exercise insights:", insightError);
        }
      }
      
      // Add exercise to the list
      if (activeExerciseIndex !== null && activeExerciseIndex < exercises.length && !exercises[activeExerciseIndex]?.name) {
        newExercises[activeExerciseIndex] = newExercise;
      } else {
        newExercises.push(newExercise);
      }
      
      setExercises(newExercises);
    } catch (error) {
      console.error("Error fetching exercise history:", error);
      // If history fetch fails, still add the exercise with default values
      const newExercises = [...exercises];
      const newExercise = {
        name: exercise.name,
        sets: [{ weight: 0, reps: 0 }]
      };
      
      if (activeExerciseIndex !== null && activeExerciseIndex < exercises.length && !exercises[activeExerciseIndex]?.name) {
        newExercises[activeExerciseIndex] = newExercise;
      } else {
        newExercises.push(newExercise);
      }
      
      setExercises(newExercises);
    } finally {
      setIsLoadingHistory(false);
      setDialogOpen(false);
    }
  }

  const closeExerciseDialog = () => {
    // Clear history and close dialog
    setActiveExerciseHistory([]);
    setExerciseInsights({});
    setDialogOpen(false);
    setIsCreatingExercise(false);
  }

  const openExerciseDialog = (index: number) => {
    // Now that we have the dialog again, let's properly set it up
    setActiveExerciseIndex(index);
    setDialogOpen(true);
  }

  // Make sure this is the ONLY function used for adding exercises
  const quickAddExercise = async (exercise: ExerciseData) => {
    // Check if exercise is already added
    const existingIndex = exercises.findIndex(e => e.name === exercise.name);
    
    if (existingIndex >= 0) {
      // Exercise already exists, do nothing
      return;
    }
    
    try {
      // Get exercise history data for prefilling sets
      const history = await getExerciseHistory(exercise._id);
      
      // Store history for this specific exercise
      const updatedHistories = { ...exerciseHistories };
      updatedHistories[exercise.name] = history;
      setExerciseHistories(updatedHistories);
      
      // Add this exercise to the list
      const newExercises = [...exercises];
      const newExercise = {
        name: exercise.name,
        sets: [{ weight: 0, reps: 0 }]
      };
      
      // If there is history, prefill with the last workout's sets
      if (history && history.length > 0) {
        const lastWorkout = history[0];
        if (lastWorkout.sets && lastWorkout.sets.length > 0) {
          newExercise.sets = lastWorkout.sets.map(set => ({
            weight: set.weight,
            reps: set.reps
          }));
        }
        
        // Generate AI insights if there's workout history
        try {
          const insights = await generateExerciseInsights(history);
          const updatedInsights = { ...exerciseInsights };
          updatedInsights[exercise.name] = insights;
          setExerciseInsights(updatedInsights);
        } catch (insightError) {
          console.error("Error generating exercise insights:", insightError);
        }
      }
      
      // Add the exercise to the list
      newExercises.push(newExercise);
      setExercises(newExercises);
      
    } catch (error) {
      console.error("Error fetching exercise history:", error);
      // If history fetch fails, still add the exercise with default values
      const newExercises = [...exercises];
      newExercises.push({
        name: exercise.name,
        sets: [{ weight: 0, reps: 0 }]
      });
      setExercises(newExercises);
    }
  }

  const handleNextStep = () => {
    // Before proceeding to the next step, clean up empty exercises
    if (currentStep === workoutSteps.selectExercises) {
      const cleanedExercises = exercises.filter(ex => ex.name.trim() !== "");
      
      // If we removed any exercises, update the state
      if (cleanedExercises.length !== exercises.length) {
        setExercises(cleanedExercises);
      }
      
      // If there are no exercises, don't proceed
      if (cleanedExercises.length === 0) {
        window.alert("Please select at least one exercise before continuing");
        return;
      }
    }
    
    setCurrentStep(prev => prev + 1);
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
        category: (newExerciseData.category as "strength" | "cardio" | "flexibility") || "strength",
        equipment: newExerciseData.equipment,
        instructions: newExerciseData.instructions
      })
      
      if (created) {
        // Check if the exercise already exists in our workout
        const existingIndex = exercises.findIndex(ex => ex.name === created.name);
        
        if (existingIndex >= 0) {
          // Exercise with this name already exists
          setIsSubmitting(false);
          window.alert("This exercise already exists in your workout");
          return;
        }
        
        // Add to local DB exercises list
        setDbExercises([...dbExercises, created]);
        
        // Add to the workout exercise list
        const newExercises = [...exercises];
        
        // Either update an empty exercise slot or add a new one
        if (activeExerciseIndex !== null && !exercises[activeExerciseIndex].name) {
          newExercises[activeExerciseIndex].name = created.name;
        } else {
          newExercises.push({
            name: created.name,
            sets: [{ weight: 0, reps: 0 }]
          });
        }
        
        setExercises(newExercises);
        
        // Reset creating state and form
        setIsCreatingExercise(false);
        setNewExerciseData({
          name: "",
          description: "",
          muscleGroups: [],
          category: "strength",
          equipment: "",
          instructions: ""
        });
        
        // Close dialog
        closeExerciseDialog();
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
        console.log("Generating exercise details for:", name)
        const details = await generateExerciseDetails(name)
        setNewExerciseData(prev => ({
          ...prev,
          ...details,
          name
        }))
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

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "MMM d, yyyy")
  }

  // Calculate average weight and reps from sets
  const calculateSetAverages = (sets: Array<{weight: number, reps: number}>) => {
    if (!sets.length) return { avgWeight: 0, avgReps: 0, totalVolume: 0 }
    
    const totalWeight = sets.reduce((sum, set) => sum + set.weight, 0)
    const totalReps = sets.reduce((sum, set) => sum + set.reps, 0)
    const avgWeight = totalWeight / sets.length
    const avgReps = totalReps / sets.length
    const totalVolume = sets.reduce((sum, set) => sum + (set.weight * set.reps), 0)
    
    return { avgWeight, avgReps, totalVolume }
  }

  // Add a helper function for fuzzy matching to detect near matches
  const findSimilarExercise = (query: string, exercises: ExerciseData[]): ExerciseData | null => {
    if (!query || query.length < 3) return null;
    
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // First check for exercises containing the full query
    const containsMatch = exercises.find(e => 
      e.name.toLowerCase().includes(normalizedQuery)
    );
    
    if (containsMatch) return containsMatch;
    
    // Check for word matches (e.g. "bench" should match "Bench Press")
    const words = normalizedQuery.split(/\s+/);
    if (words.length > 1) {
      const wordMatch = exercises.find(e => 
        words.some(word => word.length > 3 && e.name.toLowerCase().includes(word))
      );
      if (wordMatch) return wordMatch;
    }
    
    // Check for very similar names using Levenshtein distance
    // A simple version - we consider anything with more than 70% character overlap
    for (const exercise of exercises) {
      const exerciseName = exercise.name.toLowerCase();
      let matchCount = 0;
      for (let i = 0; i < normalizedQuery.length; i++) {
        if (exerciseName.includes(normalizedQuery[i])) {
          matchCount++;
        }
      }
      const similarity = matchCount / normalizedQuery.length;
      if (similarity > 0.7) {
        return exercise;
      }
    }
    
    return null;
  };

  // Add a function to create a new exercise from search query
  const createExerciseFromQuery = async () => {
    // Instead of creating directly, show the dialog with prefilled name
    setNewExerciseData({
      name: searchQuery.trim(),
      description: "",
      muscleGroups: [],
      category: "strength",
      equipment: "",
      instructions: ""
    });
    
    // Start generating details with AI
    handleNewExerciseNameChange(searchQuery.trim());
    
    // Show the create exercise dialog
    setIsCreatingExercise(true);
    setDialogOpen(true);
  };

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

      <Steps current={currentStep} total={3} onStepClick={goToStep}>
        <div className="text-xs md:text-sm text-center space-x-4 md:space-x-0">
          <span className={`${currentStep === 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>Select Exercises</span>
          <span className={`${currentStep === 1 ? "text-primary font-medium" : "text-muted-foreground"}`}>Sets & Reps</span>
          <span className={`${currentStep === 2 ? "text-primary font-medium" : "text-muted-foreground"}`}>Finish</span>
        </div>
      </Steps>

      {/* Step 1: Select Exercises */}
      <StepContent step={workoutSteps.selectExercises} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideDumbbell className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Select exercises for your workout</h2>
                <p className="text-sm text-muted-foreground">Choose the exercises you want to include in this workout</p>
              </div>
            </div>
            
            {/* Always show selected exercises at the top if any exist */}
            {exercises.length > 0 && (
              <div className="space-y-4 mb-6">
                <h3 className="font-medium">Selected Exercises</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {exercises.map((exercise, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between border rounded-lg px-4 py-3 bg-background"
                    >
                      <div className="flex items-center">
                        <LucideDumbbell className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{exercise.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 ml-2"
                        onClick={() => removeExercise(index)}
                      >
                        <LucideTrash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Always show exercise selection options */}
            <div className="space-y-6">
              {exercises.length === 0 && (
                <div className="text-center p-6 border border-dashed rounded-md bg-muted/20 mb-6">
                  <LucideDumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">No exercises selected yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Select from exercises below</p>
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="font-medium">Recent Exercises</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {dbExercises
                    .slice(0, 6)
                    .filter(exercise => !exercises.some(e => e.name === exercise.name))
                    .map(exercise => (
                      <Button 
                        key={exercise._id}
                        variant="outline"
                        className="h-auto py-3 justify-start"
                        onClick={() => quickAddExercise(exercise)}
                      >
                        <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                        {exercise.name}
                      </Button>
                    ))}
                  {dbExercises
                    .slice(0, 6)
                    .filter(exercise => exercises.some(e => e.name === exercise.name))
                    .map(exercise => (
                      <Button 
                        key={exercise._id}
                        variant="outline"
                        disabled
                        className="h-auto py-3 justify-start bg-muted cursor-not-allowed opacity-60"
                      >
                        <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                        {exercise.name}
                        <Badge variant="secondary" className="ml-2 text-xs">Selected</Badge>
                      </Button>
                    ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium">Popular Exercises</h3>
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Upper Body</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {['Bench Press', 'Push-ups', 'Pull-ups', 'Shoulder Press', 'Bicep Curls', 'Tricep Dips'].map(name => {
                      const exercise = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
                      if (!exercise) return null;
                      
                      const isSelected = exercises.some(e => e.name === exercise.name);
                      
                      return (
                        <Button 
                          key={name}
                          variant="outline"
                          disabled={isSelected}
                          className={`h-auto py-3 justify-start ${isSelected ? 'bg-muted cursor-not-allowed opacity-60' : ''}`}
                          onClick={() => !isSelected && quickAddExercise(exercise)}
                        >
                          <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                          {name}
                          {isSelected && <Badge variant="secondary" className="ml-2 text-xs">Selected</Badge>}
                        </Button>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Full Body</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {['Squats', 'Deadlifts', 'Lunges', 'Burpees', 'Kettlebell Swings', 'Mountain Climbers'].map(name => {
                      const exercise = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
                      if (!exercise) return null;
                      
                      const isSelected = exercises.some(e => e.name === exercise.name);
                      
                      return (
                        <Button 
                          key={name}
                          variant="outline"
                          disabled={isSelected}
                          className={`h-auto py-3 justify-start ${isSelected ? 'bg-muted cursor-not-allowed opacity-60' : ''}`}
                          onClick={() => !isSelected && quickAddExercise(exercise)}
                        >
                          <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                          {name}
                          {isSelected && <Badge variant="secondary" className="ml-2 text-xs">Selected</Badge>}
                        </Button>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center mb-3">
                  <Label htmlFor="quick-search">Search other exercises</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="quick-search"
                    placeholder="Type an exercise name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>
                {searchQuery.trim() && (
                  <div className="mt-3 border rounded-lg p-2">
                    <h4 className="text-sm font-medium mb-2">Search Results</h4>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {dbExercises
                        .filter(e => 
                          (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.muscleGroups.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))) &&
                          !exercises.some(selected => selected.name === e.name)
                        )
                        .slice(0, 8)
                        .map(exercise => (
                          <Button 
                            key={exercise._id}
                            variant="ghost"
                            className="w-full justify-start h-auto py-2"
                            onClick={() => quickAddExercise(exercise)}
                          >
                            <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                            {exercise.name}
                          </Button>
                        ))}
                      
                      {/* Show suggested similar exercise if exact match not found */}
                      {(() => {
                        const exactMatchExists = dbExercises.some(e => 
                          e.name.toLowerCase() === searchQuery.toLowerCase());
                        
                        const similarExercise = !exactMatchExists && findSimilarExercise(searchQuery, dbExercises);
                        
                        if (similarExercise && !exercises.some(e => e.name === similarExercise.name)) {
                          return (
                            <div className="pt-2 pb-1 border-t mt-2">
                              <p className="text-xs text-muted-foreground mb-2">Did you mean:</p>
                              <Button 
                                variant="ghost"
                                className="w-full justify-start h-auto py-2"
                                onClick={() => {
                                  quickAddExercise(similarExercise);
                                  setSearchQuery("");
                                }}
                              >
                                <LucideDumbbell className="h-4 w-4 mr-2 text-primary" />
                                {similarExercise.name}
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {dbExercises.filter(e => 
                        (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        e.muscleGroups.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))) &&
                        !exercises.some(selected => selected.name === e.name)
                      ).length === 0 && (
                        <div className="text-center py-3 space-y-3">
                          <p className="text-muted-foreground text-sm">
                            No exercises found matching "{searchQuery}"
                          </p>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={createExerciseFromQuery}
                          >
                            <LucidePlus className="h-4 w-4 mr-2" />
                            Create "{searchQuery}" Exercise
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Add back the date, duration, and intensity controls */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="workout-date">Date:</Label>
                    <Input 
                      id="workout-date" 
                      type="date" 
                      value={workoutDate}
                      onChange={(e) => setWorkoutDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="workout-duration">Duration:</Label>
                    <Input 
                      id="workout-duration" 
                      type="number" 
                      placeholder="Minutes" 
                      value={workoutDuration || ""}
                      onChange={(e) => setWorkoutDuration(parseInt(e.target.value) || undefined)}
                      className="w-24"
                    />
                    <span className="text-sm">min</span>
                  </div>
                </div>
                
                <Select 
                  value={workoutIntensity}
                  onValueChange={setWorkoutIntensity}
                >
                  <SelectTrigger className="w-auto">
                    <SelectValue placeholder="Intensity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Light</SelectItem>
                    <SelectItem value="medium">Moderate</SelectItem>
                    <SelectItem value="high">Intense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <StepActions 
          hasPrevious={false} 
          onNext={handleNextStep}
          isNextDisabled={exercises.length === 0}
        />
      </StepContent>

      {/* Step 2: Sets and Reps */}
      <StepContent step={workoutSteps.setsAndReps} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideListChecks className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Sets and Reps</h2>
                <p className="text-sm text-muted-foreground">Enter the weights and repetitions for each exercise</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {exercises.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  <p>No exercises selected</p>
                  <Button 
                    onClick={() => goToStep(workoutSteps.selectExercises)} 
                    variant="outline" 
                    className="mt-2"
                  >
                    Go back to select exercises
                  </Button>
                </div>
              ) : (
                exercises.map((exercise, exerciseIndex) => {
                  const exerciseHistory = exerciseHistories[exercise.name] || [];
                  const insight = exerciseInsights[exercise.name];
                  
                  return (
                    <div 
                      key={exerciseIndex} 
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center border-b pb-2 mb-2">
                        <h3 className="font-medium text-lg">{exercise.name}</h3>
                      </div>
                      
                      {/* Exercise history note */}
                      {exerciseHistory.length > 0 && (
                        <div className="text-sm bg-muted/40 p-2 rounded mb-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last performed:</span>
                            <span className="font-medium">{formatDate(exerciseHistory[0].createdAt)}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-muted-foreground">Previous performance:</span>
                            <span className="ml-1">
                              {exerciseHistory[0].sets.map((set: {weight: number, reps: number}, i: number) => 
                                `${set.weight}kg×${set.reps}${i < exerciseHistory[0].sets.length - 1 ? ', ' : ''}`
                              )}
                            </span>
                          </div>
                          {insight && (
                            <div className="mt-2 text-xs border-t border-muted pt-2">
                              <span className="font-medium text-primary">AI Suggestion:</span>
                              <p className="mt-1">{insight.suggestion}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        {exercise.sets.map((set, setIndex) => (
                          <div key={setIndex} className="grid grid-cols-12 gap-2 items-center bg-accent/10 p-2 rounded">
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
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <StepActions 
          onPrevious={handlePreviousStep} 
          onNext={handleNextStep}
          isNextDisabled={!isExercisesValid()}
        />
      </StepContent>

      {/* Step 3: Finalize */}
      <StepContent step={workoutSteps.finalize} currentStep={currentStep}>
        <Card>
          <CardContent className="p-4 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-full">
                <LucideSave className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Finalize your workout</h2>
                <p className="text-sm text-muted-foreground">Add a name and notes to complete your workout</p>
              </div>
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

      {/* Exercise creation/selection dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeExerciseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Create New Exercise
            </DialogTitle>
            <DialogDescription>
              Add a new exercise to your workout
            </DialogDescription>
          </DialogHeader>
          <button 
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none" 
            onClick={closeExerciseDialog}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          
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

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Target Muscle Groups</Label>
                {isGeneratingDetails && <span className="text-xs text-muted-foreground italic">(Auto-filling...)</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Chest", value: "chest" },
                  { label: "Back", value: "back" },
                  { label: "Shoulders", value: "shoulders" },
                  { label: "Arms", value: "biceps" },
                  { label: "Legs", value: "quadriceps" },
                  { label: "Core", value: "core" }
                ].map(group => {
                  const selected = newExerciseData.muscleGroups?.includes(group.value) || false;
                  return (
                    <Button
                      key={group.value}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="h-auto py-2"
                      onClick={() => {
                        if (selected) {
                          // Remove if already selected
                          setNewExerciseData({
                            ...newExerciseData,
                            muscleGroups: newExerciseData.muscleGroups?.filter(g => g !== group.value)
                          });
                        } else {
                          // Add if not selected
                          setNewExerciseData({
                            ...newExerciseData,
                            muscleGroups: [...(newExerciseData.muscleGroups || []), group.value]
                          });
                        }
                      }}
                    >
                      {group.label}
                    </Button>
                  );
                })}
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
              {isGeneratingDetails && (
                <p className="text-xs text-muted-foreground mt-1">
                  AI is suggesting equipment based on the exercise name
                </p>
              )}
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
              {isGeneratingDetails && (
                <p className="text-xs text-muted-foreground mt-1">
                  AI is creating a detailed description...
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                type="button"
                onClick={closeExerciseDialog}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={createNewExercise}
                disabled={isSubmitting || !newExerciseData.name?.trim() || (newExerciseData.muscleGroups?.length || 0) === 0}
              >
                {isSubmitting || isGeneratingDetails ? 
                  <span className="flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
                    {isGeneratingDetails ? "Generating..." : "Creating..."}
                  </span> : 
                  "Create Exercise"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

