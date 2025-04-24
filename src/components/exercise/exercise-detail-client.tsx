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
import { LucideArrowLeft, LucideSave, LucideTrash, LucideEdit, LucideTrendingUp, LucidePlus, PlusCircle, LucideImage, LucideLoader } from "lucide-react"
import { fetchExercise, updateExerciseAction, deleteExerciseAction, getExerciseHistory, generateAndSaveExerciseImage } from "@/lib/exercise-actions"
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

// Define the props type for the client component
interface ExerciseDetailPageClientProps {
  initialExercise: ExerciseData | null;
  initialHistory: WorkoutExerciseData[];
  error?: string;
  params: { id: string };
  // Pass helper functions as props from the Server Component
  formatDuration: (seconds: number | undefined | null) => string;
  formatPace: (pace: number | undefined | null) => string;
}

export default function ExerciseDetailPageClient({ 
  initialExercise, 
  initialHistory, 
  error: initialError, 
  params, 
  formatDuration, // Receive helper functions via props
  formatPace
}: ExerciseDetailPageClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(!initialExercise && !initialError)
  const [error, setError] = useState(initialError || "")
  const [exercise, setExercise] = useState<ExerciseData | null>(initialExercise)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [history, setHistory] = useState<WorkoutExerciseData[]>(initialHistory)
  const [chartData, setChartData] = useState<any[]>([])
  const [personalBest, setPersonalBest] = useState<{ weight: number, reps: number } | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
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

  // Process history data (runs on initial load and when history state changes)
  const processHistoryData = useMemo(() => (historyData: WorkoutExerciseData[]) => {
    if (!historyData.length) {
      setChartData([]) 
      setPersonalBest(null)
      setCardioStats(null)
      return
    }
    // Sort history by date (newest first)
    historyData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    let bestWeight = 0, bestReps = 0, bestTotal = 0
    let bestDistance = 0, bestDuration = 0, fastestPace = Infinity
    let totalDistance = 0, totalDuration = 0, validPaceCount = 0, totalPace = 0
    const workoutCount = historyData.length
    
    const chartPoints = historyData.map(workout => {
      let maxWeight = 0, maxReps = 0, maxTotal = 0
      workout.sets?.forEach(set => {
        const weight = Number(set.weight) || 0
        const reps = Number(set.reps) || 0
        const total = weight * reps
        if (total > maxTotal) { maxWeight = weight; maxReps = reps; maxTotal = total }
        if (total > bestTotal) { bestWeight = weight; bestReps = reps; bestTotal = total }
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
        weight: maxWeight, reps: maxReps, total: maxTotal,
        distance: workoutDistance, duration: workoutDuration, pace: workoutPace
      }
    })
    
    setChartData(chartPoints.slice().reverse()) // Reverse copy for chart
    if (bestTotal > 0) setPersonalBest({ weight: bestWeight, reps: bestReps }); else setPersonalBest(null);

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

    if (selectedDateRange === "3months") {
      const threeMonthsAgo = subMonths(now, 3);
      filteredHistory = history.filter(item => new Date(item.createdAt) >= threeMonthsAgo);
    } else if (selectedDateRange === "4weeks") {
      const fourWeeksAgo = subWeeks(now, 4);
      filteredHistory = history.filter(item => new Date(item.createdAt) >= fourWeeksAgo);
    }

    if (!filteredHistory.length) return { /* default empty state */ }; // Return default structure if no data

    filteredHistory.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const chartPoints = filteredHistory.map(workout => {
       let maxWeight = 0, maxReps = 0, maxTotal = 0
       workout.sets?.forEach(set => {
         const weight = Number(set.weight) || 0; const reps = Number(set.reps) || 0; const total = weight * reps;
         if (total > maxTotal) { maxWeight = weight; maxReps = reps; maxTotal = total }
       });
       const workoutDistance = workout.distance ? Number(workout.distance) : 0;
       const workoutDuration = workout.duration ? Number(workout.duration) : 0;
       const workoutPace = workout.pace ? Number(workout.pace) : null;
       return { date: new Date(workout.createdAt).toISOString().split('T')[0], weight: maxWeight, reps: maxReps, total: maxTotal, distance: workoutDistance, duration: workoutDuration, pace: workoutPace }
    });

    const firstNCount = Math.min(5, filteredHistory.length);
    const lastNCount = Math.min(5, filteredHistory.length);
    const firstNData = chartPoints.slice(0, firstNCount);
    const lastNData = chartPoints.slice(Math.max(0, chartPoints.length - lastNCount));

    // Calculate averages (simplified)
    const calcAvg = (data: any[], key: string) => data.length > 0 ? data.reduce((sum, d) => sum + (d[key] || 0), 0) / data.length : null;
    const calcPaceAvg = (data: any[]) => {
      const valid = data.filter(d => d.pace && d.pace > 0);
      return valid.length > 0 ? valid.reduce((sum, d) => sum + d.pace!, 0) / valid.length : null;
    };

    const avgFirstDist = calcAvg(firstNData, 'distance'); const avgLastDist = calcAvg(lastNData, 'distance');
    const avgFirstPace = calcPaceAvg(firstNData); const avgLastPace = calcPaceAvg(lastNData);
    const avgFirstDur = calcAvg(firstNData, 'duration'); const avgLastDur = calcAvg(lastNData, 'duration');
    const avgFirstWeight = calcAvg(firstNData, 'weight'); const avgLastWeight = calcAvg(lastNData, 'weight');
    const avgFirstReps = calcAvg(firstNData, 'reps'); const avgLastReps = calcAvg(lastNData, 'reps');
    const avgFirstVolume = calcAvg(firstNData, 'total'); const avgLastVolume = calcAvg(lastNData, 'total');

    return {
      chartPoints, firstNCount, lastNCount,
      avgFirstDist, avgLastDist, distChange: avgLastDist !== null && avgFirstDist !== null ? avgLastDist - avgFirstDist : null,
      avgFirstPace, avgLastPace, paceChange: avgLastPace !== null && avgFirstPace !== null ? avgLastPace - avgFirstPace : null,
      avgFirstDur, avgLastDur, durChange: avgLastDur !== null && avgFirstDur !== null ? avgLastDur - avgFirstDur : null,
      avgFirstWeight, avgLastWeight, weightChange: avgLastWeight !== null && avgFirstWeight !== null ? avgLastWeight - avgFirstWeight : null,
      avgFirstReps, avgLastReps, repsChange: avgLastReps !== null && avgFirstReps !== null ? avgLastReps - avgFirstReps : null,
      avgFirstVolume, avgLastVolume, volumeChange: avgLastVolume !== null && avgFirstVolume !== null ? avgLastVolume - avgFirstVolume : null,
    };

  }, [history, selectedDateRange]);
  
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

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true); setGenerationError(null);
    if (!exercise) { setGenerationError("Exercise data not loaded."); setIsGeneratingImage(false); return; }
    const instructionsText = exercise.instructions?.join('. ') || exercise.description || '';
    const prompt = `Minimalistic infographic, clear focus on correct technique for the ${exercise.name} exercise. ${instructionsText}`;
    console.log("Generating image with prompt:", prompt);
    try {
      const result = await generateAndSaveExerciseImage(exercise._id, prompt);
      if (result.success && result.imageUrl) {
        setExercise(prev => prev ? { ...prev, images: [...(prev.images || []), result.imageUrl!] } : null);
      } else { setGenerationError(result.error || "Failed to generate image."); }
    } catch (err: any) { setGenerationError(err.message || "An unexpected error occurred."); }
     finally { setIsGeneratingImage(false); }
  };
  
  // Loading and error states
  if (isLoading) return <LoadingIndicator />;
  if (error) return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
  if (!exercise) return <div className="container mx-auto px-4 py-8 text-center">Exercise not found.</div>;

  // JSX Return
  return (
    <div className="container mx-auto px-4 py-8">
        {/* ... Keep the entire JSX structure from the previous version ... */}
        {/* Make sure to use formatDuration and formatPace where needed */}
        {/* Example usage in JSX: */}
        {/* <p>{formatDuration(cardioStats?.bestDuration)}</p> */}
        {/* <p>{formatPace(cardioStats?.fastestPace)}</p> */}
    </div>
  );
} 