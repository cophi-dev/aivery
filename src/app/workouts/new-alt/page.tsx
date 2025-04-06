"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, isToday, isPast, isFuture } from "date-fns"
import { useSession } from "next-auth/react"
import { LucideArrowLeft, CalendarIcon, LucidePlus } from "lucide-react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { createWorkout } from "@/lib/workout-actions" // Assuming this is the correct path
import { fetchExercises } from "@/lib/exercise-actions" // Assuming this is the correct path
import type { ExerciseData, WorkoutData } from "@/types/db" // Assuming this is the correct path

// Define the shape of exercises within this component's state
type JournalExercise = {
  id: number
  name: string
  weight: string
  reps: string
  sets: string
}

// Add 'home_strength' to the type
type WorkoutTense = "past" | "present" | "future"
type WorkoutType = "gym" | "home_strength" | "run" | "swim" | "cycle" | "hike" | "other" 

// Estimate weight for common bodyweight exercises
const estimateBodyweightForExercise = (exerciseName: string): number => {
  // Default estimated bodyweight in kg if nothing else applies
  const defaultBodyweight = 75; // Adjusted default
  
  // Common bodyweight exercises with percentage of bodyweight used
  const bodyweightExercises: Record<string, number> = {
    // Higher percentage
    "pull-up": 1.0,
    "chin-up": 1.0,
    "dip": 0.95, 
    "muscle-up": 1.0,
    "inverted row": 0.8,
    "bodyweight squat": 0.9, 
    "pistol squat": 0.9, 
    "lunge": 0.6,   
    // Medium percentage
    "push-up": 0.65, // Key is "push-up"
    "diamond push-up": 0.7,
    "plank": 0.5, 
    // Lower percentage
    "sit-up": 0.3,
    "crunch": 0.2,
    "leg raise": 0.3,
    "mountain climber": 0.4, 
    "burpee": 0.7, 
    "jumping jack": 0.1 
  };
  
  // Normalize exercise name for comparison
  const normalizedName = exerciseName.toLowerCase().trim();
  
  // Check if the exercise name contains any of the known bodyweight exercises
  for (const [exerciseKey, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exerciseKey)) { 
      console.log(`[Volume Calc] Matched exercise: ${normalizedName} with key: ${exerciseKey}. Applying ${percentage * 100}% of ${defaultBodyweight}kg.`);
      return Math.round(defaultBodyweight * percentage);
    }
  }
  
  console.log(`[Volume Calc] No bodyweight match found for exercise: ${normalizedName}. Using 0kg for estimation.`);
  // If no specific match is found
  return 0;
}

