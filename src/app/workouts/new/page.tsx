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
import { Label } from "@/components/ui/label"
import { 
  createWorkout as createWorkoutAction, 
  updateWorkoutAction,
  type WorkoutUpdatePayload,
  type InputSetData
} from "@/lib/workout-actions"
import { fetchExercises } from "@/lib/exercise-actions"
import type { ExerciseData, WorkoutData, WorkoutExerciseData, Set } from "@/types/db"
import { IWorkout } from "@/lib/db/models/workout"
import { estimateBodyweightForExercise } from "@/lib/utils"

// Type guard to filter out nulls
function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

// --- NEW State Types --- 
// Represents a single set in the form state
type SetState = {
  id: number | string; // Temporary ID for form state (e.g., `set-temp-${Date.now()}`)
  order?: number; // Optional: Order for submission, managed by position in array mostly
  weight?: string; 
  reps?: string; 
  duration?: string; // In seconds
  distance?: string; // In preferred unit (e.g., meters)
  notes?: string;
}

// Represents a single exercise in the form state, containing multiple sets
type ExerciseState = {
  id: number | string; // Temporary ID for form state (e.g., `ex-temp-${Date.now()}`)
  exerciseId?: string; // ID of the canonical Exercise (if known/selected)
  name: string; // Name of the canonical Exercise
  notes?: string; // Notes specific to this exercise in this workout
  sets: SetState[]; // Array of sets for this exercise
  // Add other fields if needed (e.g., duration/distance for non-set exercises)
}
// --- END NEW State Types ---

// Define the allowed *schema* types from IWorkout
type AllowedWorkoutType = IWorkout['type']

// Define the types used for *options* in the Select dropdown.
// Include all schema types plus frontend-specific ones.
type WorkoutTypeOption = AllowedWorkoutType | "gym" | "home_strength"; 

