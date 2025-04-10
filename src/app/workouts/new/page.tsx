"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format, isToday, isPast, isFuture, parseISO } from "date-fns"
import { useSession } from "next-auth/react"
import { LucideArrowLeft, CalendarIcon, LucidePlus, LucideX } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from 'react-hot-toast'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { 
  createWorkout as createWorkoutAction, 
  updateWorkoutAction,
  type WorkoutUpdatePayload
} from "@/lib/workout-actions"
import { fetchExercises } from "@/lib/exercise-actions"
import type { ExerciseData, WorkoutData, Exercise } from "@/types/db"
import { IWorkout } from "@/lib/db/models/workout"
import { estimateBodyweightForExercise } from "@/lib/utils"

// Define the shape of exercises within this component's state
type JournalExercise = {
  id: number | string
  name: string
  weight: string
  reps: string
  sets: string
}

// Add 'home_strength' to the type
type WorkoutTense = "past" | "present" | "future"
type WorkoutTypeOption = "gym" | "home_strength" | "run" | "swim" | "cycle" | "hike" | "other"
type WorkoutTypeForDb = WorkoutData['type']

// Define the specific workout types allowed by the schema
type AllowedWorkoutType = IWorkout['type']

// Estimate weight for common bodyweight exercises
// Moved to src/lib/utils.ts

