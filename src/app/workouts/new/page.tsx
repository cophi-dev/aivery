"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format, isToday, isPast, isFuture, parseISO, differenceInDays } from "date-fns"
import { useSession } from "next-auth/react"
import { LucideArrowLeft, CalendarIcon, LucidePlus, LucideX, ChevronsUpDown, Check, Loader2, Dumbbell, Home, Footprints, Bike, PersonStanding, Waves, LucideMinus, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'motion/react'
import { SlidingNumber } from "@/components/ui/sliding-number"

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
  getRecentPerformedExercisesAction,
  getExercisePerformanceStatsAction, // <-- Import new action
  type WorkoutUpdatePayload,
  type InputSetData,
  type ExercisePerformanceStats // <-- Import new type
} from "@/lib/workout-actions"
import { fetchExercises, searchAllExercisesAction, fetchAllExercisesAction } from "@/lib/exercise-actions"
import type { ExerciseData, WorkoutData, WorkoutExerciseData, Set } from "@/types/db"
import { IWorkout } from "@/lib/db/models/workout"
import { estimateBodyweightForExercise } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { useDebounce } from "@/hooks/useDebounce"
import { GlowEffect } from "@/components/ui/glow-effect"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

// Type for individual exercise state in the form
type ExerciseState = {
  id: number | string; // Temporary ID for form state (e.g., `ex-temp-${Date.now()}`)
  exerciseId?: string; // ID of the canonical Exercise (if known/selected)
  name: string; // Name of the canonical Exercise
  notes?: string; // Notes specific to this exercise in this workout
  aiRecommendation?: string; // NEW: AI-generated recommendation
  // Fields for Strength/Set-based exercises
  sets: SetState[]; 
  // Fields for Cardio/Duration-based exercises added within a workout
  duration?: string; // Duration in minutes for this specific exercise instance
  distance?: string; // Distance in km/miles for this specific exercise instance
}

// --- START NEW Performance Data Types ---
// Local type definitions are removed as they are now imported from workout-actions
// Type for frontend state (using string dates after potential serialization)
// Note: This mirrors the structure but uses string for date to align with potential fetch results

// --- Type for AI Response Data (Mirroring API route's type) ---
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
  workoutDate?: string;
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

// Define canonical cardio exercise names
const cardioExerciseNames: Partial<Record<WorkoutTypeOption, string>> = {
  running: "Running",
  swimming: "Swimming",
  cycling: "Cycling",
  walking: "Walking",
};

