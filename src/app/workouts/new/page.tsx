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
import { Textarea } from "@/components/ui/textarea"

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

// Add this function near the other utility functions
const estimateWorkoutDuration = (exercises: ExerciseState[]): number => {
  if (!exercises.length) return 0;
  
  let totalDuration = 0;
  
  // Average time per rep in seconds
  const timePerRep = 3;
  // Average rest between sets in seconds
  const restBetweenSets = 90;
  // Average rest between exercises in seconds
  const restBetweenExercises = 120;
  
  exercises.forEach((exercise, exerciseIndex) => {
    exercise.sets.forEach((set) => {
      // Time for the reps
      const reps = Number(set.reps) || 0;
      totalDuration += reps * timePerRep;
      
      // Add rest time after each set (except the last set of the last exercise)
      if (exerciseIndex < exercises.length - 1 || set !== exercise.sets[exercise.sets.length - 1]) {
        totalDuration += restBetweenSets;
      }
    });
    
    // Add rest time between exercises (except after the last exercise)
    if (exerciseIndex < exercises.length - 1) {
      totalDuration += restBetweenExercises;
    }
  });
  
  // Add 5 minutes (300 seconds) for warm-up
  totalDuration += 300;
  
  // Return total seconds
  return totalDuration;
};

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

  // Replace with new filtering logic
  const filteredExercises = useMemo(() => {
    // Always include exercises that are currently in the workout
    const currentExerciseNames = new Set(exercises.map(ex => ex.name));
    const exercisesInCurrentWorkout = dbExercises.filter(ex => currentExerciseNames.has(ex.name));
    
    // If no workout type selected, show all exercises plus current ones
    if (!workoutType) {
      return Array.from(new Set([...exercisesInCurrentWorkout, ...dbExercises]));
    }
    
    if (workoutType === "home_strength") {
      // Filter for exercises that are marked as suitable for home workouts
      const filteredHomeExercises = dbExercises.filter(ex => {
        // Skip filtering for exercises that are already in the workout
        if (currentExerciseNames.has(ex.name)) {
          return true;
        }
        
        const equipmentList = Array.isArray(ex.equipment) ? ex.equipment : [];
        const category = ex.category?.toLowerCase() || '';
        const name = ex.name.toLowerCase();
        
        // Exclude cardio exercises
        if (
          category.includes('cardio') ||
          name.includes('running') ||
          name.includes('walking') ||
          name.includes('hiking') ||
          name.includes('swimming') ||
          name.includes('cycling')
        ) {
          return false;
        }
        
        return equipmentList.some(eq => eq?.toLowerCase().includes('bodyweight') || eq?.toLowerCase().includes('home')) ||
               equipmentList.length === 0 || // No equipment needed
               category.includes('bodyweight');
      });

      return Array.from(new Set([...exercisesInCurrentWorkout, ...filteredHomeExercises]));
    } else if (workoutType === "gym") {
      // For gym workouts, show all strength exercises
      const filteredGymExercises = dbExercises.filter(ex => {
        // Skip filtering for exercises that are already in the workout
        if (currentExerciseNames.has(ex.name)) {
          return true;
        }
        
        const category = ex.category?.toLowerCase() || '';
        return category.includes('strength');
      });

      return Array.from(new Set([...exercisesInCurrentWorkout, ...filteredGymExercises]));
    }
    
    return Array.from(new Set([...exercisesInCurrentWorkout, ...dbExercises]));
  }, [workoutType, dbExercises, exercises]);

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
          
          // Map the database workout type to the correct form type
          let formTypeOption: WorkoutTypeOption;
          if (data.type === 'strength') {
            // Default to home_strength, will be updated based on exercises
            formTypeOption = 'home_strength';
            // Check if any exercise requires gym equipment
            const hasGymExercises = data.workoutExercises?.some(ex => {
              const exercise = dbExercises.find(dbEx => dbEx._id === ex.exerciseId?._id);
              const equipment = Array.isArray(exercise?.equipment) ? exercise.equipment : [];
              return equipment.some(eq => !eq?.toLowerCase().includes('bodyweight') && !eq?.toLowerCase().includes('home'));
            });
            if (hasGymExercises) {
              formTypeOption = 'gym';
            }
          } else {
            formTypeOption = data.type as WorkoutTypeOption;
          }
          setWorkoutType(formTypeOption);
          
          setWorkoutName(data.name || "");
          setDistance(data.cardioDetails?.distance?.toString() || data.distance?.toString() || ""); 
          
          // Map DB WorkoutExercises to form state
          let mappedExercises: ExerciseState[] = [];
          if (data.workoutExercises && data.workoutExercises.length > 0) {
            mappedExercises = data.workoutExercises.map((ex: WorkoutExerciseData): ExerciseState => { 
              const setsArray = Array.isArray(ex.sets) ? ex.sets : [];
              return {
                id: ex._id || `loaded-${Date.now()}`,
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

          // If it's a strength workout and duration is missing or zero, estimate it
          if (data.type === 'strength' && (!data.duration || data.duration === 0)) {
            const estimatedDuration = estimateWorkoutDuration(mappedExercises);
            setDuration(estimatedDuration.toString());
          } else {
            setDuration(data.duration?.toString() || "");
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
  }, [editingWorkoutId, duplicateWorkoutId, dbExercises]); // Added dbExercises to dependencies

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

  // Handle selection from ExerciseSelect component
  const handleExerciseSelection = (exerciseId: number | string, selectedDbExerciseId: string) => {
    setError(null);
    // Find by ID now, assuming map key is ID
    const selectedDbExercise = dbExercises.find(ex => ex._id === selectedDbExerciseId); 
    if (!selectedDbExercise) {
      console.error("Selected DB exercise not found:", selectedDbExerciseId);
      // If not found by ID, try by name as a fallback (using the Map)
      const selectedByName = dbExercisesMap.get(selectedDbExerciseId); // selectedDbExerciseId might actually be the name here
      if (selectedByName) {
         // Call recursively with the ID if found by name
         handleExerciseSelection(exerciseId, selectedByName._id);
         return;
      }
      console.error("Selected exercise not found by ID or name:", selectedDbExerciseId);
      toast.error("Could not find selected exercise details.");
      return; 
    }

    setExercises((prevExercises) =>
      prevExercises.map((ex) => {
        if (ex.id === exerciseId) {
          const firstSet = ex.sets[0];
          let updatedWeight = firstSet?.weight || "";
          
          // --- Safer Bodyweight Check ---
          // Use type assertion assuming session might be augmented
          const userWeight = typeof (session?.user as any)?.weight === 'number' ? (session?.user as any).weight : undefined;
          const isBodyweightExercise = selectedDbExercise.category?.toLowerCase().includes('bodyweight');

          // Ensure userWeight is a number before calling
          if (isBodyweightExercise && typeof userWeight === 'number' && userWeight > 0 && !updatedWeight) {
             // Pass only exercise name as per linter error
             updatedWeight = estimateBodyweightForExercise(selectedDbExercise.name /*, userWeight */).toString();
          }
          // --- End Safer Check ---
          
          return {
            ...ex,
            exerciseId: selectedDbExercise._id,
            name: selectedDbExercise.name, 
            sets: ex.sets.map((set, index) => index === 0 ? { ...set, weight: updatedWeight } : set),
          };
        }
        return ex;
      })
    );
  };

  const getDefaultWorkoutName = (type: WorkoutTypeOption | undefined, workoutDate: Date) => {
    if (!type) return `Workout - ${format(workoutDate, 'PP')}`;
    return `${workoutTypeDisplayNames[type]} - ${format(workoutDate, 'PP')}`;
  };

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
    
    const finalWorkoutName = workoutName.trim() || getDefaultWorkoutName(workoutType, date);

    // --- Map form state (ExerciseState[]) to payload structure --- 
    let exercisesPayload: WorkoutUpdatePayload['exercises'] = []; 

    if (finalWorkoutTypeForPayload === 'strength') {
      const mappedExercises = exercisesToSubmit
        .map((exState, index): NonNullable<WorkoutUpdatePayload['exercises']>[number] | null => {
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
            } as NonNullable<WorkoutUpdatePayload['exercises']>[number];
          } 
          return null; 
        });
        
      // Remove @ts-ignore and explicitly type the result of filter
      const definedExercisesPayload: NonNullable<WorkoutUpdatePayload['exercises']>[number][] = mappedExercises.filter(isDefined);
      exercisesPayload = definedExercisesPayload; // Assign to the broader type variable
      
      // Add check here (using the correctly typed variable)
      if (exercisesToSubmit.length > 0 && definedExercisesPayload.length === 0) {
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
          setError(`Could not find a matching exercise definition for type: ${finalWorkoutTypeForPayload}.`);
          setIsSubmitting(false);
          return; 
      } else {
          // Create a single WorkoutExercise entry for the cardio activity
          // Check for non-empty duration/distance before creating payload
          if (parsedDuration > 0 || parsedDistance > 0) { 
              exercisesPayload = [{
                  exerciseId: canonicalCardioExercise._id,
                  name: canonicalCardioExercise.name,
                  order: 0,
                  duration: parsedDuration > 0 ? parsedDuration * 60 : undefined, // Convert form minutes to seconds
                  distance: parsedDistance > 0 ? parsedDistance * 1000 : undefined, // Convert form km to meters?
                  sets: [], // Cardio doesn't have sets in this model
              }] as WorkoutUpdatePayload['exercises'];
          } else {
             // If no duration/distance, don't add an exercise entry
             exercisesPayload = []; 
          }
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
      duration: isStrengthType 
        ? estimateWorkoutDuration(exercisesToSubmit)
        : (parsedCardioDuration || 0),
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
        router.push(`/workouts/${savedWorkout._id}`);
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
      return <div className="container mx-auto px-4 py-8">Loading workout data...</div>;
  }

  // --- Render Logic ---
  const isStrengthWorkout = workoutType === "gym" || workoutType === "home_strength" || workoutType === "strength";

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl"> 
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
          <LucideArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Edit Workout" : duplicateWorkoutId ? "Duplicate Workout" : "Log New Workout"}
        </h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Workout Metadata Section */}
        <div className="space-y-4 rounded-md border p-4 md:p-6">
           <h2 className="text-lg font-medium mb-4">Workout Details</h2>
            
           {/* Workout Type Selection */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                 <Label htmlFor="workout-type">Activity Type</Label>
                 <Select 
                    value={workoutType} 
                    onValueChange={(value) => setWorkoutType(value as WorkoutTypeOption)}
                    // disabled={isEditing} // Maybe allow changing type even when editing? Or disable?
                 >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select activity type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800">
                    {Object.entries(workoutTypeDisplayNames)
                      // Optionally filter out 'strength' if needed
                      // .filter(([key]) => key !== 'strength')
                      .map(([value, displayName]) => (
                        <SelectItem key={value} value={value}>{displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
               <div>
                 <Label htmlFor="workout-date">Date</Label>
                 <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <Button
                        id="workout-date"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => {
                            if (newDate) {
                                setDate(newDate);
                                updateTenseBasedOnDate(newDate);
                            }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
           </div>
           
           {/* Workout Name Input */}
           <div>
             <Label htmlFor="workout-name">Workout Name</Label>
             <Input
                id="workout-name"
                placeholder={workoutType ? `e.g., ${workoutTypeDisplayNames[workoutType]}` : "Workout Name"}
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="placeholder:text-muted-foreground/50"
             />
             <p className="text-sm text-muted-foreground mt-1">Give your workout a descriptive name.</p>
           </div>
        </div>


        {/* Conditional Fields for Non-Strength Workouts */}
        {!isStrengthWorkout && workoutType && (
          <div className="space-y-4 rounded-md border p-4 md:p-6">
             <h2 className="text-lg font-medium mb-4">{workoutTypeDisplayNames[workoutType]} Details</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input 
                    id="duration"
                    type="number" 
                    placeholder="e.g., 30" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                    min="0" 
                  />
                </div>
                {/* Add distance field only for relevant types */}
                {(workoutType === 'running' || workoutType === 'cycling' || workoutType === 'walking' || workoutType === 'swimming') && (
                  <div>
                    <Label htmlFor="distance">Distance (km/miles)</Label> 
                    <Input 
                      id="distance"
                      type="number" 
                      placeholder="e.g., 5" 
                      value={distance} 
                      onChange={(e) => setDistance(e.target.value)}
                      min="0"
                      step="0.1" 
                    />
                    {/* Consider adding unit toggle (km/miles) later */}
                  </div>
                )}
             </div>
          </div>
        )}

        {/* Exercises Section (for Strength Workouts) */}
        {isStrengthWorkout && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Exercises</h2>
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="rounded-md border p-4 md:p-6 space-y-4 relative bg-background">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2 mr-2">
                     <Label htmlFor={`exercise-name-${exercise.id}`}>Exercise #{index + 1}</Label>
                     {/* Use ExerciseSelect component - REPLACED with standard Select */}
                     <Select
                        // Pass the canonical ID if known, otherwise the name might be temporarily stored
                        value={exercise.exerciseId || exercise.name || ''} 
                        // Add string type to parameter
                        onValueChange={(selectedIdOrName: string) => {
                            // Find the exercise in dbExercises by ID first
                            const matchedEx = dbExercises.find(dbEx => dbEx._id === selectedIdOrName);
                            if (matchedEx) {
                                handleExerciseSelection(exercise.id, matchedEx._id);
                            } else {
                                // Fallback: If not found by ID, assume it's a name (e.g., "Other")
                                // or handle the case where the ID isn't in the list
                                console.warn(`Exercise ID ${selectedIdOrName} not found directly, might be a name.`);
                                // If it's just the name changing, update the name field directly
                                // The exerciseId lookup happens in updateExerciseField or handleExerciseSelection
                                updateExerciseField(exercise.id, 'name', selectedIdOrName);
                                // If selectedIdOrName *is* a valid DB exercise ID after all, call handleSelection
                                const potentialMatchById = dbExercises.find(dbEx => dbEx._id === selectedIdOrName);
                                if(potentialMatchById) {
                                   handleExerciseSelection(exercise.id, potentialMatchById._id);
                                } else if (selectedIdOrName === 'Other') {
                                  // Handle 'Other' explicitly if needed
                                }
                                // Consider adding an 'Other' input field if selectedIdOrName === 'Other'
                            }
                        }}
                     >
                        <SelectTrigger id={`exercise-name-${exercise.id}`}>
                          <SelectValue placeholder="Select exercise" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="bg-card">
                           {/* Use filteredExercises instead of dbExercises */}
                           {filteredExercises.length > 0 ? filteredExercises.map((option) => (
                              <SelectItem key={option._id} value={option._id}>{option.name}</SelectItem>
                           )) : <SelectItem value="" disabled>Loading exercises...</SelectItem>}
                        </SelectContent>
                     </Select>
                     {/* Consider adding a manual Input field if 'Other' is selected or if the Select value doesn't match a known ID */}
                     {/* {exercise.name === 'Other' && ( ... Input field ... ) } */}
                  </div>
                   <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeExercise(exercise.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive h-7 w-7"
                      title="Remove Exercise"
                    >
                      <LucideX className="h-4 w-4" />
                      <span className="sr-only">Remove Exercise</span>
                   </Button>
                 </div>

                {/* Sets Section */}
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                   <Label className="text-sm font-medium">Sets</Label>
                   {exercise.sets.map((set, setIndex) => (
                    <div key={set.id} className="flex items-end space-x-2">
                       <span className="text-sm text-muted-foreground w-6 text-right pr-1">{setIndex + 1}.</span>
                       {/* Set Inputs - Arranged Horizontally */}
                       <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                         <div>
                           <Label htmlFor={`weight-${exercise.id}-${set.id}`} className="text-xs">Weight (kg)</Label>
                           <Input
                              id={`weight-${exercise.id}-${set.id}`}
                              type="number"
                              placeholder="Weight"
                              value={set.weight || ""}
                              onChange={(e) => updateSetField(exercise.id, set.id, 'weight', e.target.value)}
                              min="0"
                              step="0.1"
                           />
                         </div>
                         <div>
                           <Label htmlFor={`reps-${exercise.id}-${set.id}`} className="text-xs">Reps</Label>
                           <Input
                              id={`reps-${exercise.id}-${set.id}`}
                              type="number"
                              placeholder="Reps"
                              value={set.reps || ""}
                              onChange={(e) => updateSetField(exercise.id, set.id, 'reps', e.target.value)}
                              min="0"
                           />
                         </div>
                          {/* Optional Notes per Set - moved to end */}
                         <div className="col-span-2 md:col-span-1">
                             <Label htmlFor={`set-notes-${exercise.id}-${set.id}`} className="text-xs">Set Notes (Opt.)</Label>
                             <Input
                                id={`set-notes-${exercise.id}-${set.id}`}
                                placeholder="e.g., RPE 8"
                                value={set.notes || ""}
                                onChange={(e) => updateSetField(exercise.id, set.id, 'notes', e.target.value)}
                                className="placeholder:text-muted-foreground/50"
                             />
                         </div>
                       </div>
                       
                       {/* Remove Set Button */}
                       <Button 
                         type="button" 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => removeSet(exercise.id, set.id)}
                         disabled={exercise.sets.length <= 1} // Disable removing the last set
                         className="h-8 w-8 text-muted-foreground hover:text-destructive"
                         title="Remove Set"
                       >
                         <LucideX className="h-4 w-4" />
                         <span className="sr-only">Remove Set</span>
                       </Button>
                    </div>
                   ))}
                   {/* Add Set Button */}
                   <Button 
                     type="button" 
                     variant="outline" 
                     size="sm"
                     onClick={() => addSet(exercise.id)} 
                     className="mt-2"
                    >
                     <LucidePlus className="h-4 w-4 mr-1" /> Add Set
                   </Button>
                </div>

                {/* Exercise Notes */}
                <div>
                  <Label htmlFor={`exercise-notes-${exercise.id}`}>Exercise Notes (Optional)</Label>
                  <Textarea
                    id={`exercise-notes-${exercise.id}`}
                    placeholder="e.g., Focused on form, felt strong"
                    value={exercise.notes || ""}
                    onChange={(e) => updateExerciseField(exercise.id, 'notes', e.target.value)}
                    className="placeholder:text-muted-foreground/50"
                    rows={2}
                  />
                </div>
              </div>
            ))}
            {/* Add Exercise Button */}
            <Button type="button" variant="secondary" onClick={addExercise} className="w-full md:w-auto">
               <LucidePlus className="h-4 w-4 mr-2" /> Add Exercise
            </Button>
          </div>
        )}

        {/* Save Workout Button */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting || !workoutType || (!isStrengthWorkout && !duration && !distance) || (isStrengthWorkout && exercises.length === 0) }>
            {isSubmitting ? "Saving..." : isEditing ? "Update Workout" : "Save Workout"}
          </Button>
        </div>
      </form>
    </div>
  )
}

