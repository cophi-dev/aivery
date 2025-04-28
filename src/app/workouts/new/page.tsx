"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format, isToday, isPast, isFuture, parseISO } from "date-fns"
import { useSession } from "next-auth/react"
import { LucideArrowLeft, CalendarIcon, LucidePlus, LucideX, ChevronsUpDown, Check, Loader2, Dumbbell, Home, Footprints, Bike, PersonStanding, Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from 'react-hot-toast'
import { motion } from 'motion/react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { 
  createWorkout as createWorkoutAction, 
  updateWorkoutAction,
  type WorkoutUpdatePayload,
  type InputSetData
} from "@/lib/workout-actions"
import { fetchExercises, searchAllExercisesAction, fetchAllExercisesAction } from "@/lib/exercise-actions"
import type { ExerciseData, WorkoutData, WorkoutExerciseData, Set } from "@/types/db"
import { IWorkout } from "@/lib/db/models/workout"
import { estimateBodyweightForExercise } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { useDebounce } from "@/hooks/useDebounce"
import { GlowEffect } from "@/components/ui/glow-effect"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

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

// Represents a single exercise in the form state, containing multiple sets OR duration/distance
type ExerciseState = {
  id: number | string; // Temporary ID for form state (e.g., `ex-temp-${Date.now()}`)
  exerciseId?: string; // ID of the canonical Exercise (if known/selected)
  name: string; // Name of the canonical Exercise
  notes?: string; // Notes specific to this exercise in this workout
  // Fields for Strength/Set-based exercises
  sets: SetState[]; 
  // Fields for Cardio/Duration-based exercises added within a workout
  duration?: string; // Duration in minutes for this specific exercise instance
  distance?: string; // Distance in km/miles for this specific exercise instance
}
// --- END NEW State Types ---

// --- NEW Type for AI Response Data (Mirroring API route's type) ---
// TODO: Keep this in sync with the API route's ParsedWorkoutData type
type ParsedWorkoutData = {
  workoutType?: string;
  workoutName?: string;
  exercises: Array<{ // Should be empty [] for pure cardio unless intervals are logged
    name: string;
    notes?: string;
    sets: Array<{
      weight?: string;
      reps?: string;
      notes?: string;
    }>;
  }>;
  // NEW: Align with backend type - Add cardioDetails
  cardioDetails?: {
    distance?: number; // in km
    duration?: number; // in minutes
  };
};
// --- END Type for AI Response Data ---

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

// --- NEW Exercise Alias Mapping ---
// Add known aliases here (lowercase keys and values for consistent lookup)
const exerciseAliases: Record<string, string> = {
  'kreuzheben': 'deadlift',
  'bankdrücken': 'bench press',
  'klimmzüge': 'pull-up', // Or 'pull ups' depending on your canonical name
  'kniebeugen': 'squat',
  // Add more aliases as needed
  'kettlebell swings': 'Kettlebell Swings', // Try matching exact case/plural
  'pushups': 'Pushup', // Try matching no hyphen, capitalized
  'pullups': 'Pull-up', // Keep previous attempt
  'horsestance': 'horse stance' // Keep previous attempt
};

// --- NEW Helper Function for Normalizing Names ---
const normalizeName = (name: string): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/-/g, '') // Remove hyphens
    // Basic plural check: remove trailing 's' if word isn't 'ss' or similar
    .replace(/([^s])s$/, '$1'); 
};

// --- NEW Helper to Find Canonical Exercise ---
const findCanonicalExercise = (
  parsedName: string,
  dbExercises: ExerciseData[],
  aliases: Record<string, string>
): ExerciseData | undefined => {
  if (!parsedName) return undefined;

  const normalizedParsedName = normalizeName(parsedName);

  // 1. Try direct normalized match
  let foundExercise = dbExercises.find(ex => {
      const normalizedDbName = normalizeName(ex.name);
      return normalizedDbName === normalizedParsedName;
  });

  if (foundExercise) {
    return foundExercise;
  }

  // 2. Try alias match (normalize the alias key and the target)
  // First, check if normalized input matches a normalized alias *key*
  const normalizedAliasKey = Object.keys(aliases).find(key => {
      const normalizedKey = normalizeName(key);
      return normalizedKey === normalizedParsedName;
  });
  const aliasTargetName = normalizedAliasKey ? aliases[normalizedAliasKey] : undefined;

  if (aliasTargetName) {
    // Find DB exercise matching the normalized alias *target*
    foundExercise = dbExercises.find(ex => {
        const normalizedDbName = normalizeName(ex.name);
        return normalizeName(ex.name) === normalizeName(aliasTargetName);
    });
    if (foundExercise) {
      return foundExercise;
    }
  }

  console.warn(`[findCanonicalExercise] Could not find canonical match for: "${parsedName}" (Normalized: "${normalizedParsedName}")`);
  return undefined; // Not found
};

// Define the main types for the toggle group
const mainWorkoutTypes: { value: WorkoutTypeOption; label: string; icon: React.ElementType }[] = [
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'home_strength', label: 'Home', icon: Home },
  { value: 'running', label: 'Run', icon: Footprints },
  { value: 'swimming', label: 'Swim', icon: Waves },
  { value: 'cycling', label: 'Bike', icon: Bike },
  { value: 'yoga', label: 'Yoga', icon: PersonStanding }, // Using yoga state value
];