type WorkoutTense = "past" | "present" | "future"

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
  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [dbExercises, setDbExercises] = useState<ExerciseData[]>([])
  const [dbExercisesMap, setDbExercisesMap] = useState<Map<string, ExerciseData>>(new Map()); // Store exercises by name for lookup
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!editingWorkoutId

  // Map of workout *option* values to display names.
  // Ensure keys match the WorkoutTypeOption definition.
  const workoutTypeDisplayNames: Record<WorkoutTypeOption, string> = {
      gym: "Gym Workout",
      home_strength: "Home Workout",
      running: "Run",
      swimming: "Swim",
      cycling: "Cycling Session",
      walking: "Walk / Hike",
      strength: "Strength (Other)", // Might hide this option later
      hiit: "HIIT",
      flexibility: "Flexibility / Stretch",
      yoga: "Yoga",
      pilates: "Pilates",
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
            const errorData = await response.json().catch(() => ({})); 
            throw new Error(`Failed to fetch workout data (${response.status}): ${errorData.error || response.statusText}`);
          }
          const data: WorkoutData = await response.json(); 
          
          // --- Pre-populate form state ---
          const dateString = typeof data.date === 'string' ? data.date : String(data.date);
          setDate(parseISO(dateString)); 
          
          const formTypeOption: WorkoutTypeOption = data.type as WorkoutTypeOption; // Use actual type now
          setWorkoutType(formTypeOption); 
          setWorkoutName(data.name || "");
          // Pre-fill overall distance/duration if applicable (e.g., for pure cardio workouts)
          setDistance(data.cardioDetails?.distance?.toString() || data.distance?.toString() || ""); 
          setDuration(data.duration?.toString() || ""); 

          // Map DB WorkoutExercises (with Sets) to the new ExerciseState format
          if (data.workoutExercises && data.workoutExercises.length > 0) {
            const mappedExercises: ExerciseState[] = data.workoutExercises.map((ex: WorkoutExerciseData): ExerciseState => { 
              // Ensure ex.sets is an array before mapping
              const setsArray = Array.isArray(ex.sets) ? ex.sets : [];
              return {
                id: ex._id || `loaded-${Date.now()}`, // Simplified temp ID generation
                exerciseId: ex.exerciseId?._id?.toString(),
                name: ex.exerciseId?.name || 'Unknown Exercise', 
                notes: ex.notes || undefined,
                sets: setsArray.map((set: Set, setIndex: number): SetState => ({ 
                  id: set._id || `loaded-set-${setIndex}-${Date.now()}`, 
                  order: set.order ?? setIndex,
                  weight: set.weight?.toString() || "",
                  reps: set.reps?.toString() || "",
                  duration: set.duration?.toString() || "",
                  distance: set.distance?.toString() || "",
                  notes: set.notes || undefined,
                }))
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
  }, [editingWorkoutId, duplicateWorkoutId]); 

  // Set tense based on date
  useEffect(() => {
    updateTenseBasedOnDate(date)
  }, [date])

  // Reset form fields when workout type changes
  useEffect(() => {
    if (isLoadingData) return; 
    setError(null); 

    // Determine if the selected type is strength-related based on our options
    const isStrengthType = workoutType === "gym" || workoutType === "home_strength" || workoutType === "strength";
    
    if (isStrengthType) { 
      // Only add initial exercise if NOT editing/duplicating AND exercises are empty
      if (!isEditing && !duplicateWorkoutId && exercises.length === 0) { 
          addExercise(); // addExercise will now add an ExerciseState with one SetState
      }
      // Clear overall distance/duration if switching TO strength?
      // setDistance(""); 
      // setDuration(""); 
    } else if (workoutType) { // Clear exercises if switching to a non-strength type
      setExercises([]); 
      // Maybe prefill overall distance/duration based on type?
    }
    // Add dependencies correctly
  }, [workoutType, isLoadingData, isEditing, duplicateWorkoutId, exercises.length]); 

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
    const newExerciseId = `ex-temp-${Date.now()}-${Math.random()}`;
    const newSetId = `set-temp-${Date.now()}-${Math.random()}`;
    // Add a new exercise with one default empty set
    setExercises([...exercises, { 
        id: newExerciseId, 
        name: "", 
        sets: [{ id: newSetId, weight: "", reps: "" }] // Start with one empty set
    }]);
  };

  // Renamed and updated: Handles changes to Exercise properties (name, notes)
  const updateExerciseField = (exerciseId: number | string, field: 'name' | 'notes', value: string) => {
    setError(null);
    setExercises(exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        // If changing name, potentially update exerciseId if a match is found in dbExercisesMap
        let updatedExerciseId = exercise.exerciseId;
        if (field === 'name') {
            const matchedDbExercise = dbExercisesMap.get(value);
            updatedExerciseId = matchedDbExercise?._id;
        }
        return { ...exercise, [field]: value, exerciseId: updatedExerciseId };
      } 
      return exercise;
    }));
  };
  
  // Remains the same logically, just operates on ExerciseState[]
  const removeExercise = (id: number | string) => {
    setError(null);
    setExercises(exercises.filter(exercise => exercise.id !== id));
  };

  // --- Need new functions for Sets ---
  const addSet = (exerciseId: number | string) => {
    setError(null);
    const newSetId = `set-temp-${Date.now()}-${Math.random()}`;
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return { 
          ...ex, 
          sets: [...ex.sets, { id: newSetId, weight: "", reps: "" }] // Add a new empty set
        };
      }
      return ex;
    }));
  };
  
  const updateSetField = (exerciseId: number | string, setId: number | string, field: keyof SetState, value: string) => {
    setError(null);
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return { 
          ...ex, 
          sets: ex.sets.map(set => set.id === setId ? { ...set, [field]: value } : set)
        };
      }
      return ex;
    }));
  };

  const removeSet = (exerciseId: number | string, setId: number | string) => {
    setError(null);
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        // Ensure at least one set remains if this is the last one? Or handle in UI.
        return { ...ex, sets: ex.sets.filter(set => set.id !== setId) };
      }
      return ex;
    }));
  };
  // --- END Set functions ---

  // Filter out empty/invalid exercises before processing
  const validExercises = useMemo(() => {
    return exercises.filter(ex => {
        // Exercise must have a name
        if (!ex.name || ex.name === 'Other') return false;
        // Exercise must have at least one set
        if (!ex.sets || ex.sets.length === 0) return false;
        // At least one set must have a rep count > 0
        return ex.sets.some(set => (Number.parseInt(set.reps || '0') || 0) > 0);
        // Weight can be 0 (bodyweight), so we don't strictly need a weight validation here
    });
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
    // Check if it's a strength type based on the WorkoutTypeOption
    const isStrengthType = workoutType === "gym" || workoutType === "home_strength" || workoutType === "strength";

    if (isStrengthType) { 
      let totalVolume = 0; 
      let totalReps = 0;
      let validExerciseCount = 0;

      validExercises.forEach((exercise) => {
        let exerciseHasValidSets = false;
        exercise.sets.forEach(set => {
            const reps = Number.parseInt(set.reps || '0') || 0;
            const weight = Number.parseFloat(set.weight || '0') || 0; 
            if (reps > 0) {
                const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(exercise.name);
                totalVolume += estimatedWeight * reps;
                totalReps += reps;
                exerciseHasValidSets = true;
            }
        });
        if (exerciseHasValidSets) {
          validExerciseCount++;
        }
      });

      if (validExerciseCount === 0) return null;

      return { totalVolume: Math.round(totalVolume), totalReps }; 
    } else if (["running", "swimming", "cycling", "walking", "other"].includes(workoutType)) { // Use WorkoutTypeOption check
      const dist = Number.parseFloat(distance) || 0;
      const dur = Number.parseFloat(duration) || 0;
      if (dist > 0 && dur > 0) {
        const pace = dur / dist // minutes per km
        return { distance: dist, duration: dur, pace: Math.round(pace * 10) / 10 }
      }
    }
    return null;
  }, [workoutType, validExercises, distance, duration]); // Keep dependencies

  // Update summary text generation
   const getSummaryText = () => {
    if (!workoutSummary || !workoutType) return null; 
    if (workoutType === "gym" || workoutType === "home_strength") {
      if (workoutSummary.totalVolume === undefined || workoutSummary.totalReps === undefined) return null; 
      const intensityText = workoutSummary.totalVolume > 10000 ? "heavy" : workoutSummary.totalVolume > 3000 ? "moderate" : "light";
      const verb = getVerbTenseText(); 
      return `${verb} a total volume of ${workoutSummary.totalVolume} kg over ${workoutSummary.totalReps} reps. This was a ${intensityText} workout.`
    } else if (["running", "swimming", "cycling", "walking"].includes(workoutType)) { 
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
    // Use the updated validExercises memo
    const exercisesToSubmit = validExercises;
    
    // Updated Validation checks
    const isStrengthType = workoutType === "gym" || workoutType === "home_strength" || workoutType === "strength";
    if (isStrengthType && exercisesToSubmit.length === 0) {
      setError("Please add at least one exercise with valid sets (reps > 0).");
      return;
    }
    if (!isStrengthType && (!distance || !duration || Number(distance) <= 0 || Number(duration) <= 0)) {
      setError("Please enter a valid distance and duration for this activity type.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    // --- Determine the correct WorkoutType for the database ---
    let finalWorkoutTypeForPayload: AllowedWorkoutType;
    if (isStrengthType) {
      finalWorkoutTypeForPayload = "strength";
    } else if (["running", "swimming", "cycling", "hiit", "flexibility", "walking", "yoga", "pilates", "other"].includes(workoutType)) {
      finalWorkoutTypeForPayload = workoutType as AllowedWorkoutType;
    } else {
      console.error("Invalid workoutType selected:", workoutType);
      setError("Invalid activity type selected.");
      setIsSubmitting(false);
      return;
    }
    
    const defaultWorkoutName = workoutTypeDisplayNames[workoutType] || "Workout";
    const finalWorkoutName = workoutName.trim() || defaultWorkoutName;

    // --- Map form state (ExerciseState[]) to payload structure --- 
    let exercisesPayload: WorkoutUpdatePayload['exercises'] = []; 

    if (finalWorkoutTypeForPayload === 'strength') {
      const mappedExercises = exercisesToSubmit
        .map((exState, index): WorkoutUpdatePayload['exercises'][0] | null => {
          const canonicalExerciseId = exState.exerciseId || dbExercisesMap.get(exState.name)?._id;
          if (!canonicalExerciseId) return null;
          const exerciseSetsPayload: InputSetData[] = exState.sets
            .map((setState, setIndex): InputSetData | null => {
              const reps = Number.parseInt(setState.reps || '0');
              if (reps > 0) {
                return {
                  weight: Number.parseFloat(setState.weight || '0') || 0,
                  reps: reps,
                  duration: setState.duration ? Number.parseInt(setState.duration) : undefined,
                  distance: setState.distance ? Number.parseFloat(setState.distance) : undefined,
                  notes: setState.notes || undefined,
                  order: setIndex 
                };
              } 
              return null;
            })
            .filter(isDefined);
          
          if (exerciseSetsPayload.length > 0) {
            return {
              _id: typeof exState.id === 'string' && exState.id.startsWith('loaded-') ? exState.id.replace('loaded-', '') : undefined,
              exerciseId: canonicalExerciseId,
              name: exState.name, 
              order: index,
              sets: exerciseSetsPayload,
              notes: exState.notes || undefined, 
            };
          } 
          return null; 
        });
        
      // @ts-ignore - Linter seems unable to correctly infer type after filter
      exercisesPayload = mappedExercises.filter(isDefined);
      
      if (exercisesPayload.length === 0 && exercisesToSubmit.length > 0) {
         setError("Could not map any exercises to a valid format. Ensure reps > 0.");
         setIsSubmitting(false);
         return;
      }

    } else { // Handle Cardio/Other Types
      const parsedDuration = Number.parseFloat(duration);
      const parsedDistance = Number.parseFloat(distance);
      const cardioExerciseName = finalWorkoutTypeForPayload.charAt(0).toUpperCase() + finalWorkoutTypeForPayload.slice(1);
      let canonicalCardioExercise = dbExercisesMap.get(cardioExerciseName);
      
      if (!canonicalCardioExercise) {
          // Try with "ing" suffix (e.g., "Running" instead of "Run")
          const alternativeName = cardioExerciseName + (cardioExerciseName.endsWith('e') ? '' : 'ing');
          canonicalCardioExercise = dbExercisesMap.get(alternativeName);
          if (!canonicalCardioExercise) {
            canonicalCardioExercise = dbExercisesMap.get(cardioExerciseName.toLowerCase()) || dbExercisesMap.get(alternativeName.toLowerCase());
          }
       }

      if (!canonicalCardioExercise) {
          console.error(`Could not find canonical exercise for type: ${finalWorkoutTypeForPayload}. Tried: ${cardioExerciseName}`);
          // Decide how to handle - maybe create a placeholder exercise? For now, we might error.
          setError(`Could not find a matching exercise definition for type: ${finalWorkoutTypeForPayload}.`);
          setIsSubmitting(false);
          return; 
      } else {
          // Create a single WorkoutExercise entry for the cardio activity
          exercisesPayload = [{
              exerciseId: canonicalCardioExercise._id,
              name: canonicalCardioExercise.name,
              order: 0,
              // Store duration/distance on the WorkoutExercise level for cardio
              duration: parsedDuration * 60, // Convert form minutes to seconds
              distance: parsedDistance * 1000, // Convert form km to meters?
              sets: [], // Cardio doesn't have sets in this model
          }];
      }
    }

    // --- Construct final WorkoutUpdatePayload --- 
    let cardioDetailsPayload: WorkoutUpdatePayload['cardioDetails'] = undefined;
    const parsedCardioDistance = distance ? Number.parseFloat(distance) * 1000 : undefined; // meters
    const parsedCardioDuration = duration ? Number.parseFloat(duration) * 60 : undefined; // seconds

    if (!isStrengthType) {
        cardioDetailsPayload = { distance: parsedCardioDistance ?? 0, duration: parsedCardioDuration ?? 0 };
    }
    
    const workoutPayload: Omit<WorkoutUpdatePayload, 'userId'> = {
      date: date, 
      name: finalWorkoutName,
      type: finalWorkoutTypeForPayload,
      notes: getSummaryText() || "", 
      duration: isStrengthType ? undefined : (parsedCardioDuration || 0),
      exercises: exercisesPayload, 
      cardioDetails: cardioDetailsPayload,
    };

    console.log("Submitting workout payload (NEW STRUCTURE):", JSON.stringify(workoutPayload, null, 2));

    try {
      setIsLoadingData(true);
      let savedWorkout;
      if (isEditing && editingWorkoutId) {
        console.log(`Attempting to update workout ID: ${editingWorkoutId}`);
        savedWorkout = await updateWorkoutAction(editingWorkoutId, workoutPayload);
        toast.success('Workout updated successfully!');
      } else {
        console.log("Attempting to create new workout");
        // Type assertion needed as createWorkout expects userId, but Omit removed it.
        const createPayload = {
            ...workoutPayload,
            userId: session!.user!.id, 
        } as any; // Use `as any` or define a specific CreatePayload type
        savedWorkout = await createWorkoutAction(createPayload); 
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
                          <Button variant="link" className={inlineButtonStyle}>
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
                  <SelectTrigger className={cn(inlineSelectStyle, !workoutType && "text-lg font-semibold text-muted-foreground")}>
                     {workoutType ? workoutTypeDisplayNames[workoutType] : "Select activity..."} 
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}>
                    {Object.entries(workoutTypeDisplayNames).filter(([key]) => key !== 'strength').map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </p>

              {/* Cardio workout details - check against WorkoutTypeOption */}
              {workoutType && !["gym", "home_strength", "strength"].includes(workoutType) && workoutType !== "other" && (
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

              {/* Gym workout details - check against WorkoutTypeOption */}
              {workoutType && (workoutType === "gym" || workoutType === "home_strength") && (
                <div className="space-y-10 text-left">
                  {exercises.map((exercise, exerciseIndex) => (
                    <div key={exercise.id} className="space-y-4 p-4 border rounded-lg relative group bg-muted/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold mr-1">{exerciseIndex + 1}.</span>
                            <Select
                              value={exercise.name}
                              onValueChange={(value) => updateExerciseField(exercise.id, "name", value)}
                            >
                              <SelectTrigger className="h-auto p-1 border-b border-input text-base w-auto min-w-[150px]">
                                <SelectValue placeholder="Select exercise" />
                              </SelectTrigger>
                              <SelectContent style={{ backgroundColor: 'hsl(var(--card))' }}>
                                {strengthExercises.length > 0 ? strengthExercises.map((option) => (
                                  <SelectItem key={option._id} value={option.name}>{option.name}</SelectItem>
                                )) : <SelectItem value="" disabled>Loading...</SelectItem>}
                                <SelectItem value="Other">Other (Type name)</SelectItem>
                              </SelectContent>
                            </Select>
                            {exercise.name === 'Other' && (
                              <Input
                                type="text"
                                value={exercise.name === 'Other' ? '' : exercise.name}
                                onChange={(e) => updateExerciseField(exercise.id, "name", e.target.value)}
                                className="h-auto p-1 border-b border-input text-base w-40 bg-transparent"
                                placeholder="Type exercise name"
                                autoFocus
                              />
                            )}
                         </div>
                         <Button 
                           type="button" 
                           variant="ghost" 
                           size="icon" 
                           className="text-muted-foreground hover:text-destructive h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity"
                           onClick={() => removeExercise(exercise.id)} 
                           aria-label="Remove exercise"
                          >
                            <LucideX className="h-4 w-4" />
                          </Button>
                      </div>

                      <div className="space-y-2 pl-4">
                        <Label className="text-xs font-semibold text-muted-foreground block mb-1">Sets:</Label>
                        {exercise.sets.map((set, setIndex) => (
                          <div key={set.id} className="flex items-center gap-3 flex-wrap relative group/set ml-2"> 
                            <span className="font-medium text-sm w-10 text-right text-muted-foreground">{setIndex + 1}.</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Label htmlFor={`weight-${exercise.id}-${set.id}`} className="sr-only">Weight</Label>
                                <Input id={`weight-${exercise.id}-${set.id}`} type="number" value={set.weight || ''} onChange={(e) => updateSetField(exercise.id, set.id, "weight", e.target.value)} className="h-8 w-20 text-sm" placeholder="Weight" step="0.5" min="0" /> 
                                <span className="text-sm text-muted-foreground">kg</span>
                                
                                <Label htmlFor={`reps-${exercise.id}-${set.id}`} className="sr-only">Reps</Label>
                                <Input id={`reps-${exercise.id}-${set.id}`} type="number" value={set.reps || ''} onChange={(e) => updateSetField(exercise.id, set.id, "reps", e.target.value)} className="h-8 w-16 text-sm" placeholder="Reps" min="1" />
                                <span className="text-sm text-muted-foreground">reps</span>
                                
                                <Label htmlFor={`set-notes-${exercise.id}-${set.id}`} className="sr-only">Set Notes</Label>
                                <Input id={`set-notes-${exercise.id}-${set.id}`} type="text" value={set.notes || ''} onChange={(e) => updateSetField(exercise.id, set.id, "notes", e.target.value)} className="h-8 text-sm flex-grow min-w-[100px]" placeholder="Set notes (optional)" />
                            </div>
                             <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-destructive h-6 w-6 opacity-0 group-hover/set:opacity-100 transition-opacity absolute -right-2 top-1/2 -translate-y-1/2" 
                                onClick={() => removeSet(exercise.id, set.id)} 
                                aria-label="Remove set"
                              >
                                <LucideX className="h-3.5 w-3.5" />
                              </Button>
                          </div>
                        ))}
                         <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 h-8 text-xs"
                          onClick={() => addSet(exercise.id)}
                        >
                          <LucidePlus className="h-3 w-3 mr-1"/> Add Set
                        </Button>
                      </div>
                      
                       <div className="pl-4 pt-2">
                           <Label htmlFor={`notes-${exercise.id}`} className="text-xs text-muted-foreground">Exercise Notes (Optional)</Label>
                           <Input 
                              id={`notes-${exercise.id}`}
                              type="text" 
                              value={exercise.notes || ''} 
                              onChange={(e) => updateExerciseField(exercise.id, "notes", e.target.value)} 
                              className="h-8 text-sm mt-1 w-full"
                              placeholder="e.g., warm-up/cool-down, technique focus..." 
                            />
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

