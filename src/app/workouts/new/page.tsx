"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format, isToday, isPast, isFuture, parseISO } from "date-fns"
import { useSession } from "next-auth/react"
import { LucideArrowLeft, CalendarIcon, LucidePlus, LucideX, ChevronsUpDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from 'react-hot-toast'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  exercises: Array<{
    name: string;
    notes?: string;
    sets: Array<{
      weight?: string;
      reps?: string;
      notes?: string;
    }>;
  }>;
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
  console.log(`[findCanonicalExercise] Attempting to match: "${parsedName}" (Normalized: "${normalizedParsedName}")`);

  // 1. Try direct normalized match
  console.log(`[findCanonicalExercise] Checking direct match against ${dbExercises.length} DB exercises...`);
  let foundExercise = dbExercises.find(ex => {
      const normalizedDbName = normalizeName(ex.name);
      console.log(`[findCanonicalExercise] Comparing "${normalizedParsedName}" with DB "${ex.name}" (Normalized: "${normalizedDbName}")`);
      return normalizedDbName === normalizedParsedName;
  });

  if (foundExercise) {
    console.log(`[findCanonicalExercise] Found direct match:`, foundExercise);
    return foundExercise;
  }
  console.log(`[findCanonicalExercise] No direct match found.`);

  // 2. Try alias match (normalize the alias key and the target)
  console.log(`[findCanonicalExercise] Checking alias match...`);
  // First, check if normalized input matches a normalized alias *key*
  const normalizedAliasKey = Object.keys(aliases).find(key => {
      const normalizedKey = normalizeName(key);
      return normalizedKey === normalizedParsedName;
  });
  const aliasTargetName = normalizedAliasKey ? aliases[normalizedAliasKey] : undefined;

  if (aliasTargetName) {
    console.log(`[findCanonicalExercise] Found matching alias key: "${normalizedAliasKey}", Target: "${aliasTargetName}"`);
    const normalizedAliasTarget = normalizeName(aliasTargetName);
    console.log(`[findCanonicalExercise] Normalized alias target: "${normalizedAliasTarget}"`);
    // Find DB exercise matching the normalized alias *target*
    console.log(`[findCanonicalExercise] Checking DB match against normalized alias target...`);
    foundExercise = dbExercises.find(ex => {
        const normalizedDbName = normalizeName(ex.name);
        console.log(`[findCanonicalExercise] Comparing normalized target "${normalizedAliasTarget}" with DB "${ex.name}" (Normalized: "${normalizedDbName}")`);
        return normalizeName(ex.name) === normalizedAliasTarget;
    });
    if (foundExercise) {
      console.log(`[findCanonicalExercise] Found alias match:`, foundExercise);
      return foundExercise;
    }
     console.log(`[findCanonicalExercise] No DB match found for normalized alias target.`);
  } else {
     console.log(`[findCanonicalExercise] No matching alias key found.`);
  }

  // 3. Optional: Add fuzzy matching here later if needed

  console.warn(`[findCanonicalExercise] Could not find canonical match for: "${parsedName}" (Normalized: "${normalizedParsedName}")`);
  return undefined; // Not found
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
      console.log("Received parsed data from AI API:", parsedData);

      // --- Update State based on Parsed Data (for UI feedback) ---
      // Still update state so the user sees the form populate
      setExercises([]); // Clear existing before populating

      if (parsedData.workoutType && workoutTypeDisplayNames.hasOwnProperty(parsedData.workoutType)) {
        setWorkoutType(parsedData.workoutType as WorkoutTypeOption);
      } else {
        if (parsedData.exercises && parsedData.exercises.length > 0) {
          if (!workoutType) { setWorkoutType("gym"); }
        }
      }

      if (parsedData.workoutName) { setWorkoutName(parsedData.workoutName); }

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

    // ... construct final workoutPayload using finalWorkoutName, date, component state distance/duration, etc. ...
    const finalWorkoutName = workoutName.trim() || getDefaultWorkoutName(currentWorkoutType, date);
    let cardioDetailsPayload: WorkoutUpdatePayload['cardioDetails'] = undefined;
    const parsedCardioDistance = distance ? Number.parseFloat(distance) * 1000 : undefined;
    const parsedCardioDuration = duration ? Number.parseFloat(duration) * 60 : undefined;
    if (finalWorkoutTypeForPayload === 'strength') {
        cardioDetailsPayload = undefined;
    } else {
        cardioDetailsPayload = { 
            distance: parsedCardioDistance ?? 0, 
            duration: parsedCardioDuration ?? 0 
        };
    }
    let finalDuration = 0;
    if (finalWorkoutTypeForPayload === 'strength') {
        const manualDurationSeconds = duration ? Number.parseFloat(duration) * 60 : 0;
        finalDuration = manualDurationSeconds > 0 ? manualDurationSeconds : estimateWorkoutDuration(currentExercises); // Use currentExercises for estimate
    } else {
        finalDuration = parsedCardioDuration || 0;
    }
    const workoutPayload: Omit<WorkoutUpdatePayload, 'userId'> = {
      date: date,
      name: finalWorkoutName,
      type: finalWorkoutTypeForPayload,
      notes: getSummaryText() || "",
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
        const createPayload = { 
            ...workoutPayload, 
            userId: session!.user!.id, 
            cardioDetails: undefined, 
            exercises: workoutPayload.exercises as Array<{ name: string; notes?: string; sets?: InputSetData[]; duration?: number; distance?: number }>
        };
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

      <div className="space-y-8">
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
                 >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select activity type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(workoutTypeDisplayNames)
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

        {/* NEW: AI Quick Log Section */}
        <div className="space-y-4 rounded-md border p-4 md:p-6">
          <h2 className="text-lg font-medium mb-4">Quick Log with AI</h2>
          <div>
            <Label htmlFor="ai-quick-log">Paste your workout log</Label>
            <Textarea 
              id="ai-quick-log"
              placeholder="e.g., Squats: 1x5 60 kg, 3x5 50 kg, Bench Press: 4x5 60 kg..."
              className="mt-1 min-h-[80px]"
              value={aiLogInput} 
              onChange={(e) => setAiLogInput(e.target.value)} 
              disabled={isProcessingAi}
            />
            <p className="text-sm text-muted-foreground mt-1">Enter your workout details in simple format.</p>
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
        {/* END NEW: AI Quick Log Section */}

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

        {/* Exercises Section (Modified) */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Exercises</h2>
          {exercises.map((exercise, index) => {
            // Determine if the current exercise is cardio
            const canonicalExercise = exercise.exerciseId ? dbExercisesMap.get(exercise.exerciseId) : null;
            const isCardioExercise = canonicalExercise?.category === 'cardio';

            return (
              <div key={exercise.id} className="rounded-md border p-4 md:p-6 space-y-4 relative bg-background">
                {/* Exercise Header (Selection + Remove Button) */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2 mr-2">
                    <Label htmlFor={`exercise-name-${exercise.id}`}>Exercise #{index + 1}</Label>
                    {/* RE-ADD Combobox for Exercise Selection */}
                    <Popover open={showSearchList} onOpenChange={setShowSearchList}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={showSearchList}
                          className="w-full justify-between font-normal"
                          onClick={() => setShowSearchList(true)} // Open on click
                        >
                          {exercise.name || "Select exercise..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white dark:bg-slate-900">
                        <Command shouldFilter={false}> {/* Filtering done via search state */}
                          <CommandInput 
                            placeholder="Search exercise..." 
                            value={exerciseSearchQuery}
                            onValueChange={setExerciseSearchQuery}
                          />
                          <CommandList> {/* Removed bg-popover */}
                            <CommandEmpty>
                              {isSearching ? "Searching..." : "No exercise found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {searchResults.map((dbExercise) => (
                                <CommandItem
                                  key={dbExercise._id}
                                  value={dbExercise.name} // Use name for Command value
                                  onSelect={() => {
                                    handleExerciseSelection(exercise.id, dbExercise);
                                    setShowSearchList(false); // Close on select
                                  }}
                                >
                                  {dbExercise.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {/* Optionally show initially loaded/filtered exercises when not searching? */}
                            {/* Or add a separator */} 
                            {debouncedSearchQuery.length < 2 && (
                                <CommandGroup heading="Recently Used / Suggested">
                                    {filteredExercises.slice(0, 10).map((dbEx) => (
                                        <CommandItem
                                            key={dbEx._id}
                                            value={dbEx.name}
                                            onSelect={() => {
                                                handleExerciseSelection(exercise.id, dbEx);
                                                setShowSearchList(false);
                                            }}
                                        >
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

                {/* --- Conditional Rendering based on Exercise Type --- */}
                {isCardioExercise ? (
                  // --- Render Duration/Distance Inputs for Cardio --- 
                  <div className="space-y-3 pl-2 border-l-2 border-muted">
                    <Label className="text-sm font-medium">Details</Label>
                    <div className="flex items-end space-x-2">
                      <div className="flex-1 grid grid-cols-2 gap-2 items-end">
                        <div>
                          <Label htmlFor={`ex-duration-${exercise.id}`} className="text-xs">Duration (min)</Label>
                          <Input
                            id={`ex-duration-${exercise.id}`}
                            type="number"
                            placeholder="Duration"
                            value={exercise.duration || ""}
                            onChange={(e) => updateExerciseField(exercise.id, 'duration', e.target.value)}
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ex-distance-${exercise.id}`} className="text-xs">Distance (km)</Label> 
                          <Input
                            id={`ex-distance-${exercise.id}`}
                            type="number"
                            placeholder="Distance"
                            value={exercise.distance || ""}
                            onChange={(e) => updateExerciseField(exercise.id, 'distance', e.target.value)}
                            min="0"
                            step="0.1"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Add Exercise Notes for Cardio */} 
                    <div>
                      <Label htmlFor={`exercise-notes-${exercise.id}`}>Notes (Optional)</Label>
                      <Textarea
                        id={`exercise-notes-${exercise.id}`}
                        placeholder="e.g., Felt good, easy pace"
                        value={exercise.notes || ""}
                        onChange={(e) => updateExerciseField(exercise.id, 'notes', e.target.value)}
                        className="placeholder:text-muted-foreground/50"
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  // --- Render Sets Section for Non-Cardio ---
                  <div className="space-y-3 pl-2 border-l-2 border-muted">
                     <Label className="text-sm font-medium">Sets</Label>
                     {exercise.sets.map((set, setIndex) => (
                      <div key={set.id} className="flex items-end space-x-2">
                         <span className="text-sm text-muted-foreground w-6 text-right pr-1">{setIndex + 1}.</span>
                         <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                           {/* Weight Input */}
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
                           {/* Reps Input */}
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
                            {/* Set Notes Input */}
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

                       {/* Exercise Notes for Non-Cardio (Now correctly placed sibling to the map result) */}
                       <div className="pt-2">
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
                  )}
                  {/* --- End Conditional Rendering --- */}
              </div>
            )
          })}
          {/* Add Exercise Button (Remains the same) */}
          <Button type="button" variant="secondary" onClick={addExercise} className="w-full md:w-auto">
             <LucidePlus className="h-4 w-4 mr-2" /> Add Exercise
          </Button>
        </div>

        {/* Save Button - onClick calls handleSaveWorkout */}
        <div className="flex justify-end pt-4">
          <Button 
            type="button" // Should be button
            onClick={handleSaveWorkout} // Calls save handler directly
            disabled={isSubmitting || !workoutType || isLoadingData || isProcessingAi}
          >
            {isSubmitting ? ( 
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? ( 
              "Update Workout"
            ) : ( 
              "Save Workout"
            )}
          </Button>
        </div>
      </div> {/* End of the div replacing the form */} 
    </div>
  )
}