// Update the NumberSlider component to have fixed width
function NumberSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  className,
  isDecimal = false
}: {
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  isDecimal?: boolean;
}) {
  // Convert to number and ensure it's within bounds
  const numValue = Math.max(min, Math.min(max, Number(value) || 0));
  
  // Format value for display - if decimal, multiply by 10 for sliding number
  const displayValue = isDecimal ? numValue * 10 : numValue;
  
  // Handle increment/decrement
  const increment = () => {
    const newVal = Math.min(max, numValue + step);
    onChange(String(newVal));
  };
  
  const decrement = () => {
    const newVal = Math.max(min, numValue - step);
    onChange(String(newVal));
  };
  
  return (
    <div className={`flex flex-col space-y-2 ${className}`}> {/* Removed responsive width */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={decrement}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <LucideMinus className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">Decrease</span>
        </button>
        
        <div className="flex items-center justify-center rounded-lg bg-muted/50 px-2 sm:px-4 py-1.5 sm:py-2 min-w-[80px] sm:min-w-[100px]">
          <div className="flex items-baseline">
            <div className="text-lg sm:text-2xl font-medium tabular-nums tracking-tighter w-16 sm:w-20 text-right h-6 sm:h-8 flex items-center justify-end">
              {isDecimal ? (
                <>
                  <SlidingNumber value={Math.floor(displayValue / 10)} />
                  <span>.</span>
                  <SlidingNumber value={displayValue % 10} />
                </>
              ) : (
                <SlidingNumber value={numValue} />
              )}
            </div>
            {unit && <span className="ml-1 text-xs sm:text-sm text-muted-foreground min-w-8 sm:min-w-10">{unit}</span>}
          </div>
        </div>
        
        <button
          type="button"
          onClick={increment}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <LucidePlus className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">Increase</span>
        </button>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

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

  // --- NEW State for Performance Data ---
  const [exercisePerformanceData, setExercisePerformanceData] = useState<Record<string | number, ExercisePerformanceStats>>({});
  // --- END NEW State ---

  // --- NEW Search State ---
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExerciseData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchList, setShowSearchList] = useState(false); // To control combobox popover visibility
  const [isExerciseDialogOpen, setIsExerciseDialogOpen] = useState(false); // NEW state for dialog
  const [performedExercises, setPerformedExercises] = useState<ExerciseData[]>([]); // NEW state for performed exercises
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

      // NEW: Update Date from AI if available
      if (parsedData.workoutDate) {
        try {
          const parsedDate = parseISO(parsedData.workoutDate); // Expects YYYY-MM-DD
          // Basic validation: Check if the parsed date is valid
          if (!isNaN(parsedDate.getTime())) {
            setDate(parsedDate);
            console.log("Set date from AI:", parsedDate);
          } else {
            console.warn(`AI provided invalid date format: ${parsedData.workoutDate}`);
            toast.error(`AI provided an invalid date: ${parsedData.workoutDate}. Please set manually.`);
          }
        } catch (dateParseError) {
          console.error(`Failed to parse date from AI: ${parsedData.workoutDate}`, dateParseError);
          toast.error(`AI provided an unparseable date: ${parsedData.workoutDate}. Please set manually.`);
        }
      }

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

  // --- NEW Effect to fetch recently performed exercises --- 
  useEffect(() => {
    const loadPerformedExercises = async () => {
      try {
        // TODO: Ensure getRecentPerformedExercisesAction exists and handles fetching/uniqueness
        const recentExercises = await getRecentPerformedExercisesAction();
        setPerformedExercises(recentExercises);
        console.log(`Fetched ${recentExercises.length} recently performed unique exercises.`);
      } catch (err) {
        console.error("Failed to fetch performed exercises:", err);
        // Don't block UI, just log error for now
      }
    };
    // Fetch only if user is logged in
    if (session?.user?.id) { 
      loadPerformedExercises();
    }
  }, [session]); // Re-run if session changes

  // --- NEW Effect for searching ALL exercises ---
  useEffect(() => {
    const searchExercises = async () => {
      if (debouncedSearchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowSearchList(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await searchAllExercisesAction(debouncedSearchQuery);
        setSearchResults(results);
        setShowSearchList(true); // Show results when found
      } catch (err) {
        console.error("Failed to search exercises:", err);
        toast.error("Exercise search failed.");
        setSearchResults([]);
        setShowSearchList(false);
      } finally {
        setIsSearching(false);
      }
    };
    searchExercises();
  }, [debouncedSearchQuery]);

  // Effect to manage exercises based on workoutType
  useEffect(() => {
    // Find the canonical exercise name for the selected cardio type
    const targetCardioName = workoutType ? cardioExerciseNames[workoutType] : undefined;

    if (targetCardioName) {
      // We are in a cardio type mode
      const canonicalCardioExercise = dbExercisesMap.get(targetCardioName);

      if (canonicalCardioExercise) {
        // Check if the current exercises state already contains *only* this cardio exercise
        const isAlreadySet =
          exercises.length === 1 &&
          exercises[0].exerciseId === canonicalCardioExercise._id;

        if (!isAlreadySet) {
          console.log(`Setting exercises state for cardio type: ${workoutType}`);
          const cardioExerciseState: ExerciseState = {
            id: `ex-temp-${targetCardioName}-${Date.now()}`,
            exerciseId: canonicalCardioExercise._id,
            name: canonicalCardioExercise.name,
            sets: [], // Cardio exercises don't have sets in this model
          };
          setExercises([cardioExerciseState]);
        }
      } else if (dbExercisesMap.size > 0) { // Only warn if exercises have loaded
        console.warn(`Canonical exercise "${targetCardioName}" not found for workout type "${workoutType}". Cannot auto-set exercise.`);
        // Optionally clear exercises if the canonical one isn't found?
        // setExercises([]); 
      }
    } else {
      // We are in a non-cardio type mode (or no type selected)
      // Check if the *first* exercise is one of the canonical cardio ones and remove it
      if (exercises.length > 0) {
        const firstExerciseName = exercises[0].name;
        const isFirstExerciseCardio = Object.values(cardioExerciseNames).includes(firstExerciseName);
        if (isFirstExerciseCardio) {
            console.log(`Clearing cardio exercise "${firstExerciseName}" as workout type changed.`);
            // Decide if we should clear all or just the cardio one
            // For simplicity, let's clear all when switching FROM cardio
             setExercises([]); 
            // Alternative: Remove only the specific cardio exercise:
            // setExercises(prev => prev.filter(ex => ex.name !== firstExerciseName));
        }
      }
    }
    // Dependencies: workoutType and dbExercisesMap (to ensure canonical exercise data is available)
  }, [workoutType, dbExercisesMap]); // Removed exercises from dependencies to avoid loops

  // --- Load existing workout data if ID is provided ---
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
  const updateExerciseField = (
    exerciseId: number | string, 
    field: 'name' | 'notes' | 'duration' | 'distance' | 'aiRecommendation',
    value: string
  ) => {
    setError(null);
    setExercises(prevExercises => prevExercises.map((exercise): ExerciseState => {
      if (exercise.id === exerciseId) {
        // Create deep copy of the exercise to avoid reference issues
        let updatedState = {
          ...exercise,
          sets: [...(exercise.sets || [])], // Explicitly preserve sets array
          [field]: value
        };

        // Logic for name changes
        if (field === 'name') {
          const matchedDbExercise = dbExercisesMap.get(value);
          updatedState.exerciseId = matchedDbExercise?._id;
          
          if (matchedDbExercise?.category === 'cardio') {
            updatedState.sets = [];
            updatedState.duration = "";
            updatedState.distance = "";
          } else if (updatedState.sets.length === 0 && !matchedDbExercise?.category) {
            updatedState.sets = [{ id: `set-temp-${Date.now()}-${Math.random()}`, weight: "", reps: "" }];
            updatedState.duration = undefined;
            updatedState.distance = undefined;
          }
          
          if (updatedState.exerciseId) {
            fetchAndSetPerformanceData(exercise.id, updatedState.exerciseId);
          } else {
            setExercisePerformanceData(prev => {
              const { [exercise.id]: _, ...rest } = prev;
              return rest;
            });
            updatedState.aiRecommendation = '';
          }
        }

        // Handle cardio-specific fields
        if ((field === 'duration' || field === 'distance') && updatedState.exerciseId) {
          const matchedDbExercise = dbExercises.find(dbEx => dbEx._id === updatedState.exerciseId);
          if (matchedDbExercise?.category !== 'cardio') {
            // For non-cardio exercises, don't update these fields
            console.warn(`Attempted to set ${field} on non-cardio exercise: ${updatedState.name}`);
            return exercise; // Return original exercise state unchanged
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
    // Check if the name is actually changing to avoid redundant fetches
    const currentExercise = exercises.find(ex => ex.id === exerciseStateId);
    const isNameChanging = currentExercise?.name !== selectedDbExercise.name;

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
    
    // Close DIALOG asynchronously 
    setTimeout(() => {
      setIsExerciseDialogOpen(false); // Use the correct state setter for the dialog
    }, 0); // 0ms delay pushes execution to next event loop tick

    // --- NEW: Fetch performance data if name changed ---
    if (isNameChanging && selectedDbExercise._id) { 
      fetchAndSetPerformanceData(exerciseStateId, selectedDbExercise._id);
    }
    // --- END NEW ---
  };
  // --- END Modified: Handle Exercise Selection ---

  // --- NEW: Fetch Performance Data --- 
  const fetchAndSetPerformanceData = async (exerciseStateId: number | string, dbExerciseId: string) => {
    if (!session?.user?.id || !dbExerciseId) { // Added check for dbExerciseId
        // Clear data if no exercise ID is provided (e.g., user cleared the input)
        setExercisePerformanceData(prev => {
            const { [exerciseStateId]: _, ...rest } = prev;
            return rest;
        });
        updateExerciseField(exerciseStateId, 'aiRecommendation', ''); 
        return; // Exit early
    }
    
    console.log(`Fetching performance data for exercise ID: ${dbExerciseId} (state ID: ${exerciseStateId})`);
    try {
      // Corrected action call: Pass only exerciseId
      const stats = await getExercisePerformanceStatsAction(dbExerciseId); 
      
      // Find the canonical exercise to check if it's bodyweight
      const currentExercise = dbExercises.find(ex => ex._id === dbExerciseId);
      const isBodyweight = currentExercise ? isBodyweightExercise(currentExercise) : false;

      // Corrected result handling: Check if stats is not null
      if (stats) {
        // No need to access stats.data, stats itself is the data
        setExercisePerformanceData(prev => ({ ...prev, [exerciseStateId]: stats }));

        // Generate recommendation based on whether it's a bodyweight exercise or not
        const recommendation = generateExerciseRecommendation(stats, isBodyweight);
        
        if (recommendation) {
            updateExerciseField(exerciseStateId, 'aiRecommendation', recommendation);
        } else {
             // Explicitly clear recommendation if logic doesn't produce one
            updateExerciseField(exerciseStateId, 'aiRecommendation', ''); 
        }
        
      } else {
        // Handle case where action returned null (no stats found or error occurred)
        console.warn(`No performance stats returned for exercise ${dbExerciseId}.`);
        setExercisePerformanceData(prev => {
          const { [exerciseStateId]: _, ...rest } = prev;
          return rest;
        });
        updateExerciseField(exerciseStateId, 'aiRecommendation', ''); 
      }
    } catch (error) {
      console.error("Error calling getExercisePerformanceStatsAction:", error);
      toast.error("Failed to fetch performance stats.")
      setExercisePerformanceData(prev => {
          const { [exerciseStateId]: _, ...rest } = prev;
          return rest;
      });
      updateExerciseField(exerciseStateId, 'aiRecommendation', ''); 
    }
  }
  // --- END NEW: Fetch Performance Data ---

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
            // Cast problematic fields to 'any' to bypass strict type checking here - REMOVED CASTS
            exercises: workoutPayload.exercises, // Removed 'as any' 
            cardioDetails: workoutPayload.cardioDetails, // Removed 'as any' 
            source: workoutPayload.source || 'manual', 
            intensity: workoutPayload.intensity, 
        };

        console.log("[handleSaveWorkout] Sending createPayload to createWorkoutAction:", JSON.stringify(createPayload, null, 2));

        // ---> THE ACTUAL CALL <--- 
        savedWorkout = await createWorkoutAction(createPayload); // Original Call Restored
        // savedWorkout = await createWorkoutAction(simplifiedPayload); // Use simplified payload for testing
        // ---> END CALL <---
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

  // Add these style constants near other style definitions
  const exerciseCardStyle = "relative overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-200 hover:shadow-md border border-border/40"
  const exerciseHeaderStyle = "flex items-center gap-4 p-6 bg-gradient-to-b from-muted/30 to-transparent"
  const exerciseBodyStyle = "px-6 pb-6 space-y-6"
  const exerciseStatsStyle = "flex items-center gap-2 text-sm text-muted-foreground"
  const exerciseStatBadgeStyle = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20"
  const setRowStyle = "group relative grid gap-4 sm:gap-6 rounded-xl p-3 sm:p-5 bg-card shadow-sm border border-border/30 mb-4 grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_1fr_auto] justify-items-center" // Modified base grid
  const inputGroupStyle = "flex flex-col items-center space-y-2 w-full max-w-[250px] mx-auto" // Changed items-start to items-center
  const inputLabelStyle = "text-xs font-semibold text-center text-muted-foreground/80 tracking-wide uppercase" // Added font-semibold and text-center
  const numberControlStyle = "flex items-center justify-center gap-2 w-full max-w-[160px]"

  // Add these style constants at the top with other styles
  const pageHeaderStyle = "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  const pageContentStyle = "container max-w-2xl mx-auto px-4 py-6 space-y-8"
  const sectionStyle = "space-y-4"
  const sectionHeaderStyle = "flex items-center justify-between"
  const sectionTitleStyle = "text-lg font-semibold tracking-tight"
  const activityTypeStyle = "grid grid-cols-6 gap-2"
  const activityButtonStyle = "flex flex-col items-center justify-center gap-1 rounded-2xl p-3 hover:bg-accent transition-colors"
  const activityIconStyle = "h-6 w-6"
  const activityLabelStyle = "text-xs font-medium"
  const quickLogStyle = "relative overflow-hidden rounded-2xl bg-card shadow-lg border border-border/40"
  const exercisesContainerStyle = "space-y-4"

  // Update the style constants
  const aiSuggestionStyle = "flex items-start p-4 space-x-3 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-200/20 dark:border-blue-300/20"

  // Add a function to check if an exercise is a bodyweight exercise
  const isBodyweightExercise = (exercise: any): boolean => {
    if (!exercise) return false;
    
    // Check if exercise name includes common bodyweight exercise names
    const name = exercise.name?.toLowerCase() || '';
    if (
      name.includes('bodyweight') || 
      name.includes('body weight') || 
      name.includes('push-up') || 
      name.includes('pushup') ||
      name.includes('pull-up') || 
      name.includes('pullup') ||
      name.includes('chin-up') ||
      name.includes('chinup') ||
      name.includes('dip') ||
      name.includes('plank') ||
      name.includes('crunch') ||
      name.includes('sit-up') ||
      name.includes('situp') ||
      name.includes('lunge') ||
      name.includes('burpee') ||
      name.includes('jumping jack') ||
      name.includes('mountain climber') ||
      name.includes('squat')
    ) {
      return true;
    }

    // Check if exercise has bodyweight in equipment
    const equipment = exercise.equipment || [];
    if (Array.isArray(equipment)) {
      return equipment.some(e => 
        typeof e === 'string' && 
        (e.toLowerCase().includes('bodyweight') || 
         e.toLowerCase().includes('body weight') ||
         e.toLowerCase() === 'body only')
      );
    }
    
    return false;
  };

  // Function to generate recommendations that handles both bodyweight and weighted exercises
  const generateExerciseRecommendation = (
    stats: ExercisePerformanceStats,
    isBodyweight: boolean
  ): string => {
    let recommendation = "";
    const lastPerf = stats.lastWorkout;
    const pr = stats.personalRecord;

    if (lastPerf && pr) {
      const lastDate = parseISO(lastPerf.date as unknown as string);
      const daysSinceLast = differenceInDays(new Date(), lastDate);
      const lastReps = typeof lastPerf.reps === 'number' ? lastPerf.reps : 0;
      const prReps = typeof pr.reps === 'number' ? pr.reps : 0;

      if (isBodyweight) {
        // Bodyweight exercise recommendations (focus only on reps)
        if (daysSinceLast <= 14) {
          if (lastReps >= prReps) {
            const suggestedReps = Math.ceil(lastReps * 1.1); // Suggest 10% more reps
            recommendation = `Great job last time with ${lastReps} reps! Try pushing for ${suggestedReps} reps this time.`;
          } else if (lastReps >= prReps * 0.9) {
            recommendation = `Last time you did ${lastReps} reps. You're close to your PR of ${prReps}! Push for it today.`;
          } else {
            recommendation = `${lastReps} reps last time (${format(lastDate, 'dd MMM')}). Your PR is ${prReps} reps. Keep building up!`;
          }
        } else if (daysSinceLast <= 30) {
          recommendation = `It's been ${daysSinceLast} days. Last time you did ${lastReps} reps. See if you can match or beat that.`;
        } else {
          const suggestedReps = Math.floor(lastReps * 0.8); // Start at 80% of last performance after long break
          recommendation = `It's been over a month (${format(lastDate, 'dd MMM')}). Start with ${suggestedReps}-${lastReps} reps today.`;
        }
      } else {
        // Weighted exercise recommendations
        const lastWeight = typeof lastPerf.weight === 'number' ? lastPerf.weight : 0;
        const prWeight = typeof pr.weight === 'number' ? pr.weight : 0;
        
        if (daysSinceLast <= 14) {
          if (lastWeight >= prWeight && lastReps >= prReps) {
            const suggestedWeight = lastWeight + 2.5;
            recommendation = `PR last time! Let's try ${suggestedWeight}kg x ${lastReps} reps.`;
          } else if (lastWeight >= prWeight * 0.9) {
            const suggestedWeight = lastWeight > 0 ? lastWeight : prWeight;
            recommendation = `Close to PR last time (${lastWeight}kg). Aim for ${suggestedWeight}kg x ${lastReps} reps or try beating the PR ${prWeight}kg!`;
          } else {
            recommendation = `Last: ${lastWeight}kg x ${lastReps} reps (${format(lastDate, 'dd MMM')}). Let's build back up towards your PR of ${prWeight}kg!`;
          }
        } else if (daysSinceLast <= 30) {
          recommendation = `It's been ${daysSinceLast} days. Start around ${lastWeight}kg x ${lastReps} reps & see how it feels.`;
        } else {
          recommendation = `Over a month since you did this (${format(lastDate, 'dd MMM')})! Maybe start light, around ${Math.max(0, lastWeight * 0.8).toFixed(1)}kg, and focus on form.`;
        }
      }
    } else if (pr) {
      const prReps = typeof pr.reps === 'number' ? pr.reps : 0;
      if (isBodyweight) {
        recommendation = `Your PR is ${prReps} reps. See if you can match that today!`;
      } else {
        const prWeight = typeof pr.weight === 'number' ? pr.weight : 0;
        recommendation = `No recent data, but your PR is ${prWeight}kg x ${prReps} reps. Go for it!`;
      }
    } else if (lastPerf) {
      const lastDate = parseISO(lastPerf.date as unknown as string);
      const daysSinceLast = differenceInDays(new Date(), lastDate);
      const lastReps = typeof lastPerf.reps === 'number' ? lastPerf.reps : 0;
      
      if (isBodyweight) {
        if (daysSinceLast <= 14) {
          const suggestedReps = Math.ceil(lastReps * 1.1); // Suggest 10% more reps
          recommendation = `Last time you completed ${lastReps} reps. Try for ${suggestedReps} reps today!`;
        } else {
          recommendation = `It's been ${daysSinceLast} days since you did ${lastReps} reps. Start with that goal today.`;
        }
      } else {
        const lastWeight = typeof lastPerf.weight === 'number' ? lastPerf.weight : 0;
        if (daysSinceLast <= 14) {
          const suggestedWeight = lastWeight + 2.5;
          recommendation = `Solid work last time (${lastWeight}kg x ${lastReps} reps). Maybe try ${suggestedWeight}kg?`;
        } else {
          recommendation = `It's been ${daysSinceLast} days since ${lastWeight}kg x ${lastReps} reps. Ease back in!`;
        }
      }
    }
    
    return recommendation;
  }

  return (
    <>
      {/* Page Header */}
      <div className={pageHeaderStyle}>
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <LucideArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {isEditing ? "Edit Workout" : duplicateWorkoutId ? "Duplicate Workout" : "Log New Workout"}
            </h1>
            <Button
              type="button"
              onClick={handleSaveWorkout}
              disabled={isSubmitting}
              size="sm"
              className="rounded-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (isEditing ? "Update" : "Save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={pageContentStyle}>
        {/* Error Display */}
        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Activity Type & Date Section */}
        <div className={sectionStyle}>
          <div className={sectionHeaderStyle}>
            <h2 className={sectionTitleStyle}>Activity Type</h2>
            <Popover modal={false}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (isToday(date) ? 'Today' : format(date, "MMM d, yyyy")) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
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

          <div className={activityTypeStyle}>
            {mainWorkoutTypes.map((type) => {
              const isSelected = workoutType === type.value;
              return (
                <Button
                  key={type.value}
                  variant="ghost"
                  className={cn(
                    activityButtonStyle,
                    isSelected && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setWorkoutType(type.value)}
                >
                  <type.icon className={activityIconStyle} />
                  <span className={activityLabelStyle}>{type.label}</span>
                </Button>
              );
            })}
          </div>

          <Input
            placeholder={getDefaultWorkoutName(workoutType, date)}
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            className="text-xl font-semibold bg-transparent border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* NEW: Overall Distance/Duration for Cardio Types */}
        {workoutType && cardioExerciseNames[workoutType] && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 gap-8 pt-4"
          >
            <div className={inputGroupStyle}>
              <Label className={inputLabelStyle}>OVERALL DURATION</Label>
              <NumberSlider
                value={duration || '0'}
                onChange={(value) => setDuration(value)}
                min={0}
                max={180}
                step={5}
                unit="min"
                className="mb-1"
              />
            </div>
            <div className={inputGroupStyle}>
              <Label className={inputLabelStyle}>OVERALL DISTANCE</Label>
              <NumberSlider
                value={distance || '0'}
                onChange={(value) => setDistance(value)}
                min={0}
                max={50}
                step={0.5}
                unit="km"
                className="mb-1"
                isDecimal={true}
              />
            </div>
          </motion.div>
        )}

        {/* Quick Log Section - Preserved with glow effect */}
        {!isEditing && (
          <div className="relative">
            <motion.div className="pointer-events-none absolute inset-0">
              <GlowEffect
                colors={['#0894FF', '#C959DD', '#FF2E54', '#FF9004']}
                mode="colorShift"
                blur="strong"
                scale={1}
                duration={4}
              />
            </motion.div>
            <div className={quickLogStyle}>
              <div className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Quick Log with AI</h2>
                <Textarea
                  placeholder="Paste your workout log... e.g., Squats: 1x5 60 kg, 3x5 50 kg..."
                  className="min-h-[80px] bg-background/50 resize-none"
                  value={aiLogInput}
                  onChange={(e) => setAiLogInput(e.target.value)}
                  disabled={isProcessingAi}
                />
                <Button
                  type="button"
                  onClick={() => handleAiProcess(aiLogInput)}
                  disabled={isProcessingAi || !aiLogInput.trim()}
                  variant="outline"
                  className="w-full"
                >
                  {isProcessingAi ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      Process with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Exercises Section - Conditionally Render based on Workout Type */}
        {!cardioExerciseNames[workoutType as WorkoutTypeOption] && (
          <motion.div
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.1 }} // Slight delay after type selection
            className={sectionStyle}
          >
            <h2 className={sectionTitleStyle}>Exercises</h2>
            <div className={exercisesContainerStyle}>
              {/* Existing exercises mapping with updated styling */} 
              {exercises.map((exercise, index) => {
                const canonicalExercise = exercise.name ? dbExercisesMap.get(exercise.name) : null;
                const isCardioExercise = canonicalExercise?.category === 'cardio';
                const isLastExercise = index === exercises.length - 1;
                const performanceStats = exercisePerformanceData[exercise.id];

                return (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={exerciseCardStyle}
                  >
                    <div className={exerciseHeaderStyle}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-muted-foreground">EXERCISE #{index + 1}</span>
                          {isBodyweightExercise(canonicalExercise) && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-green-500/20">
                              Bodyweight
                            </Badge>
                          )}
                          {performanceStats && (
                            <div className={exerciseStatsStyle}>
                              {/* Last workout performance */}
                              {performanceStats.lastWorkout && (
                                <Badge variant="secondary" className={exerciseStatBadgeStyle}>
                                  Last: {isBodyweightExercise(canonicalExercise) 
                                    ? `${performanceStats.lastWorkout.reps} reps` 
                                    : `${performanceStats.lastWorkout.weight}kg × ${performanceStats.lastWorkout.reps}`}
                                </Badge>
                              )}
                              
                              {/* Show last workout total reps for bodyweight exercises */}
                              {isBodyweightExercise(canonicalExercise) && 
                               performanceStats.dailyTotalReps?.lastWorkout && (
                                <Badge variant="secondary" className={exerciseStatBadgeStyle}>
                                  Day Total: {performanceStats.dailyTotalReps.lastWorkout.totalReps} reps
                                </Badge>
                              )}
                              
                              {/* Personal record - per set */}
                              {performanceStats.personalRecord && (
                                <Badge variant="secondary" className={exerciseStatBadgeStyle}>
                                  {isBodyweightExercise(canonicalExercise)
                                    ? `Set PR: ${performanceStats.personalRecord.reps} reps`
                                    : `PR: ${performanceStats.personalRecord.weight}kg × ${performanceStats.personalRecord.reps}`}
                                </Badge>
                              )}
                              
                              {/* Show personal record for daily total reps for bodyweight exercises */}
                              {isBodyweightExercise(canonicalExercise) && 
                               performanceStats.dailyTotalReps?.personalRecord && (
                                <Badge variant="secondary" className={cn(exerciseStatBadgeStyle, "bg-green-500/10 text-green-600 dark:text-green-400")}>
                                  Day PR: {performanceStats.dailyTotalReps.personalRecord.totalReps} total
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <Dialog open={isExerciseDialogOpen} onOpenChange={setIsExerciseDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-between px-0 font-normal text-xl hover:bg-transparent hover:text-foreground/90 hover:opacity-90 transition-colors"
                            >
                              <span className="font-semibold">{exercise.name || "Select exercise..."}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                              <DialogTitle>Select Exercise</DialogTitle>
                              <DialogDescription>
                                Choose an exercise from the list or search.
                              </DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="performed" className="w-full">
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="performed">Performed</TabsTrigger>
                                <TabsTrigger value="chest">Chest</TabsTrigger>
                                <TabsTrigger value="back">Back</TabsTrigger>
                                <TabsTrigger value="legs">Legs</TabsTrigger>
                              </TabsList>
                              <TabsContent value="performed">
                                <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
                                  {performedExercises.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-2">No recently performed exercises found.</p>
                                  ) : (
                                    performedExercises.map((dbEx) => (
                                      <button
                                        key={dbEx._id}
                                        onClick={() => handleExerciseSelection(exercise.id, dbEx)}
                                        className="block w-full text-left p-2 rounded-md hover:bg-accent"
                                      >
                                        {dbEx.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </TabsContent>
                              <TabsContent value="chest">
                                <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
                                  {dbExercises
                                    .filter(ex =>
                                      Array.isArray(ex.muscleGroups) &&
                                      ex.muscleGroups.some((m: string) => m.toLowerCase() === 'chest')
                                    )
                                    .map((dbEx) => (
                                      <button
                                        key={dbEx._id}
                                        onClick={() => handleExerciseSelection(exercise.id, dbEx)}
                                        className="block w-full text-left p-2 rounded-md hover:bg-accent"
                                      >
                                        {dbEx.name}
                                      </button>
                                    ))}
                                </div>
                              </TabsContent>
                              <TabsContent value="back">
                                <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
                                  {dbExercises
                                    .filter(ex =>
                                      Array.isArray(ex.muscleGroups) &&
                                      ex.muscleGroups.some((m: string) => m.toLowerCase() === 'back')
                                    )
                                    .map((dbEx) => (
                                      <button
                                        key={dbEx._id}
                                        onClick={() => handleExerciseSelection(exercise.id, dbEx)}
                                        className="block w-full text-left p-2 rounded-md hover:bg-accent"
                                      >
                                        {dbEx.name}
                                      </button>
                                    ))}
                                </div>
                              </TabsContent>
                              <TabsContent value="legs">
                                <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
                                  {dbExercises
                                    .filter(ex =>
                                      Array.isArray(ex.muscleGroups) &&
                                      ex.muscleGroups.some((m: string) => [
                                        'legs',
                                        'quadriceps',
                                        'hamstrings',
                                        'glutes',
                                        'calves'
                                      ].includes(m.toLowerCase()))
                                    )
                                    .map((dbEx) => (
                                      <button
                                        key={dbEx._id}
                                        onClick={() => handleExerciseSelection(exercise.id, dbEx)}
                                        className="block w-full text-left p-2 rounded-md hover:bg-accent"
                                      >
                                        {dbEx.name}
                                      </button>
                                    ))}
                                </div>
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExercise(exercise.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      >
                        <LucideX className="h-4 w-4" />
                        <span className="sr-only">Remove Exercise</span>
                      </Button>
                    </div>

                    <div className={exerciseBodyStyle}>
                      {/* AI Recommendation */}
                      <AnimatePresence>
                        {exercise.aiRecommendation && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={aiSuggestionStyle}
                          >
                            <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              <span className="font-semibold">AI Suggestion:</span> {exercise.aiRecommendation}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Sets or Cardio Input */}
                      {exercise.name && !isCardioExercise && (
                        <div className="space-y-4">
                          <AnimatePresence>
                            {exercise.sets.map((set, setIndex) => (
                              <motion.div
                                key={set.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className={cn(
                                  setRowStyle,
                                  isBodyweightExercise(canonicalExercise) && "sm:grid-cols-[2rem_1fr_auto] justify-items-center" // Added sm: prefix
                                )}
                              >
                                {/* Set Number */}
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                                    <span className="text-xs font-semibold">
                                      {setIndex + 1}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* NEW Wrapper for Weight/Reps */} 
                                <div className="flex flex-col gap-4 w-full col-span-1"> {/* This div takes the second grid column */}
                                  {/* Weight Input - Hide for bodyweight exercises */}
                                  {!isBodyweightExercise(canonicalExercise) && (
                                    <div className={inputGroupStyle}>
                                      <Label className={inputLabelStyle}>WEIGHT</Label>
                                      <NumberSlider
                                        value={set.weight || '0'}
                                        onChange={(value) => updateSetField(exercise.id, set.id, 'weight', value)}
                                        min={0}
                                        max={200}
                                        step={0.5}
                                        unit="kg"
                                        className="mb-1"
                                        isDecimal={true}
                                      />
                                    </div>
                                  )}

                                  {/* Reps Input */}
                                  <div className={cn(
                                    inputGroupStyle,
                                    isBodyweightExercise(canonicalExercise) && "w-full max-w-[250px] mx-auto" // Center if bodyweight
                                  )}>
                                    <Label className={inputLabelStyle}>REPS</Label>
                                    <NumberSlider
                                      value={set.reps || '0'}
                                      onChange={(value) => updateSetField(exercise.id, set.id, 'reps', value)}
                                      min={0}
                                      max={100}
                                      step={1}
                                      unit="reps"
                                      className="mb-1"
                                    />
                                  </div>
                                </div>

                                {/* Remove Set Button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeSet(exercise.id, set.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-6 w-6"
                                >
                                  <LucideX className="h-3 w-3" />
                                  <span className="sr-only">Remove Set {setIndex + 1}</span>
                                </Button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          
                          {/* Add Set Button */}
                          <div className="flex justify-center pt-4">
                            <Button
                              variant="outline"
                              onClick={() => addSet(exercise.id)}
                              className="rounded-full"
                            >
                              <LucidePlus className="h-4 w-4 mr-2" />
                              Add Set
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Cardio Exercise Inputs */}
                      {exercise.name && isCardioExercise && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className={inputGroupStyle}>
                            <Label className={inputLabelStyle}>DURATION</Label>
                            <NumberSlider
                              value={exercise.duration || '0'}
                              onChange={(value) => updateExerciseField(exercise.id, 'duration', value)}
                              min={0}
                              max={180}
                              step={5}
                              unit="min"
                              className="mb-1"
                            />
                          </div>
                          <div className={inputGroupStyle}>
                            <Label className={inputLabelStyle}>DISTANCE</Label>
                            <NumberSlider
                              value={exercise.distance || '0'}
                              onChange={(value) => updateExerciseField(exercise.id, 'distance', value)}
                              min={0}
                              max={50}
                              step={0.5}
                              unit="km"
                              className="mb-1"
                              isDecimal={true}
                            />
                          </div>
                        </div>
                      )}

                      {/* Exercise Notes */}
                      <div className="pt-4">
                        <Label className="text-xs font-medium text-muted-foreground">Notes (Optional)</Label>
                        <Textarea
                          value={exercise.notes || ""}
                          onChange={(e) => updateExerciseField(exercise.id, 'notes', e.target.value)}
                          placeholder="e.g., Focused on form, felt strong..."
                          className="mt-2 min-h-[60px] resize-none bg-muted/50"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })} 

              {/* Add Exercise Button - Conditionally Disable */}
              {/* Only show Add Exercise button if NOT a designated cardio type */}
              {!cardioExerciseNames[workoutType as WorkoutTypeOption] && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button
                    variant="outline"
                    onClick={addExercise}
                    className="w-full rounded-xl h-14"
                    // disabled={!!cardioExerciseNames[workoutType as WorkoutTypeOption]} // Alternative: disable instead of hide
                  >
                    <LucidePlus className="h-5 w-5 mr-2" />
                    Add Exercise
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Workout Summary - if exists */}
        {workoutSummary && (
          <div className="rounded-xl border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">{getSummaryText()}</p>
          </div>
        )}
      </main>
    </>
  )
}

