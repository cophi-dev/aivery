"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format, isToday } from "date-fns"
import { useSession } from "next-auth/react"
import { 
  LucideArrowLeft, CalendarIcon, LucidePlus, LucideX, 
  Search, Zap, Target, Weight, Dumbbell, Home, 
  Footprints, Bike, Waves, PersonStanding, Lightbulb,
  Timer, MapPin, Trash2
} from "lucide-react"
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'react-hot-toast'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fetchAllExercisesAction, searchAllExercisesAction } from "@/lib/exercise-actions"
import type { ExerciseData as DbExerciseData } from "@/types/db"
import { useDebounce } from "@/hooks/useDebounce"

// Simplified types
type WorkoutTypeOption = 'gym' | 'home' | 'running' | 'cycling' | 'swimming' | 'yoga'

type SetData = {
  id: string
  weight: string
  reps: string
  notes?: string
}

type WorkoutExercise = {
  id: string
  name: string
  exerciseId?: string
  sets: SetData[]
  duration?: string
  distance?: string
  notes?: string
}

// Professional workout categories
const workoutCategories = [
  {
    id: 'strength',
    name: 'Strength Training',
    description: 'Build muscle and power with resistance exercises',
    color: 'from-blue-600 to-indigo-600',
    icon: Dumbbell,
    types: [
      { id: 'gym', name: 'Gym Equipment', description: 'Barbells, machines, and free weights' },
      { id: 'home', name: 'Bodyweight', description: 'No equipment needed' }
    ]
  },
  {
    id: 'cardio',
    name: 'Cardiovascular',
    description: 'Improve endurance and heart health',
    color: 'from-orange-500 to-red-500',
    icon: Target,
    types: [
      { id: 'running', name: 'Running', description: 'Track distance and pace' },
      { id: 'cycling', name: 'Cycling', description: 'Indoor or outdoor rides' },
      { id: 'swimming', name: 'Swimming', description: 'Pool or open water' }
    ]
  },
  {
    id: 'flexibility',
    name: 'Flexibility & Recovery',
    description: 'Improve mobility and aid recovery',
    color: 'from-emerald-500 to-teal-500',
    icon: PersonStanding,
    types: [
      { id: 'yoga', name: 'Yoga & Stretching', description: 'Poses and flexibility work' }
    ]
  }
]

