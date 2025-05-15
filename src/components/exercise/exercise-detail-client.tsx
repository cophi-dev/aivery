"use client" 

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select"
import { LucideArrowLeft, LucideSave, LucideTrash, LucideEdit, LucideTrendingUp, LucidePlus, PlusCircle, LucideLoader } from "lucide-react"
import { fetchExercise, updateExerciseAction, deleteExerciseAction, getExerciseHistory } from "@/lib/exercise-actions"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { 
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { ExerciseData, WorkoutExerciseData } from "@/types/db"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import Image from "next/image"
import { subMonths, subWeeks } from "date-fns"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import MetricContent from "@/components/ui/metric-card"
import { estimateBodyweightForExercise } from "@/lib/utils"
import { ExercisePRTile } from "./ExercisePRTile"
import { Dumbbell, Trophy, Hash, CalendarCheck, ListChecks, Repeat2 } from "lucide-react"

// Define helper functions (can be outside or inside component scope in client components)
const formatDuration = (seconds: number | undefined | null): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return "N/A";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatPace = (pace: number | undefined | null): string => {
  if (pace === undefined || pace === null || isNaN(pace) || pace <= 0) {
    return "N/A";
  }
  // Assuming pace is seconds per kilometer
  const minutes = Math.floor(pace / 60);
  const remainingSeconds = Math.round(pace % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} /km`;
};

const formatDistance = (meters: number | undefined | null): string => {
  if (meters === undefined || meters === null || isNaN(meters) || meters < 0) {
    return "N/A";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

// Add a helper to format volume as tons or kg
const formatVolume = (kg: number | undefined | null): string => {
  if (kg === undefined || kg === null || isNaN(kg)) return "--";
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${kg.toLocaleString()} kg`;
};

// Define the props type for the client component
interface ExerciseDetailPageClientProps {
  initialExercise: ExerciseData | null;
  initialHistory: WorkoutExerciseData[];
  error?: string;
  params: { id: string };
  // REMOVE helper functions from props 
  // formatDuration: (seconds: number | undefined | null) => string;
  // formatPace: (pace: number | undefined | null) => string;
}

export default function ExerciseDetailPageClient({ 
  initialExercise, 
  initialHistory, 
  error: initialError, 
  params, 
  // REMOVE helper functions from destructuring
  // formatDuration,
  // formatPace
}: ExerciseDetailPageClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(initialError || "")
  const [exercise, setExercise] = useState<any>(null)
  const [prs, setPRs] = useState<any[]>([])
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [recentInsights, setRecentInsights] = useState<any[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [history, setHistory] = useState<WorkoutExerciseData[]>(initialHistory)
  const [chartData, setChartData] = useState<any[]>([])
  const [personalBest, setPersonalBest] = useState<{ weight: number, reps: number } | null>(null)
  const [totalReps, setTotalReps] = useState<number>(0)
  const [totalVolume, setTotalVolume] = useState<number>(0)
  const [maxWeightPR, setMaxWeightPR] = useState<{ weight: number, reps: number } | null>(null)
  const [maxRepsPR, setMaxRepsPR] = useState<{ weight: number, reps: number } | null>(null)
  const [cardioStats, setCardioStats] = useState<{
    bestDistance: number | null;
    bestDuration: number | null;
    fastestPace: number | null;
    avgDistance: number | null;
    avgDuration: number | null;
    avgPace: number | null;
    totalDistance: number;
    totalDuration: number;
    lastWorkout: { 
      distance?: number | null; 
      duration?: number | null; 
      pace?: number | null; 
      calories?: number | null;
    } | null;
  } | null>(null);
  const [name, setName] = useState(initialExercise?.name || "")
  const [description, setDescription] = useState(initialExercise?.description || "")
  const [category, setCategory] = useState<"strength" | "cardio" | "flexibility">(initialExercise?.category as "strength" | "cardio" | "flexibility" || "strength")
  const [equipment, setEquipment] = useState<string[]>(initialExercise?.equipment || [])
  const [instructions, setInstructions] = useState<string[]>(initialExercise?.instructions || [])
  const [muscleGroup, setMuscleGroup] = useState("")
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initialExercise?.muscleGroups || [])
  const [selectedDateRange, setSelectedDateRange] = useState<"allTime" | "3months" | "4weeks">("allTime");

  // Improved bodyweight detection
  const bodyweightNames = [
    'pull-up', 'pull up', 'push-up', 'push up', 'chin-up', 'chin up', 'dips', 'sit-up', 'sit up', 'crunch', 'plank', 'burpee', 'lunge', 'squat', 'jumping jack', 'mountain climber', 'bodyweight row', 'inverted row', 'leg raise', 'pushup', 'pullup', 'pushups', 'pullups', 'dips', 'situps', 'crunches', 'planks', 'lunges', 'squats', 'burpees', 'mountain climbers', 'bodyweight rows', 'inverted rows', 'leg raises'
  ];
  const isBodyweight = (
    exercise?.tags?.includes('trackMaxReps') ||
    (exercise?.name && bodyweightNames.includes(exercise.name.toLowerCase()))
  );

  // Fetch insights data on mount
  useEffect(() => {
    async function fetchInsights() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/exercises/${params.id}/insights`)
        if (!res.ok) throw new Error(`Failed to fetch insights: ${res.status}`)
        const data = await res.json()
        setExercise(data.exercise)
        setPRs(data.prs)
        setWorkoutExercises(data.workoutExercises)
        setStats(data.stats)
        setRecentInsights(data.recentInsights)
        setError("")
      } catch (err: any) {
        setError(err.message || "Failed to load exercise insights")
      } finally {
        setIsLoading(false)
      }
    }
    fetchInsights()
  }, [params.id])

  // Process history data (runs on initial load and when history state changes)
  const processHistoryData = useMemo(() => (historyData: WorkoutExerciseData[]) => {
    if (!historyData.length) {
      setChartData([])
      setPersonalBest(null)
      setCardioStats(null)
      setTotalReps(0)
      setTotalVolume(0)
      setMaxWeightPR(null)
      setMaxRepsPR(null)
      return
    }
    // Sort history by date (newest first)
    historyData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    let currentBestWeight = 0, currentBestReps = 0, currentBestTotal = 0
    let currentMaxWeightPR = { weight: 0, reps: 0 };
    let currentMaxRepsPR = { weight: 0, reps: 0 };
    let runningTotalReps = 0;
    let runningTotalVolume = 0;
    const isTrackMaxReps = exercise?.tags?.includes('trackMaxReps');

    let bestDistance = 0, bestDuration = 0, fastestPace = Infinity
    let totalDistance = 0, totalDuration = 0, validPaceCount = 0, totalPace = 0
    const workoutCount = historyData.length

    const chartPoints = historyData.map(workout => {
      let maxWeightInWorkout = 0, maxRepsInWorkout = 0, maxTotalInWorkout = 0
      workout.sets?.forEach(set => {
        const weight = Number(set.weight) || 0
        const reps = Number(set.reps) || 0
        let effectiveWeight = weight;
        
        // For bodyweight exercises, use estimated weight
        if (isTrackMaxReps && weight === 0) {
          effectiveWeight = estimateBodyweightForExercise(exercise?.name || '');
        }
        
        const total = effectiveWeight * reps;

        runningTotalReps += reps;
        runningTotalVolume += total;

        // PR Calculation
        if (effectiveWeight >= currentMaxWeightPR.weight) { // Check for max weight PR (can be equal weight but more reps)
           if (effectiveWeight > currentMaxWeightPR.weight || reps > currentMaxWeightPR.reps) {
              currentMaxWeightPR = { weight: effectiveWeight, reps };
           }
        }
        if (reps >= currentMaxRepsPR.reps) { // Check for max reps PR (can be equal reps but more weight for weighted exercises)
           if (reps > currentMaxRepsPR.reps || effectiveWeight > currentMaxRepsPR.weight) {
             currentMaxRepsPR = { weight: effectiveWeight, reps };
           }
        }

        // For chart data, track what we want to display
        if (isTrackMaxReps) {
          if (reps > maxRepsInWorkout) {
            maxRepsInWorkout = reps;
            maxWeightInWorkout = effectiveWeight;
            maxTotalInWorkout = total;
          }
        } else {
          if (total > maxTotalInWorkout) {
            maxWeightInWorkout = effectiveWeight;
            maxRepsInWorkout = reps;
            maxTotalInWorkout = total;
          }
        }

        // Legacy 'Personal Best' calculation - update based on what we're tracking
        if (isTrackMaxReps) {
          if (reps > currentBestReps || (reps === currentBestReps && effectiveWeight > currentBestWeight)) {
            currentBestWeight = effectiveWeight;
            currentBestReps = reps;
            currentBestTotal = total;
          }
        } else {
          if (total > currentBestTotal) {
            currentBestWeight = effectiveWeight;
            currentBestReps = reps;
            currentBestTotal = total;
          }
        }
      })

      const workoutDistance = workout.distance ? Number(workout.distance) : 0;
      const workoutDuration = workout.duration ? Number(workout.duration) : 0;
      const workoutPace = workout.pace ? Number(workout.pace) : null;

      if (workoutDistance > bestDistance) bestDistance = workoutDistance;
      if (workoutDuration > bestDuration) bestDuration = workoutDuration;
      if (workoutPace !== null && workoutPace > 0 && workoutPace < fastestPace) fastestPace = workoutPace;

      totalDistance += workoutDistance;
      totalDuration += workoutDuration;
      if (workoutPace !== null && workoutPace > 0) { totalPace += workoutPace; validPaceCount++; }

      return {
        date: new Date(workout.createdAt).toISOString().split('T')[0],
        weight: maxWeightInWorkout,
        reps: maxRepsInWorkout,
        total: isTrackMaxReps ? maxRepsInWorkout : maxTotalInWorkout, // Use reps as the primary metric for bodyweight exercises
        distance: workoutDistance,
        duration: workoutDuration,
        pace: workoutPace
      }
    })

    setChartData(chartPoints.slice().reverse()) // Reverse copy for chart
    if (currentBestTotal > 0) setPersonalBest({ weight: currentBestWeight, reps: currentBestReps }); else setPersonalBest(null); // Keep legacy PB state
    // Set new stats state
    setTotalReps(runningTotalReps);
    setTotalVolume(runningTotalVolume);
    setMaxWeightPR(currentMaxWeightPR.weight > 0 ? currentMaxWeightPR : null);
    setMaxRepsPR(currentMaxRepsPR.reps > 0 ? currentMaxRepsPR : null);

    setCardioStats({
      bestDistance: bestDistance > 0 ? bestDistance : null,
      bestDuration: bestDuration > 0 ? bestDuration : null,
      fastestPace: fastestPace !== Infinity ? fastestPace : null,
      avgDistance: workoutCount > 0 ? totalDistance / workoutCount : null,
      avgDuration: workoutCount > 0 ? totalDuration / workoutCount : null,
      avgPace: validPaceCount > 0 ? totalPace / validPaceCount : null,
      totalDistance: totalDistance,
      totalDuration: totalDuration,
      lastWorkout: historyData.length > 0 ? { distance: historyData[0].distance, duration: historyData[0].duration, pace: historyData[0].pace, calories: historyData[0].calories } : null
    });
  }, []); // Dependency array is empty, relies on history state passed to the function

  // Run initial processing and when history state changes
  useEffect(() => {
    processHistoryData(history);
  }, [history, processHistoryData]);

  // Update form fields if exercise prop changes (e.g., after update)
  useEffect(() => {
    if (exercise) {
      setName(exercise.name || "")
      setDescription(exercise.description || "")
      setCategory(exercise.category as "strength" | "cardio" | "flexibility" || "strength")
      setEquipment(exercise.equipment || [])
      setInstructions(exercise.instructions || [])
      setMuscleGroups(exercise.muscleGroups || [])
    }
  }, [exercise]);

  // Progression data calculation based on selected date range
  const progressionDisplayData = useMemo(() => {
    const now = new Date();
    let filteredHistory = history;
    const isTrackMaxReps = exercise?.tags?.includes('trackMaxReps');

    if (selectedDateRange === "3months") {
      const threeMonthsAgo = subMonths(now, 3);
      filteredHistory = history.filter(item => new Date(item.createdAt) >= threeMonthsAgo);
    } else if (selectedDateRange === "4weeks") {
      const fourWeeksAgo = subWeeks(now, 4);
      filteredHistory = history.filter(item => new Date(item.createdAt) >= fourWeeksAgo);
    }

    if (!filteredHistory.length) return {
      chartPoints: [],
      firstNCount: 0,
      lastNCount: 0,
      isTrackMaxReps: false,
      avgFirstWeight: null,
      avgLastWeight: null,
      weightChange: null,
      avgFirstReps: null,
      avgLastReps: null,
      repsChange: null,
      avgFirstVolume: null,
      avgLastVolume: null,
      volumeChange: null,
      avgFirstDist: null,
      avgLastDist: null,
      distChange: null,
      avgFirstDur: null,
      avgLastDur: null,
      durChange: null,
      avgFirstPace: null,
      avgLastPace: null,
      paceChange: null
    }; // Return default structure if no data

    filteredHistory.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const chartPoints = filteredHistory.map((workout: WorkoutExerciseData) => {
      let maxWeight = 0, maxReps = 0, maxTotal = 0;
      workout.sets?.forEach((set: { weight?: number, reps?: number }) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        let effectiveWeight = weight;
        
        // For bodyweight exercises, use estimated weight
        if (isTrackMaxReps && weight === 0) {
          effectiveWeight = estimateBodyweightForExercise(exercise?.name || '');
        }
        
        const total = effectiveWeight * reps;
        
        if (isTrackMaxReps) {
          if (reps > maxReps) {
            maxReps = reps;
            maxWeight = effectiveWeight;
            maxTotal = total;
          }
        } else {
          if (total > maxTotal) {
            maxWeight = effectiveWeight;
            maxReps = reps;
            maxTotal = total;
          }
        }
      });

      return {
        date: new Date(workout.createdAt).toISOString().split('T')[0],
        weight: maxWeight,
        reps: maxReps,
        total: maxTotal,
        distance: workout.distance,
        duration: workout.duration,
        pace: workout.pace
      };
    });

    // For progression comparison, we'll compare first N vs last N workouts
    const compareN = Math.min(3, Math.floor(chartPoints.length / 3)); // Compare up to 3 workouts, or 1/3 of total workouts
    const firstN = chartPoints.slice(0, compareN);
    const lastN = chartPoints.slice(-compareN);

    const calcAvg = (data: any[], key: string) => data.length > 0 ? data.reduce((sum, d) => sum + (d[key] || 0), 0) / data.length : null;
    const calcPaceAvg = (data: any[]) => {
      const validPaces = data.filter(d => d.pace && d.pace > 0);
      return validPaces.length > 0 ? validPaces.reduce((sum, d) => sum + (d.pace || 0), 0) / validPaces.length : null;
    };

    // Calculate averages for first and last N workouts
    const avgFirstWeight = calcAvg(firstN, 'weight');
    const avgFirstReps = calcAvg(firstN, 'reps');
    const avgFirstTotal = calcAvg(firstN, 'total');
    const avgLastWeight = calcAvg(lastN, 'weight');
    const avgLastReps = calcAvg(lastN, 'reps');
    const avgLastTotal = calcAvg(lastN, 'total');

    // Calculate cardio averages
    const avgFirstDist = calcAvg(firstN, 'distance');
    const avgLastDist = calcAvg(lastN, 'distance');
    const avgFirstDur = calcAvg(firstN, 'duration');
    const avgLastDur = calcAvg(lastN, 'duration');
    const avgFirstPace = calcPaceAvg(firstN);
    const avgLastPace = calcPaceAvg(lastN);

    // Calculate percentage changes
    const calcChange = (first: number | null, last: number | null) => {
      if (first === null || last === null || first === 0) return null;
      return ((last - first) / first) * 100;
    };

    return {
      chartPoints,
      firstNCount: compareN,
      lastNCount: compareN,
      isTrackMaxReps,
      // Weight stats (for all exercises)
      avgFirstWeight,
      avgLastWeight,
      weightChange: calcChange(avgFirstWeight, avgLastWeight),
      // Reps stats (for all exercises)
      avgFirstReps,
      avgLastReps,
      repsChange: calcChange(avgFirstReps, avgLastReps),
      // Volume stats (for all exercises)
      avgFirstVolume: avgFirstTotal,
      avgLastVolume: avgLastTotal,
      volumeChange: calcChange(avgFirstTotal, avgLastTotal),
      // Cardio stats
      avgFirstDist,
      avgLastDist,
      distChange: calcChange(avgFirstDist, avgLastDist),
      avgFirstDur,
      avgLastDur,
      durChange: calcChange(avgFirstDur, avgLastDur),
      avgFirstPace,
      avgLastPace,
      paceChange: calcChange(avgFirstPace, avgLastPace)
    };
  }, [history, selectedDateRange, exercise?.tags]);
  
  // Handler functions (keep all existing handlers)
  const addMuscleGroup = () => {
    if (muscleGroup.trim() === "") return;
    if (!muscleGroups.includes(muscleGroup.toLowerCase().trim())) {
      setMuscleGroups([...muscleGroups, muscleGroup.toLowerCase().trim()]);
    }
    setMuscleGroup("");
  };

  const removeMuscleGroup = (group: string) => {
    setMuscleGroups(muscleGroups.filter(g => g !== group));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError("Exercise name is required"); return; }
    if (muscleGroups.length === 0) { setError("At least one muscle group is required"); return; }
    setError("");
    try {
      const updatedData: Partial<ExerciseData> = {
        name, description, category, equipment, instructions,
        muscleGroups: muscleGroups
      };
      const updatedExercise = await updateExerciseAction(params.id, updatedData);
      if (updatedExercise) {
        setExercise(updatedExercise);
        setIsEditDialogOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update exercise");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteExerciseAction(params.id);
      router.push("/exercises");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exercise");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // For the log: one entry per date, merge sets from all workouts on that date
  const workoutsByDate: Record<string, any[]> = {};
  workoutExercises.forEach(w => {
    const date = new Date(w.createdAt).toISOString().split('T')[0];
    if (!workoutsByDate[date]) workoutsByDate[date] = [];
    workoutsByDate[date].push(w);
  });
  const uniqueWorkoutExercises = Object.entries(workoutsByDate).map(([date, group]) => {
    // Merge all sets for this date
    const allSets = group.flatMap((w: any) => w.sets || []);
    // Use the latest createdAt for display
    const latest = group.reduce((a: any, b: any) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
    return { ...latest, sets: allSets, createdAt: date };
  });
  uniqueWorkoutExercises.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Calculate Max Reps (Single Day) for bodyweight
  let maxRepsSingleDay = 0;
  if (isBodyweight && workoutExercises && workoutExercises.length > 0) {
    // Group by date, sum all reps for all sets for that date (across all workouts)
    const repsByDay: Record<string, number> = {};
    workoutExercises.forEach((w: any) => {
      const date = new Date(w.createdAt).toISOString().split('T')[0];
      if (w.sets && w.sets.length > 0) {
        w.sets.forEach((set: any) => {
          repsByDay[date] = (repsByDay[date] || 0) + (set.reps || 0);
        });
      }
    });
    maxRepsSingleDay = Math.max(...Object.values(repsByDay));
  }

  // Calculate Max Reps (Single Set) for bodyweight
  let maxRepsSingleSet = 0;
  if (isBodyweight && workoutExercises && workoutExercises.length > 0) {
    workoutExercises.forEach((w: any) => {
      if (w.sets && w.sets.length > 0) {
        w.sets.forEach((set: any) => {
          if (set.reps && set.reps > maxRepsSingleSet) {
            maxRepsSingleSet = set.reps;
          }
        });
      }
    });
  }

  // Find the date for Max Reps (Single Set)
  let maxRepsSingleSetDate = '';
  if (isBodyweight && workoutExercises && workoutExercises.length > 0 && maxRepsSingleSet) {
    for (const w of workoutExercises) {
      if (w.sets && w.sets.length > 0) {
        for (const set of w.sets) {
          if (set.reps === maxRepsSingleSet) {
            maxRepsSingleSetDate = formatDate(w.createdAt);
            break;
          }
        }
      }
      if (maxRepsSingleSetDate) break;
    }
  }
  // Find the date for Max Reps (Single Day)
  let maxRepsSingleDayDate = '';
  if (isBodyweight && workoutExercises && workoutExercises.length > 0 && maxRepsSingleDay) {
    // Group by date, sum reps per day
    const repsByDay: Record<string, number> = {};
    workoutExercises.forEach((w: any) => {
      const date = new Date(w.createdAt).toISOString().split('T')[0];
      let dayReps = 0;
      if (w.sets && w.sets.length > 0) {
        w.sets.forEach((set: any) => {
          dayReps += set.reps || 0;
        });
      }
      repsByDay[date] = (repsByDay[date] || 0) + dayReps;
    });
    for (const [date, total] of Object.entries(repsByDay)) {
      if (total === maxRepsSingleDay) {
        maxRepsSingleDayDate = formatDate(date);
        break;
      }
    }
  }

  // Add debug log for exercise
  console.log('Exercise object:', exercise);

  // JSX Return
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <LucideArrowLeft className="mr-2 h-4 w-4" />
          Back to Exercises
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <LucideEdit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Add to Workout
          </Button>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                {isDeleting ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideTrash className="mr-2 h-4 w-4" />}
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the exercise "{exercise ? exercise.name : 'this exercise'}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Exercise'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-4">{exercise ? exercise.name : 'Exercise'}</h1>

      {/* PR/Stats Grid */}
      {exercise && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isBodyweight ? (
            <>
              <ExercisePRTile
                icon={<Trophy className="h-5 w-5 text-amber-500" />}
                label="Max Reps (Single Set)"
                value={maxRepsSingleSet ? `${maxRepsSingleSet} reps` : '--'}
                color="from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20"
                date={maxRepsSingleSetDate}
              />
              <ExercisePRTile
                icon={<Repeat2 className="h-5 w-5 text-green-600" />}
                label="Max Reps (Single Day)"
                value={maxRepsSingleDay ? `${maxRepsSingleDay} reps` : '--'}
                color="from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
                date={maxRepsSingleDayDate}
              />
              <ExercisePRTile
                icon={<Dumbbell className="h-5 w-5 text-primary" />}
                label="Total Volume"
                value={formatVolume(totalVolume)}
                color="from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
              />
            </>
          ) : (
            <>
              <ExercisePRTile
                icon={<Dumbbell className="h-5 w-5 text-primary" />}
                label="Max Weight PR"
                value={stats?.maxWeight ? `${stats.maxWeight} kg` : '--'}
                color="from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
              />
              <ExercisePRTile
                icon={<Repeat2 className="h-5 w-5 text-green-600" />}
                label="Total Volume"
                value={stats?.totalVolume ? formatVolume(stats.totalVolume) : '--'}
                color="from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
              />
            </>
          )}
          <ExercisePRTile
            icon={<Hash className="h-5 w-5 text-blue-600" />}
            label="Total Reps"
            value={stats?.totalReps ? stats.totalReps.toLocaleString() : '--'}
            color="from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
          />
          <ExercisePRTile
            icon={<CalendarCheck className="h-5 w-5 text-rose-500" />}
            label="Last Session"
            value={stats?.lastSession ? formatDate(stats.lastSession) : '--'}
            color="from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20"
          />
          <ExercisePRTile
            icon={<ListChecks className="h-5 w-5 text-cyan-600" />}
            label="Total Sessions"
            value={stats?.totalSessions ? stats.totalSessions.toString() : '--'}
            color="from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20"
          />
        </div>
      )}

      {/* Progression Graph */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Progress Over Time</CardTitle>
            <RadioGroup defaultValue="allTime" value={selectedDateRange} onValueChange={(value) => setSelectedDateRange(value as any)} className="flex space-x-2">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="4weeks" id="r1" />
                <Label htmlFor="r1" className="text-xs">4W</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="3months" id="r2" />
                <Label htmlFor="r2" className="text-xs">3M</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="allTime" id="r3" />
                <Label htmlFor="r3" className="text-xs">All</Label>
              </div>
            </RadioGroup>
          </div>
        </CardHeader>
        <CardContent>
          {progressionDisplayData?.chartPoints && progressionDisplayData.chartPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressionDisplayData.chartPoints} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="reps" name="Max Reps" fontSize={10} strokeWidth={0} />
                <Tooltip contentStyle={{fontSize: '12px', padding: '4px 8px'}} />
                <Line type="monotone" dataKey="reps" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Max Reps" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-10">Not enough data points for this date range to show progression graph.</p>
          )}
        </CardContent>
      </Card>

      {/* Training History */}
      <Card>
        <CardHeader>
          <CardTitle>Workout Log</CardTitle>
        </CardHeader>
        <CardContent>
          {uniqueWorkoutExercises.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {uniqueWorkoutExercises.map((workout) => (
                <div key={workout.createdAt} className="block p-3 border rounded-lg hover:bg-accent transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium">{formatDate(workout.createdAt)}</p>
                  </div>
                  {workout.sets && workout.sets.length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground space-x-2">
                        <span>Sets: {workout.sets.length}</span>
                        {isBodyweight ? (
                          <>
                            <span>
                              Total reps: {workout.sets.reduce((sum: number, s: any) => sum + (s.reps || 0), 0)}
                            </span>
                            <span>
                              •
                            </span>
                            <span>
                              Total volume: {formatVolume(workout.sets.reduce((acc: number, set: any) => acc + (estimateBodyweightForExercise(exercise?.name || '') * (set.reps || 0)), 0))}
                            </span>
                          </>
                        ) : (
                          <span>
                            Max: {Math.max(...workout.sets.map((s: any) => (s.weight || 0) * (s.reps || 0)))} kg*reps
                          </span>
                        )}
                      </div>
                      {/* Per-set display */}
                      <div className="space-y-1 mt-1">
                        {workout.sets.map((set: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Set {idx + 1}</span>
                            {isBodyweight ? (
                              <span>{set.reps} reps</span>
                            ) : (
                              <span>{set.weight}kg × {set.reps}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-10">No workout history found.</p>
          )}
        </CardContent>
      </Card>

      {/* Debug Table: Raw workoutExercises data */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Debug: Raw workoutExercises Data</CardTitle>
        </CardHeader>
        <CardContent>
          {workoutExercises && workoutExercises.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">_id</th>
                    <th className="border px-2 py-1">workoutId</th>
                    <th className="border px-2 py-1">createdAt</th>
                    <th className="border px-2 py-1">sets.length</th>
                  </tr>
                </thead>
                <tbody>
                  {workoutExercises.map((w: any) => (
                    <tr key={w._id}>
                      <td className="border px-2 py-1">{w._id}</td>
                      <td className="border px-2 py-1">{w.workoutId}</td>
                      <td className="border px-2 py-1">{w.createdAt}</td>
                      <td className="border px-2 py-1">{w.sets ? w.sets.length : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">No workoutExercises data found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}