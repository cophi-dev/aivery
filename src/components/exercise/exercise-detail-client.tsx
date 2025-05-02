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
import MetricContent from "@/components/ui/metric-card"

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

  const isCardioExercise = exercise.category === 'cardio';
  const isStrengthExercise = exercise.category === 'strength';

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
          <Button variant="outline" size="sm"> {/* TODO: Implement Add to Workout */}
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
                  Are you sure you want to delete the exercise "{exercise.name}"? This action cannot be undone.
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

      <h1 className="text-3xl font-bold mb-4">{exercise.name}</h1>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Training History</TabsTrigger>
          <TabsTrigger value="progression">Progression</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>About this Exercise</CardTitle>
              </CardHeader>
              <CardContent>
                {exercise.images && exercise.images.length > 0 ? (
                   <Image 
                      src={exercise.images[0]} 
                      alt={`${exercise.name} illustration`} 
                      width={500} 
                      height={300} 
                      className="rounded-lg object-cover mb-4 w-full" 
                    />
                ) : (
                  <div className="text-center py-10 bg-muted rounded-lg mb-4">
                    <p className="text-muted-foreground mb-3">No image available.</p>
                     <Button onClick={handleGenerateImage} disabled={isGeneratingImage} size="sm">
                        {isGeneratingImage ? <LucideLoader className="mr-2 h-4 w-4 animate-spin" /> : <LucideImage className="mr-2 h-4 w-4" />}
                         Generate Image (AI)
                     </Button>
                     {generationError && <p className="text-red-500 text-xs mt-2">{generationError}</p>}
                  </div>
                )}
                 <p className="text-muted-foreground mb-4">{exercise.description || "No description provided."}</p>
                 {exercise.instructions && exercise.instructions.length > 0 && (
                   <div>
                     <h4 className="font-semibold mb-2">Instructions:</h4>
                     <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                       {exercise.instructions.map((inst, index) => <li key={index}>{inst}</li>)}
                     </ol>
                   </div>
                 )}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
             <Card>
               <CardHeader><CardTitle>Details</CardTitle></CardHeader>
               <CardContent className="space-y-3 text-sm">
                 <div>
                   <p className="font-semibold">Category</p>
                   <Badge variant="secondary" className="capitalize">{exercise.category}</Badge>
                 </div>
                 {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                   <div>
                     <p className="font-semibold mb-1">Target Muscle Groups</p>
                     <div className="flex flex-wrap gap-1">
                       {exercise.muscleGroups.map(muscle => <Badge key={muscle} variant="outline" className="capitalize">{muscle}</Badge>)}
                     </div>
                   </div>
                 )}
                 {exercise.equipment && exercise.equipment.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">Equipment</p>
                      <div className="flex flex-wrap gap-1">
                        {exercise.equipment.map(eq => <Badge key={eq} variant="outline" className="capitalize">{eq}</Badge>)}
                      </div>
                    </div>
                  )}
               </CardContent>
             </Card>
          </div>
        </TabsContent>

        {/* Training History Tab */}
        <TabsContent value="history" className="space-y-6">
           <div className="grid md:grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle>Quick Stats</CardTitle>
               </CardHeader>
               <CardContent className="space-y-3 text-sm">
                  {isStrengthExercise && personalBest && (
                    <div>
                      <p className="font-semibold">Personal Best (Volume)</p>
                      <p>{personalBest.weight} kg x {personalBest.reps} reps</p>
                      {/* TODO: Add date of PR */}
                    </div>
                  )}
                  {isCardioExercise && cardioStats && (
                    <div className="grid grid-cols-2 gap-3">
                      {cardioStats.bestDistance && <div><p className="font-semibold">Best Distance</p><p>{formatDistance(cardioStats.bestDistance)}</p></div>}
                      {cardioStats.bestDuration && <div><p className="font-semibold">Longest Duration</p><p>{formatDuration(cardioStats.bestDuration)}</p></div>}
                      {cardioStats.fastestPace && <div><p className="font-semibold">Fastest Pace</p><p>{formatPace(cardioStats.fastestPace)}</p></div>}
                    </div>
                  )}
                  {(isStrengthExercise && !personalBest) && (!isCardioExercise || !cardioStats?.bestDistance && !cardioStats?.bestDuration && !cardioStats?.fastestPace) && (
                    <p className="text-muted-foreground">No PR data yet.</p>
                  )}
                  
                  {history.length > 0 && (
                     <div>
                      <p className="font-semibold">Last Training Session</p>
                      <p>{formatDate(history[0].createdAt)}</p>
                      {/* Display key stats from last workout */}
                       {isCardioExercise && cardioStats?.lastWorkout && (
                         <div className="text-xs text-muted-foreground mt-1 space-x-2">
                            {cardioStats.lastWorkout.distance && <span>Dist: {formatDistance(cardioStats.lastWorkout.distance)}</span>}
                            {cardioStats.lastWorkout.duration && <span>Time: {formatDuration(cardioStats.lastWorkout.duration)}</span>}
                            {cardioStats.lastWorkout.pace && <span>Pace: {formatPace(cardioStats.lastWorkout.pace)}</span>}
                         </div>
                       )}
                     </div>
                  )}
                  <div>
                    <p className="font-semibold">Total Training Sessions</p>
                    <p>{history.length}</p>
                  </div>
               </CardContent>
             </Card>
             {/* TODO: Potentially add Progress Summary card here if desired */}
           </div>
           
           <Card>
              <CardHeader>
                <CardTitle>Workout Log</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                     {history.map((workout) => (
                      <Link key={workout.workoutId} href={`/workout/${workout.workoutId}`} className="block p-3 border rounded-lg hover:bg-accent transition-colors">
                          <div className="flex justify-between items-center mb-1">
                              <p className="font-medium">{formatDate(workout.createdAt)}</p>
                              {/* Optionally show workout name if available: <p className="text-sm text-muted-foreground">{workout.workoutName}</p> */}
                          </div>
                          {isStrengthExercise && workout.sets && workout.sets.length > 0 && (
                            <div className="text-xs text-muted-foreground space-x-2">
                                <span>Sets: {workout.sets.length}</span>
                                <span>Max: {Math.max(...workout.sets.map(s => (s.weight || 0) * (s.reps || 0)))} kg*reps</span> 
                            </div>
                           )}
                           {isCardioExercise && (
                              <div className="text-xs text-muted-foreground space-x-2">
                                {workout.distance && <span>Dist: {formatDistance(workout.distance)}</span>}
                                {workout.duration && <span>Time: {formatDuration(workout.duration)}</span>}
                                {workout.pace && <span>Pace: {formatPace(workout.pace)}</span>}
                                {workout.calories && <span>Cals: {Math.round(workout.calories)}</span>}
                              </div>
                           )}
                      </Link>
                     ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No training history recorded for this exercise yet.</p>
                )}
              </CardContent>
           </Card>
        </TabsContent>

        {/* Progression Tab */}
        <TabsContent value="progression" className="space-y-6">
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
                      {/* Adjust Y-axis based on exercise type */}
                      {isStrengthExercise && <YAxis dataKey="total" name="Volume (kg*reps)" fontSize={10} strokeWidth={0} />}
                      {isCardioExercise && <YAxis yAxisId="left" dataKey="distance" name="Distance (m)" fontSize={10} strokeWidth={0} />}
                      {isCardioExercise && <YAxis yAxisId="right" dataKey="pace" name="Pace (s/km)" orientation="right" fontSize={10} strokeWidth={0} tickFormatter={formatPace} />}
                      
                      <Tooltip contentStyle={{fontSize: '12px', padding: '4px 8px'}} />
                      {/* Adjust Line based on exercise type */}
                      {isStrengthExercise && <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Volume (kg*reps)" />}
                      {isCardioExercise && <Line yAxisId="left" type="monotone" dataKey="distance" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Distance (m)" />}
                      {isCardioExercise && <Line yAxisId="right" type="monotone" dataKey="pace" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Pace (s/km)" />}
                   </LineChart>
                 </ResponsiveContainer>
               ) : (
                 <p className="text-muted-foreground text-center py-10">Not enough data points for this date range to show progression graph.</p>
               )}
             </CardContent>
           </Card>
           {/* Display Progression Summary Stats */}
           {progressionDisplayData && progressionDisplayData.chartPoints && progressionDisplayData.chartPoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Progression Summary ({selectedDateRange === 'allTime' ? 'All Time' : selectedDateRange === '3months' ? 'Last 3 Months' : 'Last 4 Weeks'})</CardTitle>
                  <CardDescription>Comparing average of first {progressionDisplayData.firstNCount} sessions vs last {progressionDisplayData.lastNCount} sessions in selected range.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {isStrengthExercise && (
                    <>
                      <MetricContent title="Avg Weight" value={progressionDisplayData.avgLastWeight?.toFixed(1) + ' kg'} change={progressionDisplayData.weightChange} />
                      <MetricContent title="Avg Reps" value={progressionDisplayData.avgLastReps?.toFixed(1) ?? '--'} change={progressionDisplayData.repsChange} />
                      <MetricContent title="Avg Volume" value={(progressionDisplayData.avgLastVolume?.toFixed(0) ?? '--') + (progressionDisplayData.avgLastVolume != null ? ' kg' : '')} change={progressionDisplayData.volumeChange} />
                    </>
                  )}
                   {isCardioExercise && (
                     <>
                       <MetricContent title="Avg Distance" value={formatDistance(progressionDisplayData.avgLastDist)} change={progressionDisplayData.distChange} />
                       <MetricContent title="Avg Duration" value={formatDuration(progressionDisplayData.avgLastDur)} change={progressionDisplayData.durChange} />
                       <MetricContent title="Avg Pace" value={formatPace(progressionDisplayData.avgLastPace)} change={progressionDisplayData.paceChange} />
                     </>
                  )}
                </CardContent>
              </Card>
           )}
        </TabsContent>
      </Tabs>

       {/* Edit Exercise Dialog */}
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
         <DialogContent className="sm:max-w-[600px]">
           <DialogHeader>
             <DialogTitle>Edit Exercise: {exercise.name}</DialogTitle>
           </DialogHeader>
           <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="name" className="text-right">Name</Label>
                 <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                 <Label htmlFor="description" className="text-right pt-2">Description</Label>
                 <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" rows={3}/>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="category" className="text-right">Category</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as any)}>
                    <SelectTrigger className="col-span-3"> <SelectValue placeholder="Select category" /> </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              {/* TODO: Add fields for Equipment, Instructions, Muscle Groups - similar structure */}
              {/* Example for Muscle Groups */}
               <div className="grid grid-cols-4 items-start gap-4">
                 <Label className="text-right pt-2">Muscle Groups</Label>
                 <div className="col-span-3 space-y-2">
                   <div className="flex gap-2">
                      <Input 
                         value={muscleGroup} 
                         onChange={(e) => setMuscleGroup(e.target.value)} 
                         placeholder="Add muscle group..."
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMuscleGroup(); }}}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={addMuscleGroup}><PlusCircle className="h-4 w-4"/></Button>
                   </div>
                   <div className="flex flex-wrap gap-1">
                     {muscleGroups.map((group) => (
                        <Badge key={group} variant="secondary" className="capitalize">
                          {group}
                          <button type="button" onClick={() => removeMuscleGroup(group)} className="ml-1.5 text-muted-foreground hover:text-foreground">
                             <X className="h-3 w-3" />
                          </button>
                        </Badge>
                     ))}
                   </div>
                 </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center col-span-4">{error}</p>}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit"> <LucideSave className="mr-2 h-4 w-4" /> Save Changes</Button>
              </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
    </div>
  );
} 