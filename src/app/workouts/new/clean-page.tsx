"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isToday } from "date-fns"
import { useSession } from "next-auth/react"
import { 
  LucideArrowLeft, CalendarIcon, LucidePlus, LucideX, 
  Search, Zap, Target, Weight, Timer, Dumbbell, Home, 
  Footprints, Bike, Waves, PersonStanding, Lightbulb 
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
  duration?: string // for cardio
  distance?: string // for cardio
  notes?: string
}

// Workout categories with cleaner design
const workoutCategories = [
  {
    id: 'strength',
    name: 'Strength Training',
    description: 'Build muscle and power',
    types: [
      { id: 'gym', name: 'Gym Workout', icon: Dumbbell, color: 'blue' },
      { id: 'home', name: 'Home Workout', icon: Home, color: 'green' }
    ]
  },
  {
    id: 'cardio',
    name: 'Cardiovascular',
    description: 'Improve endurance',
    types: [
      { id: 'running', name: 'Running', icon: Footprints, color: 'orange' },
      { id: 'cycling', name: 'Cycling', icon: Bike, color: 'purple' },
      { id: 'swimming', name: 'Swimming', icon: Waves, color: 'cyan' }
    ]
  },
  {
    id: 'flexibility',
    name: 'Flexibility & Recovery',
    description: 'Mobility and wellness',
    types: [
      { id: 'yoga', name: 'Yoga & Stretching', icon: PersonStanding, color: 'pink' }
    ]
  }
]

