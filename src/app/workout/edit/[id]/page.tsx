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
import { LucideArrowLeft, LucideMinus, LucidePlus, LucideSave, LucideTrash, LucideTrash2, LucideInfo } from "lucide-react"
import { fetchWorkout, updateWorkout } from "@/lib/workout-actions"
import type { WorkoutData, Set, ExerciseData } from "@/types/db"
import { format } from "date-fns"

export default function EditWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutData>({
    _id: params.id,
    userId: "user123", // This should be replaced with actual user ID
    type: "strength",
    name: "",
    date: new Date(),
    duration: 0,
    volume: 0,
    exercises: [],
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exerciseDatabase, setExerciseDatabase] = useState<ExerciseData[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>("")
  const [isCreatingExercise, setIsCreatingExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState("")
  const [newExerciseMuscleGroups, setNewExerciseMuscleGroups] = useState("")
  const [newExerciseDescription, setNewExerciseDescription] = useState("")
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false)
  const [exerciseHistory, setExerciseHistory] = useState<{
    [key: string]: {
      lastDate: Date, 
      lastWeight: number, 
      lastReps: number,
      totalSets: number,
      motivationalNote?: string
    }
  }>({})

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
          router.push("/workouts") // Redirect to workouts list
        }
      } catch (error) {
        console.error("Failed to load workout:", error)
        router.push("/workouts") // Redirect to workouts list on error
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id, router])

  // Load exercise database
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch('/api/exercises')
        if (response.ok) {
          const data = await response.json()
          setExerciseDatabase(data)
        }
      } catch (error) {
        console.error('Failed to fetch exercises:', error)
      }
    }

    fetchExercises()
  }, [])

  // Generate sample exercises if the database is empty
  useEffect(() => {
    if (exerciseDatabase.length === 0) {
      // Sample exercises for demonstration
      const sampleExercises = [
        { _id: "ex1", name: "Bench Press", description: "Chest exercise", muscleGroups: ["chest", "triceps"], category: "strength" },
        { _id: "ex2", name: "Squat", description: "Leg exercise", muscleGroups: ["quadriceps", "glutes"], category: "strength" },
        { _id: "ex3", name: "Deadlift", description: "Back exercise", muscleGroups: ["back", "hamstrings"], category: "strength" },
        { _id: "ex4", name: "Pull-up", description: "Back exercise", muscleGroups: ["back", "biceps"], category: "strength" },
        { _id: "ex5", name: "Push-up", description: "Chest exercise", muscleGroups: ["chest", "triceps"], category: "strength" },
        { _id: "ex6", name: "Overhead Press", description: "Shoulder exercise", muscleGroups: ["shoulders"], category: "strength" },
        { _id: "ex7", name: "Barbell Row", description: "Back exercise", muscleGroups: ["back"], category: "strength" },
        { _id: "ex8", name: "Lunges", description: "Leg exercise", muscleGroups: ["quadriceps", "glutes"], category: "strength" },
        { _id: "ex9", name: "Dips", description: "Chest and triceps exercise", muscleGroups: ["chest", "triceps"], category: "strength" },
        { _id: "ex10", name: "Plank", description: "Core exercise", muscleGroups: ["core"], category: "strength" },
      ] as ExerciseData[]
      setExerciseDatabase(sampleExercises)
    }
  }, [exerciseDatabase])

  // Load exercise history
  useEffect(() => {
    const fetchExerciseHistory = async () => {
      try {
        const response = await fetch('/api/exercises/history')
        if (response.ok) {
          const data = await response.json()
          setExerciseHistory(data)
        }
      } catch (error) {
        console.error('Failed to fetch exercise history:', error)
      }
    }

    fetchExerciseHistory()
  }, [])

  // Filter to only show strength exercises
  const strengthExercises = exerciseDatabase.filter(exercise => 
    exercise.category === "strength"
  )

  // Handle adding a new exercise
  const handleAddExercise = () => {
    if (!selectedExercise) return;
    
    const exercise = exerciseDatabase.find(ex => ex.name === selectedExercise);
    if (exercise) {
      // Get last weight from history if available
      const history = exerciseHistory[exercise.name]
      const initialWeight = history ? history.lastWeight : 0

      setWorkout(prev => ({
        ...prev,
        exercises: [...(prev.exercises || []), { 
          name: exercise.name, 
          sets: [{ weight: initialWeight, reps: 0 }] 
        }]
      }));
      setSelectedExercise("");
    }
  };

  // Handle adding a custom exercise with more details
  const handleAddCustomExercise = () => {
    if (!newExerciseName.trim()) return;
    
    // Parse muscle groups from comma-separated string
    const muscleGroups = newExerciseMuscleGroups
      .split(',')
      .map(group => group.trim().toLowerCase())
      .filter(group => group.length > 0);
    
    // Use default muscle groups if none provided
    const finalMuscleGroups = muscleGroups.length > 0 
      ? muscleGroups 
      : ["custom"];
    
    // Create the exercise
    const newExercise = {
      _id: `ex${Date.now()}`,
      name: newExerciseName.trim(),
      description: newExerciseDescription || "Custom exercise",
      muscleGroups: finalMuscleGroups,
      category: "strength"
    } as ExerciseData;
    
    // Add to workout
    setWorkout(prev => ({
      ...prev,
      exercises: [...(prev.exercises || []), { 
        name: newExerciseName.trim(), 
        sets: [{ weight: 0, reps: 0 }] 
      }]
    }));
    
    // Add to local exercise database
    setExerciseDatabase(prev => [...prev, newExercise]);
    
    // Reset form
    setNewExerciseName("");
    setNewExerciseMuscleGroups("");
    setNewExerciseDescription("");
    setIsCreatingExercise(false);
  };

  // Generate exercise details using AI
  const generateExerciseDetails = async () => {
    if (!newExerciseName.trim()) return;
    
    try {
      setIsGeneratingDetails(true);
      setNewExerciseDescription("");
      setNewExerciseMuscleGroups("");
      
      // Call the AI service to get exercise details
      const response = await fetch('/api/exercises/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exerciseName: newExerciseName.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.description) {
          setNewExerciseDescription(data.description);
        }
        if (data.muscleGroups && data.muscleGroups.length > 0) {
          setNewExerciseMuscleGroups(data.muscleGroups.join(', '));
        }
      }
    } catch (error) {
      console.error('Error generating exercise details:', error);
    } finally {
      setIsGeneratingDetails(false);
    }
  };
  
  // Handle name blur to trigger auto-suggestion
  const handleNameBlur = () => {
    if (newExerciseName.trim().length > 3) {
      generateExerciseDetails();
    }
  };

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
      const currentSets = newExercises[exerciseIndex].sets || [];
      
      // Get the values from the last set if it exists
      const lastSet = currentSets.length > 0 
        ? currentSets[currentSets.length - 1]
        : { weight: 0, reps: 0 };
      
      // Use the values from the last set
      newExercises[exerciseIndex] = {
        ...newExercises[exerciseIndex],
        sets: [...currentSets, { weight: lastSet.weight, reps: lastSet.reps }]
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
            <Link href="/workouts">Back to Workouts</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/workouts">
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
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="cycling">Cycling</SelectItem>
                      <SelectItem value="swimming">Swimming</SelectItem>
                      <SelectItem value="cardio">Other Cardio</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={workout.date instanceof Date 
                      ? workout.date.toISOString().split('T')[0]
                      : new Date(workout.date).toISOString().split('T')[0]}
                    onChange={(e) => updateWorkoutField("date", new Date(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={workout.duration || 0}
                    onChange={(e) => updateWorkoutField("duration", parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Cardio-specific fields */}
              {(workout.type === "running" || workout.type === "cycling" || workout.type === "swimming" || workout.type === "cardio") && (
                <div className="space-y-4 border-t pt-4 mt-4">
                  <h3 className="font-medium">Cardio Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="distance">Distance (km)</Label>
                      <Input
                        id="distance"
                        type="number"
                        step="0.01"
                        value={workout.distance || workout.cardioDetails?.distance || 0}
                        onChange={(e) => {
                          const distance = parseFloat(e.target.value);
                          updateWorkoutField("distance", distance);
                          
                          // Update cardioDetails as well for consistency
                          const currentCardioDetails = workout.cardioDetails || {};
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            distance
                          });
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="pace">Pace (min/km)</Label>
                      <Input
                        id="pace"
                        type="number"
                        step="0.01"
                        value={workout.cardioDetails?.pace || 0}
                        onChange={(e) => {
                          const pace = parseFloat(e.target.value);
                          const currentCardioDetails = workout.cardioDetails || {};
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            pace
                          });
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="avgHeartRate">Average Heart Rate (bpm)</Label>
                      <Input
                        id="avgHeartRate"
                        type="number"
                        value={workout.cardioDetails?.heartRate?.average || 0}
                        onChange={(e) => {
                          const average = parseInt(e.target.value);
                          const currentCardioDetails = workout.cardioDetails || {};
                          const currentHeartRate = currentCardioDetails.heartRate || {};
                          
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            heartRate: {
                              ...currentHeartRate,
                              average
                            }
                          });
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maxHeartRate">Max Heart Rate (bpm)</Label>
                      <Input
                        id="maxHeartRate"
                        type="number"
                        value={workout.cardioDetails?.heartRate?.max || 0}
                        onChange={(e) => {
                          const max = parseInt(e.target.value);
                          const currentCardioDetails = workout.cardioDetails || {};
                          const currentHeartRate = currentCardioDetails.heartRate || {};
                          
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            heartRate: {
                              ...currentHeartRate,
                              max
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                  
                  {(workout.type === "running" || workout.type === "cycling") && (
                    <div className="space-y-2">
                      <Label htmlFor="elevationGain">Elevation Gain (m)</Label>
                      <Input
                        id="elevationGain"
                        type="number"
                        value={workout.cardioDetails?.elevationGain || 0}
                        onChange={(e) => {
                          const elevationGain = parseInt(e.target.value);
                          const currentCardioDetails = workout.cardioDetails || {};
                          
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            elevationGain
                          });
                        }}
                      />
                    </div>
                  )}
                  
                  {workout.type === "cycling" && (
                    <div className="space-y-2">
                      <Label htmlFor="power">Average Power (W)</Label>
                      <Input
                        id="power"
                        type="number"
                        value={workout.cardioDetails?.power?.average || 0}
                        onChange={(e) => {
                          const average = parseInt(e.target.value);
                          const currentCardioDetails = workout.cardioDetails || {};
                          const currentPower = currentCardioDetails.power || {};
                          
                          updateWorkoutField("cardioDetails", {
                            ...currentCardioDetails,
                            power: {
                              ...currentPower,
                              average
                            }
                          });
                        }}
                      />
                    </div>
                  )}
                  
                  {(workout.type === "running" || workout.type === "cycling") && (
                    <div className="space-y-2">
                      <Label htmlFor="stravaLink">Strava Link</Label>
                      <Input
                        id="stravaLink"
                        placeholder="https://www.strava.com/activities/..."
                        value={workout.stravaLink || ""}
                        onChange={(e) => updateWorkoutField("stravaLink", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Paste your Strava activity URL to connect this workout to Strava
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add your personal comments about this workout..."
                  value={workout.notes || ""}
                  onChange={(e) => updateWorkoutField("notes", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Personal notes about this workout. Imported data from Strava is automatically stored in the appropriate fields.
                </p>
              </div>
            </CardContent>
          </Card>

          {workout.type === "strength" && (
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

                {/* Simple exercise selector */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <Label className="text-base font-medium">Add Exercise</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setIsCreatingExercise(!isCreatingExercise);
                        setSelectedExercise("");
                        setNewExerciseName("");
                        setNewExerciseMuscleGroups("");
                        setNewExerciseDescription("");
                      }}
                    >
                      {isCreatingExercise ? "Select Existing" : "Create New"}
                    </Button>
                  </div>
                  
                  {isCreatingExercise ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-exercise">Exercise Name</Label>
                        <div className="flex gap-2">
                          <Input
                            id="new-exercise"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            onBlur={handleNameBlur}
                            placeholder="Enter exercise name"
                            className="flex-1"
                            disabled={isGeneratingDetails}
                          />
                          <Button 
                            variant="outline"
                            onClick={generateExerciseDetails}
                            disabled={!newExerciseName.trim() || isGeneratingDetails}
                          >
                            {isGeneratingDetails ? 
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div> : 
                              "Suggest"
                            }
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the exercise name and we'll suggest details for you
                        </p>
                      </div>
                      
                      {isGeneratingDetails && (
                        <div className="flex items-center justify-center my-2 py-2 text-sm text-muted-foreground bg-muted/50 rounded-md">
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current mr-2"></div>
                          Getting exercise details...
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="muscle-groups">Target Muscles</Label>
                        <Input
                          id="muscle-groups"
                          value={newExerciseMuscleGroups}
                          onChange={(e) => setNewExerciseMuscleGroups(e.target.value)}
                          placeholder="e.g. chest, triceps, shoulders (comma separated)"
                          disabled={isGeneratingDetails}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="exercise-description">Description</Label>
                        <Textarea
                          id="exercise-description"
                          value={newExerciseDescription}
                          onChange={(e) => setNewExerciseDescription(e.target.value)}
                          placeholder="Brief description of the exercise"
                          rows={2}
                          disabled={isGeneratingDetails}
                        />
                      </div>
                      
                      <div className="flex justify-end mt-4">
                        <Button 
                          onClick={handleAddCustomExercise} 
                          disabled={!newExerciseName.trim() || isGeneratingDetails}
                        >
                          <LucidePlus className="h-4 w-4 mr-1" />
                          Add Exercise
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select exercise" />
                          </SelectTrigger>
                          <SelectContent>
                            {strengthExercises.map((exercise) => (
                              <SelectItem key={exercise._id} value={exercise.name}>
                                {exercise.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddExercise} disabled={!selectedExercise}>
                          <LucidePlus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      
                      {selectedExercise && exerciseHistory[selectedExercise] && (
                        <div className="mt-2 p-3 text-sm bg-muted rounded-md">
                          <div className="flex items-center mb-1">
                            <LucideInfo className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Last workout details:</span>
                          </div>
                          <div className="ml-6 space-y-1">
                            <div>
                              <span className="text-muted-foreground">Date:</span> {format(new Date(exerciseHistory[selectedExercise].lastDate), 'MMM d, yyyy')}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Weight:</span> {exerciseHistory[selectedExercise].lastWeight}kg
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reps:</span> {exerciseHistory[selectedExercise].lastReps}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sets:</span> {exerciseHistory[selectedExercise].totalSets}
                            </div>
                            {exerciseHistory[selectedExercise].motivationalNote && (
                              <div className="mt-2 text-primary font-medium">
                                {exerciseHistory[selectedExercise].motivationalNote}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center mb-4">
            <Link href="/workouts">Back to Workouts</Link>
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
            <Button variant="outline" onClick={() => router.push("/workouts")}>
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