export default function CleanWorkoutLogger() {
  const router = useRouter()
  const { data: session } = useSession()
  
  // Core state
  const [step, setStep] = useState<'type' | 'build' | 'review'>('type')
  const [workoutType, setWorkoutType] = useState<WorkoutTypeOption | null>(null)
  const [date, setDate] = useState<Date>(new Date())
  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  
  // Data state
  const [allExercises, setAllExercises] = useState<DbExerciseData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DbExerciseData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  // AI state
  const [aiInput, setAiInput] = useState('')
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const exercises = await fetchAllExercisesAction()
        setAllExercises(exercises)
      } catch (error) {
        console.error('Failed to load exercises:', error)
        toast.error('Failed to load exercises')
      }
    }
    loadExercises()
  }, [])

  // Handle search
  useEffect(() => {
    const search = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([])
        return
      }
      
      setIsSearching(true)
      try {
        const results = await searchAllExercisesAction(debouncedSearch)
        setSearchResults(results.slice(0, 8))
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsSearching(false)
      }
    }
    search()
  }, [debouncedSearch])

  // Workout type selection
  const selectWorkoutType = (type: WorkoutTypeOption) => {
    setWorkoutType(type)
    setStep('build')
    
    // Auto-generate name
    const selectedCategory = workoutCategories.find(cat => 
      cat.types.some(t => t.id === type)
    )
    const selectedType = selectedCategory?.types.find(t => t.id === type)
    setWorkoutName(`${selectedType?.name || type} - ${format(date, 'MMM d')}`)
    
    // For cardio types, add the main exercise
    if (['running', 'cycling', 'swimming', 'yoga'].includes(type)) {
      addExercise(type)
    }
  }

  // Add exercise
  const addExercise = (exerciseName: string, exerciseData?: any) => {
    const exercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      name: exerciseName,
      exerciseId: exerciseData?._id,
      sets: ['running', 'cycling', 'swimming', 'yoga'].includes(workoutType || '') 
        ? [] 
        : [{ id: `set-${Date.now()}`, weight: '', reps: '' }],
      duration: ['running', 'cycling', 'swimming', 'yoga'].includes(workoutType || '') ? '30' : undefined,
      distance: ['running', 'cycling'].includes(workoutType || '') ? '5' : undefined
    }
    
    setExercises(prev => [...prev, exercise])
    setSearchQuery('')
    setSearchResults([])
  }

  // Update exercise
  const updateExercise = (exerciseId: string, field: string, value: any) => {
    setExercises(prev => prev.map(ex => 
      ex.id === exerciseId ? { ...ex, [field]: value } : ex
    ))
  }

  // Add set
  const addSet = (exerciseId: string) => {
    setExercises(prev => prev.map(ex => 
      ex.id === exerciseId 
        ? { ...ex, sets: [...ex.sets, { id: `set-${Date.now()}`, weight: '', reps: '' }] }
        : ex
    ))
  }

  // Update set
  const updateSet = (exerciseId: string, setId: string, field: string, value: string) => {
    setExercises(prev => prev.map(ex => 
      ex.id === exerciseId 
        ? {
            ...ex,
            sets: ex.sets.map(set => 
              set.id === setId ? { ...set, [field]: value } : set
            )
          }
        : ex
    ))
  }

  // Remove set
  const removeSet = (exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => 
      ex.id === exerciseId 
        ? { ...ex, sets: ex.sets.filter(set => set.id !== setId) }
        : ex
    ))
  }

  // Remove exercise
  const removeExercise = (exerciseId: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== exerciseId))
  }

  // Process with AI
  const processWithAI = async () => {
    if (!aiInput.trim()) return
    
    setIsProcessingAI(true)
    try {
      const response = await fetch('/api/ai/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiInput })
      })
      
      const data = await response.json()
      
      if (data.success && data.exercises) {
        const parsedExercises: WorkoutExercise[] = data.exercises.map((ex: any) => ({
          id: `ex-${Date.now()}-${Math.random()}`,
          name: ex.name,
          sets: ex.sets?.map((set: any, index: number) => ({
            id: `set-${Date.now()}-${index}`,
            weight: set.weight?.toString() || '',
            reps: set.reps?.toString() || '',
            notes: set.notes || ''
          })) || [],
          duration: ex.duration?.toString() || undefined,
          distance: ex.distance?.toString() || undefined,
          notes: ex.notes || ''
        }))
        
        setExercises(parsedExercises)
        setWorkoutType('gym') // Default to gym
        setStep('build')
        
        if (data.workoutName) {
          setWorkoutName(data.workoutName)
        }
        
        toast.success('Workout parsed successfully!')
      } else {
        toast.error(data.error || 'Failed to parse workout')
      }
    } catch (error) {
      console.error('AI processing failed:', error)
      toast.error('Failed to process workout')
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Save workout
  const saveWorkout = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to save workout')
      return
    }

    if (exercises.length === 0) {
      toast.error('Add at least one exercise')
      return
    }

    setIsSubmitting(true)
    
    try {
      const workoutData = {
        name: workoutName || 'Untitled Workout',
        date: date.toISOString(),
        type: workoutType,
        exercises: exercises.map(ex => ({
          name: ex.name,
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          duration: ex.duration,
          distance: ex.distance,
          notes: ex.notes
        }))
      }

      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData)
      })

      if (response.ok) {
        toast.success('Workout saved!')
        router.push('/workouts')
      } else {
        toast.error('Failed to save workout')
      }
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save workout')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Compute summary
  const summary = useMemo(() => {
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    const totalReps = exercises.reduce((sum, ex) => 
      sum + ex.sets.reduce((setSum, set) => setSum + (parseInt(set.reps) || 0), 0), 0
    )
    
    return {
      exercises: exercises.length,
      sets: totalSets,
      reps: totalReps
    }
  }, [exercises])

  return (
    <div className="min-h-screen bg-background">
      {/* Professional Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-10 w-10"
              >
                <LucideArrowLeft className="h-5 w-5" />
              </Button>
              
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">New Workout</h1>
                {summary.exercises > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {summary.exercises} exercises • {summary.sets} sets
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {isToday(date) ? 'Today' : format(date, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                  />
                </PopoverContent>
              </Popover>

              {step === 'build' && (
                <Button
                  onClick={saveWorkout}
                  disabled={exercises.length === 0 || isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? 'Saving...' : 'Save Workout'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Professional Type Selection */}
          {step === 'type' && (
            <motion.div
              key="type-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* AI Quick Log Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-8 border border-blue-200/50 dark:border-blue-800/30">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-start gap-6">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white">
                      <Lightbulb className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h2 className="text-2xl font-semibold mb-2">Quick Log with AI</h2>
                        <p className="text-muted-foreground">
                          Describe your workout and let AI parse it automatically
                        </p>
                      </div>
                      
                      <div className="flex gap-4">
                        <Textarea
                          placeholder="e.g., Did 3 sets of 10 push-ups and 2 sets of 15 squats..."
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          className="flex-1 min-h-[80px] resize-none bg-white dark:bg-background border-border/50"
                        />
                        <Button 
                          onClick={processWithAI}
                          disabled={!aiInput.trim() || isProcessingAI}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6"
                        >
                          {isProcessingAI ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Parse
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workout Type Selection */}
              <div className="text-center space-y-8">
                <div>
                  <h2 className="text-3xl font-semibold mb-3">Choose Workout Type</h2>
                  <p className="text-lg text-muted-foreground">
                    Select the type of workout you want to log
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {workoutCategories.map((category, index) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="space-y-4"
                    >
                      <div className={`bg-gradient-to-br ${category.color} rounded-2xl p-6 text-white`}>
                        <category.icon className="h-8 w-8 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                        <p className="text-white/80 text-sm">{category.description}</p>
                      </div>
                      
                      <div className="space-y-3">
                        {category.types.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => selectWorkoutType(type.id as WorkoutTypeOption)}
                            className="w-full p-4 text-left bg-card hover:bg-muted/50 rounded-xl border border-border transition-all duration-200 hover:shadow-md"
                          >
                            <h4 className="font-medium mb-1">{type.name}</h4>
                            <p className="text-sm text-muted-foreground">{type.description}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Build Workout */}
          {step === 'build' && (
            <motion.div
              key="build-workout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Workout Details */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="workout-name" className="text-sm font-medium">
                      Workout Name
                    </Label>
                    <Input
                      id="workout-name"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      placeholder="Enter workout name..."
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Exercise Search and List */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Exercise Search */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Add Exercises</h3>
                    
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Search Results</p>
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {searchResults.map((exercise) => (
                          <button
                            key={exercise._id}
                            onClick={() => addExercise(exercise.name, exercise)}
                            className="w-full p-3 text-left bg-card hover:bg-muted/50 rounded-lg border border-border transition-colors"
                          >
                            <div className="font-medium">{exercise.name}</div>
                            {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {exercise.muscleGroups.join(', ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Exercise List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Exercises ({exercises.length})</h3>
                    {exercises.length > 0 && (
                      <Badge variant="secondary">
                        {summary.sets} sets • {summary.reps} reps
                      </Badge>
                    )}
                  </div>

                  {exercises.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Weight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No exercises added yet</p>
                      <p className="text-sm">Search and add exercises to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {exercises.map((exercise, index) => (
                        <motion.div
                          key={exercise.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-card rounded-lg border border-border p-4"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium">{exercise.name}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExercise(exercise.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Strength Exercise Sets */}
                          {!['running', 'cycling', 'swimming', 'yoga'].includes(workoutType || '') && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Sets</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addSet(exercise.id)}
                                >
                                  <LucidePlus className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {exercise.sets.map((set, setIndex) => (
                                <div key={set.id} className="flex items-center gap-3">
                                  <span className="text-sm text-muted-foreground w-8">
                                    {setIndex + 1}
                                  </span>
                                  <Input
                                    placeholder="Weight"
                                    value={set.weight}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'weight', e.target.value)}
                                    className="flex-1"
                                  />
                                  <span className="text-sm text-muted-foreground">×</span>
                                  <Input
                                    placeholder="Reps"
                                    value={set.reps}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSet(exercise.id, set.id)}
                                  >
                                    <LucideX className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Cardio Exercise Details */}
                          {['running', 'cycling', 'swimming'].includes(workoutType || '') && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm">Duration (min)</Label>
                                <div className="relative mt-1">
                                  <Timer className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="30"
                                    value={exercise.duration || ''}
                                    onChange={(e) => updateExercise(exercise.id, 'duration', e.target.value)}
                                    className="pl-10"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm">Distance (km)</Label>
                                <div className="relative mt-1">
                                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="5"
                                    value={exercise.distance || ''}
                                    onChange={(e) => updateExercise(exercise.id, 'distance', e.target.value)}
                                    className="pl-10"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
} 