export default function NewWorkoutAltPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [date, setDate] = useState<Date>(new Date())
  const [tense, setTense] = useState<WorkoutTense>("present")
  const [workoutType, setWorkoutType] = useState<WorkoutType | undefined>(undefined)
  const [distance, setDistance] = useState<string>("")
  const [duration, setDuration] = useState<string>("")
  const [exercises, setExercises] = useState<JournalExercise[]>([])
  const [dbExercises, setDbExercises] = useState<ExerciseData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map of workout values to display names for easy lookup
  const workoutTypeDisplayNames: Record<WorkoutType, string> = {
      gym: "Gym Workout",
      home_strength: "Home Workout",
      run: "Run",
      swim: "Swim",
      cycle: "Cycling Session",
      hike: "Hike",
      other: "Other Activity"
  }

  // Filtered list of strength exercises for the dropdown
  const strengthExercises = useMemo(() => {
    // Assuming ExerciseData has a 'category' field
    return dbExercises.filter(ex => ex.category?.toLowerCase() === 'strength');
  }, [dbExercises]);

  // Fetch exercises from DB on mount
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const fetchedExercises = await fetchExercises()
        setDbExercises(fetchedExercises)
        // DON'T add initial exercise row here, wait for type selection
      } catch (err) {
        console.error("Failed to fetch exercises:", err)
        setError("Could not load exercises list.")
      }
    }
    loadExercises()
  }, []) // Run only once on mount

  // Set tense based on date
  useEffect(() => {
    updateTenseBasedOnDate(date)
  }, [date])

  // Reset form fields when workout type changes
  useEffect(() => {
    setError(null); 
    // Add check for undefined workoutType
    if (workoutType === "gym" || workoutType === "home_strength") { 
      if (exercises.length === 0) { addExercise(); }
      setDistance(""); setDuration("");
    } else if (workoutType) { // Only clear if it's defined and not strength
      setExercises([]); 
    }
  }, [workoutType]) // Keep dependency

  // Update tense when date changes
  const updateTenseBasedOnDate = (selectedDate: Date) => {
    if (isToday(selectedDate)) {
      setTense("present")
    } else if (isPast(selectedDate)) {
      setTense("past")
    } else if (isFuture(selectedDate)) {
      setTense("future")
    }
  }

  const addExercise = () => {
    setError(null);
    const newId = exercises.length > 0 ? Math.max(...exercises.map((e) => e.id)) + 1 : 1
    setExercises([...exercises, { id: newId, name: "", weight: "", reps: "", sets: "" }])
  }

  const updateExercise = (id: number, field: keyof JournalExercise, value: string) => {
    setError(null);
    setExercises(exercises.map((exercise) => (exercise.id === id ? { ...exercise, [field]: value } : exercise)))
  }

  // Filter out empty/invalid exercises before processing
  const validExercises = useMemo(() => {
    return exercises.filter(ex => 
        ex.name && 
        (Number.parseInt(ex.reps) > 0) && 
        (Number.parseInt(ex.sets) > 0)
        // Weight can be 0 (bodyweight)
    );
  }, [exercises]);

  // Use updated verbs
  const getVerbTenseText = () => {
    switch (tense) {
      case "past": return "I did";
      case "present": return "I'm doing";
      case "future": return "I'll do";
    }
  }

  // Calculate workout summary
  const workoutSummary = useMemo(() => {
    if (!workoutType) return null;
    if (workoutType === "gym" || workoutType === "home_strength") { 
      let totalVolume = 0; // Changed from totalWeight to totalVolume
      let totalReps = 0;
      let validExerciseCount = 0;

      validExercises.forEach((exercise) => {
        const reps = Number.parseInt(exercise.reps) || 0;
        const sets = Number.parseInt(exercise.sets) || 0;
        const weight = Number.parseFloat(exercise.weight) || 0; 

        if (reps > 0 && sets > 0) {
          const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(exercise.name);
          totalVolume += estimatedWeight * reps * sets;
          totalReps += reps * sets;
          validExerciseCount++;
        }
      });

      if (validExerciseCount === 0) return null;

      return { totalVolume: Math.round(totalVolume), totalReps }; // Return totalVolume
    } else if (["run", "swim", "cycle", "hike", "other"].includes(workoutType)) { 
      const dist = Number.parseFloat(distance) || 0;
      const dur = Number.parseFloat(duration) || 0;
      if (dist > 0 && dur > 0) {
        const pace = dur / dist // minutes per km
        return { distance: dist, duration: dur, pace: Math.round(pace * 10) / 10 }
      }
    }
    return null;
  }, [workoutType, validExercises, distance, duration]);

  // Update summary text generation
   const getSummaryText = () => {
    if (!workoutSummary || !workoutType) return null; 
    if (workoutType === "gym" || workoutType === "home_strength") {
      // Use totalVolume from summary
      if (workoutSummary.totalVolume === undefined || workoutSummary.totalReps === undefined) return null; 
      // Adjust intensity thresholds based on volume
      const intensityText =
        workoutSummary.totalVolume > 10000 ? "heavy" : workoutSummary.totalVolume > 3000 ? "moderate" : "light";
      const verb = getVerbTenseText(); // Should be "I did", "I'm doing", etc.
      // Updated phrasing for volume
      return `${verb} a total volume of ${workoutSummary.totalVolume} kg over ${workoutSummary.totalReps} reps. This was a ${intensityText} workout.`
    } else if (["run", "swim", "cycle", "hike"].includes(workoutType)) { 
      if (workoutSummary.distance === undefined || workoutSummary.pace === undefined) return null;
      const paceText =
        workoutSummary.pace < 5 ? "quite fast" : workoutSummary.pace < 7 ? "a good pace" : "a comfortable pace";
       const verb = getVerbTenseText();
       const linkingVerb = "which was"; // Keep consistent tense for past/present/future summary
      return `${verb} a pace of ${workoutSummary.pace} minutes per km, ${linkingVerb} ${paceText}.`;
    }
    // Note: 'other' type currently doesn't generate a summary
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Add check: Ensure workout type is selected
    if (!workoutType) {
        setError("Please select a workout activity type.");
        return;
    }
    if (!session?.user?.id) {
        setError("You must be logged in to save a workout.");
        return;
    }
    // Add check for undefined workoutType before accessing validExercises
    if ((workoutType === 'gym' || workoutType === 'home_strength') && validExercises.length === 0) {
        setError("Please add at least one valid exercise (name, reps, sets).");
      return;
    }
    // Add check for undefined workoutType before checking distance/duration
    if (workoutType !== 'gym' && workoutType !== 'home_strength' && (!distance || !duration || Number(distance) <= 0 || Number(duration) <= 0)) {
        setError("Please enter a valid distance and duration.");
        return;
    }

    setError(null);
    setIsSubmitting(true);

    // Map internal type for saving - workoutType is guaranteed to be defined here
    const workoutTypeName = workoutTypeDisplayNames[workoutType] || "Workout";
    const workoutTypeForDb: WorkoutData['type'] = 
        (workoutType === "gym" || workoutType === "home_strength") ? "strength" : workoutType;

    // Construct payload parts based on workout type - workoutType is defined here
    let payloadSpecifics: Partial<Pick<WorkoutData, 'duration' | 'distance' | 'exercises'>> = {};
    if (workoutType !== "gym" && workoutType !== "home_strength") { 
       const parsedDuration = Number.parseFloat(duration);
       const parsedDistance = Number.parseFloat(distance);
       // Assign only if valid numbers
       if (!Number.isNaN(parsedDuration) && parsedDuration > 0) {
           payloadSpecifics.duration = parsedDuration;
       }
       if (!Number.isNaN(parsedDistance) && parsedDistance > 0) {
           payloadSpecifics.distance = parsedDistance;
       }
       payloadSpecifics.exercises = []; // Cardio types have no detailed exercises here
      } else {
         payloadSpecifics.exercises = validExercises.map(ex => ({
            name: ex.name,
            sets: Array.from({ length: Number.parseInt(ex.sets) || 0 }).map(() => ({ 
                weight: Number.parseFloat(ex.weight) || 0,
                reps: Number.parseInt(ex.reps) || 0
            }))
          }));
         // Explicitly set cardio fields to undefined for gym workouts if needed by the type
         payloadSpecifics.duration = undefined;
         payloadSpecifics.distance = undefined;
    }

    // Construct final WorkoutData payload
    const workoutPayload = {
      userId: session.user.id,
      date: date, 
      name: workoutTypeName, 
      type: workoutTypeForDb, 
      notes: getSummaryText() || "", // getSummaryText now checks for workoutType
      ...payloadSpecifics 
    };

    console.log("Submitting workout payload:", workoutPayload);

    try {
      // Assume createWorkout returns the created workout object with _id
      const createdWorkout = await createWorkout(workoutPayload as Omit<WorkoutData, '_id' | 'createdAt' | 'updatedAt'> & { userId: string }); 
      
      if (createdWorkout?._id) {
        router.push(`/workout/${createdWorkout._id}`); // Redirect to specific workout page
        } else {
        // Fallback redirect if ID is somehow missing
        console.warn("Workout created but ID missing, redirecting to list.");
        router.push("/workouts"); 
      }
    } catch (err) {
      console.error("Failed to save workout:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper to style inline inputs/selects - Added font-bold to input style
  const inlineInputStyle = "w-20 h-auto inline-block border-0 border-b border-input rounded-none px-1 py-0 text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 bg-transparent align-baseline text-base font-bold focus:border-primary transition-colors duration-200 ease-in-out"
  const inlineSelectStyle = "h-auto border-0 p-0 font-medium text-primary hover:text-primary/80 focus:ring-0 focus:ring-offset-0 shadow-none bg-transparent w-auto inline-block align-baseline text-base font-medium underline-offset-4 hover:underline transition-colors duration-200 ease-in-out"
  const inlineButtonStyle = "h-auto p-0 font-medium text-primary hover:text-primary/80 focus:ring-0 focus:ring-offset-0 shadow-none bg-transparent w-auto inline-block align-baseline text-base underline-offset-4 hover:underline transition-colors duration-200 ease-in-out"

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col min-h-[calc(100vh-120px)]">
      {/* --- Simplified Header --- */}
      <div className="flex items-center mb-8 flex-shrink-0">
         {/* Back button removed */}
        <h1 className="text-2xl font-semibold tracking-tight">Log your workout</h1> {/* Updated Title & Style */}
         {/* Alternative UI Badge removed */}
        <Link href="/workouts/new" className="ml-auto">
          <Button variant="outline" size="sm">
            Switch to Standard UI
          </Button>
        </Link>
      </div>
      {/* --- End Simplified Header --- */}

      {/* --- Wrapper for Vertical Centering --- */}
      <div className="flex flex-col justify-center flex-grow"> 
        {/* --- New Journal Form (No Card Styling) --- */}
        <div className="text-foreground px-1 text-center"> 
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-8 leading-relaxed">
              {/* Top section - ensure medium weight */} 
              <p className="text-base font-medium">
                On{" "}
                <Popover>
                  <PopoverTrigger asChild>
                          <Button 
                      variant="link"
                      className={inlineButtonStyle}
                    >
                      {format(date, "MMMM d, yyyy")}
                      <CalendarIcon className="ml-1.5 h-4 w-4 inline-block" />
                          </Button>
                  </PopoverTrigger>
                  <PopoverContent style={{ backgroundColor: 'hsl(var(--card))' }} className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>{" "}
                {getVerbTenseText()}{" "}
                a{" "} {/* Added article */}
                <Select value={workoutType || ""} onValueChange={(value) => setWorkoutType(value as WorkoutType)}>
                  <SelectTrigger className={cn(
                      inlineSelectStyle, 
                      !workoutType && "text-lg font-semibold text-muted-foreground" // Larger/bolder/muted when placeholder
                     )}>
                     {/* Display selected workout name or placeholder */}
                     {workoutType ? workoutTypeDisplayNames[workoutType] : "Select activity..."} 
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}> 
                    {/* Remove disabled placeholder with value="" */}
                    {/* <SelectItem value="" disabled>Select activity...</SelectItem> */}
                    <SelectItem value="gym">Gym Workout</SelectItem>
                    <SelectItem value="home_strength">Home Workout</SelectItem> 
                    <SelectItem value="run">Run</SelectItem>
                    <SelectItem value="swim">Swim</SelectItem>
                    <SelectItem value="cycle">Cycling Session</SelectItem>
                    <SelectItem value="hike">Hike</SelectItem>
                    <SelectItem value="other">Other Activity</SelectItem>
                  </SelectContent>
                </Select>
              </p>

              {/* Cardio workout details - ensure medium weight */} 
              {workoutType && workoutType !== "gym" && workoutType !== "home_strength" && workoutType !== "other" && (
                <p className="text-base font-medium">
                  {getVerbTenseText()}{" "} 
                  <Input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className={cn(inlineInputStyle, !distance && "text-muted-foreground")} // Muted if empty
                    placeholder="distance"
                    step="0.1"
                    min="0"
                  />{" "}
                  km in{" "}
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={cn(inlineInputStyle, !duration && "text-muted-foreground")} // Muted if empty
                    placeholder="time"
                    min="0"
                  />{" "}
                  minutes.
                </p>
              )}
               {/* Other workout type - ensure medium weight */} 
               {workoutType && workoutType === "other" && (
                  <p className="text-base font-medium">
                      {/* Placeholder for potentially adding a notes field or other details for 'other' type */}
                      Describe your activity... (feature not fully implemented)
                  </p>
               )}

              {/* Gym workout details */}
              {workoutType && (workoutType === "gym" || workoutType === "home_strength") && (
                <div className="space-y-10"> {/* Increased exercise spacing */}
                  {exercises.map((exercise, index) => (
                    <div key={exercise.id} className={cn(
                        "space-y-2" // Removed border/padding condition
                       )}>
                      {/* Use flex items-center for vertical alignment */}
                      <div className="flex items-center">
                        {/* Larger, Bolder Number (No Circle) */}
                        <div className="w-auto mr-5 flex-shrink-0 text-foreground flex items-center justify-center text-3xl font-bold">
                          {index + 1}
                    </div>
                        {/* Wrap the two lines in a div for alignment */} 
                        <div className="flex-1 space-y-1">
                          {/* Line 1: Exercise Name - ensure medium weight */} 
                          <div className="flex items-baseline justify-center gap-2 flex-wrap text-base font-medium"> 
                            <span>{getVerbTenseText()}</span>
                            <Select
                              value={exercise.name}
                              onValueChange={(value) => updateExercise(exercise.id, "name", value)}
                            >
                              <SelectTrigger className={cn(inlineSelectStyle, "min-w-[140px] justify-start")}> 
                                <SelectValue placeholder="select exercise" />
                              </SelectTrigger>
                              {/* Force background using inline style */}
                              <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}> 
                                {/* Use filtered list */} 
                                {strengthExercises.length > 0 ? strengthExercises.map((option) => (
                                  <SelectItem key={option._id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                )) : <SelectItem value="" disabled>Loading...</SelectItem>}
                                 <SelectItem value="Other">Other (Type below)</SelectItem> {/* Option for custom */}
                              </SelectContent>
                            </Select>
                            {exercise.name === 'Other' && (
                      <Input
                                    type="text"
                                    // Use actual name state for value, this allows typing
                                    value={exercise.name === 'Other' ? '' : exercise.name} 
                                    onChange={(e) => updateExercise(exercise.id, "name", e.target.value)}
                                    className={cn(inlineInputStyle, "w-40")} // Wider for custom name
                                    placeholder="Type exercise name"
                                />
                    )}
                  </div>
                  
                          {/* Line 2: Weight, Reps, Sets - ensure medium weight */} 
                          <div className="flex items-baseline justify-center gap-2 ml-0 flex-wrap text-base font-medium"> 
                            <span>with</span>
                        <Input 
                          type="number" 
                              value={exercise.weight}
                              onChange={(e) => updateExercise(exercise.id, "weight", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.weight && "text-muted-foreground")} // Muted if empty
                               step="0.5"
                               min="0"
                            />
                            <span>kg for</span>
                                      <Input
                                        type="number"
                              value={exercise.reps}
                              onChange={(e) => updateExercise(exercise.id, "reps", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.reps && "text-muted-foreground")} // Muted if empty
                              min="1"
                            />
                            <span>reps ×</span>
                                      <Input
                                        type="number"
                              value={exercise.sets}
                              onChange={(e) => updateExercise(exercise.id, "sets", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.sets && "text-muted-foreground")} // Muted if empty
                               min="1"
                            />
                            <span>sets</span>
                                    </div>
                                  </div>
                                  </div>
                                </div>
                              ))}
                  {/* ADD Button After the Map */} 
                  <div className="flex justify-center pt-4"> 
                              <Button
                                type="button"
                      variant="ghost"
                                size="sm"
                      onClick={addExercise}
                      className="text-muted-foreground hover:text-primary"
                              >
                        <LucidePlus className="h-4 w-4 mr-1.5"/> Add exercise
                              </Button>
                              </div>
                            </div>
              )}

              {/* Workout summary - keep text-sm */} 
              {workoutSummary && (
                <div className="mt-8 text-muted-foreground italic text-sm">
                  <p>{getSummaryText()}</p>
                  </div>
              )}
            </div>

             {/* Error Message */}
              {error && (
                  <p className="text-sm text-destructive mt-4">{error}</p>
              )}

            {/* Submit Button */}
            <div className="mt-10 flex justify-center">
                        <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90" // Standard primary button
                size="lg" 
              >
                {isSubmitting ? "Saving..." : "Save Workout"} {/* Consistent naming */}
                        </Button>
                  </div>
          </form>
                </div>
                </div>
      {/* --- End Wrapper --- */}
    </div>
  )
}