export default function NewWorkoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  const editingWorkoutId = searchParams?.get("id");
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
  const [aiLogInput, setAiLogInput] = useState<string>("") // State for AI input
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false) // State for AI processing status

  // --- NEW Search State ---
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExerciseData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchList, setShowSearchList] = useState(false); // To control combobox popover visibility
  const debouncedSearchQuery = useDebounce(exerciseSearchQuery, 300); // Debounce search input
  // --- END Search State ---

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
        
        // Include if category is 'strength' OR meets existing home criteria
        return category.includes('strength') || 
               equipmentList.some(eq => eq?.toLowerCase().includes('bodyweight') || eq?.toLowerCase().includes('home')) ||
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

  // --- NEW: Moved AI Handler inside component ---
  // Modified to return parsed data on success
  const handleAiProcess = async (aiLogInput: string) => { 
    if (!aiLogInput.trim()) {
      toast.error("Please enter your workout log first.");
      return; // Explicit return for early exit
    }
    setIsProcessingAi(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logText: aiLogInput }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const parsedData: ParsedWorkoutData = await response.json();

      // --- Update State based on Parsed Data (for UI feedback) ---
      // Still update state so the user sees the form populate
      setExercises([]); // Clear existing before populating

      if (parsedData.workoutType && workoutTypeDisplayNames.hasOwnProperty(parsedData.workoutType)) {
        setWorkoutType(parsedData.workoutType as WorkoutTypeOption);
      } else {
        // If type isn't explicitly set, infer from exercises or default
        if (parsedData.exercises && parsedData.exercises.length > 0) {
           // If exercises exist but no type, assume 'gym' for strength
           if (!workoutType) { setWorkoutType("gym"); }
        } else if (parsedData.cardioDetails?.distance || parsedData.cardioDetails?.duration) {
           // If cardio details exist but no type, assume 'running'
           if (!workoutType) { setWorkoutType("running"); }
        }
      }

      if (parsedData.workoutName) { setWorkoutName(parsedData.workoutName); }

      // --- NEW: Update Distance and Duration from AI ---
      // AI response might include distance (km) and duration (minutes) directly or in cardioDetails
      // Convert distance (km) to string
      if (parsedData.cardioDetails?.distance !== undefined) {
        setDistance(String(parsedData.cardioDetails.distance));
      }
      // Convert duration (minutes) to string
      if (parsedData.cardioDetails?.duration !== undefined) {
        setDuration(String(parsedData.cardioDetails.duration));
      }
      // --- END NEW ---

      const newExercisesState: ExerciseState[] = parsedData.exercises.map((parsedEx) => {
        const exerciseTempId = `ex-temp-${Date.now()}-${Math.random()}`;
        const canonicalExercise = findCanonicalExercise(parsedEx.name, dbExercises, exerciseAliases);
        const newSetsState: SetState[] = parsedEx.sets.map((parsedSet) => ({
          id: `set-temp-${Date.now()}-${Math.random()}`,
          weight: parsedSet.weight || "",
          reps: parsedSet.reps || "",
          notes: parsedSet.notes || "",
        }));
        return {
          id: exerciseTempId,
          exerciseId: canonicalExercise?._id,
          name: canonicalExercise?.name || parsedEx.name,
          notes: parsedEx.notes || "",
          sets: newSetsState,
        };
      });
      setExercises(newExercisesState);
      toast.success("Workout populated from AI!");
      // --- End State Update ---

      setAiLogInput(""); // Clear the input field after success

    } catch (err) {
      console.error("AI Processing failed:", err);
      setError(`AI Processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error("AI Processing failed.");
      return; // Explicit return on error
    } finally {
      setIsProcessingAi(false);
    }
  };
  // --- END AI Handler ---

  // Fetch ALL exercises from DB on mount
  useEffect(() => {
    const loadAllExercises = async () => { 
      try {
        setIsLoadingData(true); 
        console.log("Fetching ALL exercises...");
        // Use the new action designed to fetch all exercises
        const fetchedExercises = await fetchAllExercisesAction(); 
        console.log(`Fetched ${fetchedExercises.length} total exercises.`); 
        setDbExercises(fetchedExercises); 
        setDbExercisesMap(new Map(fetchedExercises.map(ex => [ex.name, ex]))); 
      } catch (err) {
        console.error("Failed to fetch all exercises:", err);
        setError("Could not load initial exercises list.");
      } finally {
         setIsLoadingData(false); 
      }
    };
    loadAllExercises(); 
  }, []); // Run only once on mount

  // --- NEW Effect for searching ALL exercises ---
  useEffect(() => {
    const searchExercises = async () => {
      if (debouncedSearchQuery.trim().length < 2) {
        setSearchResults([]); // Clear results if query is too short
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        console.log(`Searching all exercises for: "${debouncedSearchQuery}"`);
        const results = await searchAllExercisesAction(debouncedSearchQuery);
        console.log(`Found ${results.length} search results.`);
        setSearchResults(results);
      } catch (err) {
        console.error("Failed to search exercises:", err);
        setError("Exercise search failed.");
        setSearchResults([]); // Clear results on error
      } finally {
        setIsSearching(false);
      }
    };

    searchExercises();
  }, [debouncedSearchQuery]);
  // --- END Search Effect ---

  // Fetch workout data if editing or duplicating
  useEffect(() => {
    const workoutIdToLoad = editingWorkoutId || duplicateWorkoutId;
    if (workoutIdToLoad && dbExercises.length > 0 && dbExercisesMap.size > 0) {
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
            // Filter out the 'Running' exercise ONLY if the main workout type is 'running'
            const exercisesToMap = formTypeOption === 'running' 
              ? data.workoutExercises.filter(ex => ex.exerciseId?.name?.toLowerCase() !== 'running') 
              : data.workoutExercises;

            mappedExercises = exercisesToMap.map((ex: WorkoutExerciseData): ExerciseState => { 
              const setsArray = Array.isArray(ex.sets) ? ex.sets : [];
              // Check if the specific exercise being mapped is cardio
              const isMappedExerciseCardio = ex.exerciseId?.category === 'cardio';
              
              return {
                id: ex._id || `loaded-${Date.now()}-${Math.random()}`, // Use random ID for loaded state
                exerciseId: ex.exerciseId?._id?.toString(),
                name: ex.exerciseId?.name || 'Unknown Exercise',
                notes: ex.notes || undefined,
                // Only include sets if it's NOT a cardio exercise being mapped
                sets: !isMappedExerciseCardio ? setsArray.map((set: Set, setIndex: number): SetState => ({ 
                  id: set._id || `loaded-set-${setIndex}-${Date.now()}-${Math.random()}`,
                  order: set.order ?? setIndex,
                  weight: set.weight?.toString() || "",
                  reps: set.reps?.toString() || "",
                  duration: set.duration?.toString() || "",
                  distance: set.distance?.toString() || "",
                  notes: set.notes || undefined,
                })) : [], // Empty sets for cardio exercises mapped here
                // Include duration/distance ONLY if it IS a cardio exercise being mapped
                // Convert seconds/meters from DB to minutes/km for form state
                duration: isMappedExerciseCardio ? (ex.duration ? (ex.duration / 60).toString() : "") : undefined,
                distance: isMappedExerciseCardio ? (ex.distance ? (ex.distance / 1000).toString() : "") : undefined,
              };
            });
            setExercises(mappedExercises);
          } else {
            setExercises([]); 
          }

          // If it's a strength workout and duration is missing or zero, estimate it
          if (data.type === 'strength' && (!data.duration || data.duration === 0)) {
            const estimatedDuration = estimateWorkoutDuration(mappedExercises);
            setDuration((estimatedDuration / 60).toString()); // Estimate in seconds, set state in minutes
          } else {
            // Convert fetched duration (seconds) to minutes for the form
            const durationInMinutes = data.duration ? Math.round(data.duration / 60) : "";
            setDuration(durationInMinutes.toString()); 
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
    } else {
      console.log(`[fetchWorkoutData Effect Check] Skipping fetch. Conditions not met.`);
    }
  }, [editingWorkoutId, duplicateWorkoutId, dbExercises, dbExercisesMap]);

  // Set tense based on date
  useEffect(() => {
    updateTenseBasedOnDate(date)
  }, [date])

  // Reset form fields when workout type changes
  useEffect(() => {
    if (isLoadingData) {
        return;
    }
    setError(null); 

    // Determine if the selected type is strength-related based on our options
    const isStrengthType = workoutType === "gym" || workoutType === "home_strength" || workoutType === "strength";
    
    if (isStrengthType) { 
      // Only add initial exercise if NOT editing/duplicating AND exercises are empty
      if (!isEditing && !duplicateWorkoutId && exercises.length === 0) { 
          addExercise(); // addExercise will now add an ExerciseState with one SetState
      }
    } else if (workoutType && !isEditing) { // Clear exercises if switching to a non-strength type AND NOT editing
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
    const newExercise: ExerciseState = {
      id: `ex-temp-${Date.now()}-${Math.random()}`, // Unique temp ID
      name: "", // Start with empty name, user will select
      sets: [{ id: `set-temp-${Date.now()}-${Math.random()}`, weight: "", reps: "" }], // Start with one empty set
    };
    setExercises([...exercises, newExercise]);
  };

  // Renamed and updated: Handles changes to Exercise properties
  const updateExerciseField = (exerciseId: number | string, field: 'name' | 'notes' | 'duration' | 'distance', value: string) => { // Added duration/distance
    setError(null);
    setExercises(exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        let updatedState = { ...exercise, [field]: value };

        // If name is changing, update canonical ID link
        if (field === 'name') {
            const matchedDbExercise = dbExercisesMap.get(value);
            updatedState.exerciseId = matchedDbExercise?._id;
            // If the newly matched exercise is cardio, clear sets
            if (matchedDbExercise?.category === 'cardio') {
               updatedState.sets = []; // Clear sets for cardio
               // Optionally pre-fill duration/distance if needed, or leave for user
            } else if (updatedState.sets.length === 0) {
               // If switching TO non-cardio and sets are empty, add a default set
               updatedState.sets = [{ id: `set-temp-${Date.now()}-${Math.random()}`, weight: "", reps: "" }];
            }
        }
        return updatedState;
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
                const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(exercise.name!);
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

  // --- Modified: Handle Exercise Selection --- 
  // This function is called when an exercise is selected from the Combobox
  const handleExerciseSelection = (exerciseStateId: number | string, selectedDbExercise: ExerciseData) => {
    if (!selectedDbExercise) return;

    setExercises(currentExercises =>
      currentExercises.map(ex => {
        if (ex.id === exerciseStateId) {
          // Update the exercise state with details from the selected DB exercise
          let updatedEx = {
            ...ex,
            exerciseId: selectedDbExercise._id, 
            name: selectedDbExercise.name, 
            // Clear duration/distance when selecting any exercise initially
            duration: undefined,
            distance: undefined,
          };

          // If the selected exercise is cardio, ensure sets are empty
          if (selectedDbExercise.category === 'cardio') {
            updatedEx.sets = [];
          } else if (updatedEx.sets.length === 0) {
            // If non-cardio and sets were empty (e.g., from previous cardio selection), add default set
            updatedEx.sets = [{ id: `set-temp-${Date.now()}-${Math.random()}`, weight: "", reps: "" }];
          }

          return updatedEx;
        }
        return ex;
      })
    );
    // Clear search after selection
    setExerciseSearchQuery("");
    setSearchResults([]);
    setShowSearchList(false);
  };
  // --- END Modified: Handle Exercise Selection ---

  const getDefaultWorkoutName = (type: WorkoutTypeOption | undefined, workoutDate: Date) => {
    if (!type) return `Workout - ${format(workoutDate, 'PP')}`;
    return `${workoutTypeDisplayNames[type]} - ${format(workoutDate, 'PP')}`;
  };

  // Submit function using state data 
  // Renamed from submitWorkout, removed map parameter
  const handleSaveWorkout = async () => { 
    // Get current state values at the time of clicking save
    const currentExercises = exercises;
    // No longer need currentDbMap here
    const currentWorkoutType = workoutType;

    if (!currentWorkoutType) {
       // ... validation ...
    }
    // ... other initial checks ...

    setIsSubmitting(true);
    setError(null);

    // ... determine finalWorkoutTypeForPayload based on currentWorkoutType ...
    let finalWorkoutTypeForPayload: AllowedWorkoutType;
    const isSubmitStrengthType = currentWorkoutType === "gym" || currentWorkoutType === "home_strength" || currentWorkoutType === "strength";
    if (isSubmitStrengthType) {
        finalWorkoutTypeForPayload = "strength";
    } else if (currentWorkoutType && ["running", "swimming", "cycling", "hiit", "flexibility", "walking", "yoga", "pilates", "other"].includes(currentWorkoutType)) {
        finalWorkoutTypeForPayload = currentWorkoutType as AllowedWorkoutType;
    } else {
        console.error("Invalid or undefined workoutType selected for submission:", currentWorkoutType);
        setError("Invalid activity type selected.");
        setIsSubmitting(false);
        return;
    }

    // Map the CURRENT exercises state using findCanonicalExercise
    const mappedExercises = currentExercises
        .map((exState, index): NonNullable<WorkoutUpdatePayload['exercises']>[number] | null => {
            const sourceName = exState.name;
            
            // Always use findCanonicalExercise based on the name in the state
            console.log(`[handleSaveWorkout] Finding canonical for: ${sourceName}`);
            const canonicalExercise = findCanonicalExercise(sourceName, dbExercises, exerciseAliases);
            console.log(`[handleSaveWorkout] Result: ${canonicalExercise ? canonicalExercise.name : 'Not Found'}`);

            if (!canonicalExercise || !sourceName) { // Keep sourceName check just in case
                console.warn(`[handleSaveWorkout] Skipping exercise (no canonical/name): ${sourceName}`);
                return null;
            }
            
            const isCardioExercise = canonicalExercise.category === 'cardio';

            if (isCardioExercise) {
               // ... cardio mapping logic using exState.duration/distance ...
                 const durationMinutes = Number.parseFloat(exState.duration || '0');
                 const distanceKm = Number.parseFloat(exState.distance || '0');
                 if (durationMinutes > 0 || distanceKm > 0) {
                     return {
                         exerciseId: canonicalExercise._id,
                         name: canonicalExercise.name,
                         order: index,
                         duration: durationMinutes * 60,
                         distance: distanceKm * 1000,
                         sets: [],
                         notes: exState.notes || undefined,
                     } as NonNullable<WorkoutUpdatePayload['exercises']>[number];
                 } else {
                      return {
                          exerciseId: canonicalExercise._id,
                          name: canonicalExercise.name,
                          order: index,
                          sets: [],
                          notes: exState.notes || undefined,
                      } as NonNullable<WorkoutUpdatePayload['exercises']>[number];
                 }
            } else {
                // Strength specific payload using exState.sets
                const exerciseSetsPayload: InputSetData[] = exState.sets
                    .map((setState, setIndex): InputSetData | null => {
                        const reps = Number.parseInt(setState.reps || '0');
                        if (reps > 0) {
                            const setDuration = setState.duration ? Number.parseInt(setState.duration) : undefined;
                            const setDistance = setState.distance ? Number.parseFloat(setState.distance) : undefined;
                            return {
                                weight: Number.parseFloat(setState.weight || '0') || 0,
                                reps: reps,
                                duration: setDuration,
                                distance: setDistance,
                                notes: setState.notes || undefined,
                                order: setIndex
                            };
                        }
                        return null;
                    })
                    .filter(isDefined);

                if (exerciseSetsPayload.length > 0) {
                    return {
                        exerciseId: canonicalExercise._id,
                        name: canonicalExercise.name,
                        order: index,
                        sets: exerciseSetsPayload,
                        notes: exState.notes || undefined,
                    } as NonNullable<WorkoutUpdatePayload['exercises']>[number];
                }
                return null;
            }
        })
        .filter(isDefined);

    const exercisesPayload = mappedExercises;

    // --- Validation (on mapped payload) ---
    if (finalWorkoutTypeForPayload === 'strength' && exercisesPayload.length === 0) {
       setError("Workout requires at least one exercise with valid sets (reps > 0).");
       setIsSubmitting(false);
       return;
    }
    // ... non-strength validation using component state distance/duration ...
    if (finalWorkoutTypeForPayload !== 'strength' && (!distance || !duration || Number(distance) <= 0 || Number(duration) <= 0)) {
      setError("Please enter a valid overall distance and duration for this activity type.");
      setIsSubmitting(false);
      return;
    }
    // --- End Validation --- 

    // Define cardioDetailsPayload *before* notes generation
    let cardioDetailsPayload: WorkoutUpdatePayload['cardioDetails'] = undefined;
    const parsedCardioDistance = distance ? Number.parseFloat(distance) : undefined; // Distance from form state is KM
    const parsedCardioDuration = duration ? Number.parseFloat(duration) * 60 : undefined; // Duration from form state is minutes, payload needs seconds
    if (finalWorkoutTypeForPayload !== 'strength') { // Assign only if not strength
        cardioDetailsPayload = { 
            distance: parsedCardioDistance ?? 0, // Send KM to backend
            duration: parsedCardioDuration ?? 0 
        };
    }

    // --- Regenerate Notes based on final payload data ---
    let finalNotes = ""; // Default empty notes
    const verb = "I did"; // Assume past tense for saved workout notes
    const linkingVerb = "which was"; // Assume past tense

    // Get user weight (ideally passed down or fetched, using placeholder for now)
    // This needs to be implemented properly if available
    // const currentUserWeight = session?.user?.weight || null; // Removed use of session.user.weight

    if (finalWorkoutTypeForPayload === 'strength') {
        let totalVolume = 0;
        let totalReps = 0;
        exercisesPayload.forEach(ex => {
            if (ex.sets && ex.name) { // Check ex.name exists
                ex.sets.forEach(set => {
                    const reps = set.reps ?? 0;
                    const weight = set.weight ?? 0;
                    if (reps > 0) {
                        // Use bodyweight estimation if weight is 0, passing only the name
                        const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(ex.name!);
                        totalVolume += estimatedWeight * reps;
                        totalReps += reps;
                    }
                });
            }
        });
        if (totalReps > 0) { 
           const intensityText = totalVolume > 10000 ? "heavy" : totalVolume > 3000 ? "moderate" : "light";
           finalNotes = `${verb} a total volume of ${Math.round(totalVolume)} kg over ${totalReps} reps. This was a ${intensityText} workout.`;
        }
    } else if (["running", "swimming", "cycling", "walking"].includes(finalWorkoutTypeForPayload)) {
        const distKm = cardioDetailsPayload?.distance ?? 0; // Distance is already in KM
        const durMin = (cardioDetailsPayload?.duration ?? 0) / 60; // Duration is in seconds, convert to minutes
         if (distKm > 0 && durMin > 0) {
            const paceMinPerKm = durMin / distKm;
            const paceText = paceMinPerKm < 5 ? "quite fast" : paceMinPerKm < 7 ? "a good pace" : "a comfortable pace";
            finalNotes = `${verb} a pace of ${Math.round(paceMinPerKm * 10) / 10} minutes per km, ${linkingVerb} ${paceText}.`;
        }
    }
    // --- End Regenerate Notes ---

    // ... construct final workoutPayload using finalWorkoutName, date, component state distance/duration, etc. ...
    const finalWorkoutName = workoutName.trim() || getDefaultWorkoutName(currentWorkoutType, date);
    let finalDuration = 0;
    if (finalWorkoutTypeForPayload === 'strength') {
        const manualDurationMinutes = duration ? Number.parseFloat(duration) : 0;
        // Estimate duration returns seconds, so we only convert manual input
        finalDuration = manualDurationMinutes > 0 ? manualDurationMinutes * 60 : estimateWorkoutDuration(currentExercises);
    } else {
        // Convert form duration (minutes) back to seconds for payload
        finalDuration = duration ? Number.parseFloat(duration) * 60 : 0;
    }
    const workoutPayload: Omit<WorkoutUpdatePayload, 'userId'> = {
      date: date,
      name: finalWorkoutName,
      type: finalWorkoutTypeForPayload,
      notes: finalNotes, // Use the newly generated notes
      duration: finalDuration,
      exercises: exercisesPayload,
      cardioDetails: cardioDetailsPayload,
    };

    console.log("[handleSaveWorkout] Submitting payload:", JSON.stringify(workoutPayload, null, 2));

    // ... try/catch block for submission (create/update action calls) ...
    try {
      let savedWorkout;
      if (isEditing && editingWorkoutId) {
        savedWorkout = await updateWorkoutAction(editingWorkoutId, workoutPayload);
        toast.success('Workout updated successfully!');
      } else {
        // Explicitly construct payload for createWorkoutAction to ensure cardioDetails is passed
        type CreateActionPayload = Parameters<typeof createWorkoutAction>[0]; 
        const createPayload: CreateActionPayload = {
            userId: session!.user!.id, 
            date: workoutPayload.date,
            name: workoutPayload.name,
            type: workoutPayload.type,
            notes: workoutPayload.notes,
            duration: workoutPayload.duration, 
            // Cast problematic fields to 'any' to bypass strict type checking here
            exercises: workoutPayload.exercises as any, 
            cardioDetails: workoutPayload.cardioDetails as any, 
            source: workoutPayload.source || 'manual', 
            intensity: workoutPayload.intensity, 
        };

        console.log("[handleSaveWorkout] Sending createPayload to createWorkoutAction:", JSON.stringify(createPayload, null, 2));

        savedWorkout = await createWorkoutAction(createPayload);
        toast.success('Workout created successfully!');
      }
      if (savedWorkout && savedWorkout._id) {
        router.push(`/workouts/${savedWorkout._id}`);
      } else {
        throw new Error("Save operation did not return a valid workout ID.");
      }
    } catch (err) {
      console.error('[handleSaveWorkout] Failed:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Failed to save workout'}`);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to save workout'}`);
    } finally {
      setIsSubmitting(false);
    }
  }
  // --- END Submit function ---

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
    <div className="container mx-auto px-4 py-8 max-w-4xl"> 
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

      <div className="space-y-6">
        {/* Workout Metadata Section - Apply subtle styling */}
        <div className="space-y-4 p-4"> {/* Increased vertical spacing slightly */}
            
           {/* Replace Select with ToggleGroup */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start"> {/* Increased gap */}
              <div>
                 <Label className="text-xs font-medium text-muted-foreground/80 mb-2 block">Activity Type</Label>
                 {/* Toggle Group for main types */}
                 <ToggleGroup 
                    type="single"
                    variant="outline"
                    value={workoutType}
                    onValueChange={(value) => {
                       if (value) setWorkoutType(value as WorkoutTypeOption);
                    }}
                    className="flex flex-wrap justify-start gap-2" // Allow wrapping
                 >
                    {mainWorkoutTypes.map((type) => (
                      <ToggleGroupItem 
                        key={type.value} 
                        value={type.value} 
                        aria-label={type.label}
                        className="h-12 w-12 flex flex-col items-center justify-center gap-1 p-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                      >
                        <type.icon className="h-5 w-5" />
                        <span className="text-[10px]">{type.label}</span>
                      </ToggleGroupItem>
                    ))}
                    {/* TODO: Add an "Other" button here if needed */}
                 </ToggleGroup>
              </div>

              {/* Date Picker */}
               <div>
                 {/* Make label smaller and lighter */}
                 <Label htmlFor="workout-date" className="text-xs font-medium text-muted-foreground/80">Date</Label>
                 <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <Button
                        id="workout-date"
                        className={cn(
                          "w-full justify-start text-left font-normal", 
                          "bg-transparent hover:bg-transparent", 
                          "p-0", // Remove padding to rely on parent spacing
                          !date && "text-muted-foreground",
                           date && "text-foreground" // Ensure text color is visible
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? (isToday(date) ? 'Today' : format(date, "PPP")) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900">
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
             {/* Remove border from input, use placeholder as label concept */}
             <Input
                id="workout-name"
                placeholder={workoutName || getDefaultWorkoutName(workoutType, date)}
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="placeholder:text-muted-foreground/80 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base font-medium"
             />
           </div>
        </div>

        {/* --> Conditionally render AI Quick Log Section <-- */}
        {!isEditing && (
            // Outer container: Only relative positioning
            <div className="relative">
              
              {/* Glow Effect Layer */}
              <motion.div
                className='pointer-events-none absolute inset-0' // Fills the outer container
                animate={{ opacity: 1 }}
              >
                <GlowEffect
                  colors={['#0894FF', '#C959DD', '#FF2E54', '#FF9004']} 
                  mode='colorShift'
                  blur='strong' // Adjust blur if needed
                  scale={1}       // Revert scale to 1
                  duration={4}
                />
              </motion.div>

              {/* Inner Content Block - gets card styling and masks glow center */}
              <div className="relative z-10 space-y-4 rounded-xl shadow-sm p-6 bg-card"> 
                <h2 className="text-lg font-medium mb-4">Quick Log with AI</h2>
                <div>
                  <Textarea 
                    id="ai-quick-log"
                    placeholder="Paste your workout log... e.g., Squats: 1x5 60 kg, 3x5 50 kg..."
                    className="mt-1 min-h-[80px] placeholder:text-muted-foreground/80"
                    value={aiLogInput} 
                    onChange={(e) => setAiLogInput(e.target.value)} 
                    disabled={isProcessingAi}
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={() => handleAiProcess(aiLogInput)} 
                  disabled={isProcessingAi || !aiLogInput.trim()}
                  variant="outline"
                >
                  {isProcessingAi ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process with AI"
                  )}
                </Button>
              </div>
            </div>
        )}
        {/* --> End Conditional Render <-- */}

        {/* Conditional Fields for Non-Strength Workouts */}
        {!isStrengthWorkout && workoutType && (
          <div className="space-y-4 rounded-xl shadow-sm p-6 bg-card">
             <h2 className="text-lg font-medium mb-4">{workoutTypeDisplayNames[workoutType]} Details</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input 
                    id="duration"
                    type="number" 
                    placeholder="Duration (minutes)"
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                    min="0" 
                  />
                </div>
                {(workoutType === 'running' || workoutType === 'cycling' || workoutType === 'walking' || workoutType === 'swimming') && (
                  <div>
                    <Input 
                      id="distance"
                      type="number" 
                      placeholder="Distance (km/miles)"
                      value={distance} 
                      onChange={(e) => setDistance(e.target.value)}
                      min="0"
                      step="0.1" 
                    />
                  </div>
                )}
             </div>
          </div>
        )}

        {/* Exercises Section (Modified - Conditionally Rendered) */}
        {isStrengthWorkout && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Exercises</h2>
            {exercises.map((exercise, index) => {
              // Determine if the current exercise is cardio
              const canonicalExercise = exercise.name ? dbExercisesMap.get(exercise.name) : null;
              const isCardioExercise = canonicalExercise?.category === 'cardio';

              return (
                <div key={exercise.id} className="border rounded-lg shadow-sm p-6 space-y-5 relative bg-card">
                  {/* Exercise Header: Increased spacing mb-4 */}
                  <div className="flex justify-between items-start mb-4"> 
                    <div className="flex-1 space-y-2 mr-4"> {/* Increased mr-4 */}
                      {/* Changed Label style */}
                      <Label htmlFor={`exercise-name-${exercise.id}`} className="text-xs font-medium text-muted-foreground">
                        EXERCISE #{index + 1}
                      </Label>
                      {/* RE-ADD Combobox for Exercise Selection */}
                      <Popover open={showSearchList} onOpenChange={setShowSearchList} modal={false}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={showSearchList}
                            // Slightly larger, consistent height
                            className="w-full h-10 justify-between font-normal text-base" 
                            onClick={() => setShowSearchList(true)} // Open on click
                          >
                            <>
                              {exercise.name || "Select exercise..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </>
                          </Button>
                        </PopoverTrigger>
                        {/* Ensure PopoverContent has relative positioning for z-index context */}
                        <PopoverContent 
                            className="w-[--radix-popover-trigger-width] p-0 bg-popover border shadow-md rounded-md relative z-40"
                         > 
                          <Command shouldFilter={false}> 
                            <CommandInput 
                              placeholder="Search exercise..." 
                              value={exerciseSearchQuery}
                              onValueChange={setExerciseSearchQuery}
                              className="h-9" // Slightly smaller input
                            />
                            {/* Add scrollable container styles */}
                            <CommandList className="max-h-[300px] overflow-y-auto"> 
                              <CommandEmpty>
                                {isSearching ? "Searching..." : "No exercise found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {searchResults.map((dbExercise) => (
                                  <CommandItem
                                    key={dbExercise._id}
                                    value={dbExercise.name} // Use name for Command value
                                    onSelect={() => {
                                      // This should handle keyboard Enter and mouse clicks
                                      console.log('[onSelect Fired - Search Result]:', dbExercise.name); 
                                      handleExerciseSelection(exercise.id, dbExercise);
                                      // setShowSearchList(false); // onOpenChange should handle this
                                    }}
                                    onClick={() => {
                                      // Explicitly handle click for testing
                                      console.log('[onClick Fired - Search Result]:', dbExercise.name);
                                      handleExerciseSelection(exercise.id, dbExercise);
                                      // setShowSearchList(false); // onOpenChange should handle this
                                    }}
                                    className="cursor-pointer" 
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", exercise.name === dbExercise.name ? "opacity-100" : "opacity-0")} />
                                    {dbExercise.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              
                              {debouncedSearchQuery.length < 2 && searchResults.length === 0 && ( // Show only if no search results yet
                                  <CommandGroup heading="Suggestions"> {/* Changed heading */}
                                      {/* Using filteredExercises which depends on workout type */}
                                      {filteredExercises.slice(0, 5).map((dbEx) => ( 
                                          <CommandItem
                                              key={dbEx._id}
                                              value={dbEx.name}
                                              onSelect={() => {
                                                  // This should handle keyboard Enter and mouse clicks
                                                  console.log('[onSelect Fired - Suggestion]:', dbEx.name); 
                                                  handleExerciseSelection(exercise.id, dbEx);
                                                  // setShowSearchList(false); // onOpenChange should handle this
                                              }}
                                              onClick={() => {
                                                // Explicitly handle click for testing
                                                console.log('[onClick Fired - Suggestion]:', dbEx.name);
                                                handleExerciseSelection(exercise.id, dbEx);
                                                // setShowSearchList(false); // onOpenChange should handle this
                                              }}
                                              className="cursor-pointer"
                                          >
                                             <Check className={cn("mr-2 h-4 w-4", exercise.name === dbEx.name ? "opacity-100" : "opacity-0")} />
                                              {dbEx.name}
                                          </CommandItem>
                                      ))}
                                  </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {/* Remove Exercise Button: Use ghost variant, slightly larger */}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeExercise(exercise.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" // Show on hover/focus within row
                    >
                      <LucideX className="h-4 w-4" />
                      <span className="sr-only">Remove Exercise</span>
                    </Button>
                  </div>

                  {/* Sets Section: Only show if not cardio and exercise name is selected */}
                  {exercise.name && !isCardioExercise && (
                    <div className="space-y-3 pt-2"> {/* Added padding-top */}
                      {/* Sets Header Row - Added labels */}
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 items-center px-2 pb-1 border-b">
                        <Label className="text-xs font-medium text-muted-foreground justify-self-center">WEIGHT (KG)</Label>
                        <Label className="text-xs font-medium text-muted-foreground justify-self-center">REPS</Label>
                        <div className="w-8"></div> {/* Spacer for alignment */}
                      </div>

                      {/* Sets List */}
                      <div className="space-y-2">
                        {exercise.sets.map((set, setIndex) => (
                          // Use grid for better alignment, gap-x-3
                          <div key={set.id} className="grid grid-cols-[1fr_1fr_auto] gap-x-3 items-center group"> 
                            <Input
                              type="number"
                              placeholder="0"
                              value={set.weight}
                              onChange={(e) => updateSetField(exercise.id, set.id, 'weight', e.target.value)}
                              className="h-9 text-center tabular-nums" // Smaller height, centered text
                              min="0"
                            />
                            <Input
                              type="number"
                              placeholder="0"
                              value={set.reps}
                              onChange={(e) => updateSetField(exercise.id, set.id, 'reps', e.target.value)}
                              className="h-9 text-center tabular-nums" // Smaller height, centered text
                              min="0"
                            />
                            {/* Remove Set Button: Ghost, icon only, appears on hover/focus */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeSet(exercise.id, set.id)} 
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" // Show on hover/focus within row
                            >
                              <LucideX className="h-4 w-4" />
                              <span className="sr-only">Remove Set {setIndex + 1}</span>
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Add Set Button: Outline variant, centered */}
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => addSet(exercise.id)} className="w-full md:w-auto">
                          <LucidePlus className="h-4 w-4 mr-2" />
                          Add Set
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Cardio Input Section: Show if cardio and name selected */}
                   {exercise.name && isCardioExercise && (
                     <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-x-3 items-center">
                             <div>
                                 <Label htmlFor={`ex-duration-${exercise.id}`} className="text-xs font-medium text-muted-foreground mb-1 block">DURATION (MIN)</Label>
                                 <Input
                                    id={`ex-duration-${exercise.id}`}
                                    type="number"
                                    placeholder="e.g., 30"
                                    value={exercise.duration ?? ""}
                                    onChange={(e) => updateExerciseField(exercise.id, 'duration', e.target.value)}
                                    className="h-9"
                                    min="0"
                                 />
                             </div>
                             <div>
                                <Label htmlFor={`ex-distance-${exercise.id}`} className="text-xs font-medium text-muted-foreground mb-1 block">DISTANCE (KM)</Label>
                                <Input
                                    id={`ex-distance-${exercise.id}`}
                                    type="number"
                                    placeholder="e.g., 5"
                                    value={exercise.distance ?? ""}
                                    onChange={(e) => updateExerciseField(exercise.id, 'distance', e.target.value)}
                                    className="h-9"
                                    min="0"
                                    step="0.1"
                                />
                            </div>
                        </div>
                     </div>
                   )}


                  {/* Exercise Notes: Added label, slightly more space */}
                  <div className="pt-2"> 
                    <Label htmlFor={`exercise-notes-${exercise.id}`} className="text-xs font-medium text-muted-foreground">Notes (Optional)</Label>
                    <Textarea
                      id={`exercise-notes-${exercise.id}`}
                      placeholder="e.g., Focused on form, felt strong..."
                      value={exercise.notes || ""}
                      onChange={(e) => updateExerciseField(exercise.id, 'notes', e.target.value)}
                      className="mt-1 min-h-[60px] text-sm" // Reduced min-height, smaller text
                    />
                  </div>
                </div>
              );
            })}

            {/* Add Exercise Button: Secondary variant, full width */}
            <Button variant="secondary" onClick={addExercise} className="w-full">
              <LucidePlus className="h-4 w-4 mr-2" />
              Add Another Exercise
            </Button>
          </div>
        )}

        {/* Workout Summary */}
        {workoutSummary && (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground"> {/* Changed styling */}
            <p>{getSummaryText()}</p>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-6 flex justify-end"> {/* Added padding top */}
          <Button 
             type="button" 
             onClick={handleSaveWorkout} 
             disabled={isSubmitting}
             size="lg" // Larger save button
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (isEditing ? "Update Workout" : "Save Workout")}
          </Button>
        </div>
      </div>
    </div>
  )
}