// Popular exercises by type
const popularExercises = {
  gym: ['Bench Press', 'Squat', 'Deadlift', 'Pull-up', 'Overhead Press', 'Barbell Row'],
  home: ['Push-up', 'Bodyweight Squat', 'Plank', 'Lunge', 'Burpee', 'Mountain Climber'],
  running: ['Running'],
  cycling: ['Cycling'],
  swimming: ['Swimming'],
  yoga: ['Yoga Session']
}

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
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
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
    const typeName = workoutCategories
      .flatMap(cat => cat.types)
      .find(t => t.id === type)?.name || type
    setWorkoutName(`${typeName} - ${format(date, 'MMM d')}`)
    
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
    setActiveExercise(exercise.id)
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
    if (activeExercise === exerciseId) {
      setActiveExercise(null)
    }
  }

  // AI Processing
  const processWithAI = async () => {
    if (!aiInput.trim()) return
    
    setIsProcessingAI(true)
    try {
      const response = await fetch('/api/ai/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logText: aiInput })
      })
      
      if (!response.ok) throw new Error('AI processing failed')
      
      const data = await response.json()
      
      // Process the AI response
      if (data.exercises?.length > 0) {
        const newExercises = data.exercises.map((ex: any) => ({
          id: `ex-${Date.now()}-${Math.random()}`,
          name: ex.name,
          sets: ex.sets?.map((set: any, i: number) => ({
            id: `set-${Date.now()}-${i}`,
            weight: set.weight || '',
            reps: set.reps || ''
          })) || []
        }))
        
        setExercises(newExercises)
        setStep('build')
        
        // Try to infer workout type
        if (data.workoutType) {
          setWorkoutType(data.workoutType)
        } else {
          // Default to gym for strength exercises
          setWorkoutType('gym')
        }
      }
      
      setAiInput('')
      toast.success('Workout parsed successfully!')
      
    } catch (error) {
      console.error('AI processing failed:', error)
      toast.error('AI processing failed')
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Calculate summary
  const summary = useMemo(() => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
    const totalReps = exercises.reduce((acc, ex) => 
      acc + ex.sets.reduce((setAcc, set) => setAcc + (parseInt(set.reps) || 0), 0), 0
    )
    return { exercises: exercises.length, sets: totalSets, reps: totalReps }
  }, [exercises])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Clean Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-xl"
            >
              <LucideArrowLeft className="h-5 w-5" />
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold">New Workout</h1>
              {summary.exercises > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {summary.exercises} exercises • {summary.sets} sets • {summary.reps} reps
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl">
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

            <Button
              disabled={exercises.length === 0 || isSubmitting}
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              Save Workout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Choose Type */}
          {step === 'type' && (
            <motion.div
              key="type-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              {/* AI Quick Start */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl" />
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex items-start gap-6">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl text-white">
                      <Lightbulb className="h-8 w-8" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">Quick Log with AI</h2>
                        <p className="text-slate-600 dark:text-slate-400">
                          Describe your workout and let AI parse it automatically
                        </p>
                      </div>
                      
                      <div className="flex gap-3">
                        <Textarea
                          placeholder="e.g., Did 3 sets of 10 push-ups and 2 sets of 15 squats..."
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          className="flex-1 min-h-[60px] resize-none rounded-xl bg-white dark:bg-slate-800"
                        />
                        <Button 
                          onClick={processWithAI}
                          disabled={!aiInput.trim() || isProcessingAI}
                          className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
                        >
                          {isProcessingAI ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
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

              {/* Manual Selection */}
              <div className="text-center space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-3">Choose Your Workout</h2>
                  <p className="text-lg text-slate-600 dark:text-slate-400">
                    Or start building manually
                  </p>
                </div>

                <div className="grid gap-8">
                  {workoutCategories.map((category) => (
                    <div key={category.id} className="space-y-4">
                      <div className="text-left">
                        <h3 className="text-xl font-semibold">{category.name}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{category.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {category.types.map((type) => (
                          <motion.button
                            key={type.id}
                            onClick={() => selectWorkoutType(type.id as WorkoutTypeOption)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 text-left group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl bg-${type.color}-100 dark:bg-${type.color}-900/30 group-hover:scale-110 transition-transform`}>
                                <type.icon className={`h-6 w-6 text-${type.color}-600 dark:text-${type.color}-400`} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg">{type.name}</h4>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(popularExercises[type.id as keyof typeof popularExercises] || []).slice(0, 3).map((ex) => (
                                    <span key={ex} className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                      {ex}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Build Workout */}
          {step === 'build' && workoutType && (
            <motion.div
              key="workout-builder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setStep('type')}
                  className="text-slate-600 dark:text-slate-400"
                >
                  <LucideArrowLeft className="h-4 w-4 mr-2" />
                  Back to Types
                </Button>

                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                  {workoutCategories.flatMap(c => c.types).find(t => t.id === workoutType)?.name}
                </Badge>
              </div>

              {/* Workout Name */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <Label className="text-sm font-medium mb-2 block">Workout Name</Label>
                <Input
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="Enter workout name..."
                  className="text-lg font-semibold bg-transparent border-none p-0 focus-visible:ring-0"
                />
              </div>

              {/* Exercise Management */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Exercise Search & Add */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                    <h3 className="font-semibold mb-4">Add Exercises</h3>
                    
                    {/* Search */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search exercises..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-xl"
                        />
                      </div>
                      
                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {searchResults.map((exercise) => (
                            <button
                              key={exercise._id}
                              onClick={() => addExercise(exercise.name, exercise)}
                              className="w-full p-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              {exercise.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Add Popular */}
                    <div className="mt-6">
                      <Label className="text-sm font-medium mb-3 block">Popular</Label>
                      <div className="grid gap-1">
                        {(popularExercises[workoutType as keyof typeof popularExercises] || []).map((exercise) => (
                          <button
                            key={exercise}
                            onClick={() => addExercise(exercise)}
                            className="p-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <LucidePlus className="h-3 w-3" />
                            {exercise}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exercise List */}
                <div className="lg:col-span-2 space-y-4">
                  {exercises.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center">
                      <Target className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No exercises yet</h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        Search and add exercises to start building your workout
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {exercises.map((exercise, index) => (
                        <motion.div
                          key={exercise.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                        >
                          {/* Exercise Header */}
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="font-semibold">{exercise.name}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {exercise.sets.length > 0 ? `${exercise.sets.length} sets` : 'Cardio exercise'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveExercise(
                                  activeExercise === exercise.id ? null : exercise.id
                                )}
                              >
                                {activeExercise === exercise.id ? 'Collapse' : 'Expand'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExercise(exercise.id)}
                                className="text-red-500 hover:text-red-700 h-8 w-8"
                              >
                                <LucideX className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Exercise Details */}
                          <AnimatePresence>
                            {activeExercise === exercise.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 space-y-4">
                                  {/* Cardio Fields */}
                                  {['running', 'cycling', 'swimming', 'yoga'].includes(workoutType) && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm mb-2 block">Duration (min)</Label>
                                        <Input
                                          value={exercise.duration || ''}
                                          onChange={(e) => updateExercise(exercise.id, 'duration', e.target.value)}
                                          placeholder="30"
                                          className="rounded-xl"
                                        />
                                      </div>
                                      {['running', 'cycling'].includes(workoutType) && (
                                        <div>
                                          <Label className="text-sm mb-2 block">Distance (km)</Label>
                                          <Input
                                            value={exercise.distance || ''}
                                            onChange={(e) => updateExercise(exercise.id, 'distance', e.target.value)}
                                            placeholder="5"
                                            className="rounded-xl"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Sets for Strength */}
                                  {!['running', 'cycling', 'swimming', 'yoga'].includes(workoutType) && (
                                    <div className="space-y-3">
                                      <Label className="text-sm font-medium">Sets</Label>
                                      {exercise.sets.map((set, setIndex) => (
                                        <div key={set.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                          <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-medium">
                                            {setIndex + 1}
                                          </div>
                                          
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                              <Weight className="h-3 w-3 text-slate-400" />
                                              <Input
                                                placeholder="kg"
                                                value={set.weight}
                                                onChange={(e) => updateSet(exercise.id, set.id, 'weight', e.target.value)}
                                                className="w-20 h-8 text-center rounded-lg"
                                              />
                                            </div>
                                            
                                            <span className="text-slate-400">×</span>
                                            
                                            <div className="flex items-center gap-1">
                                              <Target className="h-3 w-3 text-slate-400" />
                                              <Input
                                                placeholder="reps"
                                                value={set.reps}
                                                onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                                                className="w-20 h-8 text-center rounded-lg"
                                              />
                                            </div>
                                          </div>
                                          
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeSet(exercise.id, set.id)}
                                            className="h-8 w-8 text-red-500 hover:text-red-700 ml-auto"
                                          >
                                            <LucideX className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addSet(exercise.id)}
                                        className="w-full rounded-xl"
                                      >
                                        <LucidePlus className="h-3 w-3 mr-2" />
                                        Add Set
                                      </Button>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  <div>
                                    <Label className="text-sm mb-2 block">Notes (optional)</Label>
                                    <Textarea
                                      value={exercise.notes || ''}
                                      onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value)}
                                      placeholder="Any notes about this exercise..."
                                      className="rounded-xl resize-none"
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </AnimatePresence>
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