export default function NewWorkoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  const editingWorkoutId = searchParams?.get("edit");
  const duplicateWorkoutId = searchParams?.get("duplicate");

  const [date, setDate] = useState<Date>(new Date())
  const [tense, setTense] = useState<WorkoutTense>("present")
  const [workoutType, setWorkoutType] = useState<WorkoutTypeOption | undefined>(undefined)
  const [workoutName, setWorkoutName] = useState<string>("")
  const [distance, setDistance] = useState<string>("")
  const [duration, setDuration] = useState<string>("")
  const [exercises, setExercises] = useState<JournalExercise[]>([])
  const [dbExercises, setDbExercises] = useState<ExerciseData[]>([])
  const [dbExercisesMap, setDbExercisesMap] = useState<Map<string, ExerciseData>>(new Map()); // Store exercises by name for lookup
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!editingWorkoutId

  // Map of workout values to display names for easy lookup
  const workoutTypeDisplayNames: Record<WorkoutTypeOption, string> = {
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
        // Create map for easier ID lookup by name during submit
        setDbExercisesMap(new Map(fetchedExercises.map(ex => [ex.name, ex]))); 
      } catch (err) {
        console.error("Failed to fetch exercises:", err)
        setError("Could not load exercises list.")
      }
    }
    loadExercises()
  }, []) // Run only once on mount

  // Fetch workout data if editing or duplicating
  useEffect(() => {
    const workoutIdToLoad = editingWorkoutId || duplicateWorkoutId;
    if (workoutIdToLoad) {
      setIsLoadingData(true);
      setError(null);
      const fetchWorkoutData = async () => {
        try {
          const response = await fetch(`/api/workouts/${workoutIdToLoad}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(`Failed to fetch workout data (${response.status}): ${errorData.error || response.statusText}`);
          }
          const data: WorkoutData = await response.json();
          
          // --- Pre-populate form state ---
          // Ensure date is treated as string before parsing
          const dateString = typeof data.date === 'string' ? data.date : String(data.date);
          setDate(parseISO(dateString)); 
          
          const formTypeOption: WorkoutTypeOption = 
              data.type === 'strength' ? 'gym' : data.type as WorkoutTypeOption;
          setWorkoutType(formTypeOption); 
          setWorkoutName(data.name || "");
          setDistance(data.distance?.toString() || "");
          setDuration(data.duration?.toString() || "");

          // Map DB exercises (type Exercise) to JournalExercise format
          if (data.exercises && data.type === 'strength') {
            const mappedExercises = data.exercises.map((ex: Exercise, index) => { 
              const firstSet = ex.sets?.[0]; 
              return {
                id: `loaded-${index}-${Date.now()}`, 
                name: ex.name, 
                weight: firstSet?.weight?.toString() || "", 
                reps: firstSet?.reps?.toString() || "",
                sets: ex.sets?.length.toString() || "1" 
              };
            });
            setExercises(mappedExercises);
          } else {
            setExercises([]);
          }
          
          console.log("Loaded workout data for edit/duplicate:", data);

        } catch (err) {
          console.error("Error fetching workout data:", err);
          setError(err instanceof Error ? err.message : "Failed to load workout data.");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchWorkoutData();
    }
    // Removed router dependency, only depend on the IDs
  }, [editingWorkoutId, duplicateWorkoutId]); 

  // Set tense based on date
  useEffect(() => {
    updateTenseBasedOnDate(date)
  }, [date])

  // Reset form fields when workout type changes (unless loading data)
  useEffect(() => {
    if (isLoadingData) return; // Don't reset while loading
    
    setError(null); 
    // Add check for undefined workoutType
    if (workoutType === "gym" || workoutType === "home_strength") { 
      // Only add initial exercise if NOT editing/duplicating AND exercises are empty
      if (!isEditing && !duplicateWorkoutId && exercises.length === 0) { 
          addExercise(); 
      }
      setDistance(""); setDuration("");
    } else if (workoutType) { // Only clear if it's defined and not strength
      setExercises([]); 
    }
  }, [workoutType, isLoadingData, isEditing, duplicateWorkoutId]) // Add dependencies

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
    const newId = `temp-${Date.now()}-${Math.random()}`; // Use temporary string ID
    setExercises([...exercises, { id: newId, name: "", weight: "", reps: "", sets: "" }])
  }

  const updateExercise = (id: number | string, field: keyof JournalExercise, value: string) => {
    setError(null);
    setExercises(exercises.map((exercise) => (exercise.id === id ? { ...exercise, [field]: value } : exercise)))
  }
  
  const removeExercise = (id: number | string) => {
    setError(null);
    setExercises(exercises.filter(exercise => exercise.id !== id));
  }

  // Filter out empty/invalid exercises before processing
  const validExercises = useMemo(() => {
    return exercises.filter(ex => 
        ex.name && ex.name !== 'Other' && // Ensure 'Other' isn't saved directly if not typed
        (Number.parseInt(ex.reps) > 0) && 
        (Number.parseInt(ex.sets) > 0)
        // Weight can be 0 (bodyweight)
    );
  }, [exercises]);

  // Use updated verbs
  const getVerbTenseText = () => {
    switch (tense) {
      case "past": return isEditing ? "I updated" : "I did"; // Adjust verb for editing past
      case "present": return "I'm doing";
      case "future": return "I'll do";
    }
  }

  // Calculate workout summary
  const workoutSummary = useMemo(() => {
    if (!workoutType) return null;
    if (workoutType === "gym" || workoutType === "home_strength") { 
      let totalVolume = 0; 
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

      return { totalVolume: Math.round(totalVolume), totalReps }; 
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
      if (workoutSummary.totalVolume === undefined || workoutSummary.totalReps === undefined) return null; 
      const intensityText = workoutSummary.totalVolume > 10000 ? "heavy" : workoutSummary.totalVolume > 3000 ? "moderate" : "light";
      const verb = getVerbTenseText(); 
      return `${verb} a total volume of ${workoutSummary.totalVolume} kg over ${workoutSummary.totalReps} reps. This was a ${intensityText} workout.`
    } else if (["run", "swim", "cycle", "hike"].includes(workoutType)) { 
      if (workoutSummary.distance === undefined || workoutSummary.pace === undefined) return null;
      const paceText = workoutSummary.pace < 5 ? "quite fast" : workoutSummary.pace < 7 ? "a good pace" : "a comfortable pace";
       const verb = getVerbTenseText();
       const linkingVerb = tense === 'past' ? "which was" : "which is"; // Adjust linking verb
      return `${verb} a pace of ${workoutSummary.pace} minutes per km, ${linkingVerb} ${paceText}.`;
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workoutType) {
        setError("Please select a workout activity type.");
        return;
    }
    if (!session?.user?.id) {
        setError("You must be logged in to save a workout.");
        return;
    }
    // Validation checks... (remain mostly the same)
    if ((workoutType === 'gym' || workoutType === 'home_strength') && validExercises.length === 0) {
        setError("Please add at least one valid exercise (name, reps, sets).");
      return;
    }
    if (workoutType !== 'gym' && workoutType !== 'home_strength' && (!distance || !duration || Number(distance) <= 0 || Number(duration) <= 0)) {
        setError("Please enter a valid distance and duration.");
        return;
    }

    setError(null);
    setIsSubmitting(true);

    // Determine DB type
    const workoutTypeForDb = 
        (workoutType === "gym" || workoutType === "home_strength") ? "strength" : workoutType;
    
    // Explicitly cast to the allowed types for the payload
    const finalWorkoutTypeForPayload = workoutTypeForDb as AllowedWorkoutType;

    const defaultWorkoutName = workoutTypeDisplayNames[workoutType] || "Workout";
    const finalWorkoutName = workoutName.trim() || defaultWorkoutName; // Use provided name or default

    let exercisesPayload: any[] = []; // Initialize for WorkoutExercise structure

    if (workoutTypeForDb === 'strength') {
      if (validExercises.length === 0) {
        // Existing validation for strength workouts needing exercises
        setError("Please add at least one valid exercise (name, reps, sets).");
        setIsSubmitting(false);
        return;
      }
      
      // Map form state (JournalExercise) to the structure needed by backend actions
      exercisesPayload = validExercises.map((ex, index) => {
          // Find the canonical exercise ID from the map created earlier
          const canonicalExercise = dbExercisesMap.get(ex.name);
          if (!canonicalExercise) {
              console.warn(`Could not find canonical exercise ID for: ${ex.name}. Skipping in payload.`);
              // Optionally throw error or handle differently
              return null; 
          }
          
          // Create the sets array based on form input
          const numSets = Number.parseInt(ex.sets) || 1;
          const exerciseSets = Array.from({ length: numSets }).map((_, setIndex) => ({
              weight: Number.parseFloat(ex.weight) || 0, 
              reps: Number.parseInt(ex.reps) || 0,
              // Add duration/distance/notes per set if your form captures them
              order: setIndex
          }));

          return {
              // _id: Might need this when *editing* existing WorkoutExercises
              // If ex.id relates to an existing WorkoutExercise._id, pass it here
              // For simplicity now, we assume create/update handles based on presence/absence
              // but a robust edit needs to track original WorkoutExercise IDs.
              exerciseId: canonicalExercise._id, // Use the looked-up ID
              name: ex.name, // Send name too, might help backend if ID lookup fails? Redundant?
              order: index,
              sets: exerciseSets,
              // notes: ex.notes, // If form captures notes per exercise
          };
      }).filter(Boolean); // Remove any skipped null entries
      
      if (exercisesPayload.length === 0 && validExercises.length > 0) {
         // This happens if all exercises entered were invalid or couldn't be found
         setError("Could not match provided exercises to known exercises. Please check names.");
         setIsSubmitting(false);
         return;
      }

    } else { 
      // Handle Cardio Types - Create a single WorkoutExercise entry
      const parsedDuration = Number.parseFloat(duration);
      const parsedDistance = Number.parseFloat(distance);
      if (Number.isNaN(parsedDuration) || parsedDuration <= 0 || Number.isNaN(parsedDistance) || parsedDistance <= 0) {
          setError("Please enter a valid positive distance and duration for cardio.");
          setIsSubmitting(false);
          return;
      }

      // Find the canonical exercise ID for the cardio type (e.g., "Running")
      const cardioExerciseName = workoutType.charAt(0).toUpperCase() + workoutType.slice(1);
      
      // Try multiple variations of the exercise name
      let canonicalCardioExercise = dbExercisesMap.get(cardioExerciseName); // First try e.g. "Run"
      
      if (!canonicalCardioExercise) {
        // Try with "ing" suffix (e.g., "Running" instead of "Run")
        const alternativeName = cardioExerciseName + (cardioExerciseName.endsWith('e') ? '' : 'ing');
        canonicalCardioExercise = dbExercisesMap.get(alternativeName);
        
        // Try lowercase variations
        if (!canonicalCardioExercise) {
          canonicalCardioExercise = dbExercisesMap.get(cardioExerciseName.toLowerCase()) || 
                                  dbExercisesMap.get(alternativeName.toLowerCase());
        }
      }

      if (!canonicalCardioExercise) {
          console.error(`Could not find cardio exercise. Tried: ${cardioExerciseName} and ${cardioExerciseName}ing`);
          console.log("Available exercises:", Array.from(dbExercisesMap.keys()));
          
          // Create a temporary entry for form submission with name only
          exercisesPayload.push({
              name: cardioExerciseName,
              order: 0,
              duration: parsedDuration * 60, // Assuming form duration is in minutes, convert to seconds
              distance: parsedDistance * 1000, // Assuming form distance is in km, convert to meters
              sets: [], // Cardio doesn't have sets in this structure
          });
      } else {
          exercisesPayload.push({
              exerciseId: canonicalCardioExercise._id,
              name: canonicalCardioExercise.name,
              order: 0,
              duration: parsedDuration * 60, // Assuming form duration is in minutes, convert to seconds
              distance: parsedDistance * 1000, // Assuming form distance is in km, convert to meters
              sets: [], // Cardio doesn't have sets in this structure
          });
      }
    }

    // Construct final WorkoutData payload
    const workoutPayload = {
      date: date, 
      name: finalWorkoutName, 
      type: finalWorkoutTypeForPayload, 
      notes: getSummaryText() || "", 
      duration: (finalWorkoutTypeForPayload !== 'strength' && duration) ? Number.parseFloat(duration) : undefined,
      exercises: exercisesPayload, 
      // Add other fields compatible with both create and update payloads if needed
    };

    console.log("Submitting workout payload (NEW STRUCTURE):", JSON.stringify(workoutPayload, null, 2));

    try {
      setIsLoadingData(true);
      let savedWorkout;
      if (isEditing && editingWorkoutId) {
        console.log(`Attempting to update workout ID: ${editingWorkoutId}`);
        // Ensure the payload passed matches WorkoutUpdatePayload type expected by updateWorkoutAction
        savedWorkout = await updateWorkoutAction(editingWorkoutId, workoutPayload as Omit<WorkoutUpdatePayload, 'userId'>);
        toast.success('Workout updated successfully!');
      } else {
        console.log("Attempting to create new workout");
        // createWorkoutAction uses 'as any' for now, so less strict typing needed here
        const createPayload = {
            ...workoutPayload,
            userId: session!.user!.id, 
        };
        savedWorkout = await createWorkoutAction(createPayload as any); 
        toast.success('Workout created successfully!');
      }
      
      if (savedWorkout && savedWorkout._id) {
        router.push(`/workout/${savedWorkout._id}`);
      } else {
        console.error("Workout save operation did not return a valid workout object or ID.", savedWorkout);
        toast.error('Failed to get workout ID after saving.');
      }
    } catch (err) {
      console.error('Failed to save workout:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to save workout'}`);
    } finally {
      setIsSubmitting(false);
      setIsLoadingData(false);
    }
  }

  // Helper styles (remain the same)
  const inlineInputStyle = "w-20 h-auto inline-block border-0 border-b border-input rounded-none px-1 py-0 text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 bg-transparent align-baseline text-base font-bold focus:border-primary transition-colors duration-200 ease-in-out"
  const inlineSelectStyle = "h-auto border-0 p-0 font-medium text-primary hover:text-primary/80 focus:ring-0 focus:ring-offset-0 shadow-none bg-transparent w-auto inline-block align-baseline text-base font-medium underline-offset-4 hover:underline transition-colors duration-200 ease-in-out"
  const inlineButtonStyle = "h-auto p-0 font-medium text-primary hover:text-primary/80 focus:ring-0 focus:ring-offset-0 shadow-none bg-transparent w-auto inline-block align-baseline text-base underline-offset-4 hover:underline transition-colors duration-200 ease-in-out"

  // Loading indicator
  if (isLoadingData) {
      return <div className="container mx-auto px-4 py-6 flex justify-center items-center min-h-[calc(100vh-120px)]"><p>Loading workout data...</p></div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col min-h-[calc(100vh-120px)]">
      <div className="flex items-center mb-8 flex-shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">
           {isEditing ? 'Edit your workout' : 'Log your workout'}
        </h1>
      </div>

      <div className="flex flex-col justify-center flex-grow"> 
        <div className="text-foreground px-1 text-center"> 
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-8 leading-relaxed">
             {/* --- Workout Name Input (Optional) --- */}
              <div className="text-base font-medium">
                <label htmlFor="workoutName" className="sr-only">Workout Name (Optional)</label>
                <Input
                  id="workoutName"
                  type="text"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder={workoutType ? workoutTypeDisplayNames[workoutType] : "Workout Name (Optional)"}
                  className="w-full max-w-xs mx-auto h-10 px-3 text-center border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary bg-transparent text-lg"
                />
              </div>
            
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
                a{" "} 
                <Select value={workoutType || ""} onValueChange={(value) => setWorkoutType(value as WorkoutTypeOption)}>
                  <SelectTrigger className={cn(
                      inlineSelectStyle, 
                      !workoutType && "text-lg font-semibold text-muted-foreground"
                     )}>
                     {workoutType ? workoutTypeDisplayNames[workoutType] : "Select activity..."} 
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}> 
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
                    className={cn(inlineInputStyle, !distance && "text-muted-foreground")}
                    placeholder="distance"
                    step="0.1"
                    min="0"
                  />{" "}
                  km in{" "}
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={cn(inlineInputStyle, !duration && "text-muted-foreground")}
                    placeholder="time"
                    min="0"
                  />{" "}
                  minutes.
                </p>
              )}
               {/* Other workout type - ensure medium weight */} 
               {workoutType && workoutType === "other" && (
                  <p className="text-base font-medium">
                      Describe your activity...
                  </p>
               )}

              {/* Gym workout details */}
              {workoutType && (workoutType === "gym" || workoutType === "home_strength") && (
                <div className="space-y-10">
                  {exercises.map((exercise, index) => (
                    <div key={exercise.id} className="space-y-2 relative group">
                      <div className="flex items-center">
                        <div className="w-auto mr-5 flex-shrink-0 text-foreground flex items-center justify-center text-3xl font-bold">
                          {index + 1}
                    </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-baseline justify-center gap-2 flex-wrap text-base font-medium"> 
                            <span>{getVerbTenseText()}</span>
                            <Select
                              value={exercise.name}
                              onValueChange={(value) => updateExercise(exercise.id, "name", value)}
                            >
                              <SelectTrigger className={cn(inlineSelectStyle, "min-w-[140px] justify-start")}> 
                                <SelectValue placeholder="select exercise" />
                              </SelectTrigger>
                              <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}> 
                                {strengthExercises.length > 0 ? strengthExercises.map((option) => (
                                  <SelectItem key={option._id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                )) : <SelectItem value="" disabled>Loading...</SelectItem>}
                                 <SelectItem value="Other">Other (Type below)</SelectItem>
                              </SelectContent>
                            </Select>
                            {exercise.name === 'Other' && (
                      <Input
                                    type="text"
                                    value={exercise.name === 'Other' ? '' : exercise.name} 
                                    onChange={(e) => updateExercise(exercise.id, "name", e.target.value)}
                                    className={cn(inlineInputStyle, "w-40")}
                                    placeholder="Type exercise name"
                                />
                    )}
                  </div>
                  
                          <div className="flex items-baseline justify-center gap-2 ml-0 flex-wrap text-base font-medium"> 
                            <span>with</span>
                        <Input 
                          type="number" 
                              value={exercise.weight}
                              onChange={(e) => updateExercise(exercise.id, "weight", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.weight && "text-muted-foreground")}
                               step="0.5"
                               min="0"
                            />
                            <span>kg for</span>
                                      <Input
                                        type="number"
                              value={exercise.reps}
                              onChange={(e) => updateExercise(exercise.id, "reps", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.reps && "text-muted-foreground")}
                              min="1"
                            />
                            <span>reps ×</span>
                                      <Input
                                        type="number"
                              value={exercise.sets}
                              onChange={(e) => updateExercise(exercise.id, "sets", e.target.value)}
                              className={cn(inlineInputStyle, !exercise.sets && "text-muted-foreground")}
                               min="1"
                            />
                            <span>sets</span>
                                    </div>
                                  </div>
                                  </div>
                                </div>
                              ))}
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
                disabled={isSubmitting || isLoadingData}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg" 
              >
                {isSubmitting ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update Workout" : "Save Workout")}
                        </Button>
                  </div>
          </form>
        </div>
      </div>
    </div>
  )
}

