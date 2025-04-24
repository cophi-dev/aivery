"use client"

// Add helper function for formatting duration (seconds to MM:SS)
const formatDuration = (seconds: number | undefined | null): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return "N/A";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Add helper function for formatting pace (seconds per km to MM:SS/km)
const formatPace = (pace: number | undefined | null): string => {
  if (pace === undefined || pace === null || isNaN(pace) || pace <= 0) {
    return "N/A";
  }
  // Assuming pace is in seconds per kilometer
  const minutes = Math.floor(pace / 60);
  const remainingSeconds = Math.round(pace % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} /km`;
};

// --- Metadata Generation (Server-Side) ---

type Props = {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // 1. Fetch exercise data on the server
  const exercise = await fetchExercise(params.id);

  if (!exercise) {
    // Optionally handle not found case for metadata
    return {
      title: "Exercise Not Found | Aivery",
      description: "The requested exercise could not be found.",
    }
  }

  // 2. Construct Image URLs
  // Base URL for Vercel Blob storage (automatically set by Vercel)
  const blobBaseUrl = process.env.BLOB_URL;
  // Construct filename matching the one used in the API route
  const screenshotFilename = `og-images_exercises_${params.id}.png`;
  const screenshotUrl = blobBaseUrl ? `${blobBaseUrl}/${screenshotFilename}` : '/images/og-fallback.png'; // Use fallback if BLOB_URL missing
  const fallbackImageUrl = '/images/og-fallback.png'; // Define a static fallback

  // 3. Generate Metadata
  const title = `${exercise.name} | Aivery Exercises`;
  const description = exercise.description || `Details and history for the ${exercise.name} exercise.`;
  const pageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/exercises/${params.id}`; // Construct canonical URL

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: pageUrl,
      // Provide both the generated screenshot and a fallback
      images: [
        {
          url: screenshotUrl, 
          width: 1200,
          height: 630,
          alt: `${exercise.name} Exercise Preview`,
        },
        // Optional: Include the fallback image as a secondary option
        // {
        //   url: fallbackImageUrl,
        //   width: 1200, // Specify dimensions for fallback too
        //   height: 630,
        //   alt: "Aivery Logo", 
        // }
      ],
      type: 'article', // 'article' might be suitable for a specific exercise page
      // Optional: Add article specific tags if relevant
      // article: {
      //   tags: exercise.tags || exercise.muscleGroups || [],
      // },
    },
    // Optional: Twitter specific tags
    // twitter: {
    //   card: "summary_large_image",
    //   title: title,
    //   description: description,
    //   images: [screenshotUrl], // Use the primary screenshot URL
    // },
  };
}

// --- Server Component (Default Export) ---

export default async function ExerciseDetailPage({ params }: Props) {
  // Fetch initial data on the server
  let initialExercise: ExerciseData | null = null;
  let initialHistory: WorkoutExerciseData[] = [];
  let error: string | undefined = undefined;

  try {
    initialExercise = await fetchExercise(params.id);
    if (initialExercise) {
      initialHistory = await getExerciseHistory(params.id);
    } else {
      error = "Exercise not found";
      // Consider using notFound() from next/navigation for a proper 404 page
      // import { notFound } from 'next/navigation'
      // notFound();
    }
  } catch (err) {
    console.error("Server-side fetch error for Exercise Detail Page:", err);
    error = "Failed to load exercise data.";
  }

  // Render the client component with initial data
  return (
    <ExerciseDetailPageClient 
      initialExercise={initialExercise}
      initialHistory={initialHistory}
      error={error}
      params={params}
    />
  );
}

// --- Client Component (Renamed) ---

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
import type { Metadata, ResolvingMetadata } from 'next'

// Renamed component
function ExerciseDetailPageClient({ initialExercise, initialHistory, error: initialError, params }: { 
  initialExercise: ExerciseData | null;
  initialHistory: WorkoutExerciseData[];
  error?: string;
  params: { id: string };
}) {
  const router = useRouter()
  // Use initial props for state initialization
  const [isLoading, setIsLoading] = useState(!initialExercise && !initialError) // Start loading only if no initial data/error
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
  
  // Add state for cardio stats
  const [cardioStats, setCardioStats] = useState<{
    bestDistance: number | null;
    bestDuration: number | null; // For longest workout
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
  
  // State for exercise form
  const [name, setName] = useState(initialExercise?.name || "")
  const [description, setDescription] = useState(initialExercise?.description || "")
  const [category, setCategory] = useState<"strength" | "cardio" | "flexibility">(initialExercise?.category as "strength" | "cardio" | "flexibility" || "strength")
  const [equipment, setEquipment] = useState<string[]>(initialExercise?.equipment || [])
  const [instructions, setInstructions] = useState<string[]>(initialExercise?.instructions || [])
  const [muscleGroup, setMuscleGroup] = useState("")
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initialExercise?.muscleGroups || [])
  
  // Add state for date range selection
  const [selectedDateRange, setSelectedDateRange] = useState<"allTime" | "3months" | "4weeks">("allTime");
  
  // useEffect to process history when it changes (passed via props or updated later)
  useEffect(() => {
    processHistoryData(history); // Process initial or updated history
  }, [history]);

  // useEffect to set form fields if exercise data becomes available after initial load (e.g., refetch)
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
  
  const processHistoryData = (historyData: WorkoutExerciseData[]) => {
    if (!historyData.length) {
      // setChartData(fallbackHistoryData) - REMOVED
      setChartData([]) // Set empty array instead
      return
    }
    
    // Sort history by date (newest first)
    historyData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    // Find personal best (strength)
    let bestWeight = 0
    let bestReps = 0
    let bestTotal = 0

    // Initialize cardio stats
    let bestDistance = 0;
    let bestDuration = 0; // Longest duration workout
    let fastestPace = Infinity; // Lower is better
    let totalDistance = 0;
    let totalDuration = 0;
    let validPaceCount = 0;
    let totalPace = 0; // Sum of paces for averaging
    let workoutCount = historyData.length; // Count workouts with data
    
    // Process data for chart and stats
    const chartPoints = historyData.map(workout => {
      // Strength processing
      let maxWeight = 0
      let maxReps = 0
      let maxTotal = 0
      
      workout.sets.forEach(set => {
        const weight = Number(set.weight) || 0
        const reps = Number(set.reps) || 0
        const total = weight * reps
        
        if (total > maxTotal) {
          maxWeight = weight
          maxReps = reps
          maxTotal = total
        }
        
        // Update overall personal best (strength)
        if (total > bestTotal) {
          bestWeight = weight
          bestReps = reps
          bestTotal = total
        }
      })

      // Cardio processing
      const workoutDistance = workout.distance ? Number(workout.distance) : 0; // Assuming distance is in km
      const workoutDuration = workout.duration ? Number(workout.duration) : 0; // Assuming duration is in seconds
      const workoutPace = workout.pace ? Number(workout.pace) : null; // Assuming pace is seconds/km

      if (workoutDistance > bestDistance) {
        bestDistance = workoutDistance;
      }
      if (workoutDuration > bestDuration) {
        bestDuration = workoutDuration;
      }
      if (workoutPace !== null && workoutPace > 0 && workoutPace < fastestPace) {
        fastestPace = workoutPace;
      }
      
      totalDistance += workoutDistance;
      totalDuration += workoutDuration;
      if (workoutPace !== null && workoutPace > 0) {
        totalPace += workoutPace;
        validPaceCount++;
      }
      
      return { // Chart data point (might need adjusting based on chart needs)
        date: new Date(workout.createdAt).toISOString().split('T')[0],
        weight: maxWeight, // Keep for potential strength chart
        reps: maxReps,     // Keep for potential strength chart
        total: maxTotal,   // Keep for potential strength chart
        distance: workoutDistance, // Add cardio data
        duration: workoutDuration, // Add cardio data
        pace: workoutPace         // Add cardio data
      }
    })
    
    // Reverse to get chronological order for chart
    setChartData(chartPoints.reverse())
    
    // Set personal best (strength)
    if (bestTotal > 0) {
      setPersonalBest({ weight: bestWeight, reps: bestReps })
    } else {
      setPersonalBest(null); // Ensure it's null if no data
    }

    // Set calculated cardio stats
    setCardioStats({
      bestDistance: bestDistance > 0 ? bestDistance : null,
      bestDuration: bestDuration > 0 ? bestDuration : null,
      fastestPace: fastestPace !== Infinity ? fastestPace : null,
      avgDistance: workoutCount > 0 ? totalDistance / workoutCount : null,
      avgDuration: workoutCount > 0 ? totalDuration / workoutCount : null,
      avgPace: validPaceCount > 0 ? totalPace / validPaceCount : null,
      totalDistance: totalDistance,
      totalDuration: totalDuration,
      lastWorkout: historyData.length > 0 ? {
        distance: historyData[0].distance,
        duration: historyData[0].duration,
        pace: historyData[0].pace,
        calories: historyData[0].calories // Assuming calories might be available
      } : null
    });
  }
  
  // Use useMemo to process history data based on selected date range
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

    // If no data for the selected range, return empty/default state
    if (!filteredHistory.length) {
      return {
        chartPoints: [],
        avgFirstDist: null,
        avgLastDist: null,
        distChange: null,
        avgFirstPace: null,
        avgLastPace: null,
        paceChange: null,
        avgFirstDur: null,
        avgLastDur: null,
        durChange: null,
        avgFirstWeight: null,
        avgLastWeight: null,
        weightChange: null,
        avgFirstReps: null,
        avgLastReps: null,
        repsChange: null,
        avgFirstVolume: null,
        avgLastVolume: null,
        volumeChange: null,
        firstNCount: 0,
        lastNCount: 0
      };
    }

    // Sort filtered history chronologically for chart and first/last calcs
    filteredHistory.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Process for chart points
    const chartPoints = filteredHistory.map(workout => {
       // Strength processing
       let maxWeight = 0
       let maxReps = 0
       let maxTotal = 0
       workout.sets?.forEach(set => {
         const weight = Number(set.weight) || 0
         const reps = Number(set.reps) || 0
         const total = weight * reps
         if (total > maxTotal) {
           maxWeight = weight
           maxReps = reps
           maxTotal = total
         }
       });
       // Cardio processing
       const workoutDistance = workout.distance ? Number(workout.distance) : 0;
       const workoutDuration = workout.duration ? Number(workout.duration) : 0;
       const workoutPace = workout.pace ? Number(workout.pace) : null;

       return {
        date: new Date(workout.createdAt).toISOString().split('T')[0],
        weight: maxWeight,
        reps: maxReps,
        total: maxTotal,
        distance: workoutDistance,
        duration: workoutDuration,
        pace: workoutPace
      }
    });

    // Calculate first/last N averages for summary boxes
    const firstNCount = Math.min(5, filteredHistory.length);
    const lastNCount = Math.min(5, filteredHistory.length); // Use same N for consistency

    const firstNData = chartPoints.slice(0, firstNCount);
    const lastNData = chartPoints.slice(Math.max(0, chartPoints.length - lastNCount));

    // Cardio Averages
    const avgFirstDist = firstNData.reduce((sum, d) => sum + (d.distance || 0), 0) / firstNCount;
    const avgLastDist = lastNData.reduce((sum, d) => sum + (d.distance || 0), 0) / lastNCount;
    const distChange = avgLastDist - avgFirstDist;

    const validFirstPace = firstNData.filter(d => d.pace && d.pace > 0);
    const validLastPace = lastNData.filter(d => d.pace && d.pace > 0);
    const avgFirstPace = validFirstPace.length > 0 ? validFirstPace.reduce((sum, d) => sum + d.pace!, 0) / validFirstPace.length : null;
    const avgLastPace = validLastPace.length > 0 ? validLastPace.reduce((sum, d) => sum + d.pace!, 0) / validLastPace.length : null;
    const paceChange = (avgLastPace !== null && avgFirstPace !== null) ? avgLastPace - avgFirstPace : null;

    const avgFirstDur = firstNData.reduce((sum, d) => sum + (d.duration || 0), 0) / firstNCount;
    const avgLastDur = lastNData.reduce((sum, d) => sum + (d.duration || 0), 0) / lastNCount;
    const durChange = avgLastDur - avgFirstDur;

    // Strength Averages
    const avgFirstWeight = firstNData.reduce((sum, d) => sum + (d.weight || 0), 0) / firstNCount;
    const avgLastWeight = lastNData.reduce((sum, d) => sum + (d.weight || 0), 0) / lastNCount;
    const weightChange = avgLastWeight - avgFirstWeight;

    const avgFirstReps = firstNData.reduce((sum, d) => sum + (d.reps || 0), 0) / firstNCount;
    const avgLastReps = lastNData.reduce((sum, d) => sum + (d.reps || 0), 0) / lastNCount;
    const repsChange = avgLastReps - avgFirstReps;

    const avgFirstVolume = firstNData.reduce((sum, d) => sum + (d.total || 0), 0) / firstNCount;
    const avgLastVolume = lastNData.reduce((sum, d) => sum + (d.total || 0), 0) / lastNCount;
    const volumeChange = avgLastVolume - avgFirstVolume;

    return {
      chartPoints,
      avgFirstDist,
      avgLastDist,
      distChange,
      avgFirstPace,
      avgLastPace,
      paceChange,
      avgFirstDur,
      avgLastDur,
      durChange,
      avgFirstWeight,
      avgLastWeight,
      weightChange,
      avgFirstReps,
      avgLastReps,
      repsChange,
      avgFirstVolume,
      avgLastVolume,
      volumeChange,
      firstNCount,
      lastNCount
    };

  }, [history, selectedDateRange]); // Recompute when history or range changes
  
  const addMuscleGroup = () => {
    if (muscleGroup.trim() === "") return
    if (!muscleGroups.includes(muscleGroup.toLowerCase().trim())) {
      setMuscleGroups([...muscleGroups, muscleGroup.toLowerCase().trim()])
    }
    setMuscleGroup("")
  }

  const removeMuscleGroup = (group: string) => {
    setMuscleGroups(muscleGroups.filter(g => g !== group))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!name) {
      setError("Exercise name is required")
      return
    }
    
    if (muscleGroups.length === 0) {
      setError("At least one muscle group is required")
      return
    }
    
    setError("")
    
    try {
      const updatedExercise = await updateExerciseAction(params.id, {
        name,
        description,
        category,
        equipment,
        instructions,
        muscleGroups: muscleGroups
      })
      
      if (updatedExercise) {
        setExercise(updatedExercise)
        setIsEditDialogOpen(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update exercise")
    }
  }
  
  const handleDelete = async () => {
    setIsDeleting(true)
    
    try {
      await deleteExerciseAction(params.id)
      router.push("/exercises")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exercise")
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setGenerationError(null);

    if (!exercise) {
      setGenerationError("Exercise data not loaded.");
      setIsGeneratingImage(false);
      return;
    }

    // Construct a prompt (Improved logic)
    const instructionsText = exercise.instructions && exercise.instructions.length > 0
      ? `Instructions: ${exercise.instructions.join('. ')}`
      : exercise.description || ''; // Fallback to description if no instructions

    const prompt = `Minimalistic infographic, clear focus on correct technique for the ${exercise.name} exercise. ${instructionsText}`;

    console.log("Generating image with prompt:", prompt);

    try {
      const result = await generateAndSaveExerciseImage(exercise._id, prompt);

      if (result.success && result.imageUrl) {
        console.log("Image generated successfully:", result.imageUrl);
        // Update local state to show the new image immediately
        setExercise(prev => prev ? { ...prev, images: [...(prev.images || []), result.imageUrl!] } : null);
      } else {
        console.error("Image generation failed:", result.error);
        setGenerationError(result.error || "Failed to generate image.");
      }
    } catch (err: any) {
      console.error("Error calling generateAndSaveExerciseImage action:", err);
      setGenerationError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGeneratingImage(false);
    }
  }
  
  // Loading and error states
  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-500">
        Error: {error}
      </div>
    );
  }
  
  if (!exercise) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        Exercise not found.
      </div>
    );
  }
  
  // Calculate progress percentage if available
  const calculateProgress = () => {
    if (chartData.length < 2) return null
    
    const firstWeight = chartData[0].weight
    const lastWeight = chartData[chartData.length - 1].weight
    
    if (firstWeight === 0) return null
    
    const progressPercentage = ((lastWeight - firstWeight) / firstWeight) * 100
    return progressPercentage.toFixed(1)
  }
  
  const progressPercentage = calculateProgress()
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/exercises">
            <Button variant="ghost" size="sm" className="mr-4">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Back to Exercises
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsEditDialogOpen(true)}
          >
            <LucideEdit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <div className="w-full md:w-auto mt-4 md:mt-0">
            <Link href={`/workouts/new?exercise=${params.id}`}>
              <Button variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" /> Add to Workout
              </Button>
            </Link>
          </div>
          
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            <LucideTrash className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Training History</TabsTrigger>
          <TabsTrigger value="progression">Progression</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>About this Exercise</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-4">
                  {exercise.images && exercise.images.length > 0 ? (
                    <div className="bg-muted rounded-md overflow-hidden flex justify-center items-center aspect-video relative">
                      <Image 
                        src={exercise.images[0]} 
                        alt={`${exercise.name} illustration`} 
                        layout="fill"
                        objectFit="contain"
                        unoptimized={true}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 border rounded-md bg-muted/50 min-h-[150px]">
                      <Button 
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        variant="outline"
                        size="sm"
                      >
                        {isGeneratingImage ? (
                          <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <LucideImage className="h-4 w-4 mr-2" />
                        )}
                        {isGeneratingImage ? "Generating..." : "Generate Image"}
                      </Button>
                      {generationError && (
                        <p className="text-destructive text-xs mt-2 text-center">Error: {generationError}</p>
                      )}
                      {!isGeneratingImage && !generationError && (
                         <p className="text-muted-foreground text-xs mt-2 text-center">No image available. Click to generate one.</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium mb-1">Category</h3>
                  <p className="capitalize">{exercise.category}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-1">Target Muscle Groups</h3>
                  <div className="flex flex-wrap gap-1">
                    {(exercise.muscleGroups || []).map((muscle: string) => (
                      <Badge key={muscle} variant="secondary" className="capitalize">
                        {muscle}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {exercise.equipment && exercise.equipment.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-1">Equipment</h3>
                    <p>{exercise.equipment.join(", ")}</p>
                  </div>
                )}
                
                {exercise.instructions && exercise.instructions.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-1">Instructions</h3>
                    <p className="whitespace-pre-line">
                      {exercise.instructions.join('\n')}
                    </p>
                  </div>
                )}
                
                {exercise.description && !exercise.instructions && (
                  <div>
                    <h3 className="font-medium mb-1">Description</h3>
                    <p>{exercise.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm text-muted-foreground">Personal Best</h3>
                    <p className="text-2xl font-bold">
                      {exercise.category === 'cardio' ? (
                        cardioStats?.fastestPace || cardioStats?.bestDistance || cardioStats?.bestDuration ? (
                          <span className="text-sm">
                            {cardioStats.bestDistance ? `Dist: ${cardioStats.bestDistance.toFixed(2)} km` : ''}
                            {cardioStats.bestDistance && cardioStats.bestDuration ? ' / ' : ''}
                            {cardioStats.bestDuration ? `Time: ${formatDuration(cardioStats.bestDuration)}` : ''}
                            {cardioStats.fastestPace && (cardioStats.bestDistance || cardioStats.bestDuration) ? ' / ' : ''}
                            {cardioStats.fastestPace ? `Pace: ${formatPace(cardioStats.fastestPace)}` : ''}
                          </span>
                        ) : "No data yet"
                      ) : (
                        personalBest 
                          ? `${personalBest.weight} kg × ${personalBest.reps}` 
                          : "No data yet"
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm text-muted-foreground">Last Workout</h3>
                    <p>
                      {history.length > 0 
                        ? formatDate(history[0].createdAt) 
                        : "No workouts yet"}
                    </p>
                    {/* Add Last Workout details for Cardio */}
                    {exercise.category === 'cardio' && cardioStats?.lastWorkout && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {cardioStats.lastWorkout.duration ? `${formatDuration(cardioStats.lastWorkout.duration)}` : ''}
                        {cardioStats.lastWorkout.distance ? ` / ${cardioStats.lastWorkout.distance.toFixed(2)} km` : ''}
                        {cardioStats.lastWorkout.pace ? ` / ${formatPace(cardioStats.lastWorkout.pace)}` : ''}
                        {/* {cardioStats.lastWorkout.calories ? ` / ${Math.round(cardioStats.lastWorkout.calories)} kcal` : ''} */}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm text-muted-foreground">Total Training Sessions</h3>
                    <p>{history.length}</p>
                  </div>
                  
                  {progressPercentage && (
                    <div>
                      <h3 className="text-sm text-muted-foreground">Progress Since Start</h3>
                      <div className="flex items-center">
                        <LucideTrendingUp className={`h-4 w-4 mr-1 ${Number(progressPercentage) >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        <span className={Number(progressPercentage) >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {Number(progressPercentage) >= 0 ? '+' : ''}{progressPercentage}%
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Progress Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No training history yet
                    </div>
                  ) : exercise.category === 'cardio' ? (
                    // CARDIO Progress Summary
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Best Distance</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.bestDistance ? `${cardioStats.bestDistance.toFixed(2)} km` : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Longest Duration</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.bestDuration ? formatDuration(cardioStats.bestDuration) : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Fastest Pace</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.fastestPace ? formatPace(cardioStats.fastestPace) : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Distance</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.avgDistance ? `${cardioStats.avgDistance.toFixed(2)} km` : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Duration</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.avgDuration ? formatDuration(cardioStats.avgDuration) : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Pace</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.avgPace ? formatPace(cardioStats.avgPace) : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Distance</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.totalDistance ? `${cardioStats.totalDistance.toFixed(2)} km` : '0 km'}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Time</div>
                          <div className="text-xl font-bold">
                            {cardioStats?.totalDuration ? formatDuration(cardioStats.totalDuration) : '0:00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // STRENGTH Progress Summary (Original Logic)
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Best Weight</div>
                          <div className="text-xl font-bold">
                            {Math.max(0, ...history.flatMap(w => w.sets?.map(s => Number(s.weight) || 0) ?? []))} kg
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Best Reps</div>
                          <div className="text-xl font-bold">
                            {Math.max(0, ...history.flatMap(w => w.sets?.map(s => Number(s.reps) || 0) ?? []))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Weight</div>
                          <div className="text-xl font-bold">
                            {(() => {
                              const allSets = history.flatMap(w => w.sets ?? []);
                              const totalWeight = allSets.reduce((sum, set) => sum + (Number(set.weight) || 0), 0);
                              const numSets = allSets.length;
                              return numSets > 0 ? `${(totalWeight / numSets).toFixed(1)} kg` : 'N/A';
                            })()}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Reps</div>
                          <div className="text-xl font-bold">
                             {(() => {
                              const allSets = history.flatMap(w => w.sets ?? []);
                              const totalReps = allSets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
                              const numSets = allSets.length;
                              return numSets > 0 ? (totalReps / numSets).toFixed(1) : 'N/A';
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Volume</div>
                        <div className="text-xl font-bold">
                          {history.reduce((sum, w) => sum + (w.sets?.reduce((s, set) => s + ((Number(set.weight) || 0) * (Number(set.reps) || 0)), 0) ?? 0), 0)} kg
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Training History</CardTitle>
              <CardDescription>
                Your workout history for this exercise
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted">
                      {/* Conditional Headers based on category */}
                      {exercise.category === 'cardio' ? (
                        <tr>
                          <th scope="col" className="px-6 py-3">Date</th>
                          <th scope="col" className="px-6 py-3">Duration</th>
                          <th scope="col" className="px-6 py-3">Distance</th>
                          <th scope="col" className="px-6 py-3">Avg Pace</th>
                          <th scope="col" className="px-6 py-3">Notes</th>
                        </tr>
                      ) : (
                        // Default to Strength columns
                        <tr>
                          <th scope="col" className="px-6 py-3">Date</th>
                          <th scope="col" className="px-6 py-3">Sets</th>
                          <th scope="col" className="px-6 py-3">Best Set</th>
                          <th scope="col" className="px-6 py-3">Volume</th>
                          <th scope="col" className="px-6 py-3">Notes</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {history.map((workout, index) => {
                        const workoutLink = workout.workoutId ? `/workouts/${workout.workoutId}` : '#';
                        
                        // Render row based on category
                        return (
                          <Link href={workoutLink} key={index} passHref legacyBehavior>
                            {exercise.category === 'cardio' ? (
                              <tr className="border-b hover:bg-muted/50 cursor-pointer">
                                <td className="px-6 py-4">{formatDate(workout.createdAt)}</td>
                                <td className="px-6 py-4">{formatDuration(workout.duration)}</td>
                                <td className="px-6 py-4">{workout.distance !== undefined ? `${workout.distance.toFixed(2)} km` : 'N/A'}</td>
                                <td className="px-6 py-4">{formatPace(workout.pace)}</td>
                                <td className="px-6 py-4 max-w-xs truncate">{workout.notes || "-"}</td>
                              </tr>
                            ) : (
                              // STRENGTH ROW - Calculate metrics first, then return the row
                              (() => {
                                let bestSet = { weight: 0, reps: 0 };
                                let bestVolume = 0;
                                let totalVolume = 0;
                                
                                workout.sets?.forEach(set => {
                                  const weight = Number(set.weight) || 0;
                                  const reps = Number(set.reps) || 0;
                                  const volume = weight * reps;
                                  totalVolume += volume;
                                  if (volume > bestVolume) {
                                    bestSet = { weight, reps };
                                    bestVolume = volume;
                                  }
                                });
                                
                                return (
                                  <tr className="border-b hover:bg-muted/50 cursor-pointer">
                                    <td className="px-6 py-4">{formatDate(workout.createdAt)}</td>
                                    <td className="px-6 py-4">{workout.sets?.length ?? 0}</td>
                                    <td className="px-6 py-4">
                                      {bestSet.weight > 0 ? `${bestSet.weight} kg × ${bestSet.reps}` : "N/A"}
                                    </td>
                                    <td className="px-6 py-4">{totalVolume} kg</td>
                                    <td className="px-6 py-4 max-w-xs truncate">{workout.notes || "-"}</td>
                                  </tr>
                                );
                              })()
                            )}
                          </Link>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No training history found for this exercise yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="progression">
          <Card>
            <CardHeader>
              <CardTitle>Progression</CardTitle>
              <CardDescription>
                Your {exercise.category === 'cardio' ? 'cardio' : 'strength'} progression over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="space-y-6">
                  {/* Date Range Toggle */}
                  <div className="flex justify-center mb-4">
                    <RadioGroup 
                      defaultValue="allTime"
                      value={selectedDateRange}
                      onValueChange={(value: "allTime" | "3months" | "4weeks") => setSelectedDateRange(value)}
                      className="flex items-center space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="allTime" id="r-all" />
                        <Label htmlFor="r-all">All Time</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="3months" id="r-3m" />
                        <Label htmlFor="r-3m">Last 3 Months</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="4weeks" id="r-4w" />
                        <Label htmlFor="r-4w">Last 4 Weeks</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Conditional Chart Rendering using progressionDisplayData */} 
                  {progressionDisplayData.chartPoints.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available for the selected date range.
                    </div>
                  ) : exercise.category === 'cardio' ? (
                    // CARDIO CHART
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={progressionDisplayData.chartPoints}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          />
                          <YAxis yAxisId="left" unit=" km" name="Distance" />
                          <YAxis yAxisId="right" orientation="right" name="Pace" tickFormatter={(value) => formatPace(value)} domain={['dataMin - 10', 'dataMax + 10']} reversed={true} />
                          <Tooltip 
                            formatter={(value: number, name: string) => {
                              if (name === 'distance') return [`${value.toFixed(2)} km`, 'Distance'];
                              if (name === 'pace') return [formatPace(value), 'Avg Pace'];
                              if (name === 'duration') return [formatDuration(value), 'Duration']; // Add duration if needed
                              return [value, name];
                            }}
                            labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="distance" 
                            stroke="#8884d8" 
                            name="Distance"
                            unit="km"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="pace" 
                            stroke="#82ca9d" 
                            name="Pace"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            connectNulls // Connect line even if pace is missing for some points
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    // STRENGTH CHART
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={progressionDisplayData.chartPoints}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          />
                          <YAxis yAxisId="left" unit=" kg" name="Weight/Volume" />
                          <YAxis yAxisId="right" orientation="right" name="Reps" />
                          <Tooltip 
                            formatter={(value: number, name: string) => {
                               if (name === 'weight') return [`${value} kg`, 'Weight'];
                               if (name === 'reps') return [value, 'Reps'];
                               if (name === 'total') return [`${value} kg`, 'Volume'];
                               return [value, name];
                            }}
                            labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="weight" 
                            stroke="#8884d8" 
                            name="Weight"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="reps" 
                            stroke="#82ca9d" 
                            name="Reps"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                           <Line 
                            yAxisId="left" // Plot volume on the left axis with weight
                            type="monotone" 
                            dataKey="total" 
                            stroke="#ffc658" 
                            name="Volume"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* SUMMARY BOXES - Conditional Rendering using progressionDisplayData */} 
                  {progressionDisplayData.chartPoints.length === 0 ? null : exercise.category === 'cardio' ? (
                     // CARDIO Summary Boxes
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="bg-muted/50 p-4 rounded-lg">
                         <h3 className="text-sm font-medium mb-2">Distance Progression</h3>
                         <div className="space-y-1">
                            {(() => {
                              const { avgFirstDist, avgLastDist, distChange, firstNCount, lastNCount } = progressionDisplayData;
                              
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                    <span className="font-medium">{avgFirstDist !== null ? `${avgFirstDist.toFixed(2)} km` : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                    <span className="font-medium">{avgLastDist !== null ? `${avgLastDist.toFixed(2)} km` : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Change:</span>
                                    <span className={`font-medium ${distChange === null || isNaN(distChange) ? '' : distChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {distChange === null || isNaN(distChange) ? 'N/A' : `${distChange >= 0 ? '+' : ''}${distChange.toFixed(2)} km`}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                         </div>
                       </div>

                       <div className="bg-muted/50 p-4 rounded-lg">
                         <h3 className="text-sm font-medium mb-2">Pace Progression</h3>
                         <div className="space-y-1">
                            {(() => {
                              const { avgFirstPace, avgLastPace, paceChange, firstNCount, lastNCount } = progressionDisplayData;
                              
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                    <span className="font-medium">{formatPace(avgFirstPace)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                    <span className="font-medium">{formatPace(avgLastPace)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Change:</span>
                                    {paceChange !== null ? (
                                      <span className={`font-medium ${paceChange <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {/* Pace change: lower is better */}
                                        {formatDuration(paceChange)} /km
                                      </span>
                                    ) : (
                                      <span className="font-medium">N/A</span>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                         </div>
                       </div>

                       <div className="bg-muted/50 p-4 rounded-lg">
                         <h3 className="text-sm font-medium mb-2">Duration Progression</h3>
                         <div className="space-y-1">
                            {(() => {
                              const { avgFirstDur, avgLastDur, durChange, firstNCount, lastNCount } = progressionDisplayData;
                              
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                    <span className="font-medium">{avgFirstDur !== null ? formatDuration(avgFirstDur) : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                    <span className="font-medium">{avgLastDur !== null ? formatDuration(avgLastDur) : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Change:</span>
                                    <span className={`font-medium ${durChange === null || isNaN(durChange) ? '' : durChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {durChange === null || isNaN(durChange) ? 'N/A' : `${durChange >= 0 ? '+' : ''}${formatDuration(durChange)}`}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                         </div>
                       </div>
                     </div>
                  ) : (
                    // STRENGTH Summary Boxes
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">Weight Progression</h3>
                        <div className="space-y-1">
                          {(() => {
                            const { avgFirstWeight, avgLastWeight, weightChange, firstNCount, lastNCount } = progressionDisplayData;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                  <span className="font-medium">{avgFirstWeight !== null ? `${avgFirstWeight.toFixed(1)} kg` : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                  <span className="font-medium">{avgLastWeight !== null ? `${avgLastWeight.toFixed(1)} kg` : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Total Change:</span>
                                  <span className={`font-medium ${weightChange === null || isNaN(weightChange) ? '' : weightChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {weightChange === null || isNaN(weightChange) ? 'N/A' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">Rep Progression</h3>
                        <div className="space-y-1">
                          {(() => {
                            const { avgFirstReps, avgLastReps, repsChange, firstNCount, lastNCount } = progressionDisplayData;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                  <span className="font-medium">{avgFirstReps !== null ? avgFirstReps.toFixed(1) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                  <span className="font-medium">{avgLastReps !== null ? avgLastReps.toFixed(1) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Total Change:</span>
                                  <span className={`font-medium ${repsChange === null || isNaN(repsChange) ? '' : repsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {repsChange === null || isNaN(repsChange) ? 'N/A' : `${repsChange >= 0 ? '+' : ''}${repsChange.toFixed(1)}`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">Volume Progression</h3>
                        <div className="space-y-1">
                          {(() => {
                            const { avgFirstVolume, avgLastVolume, volumeChange, firstNCount, lastNCount } = progressionDisplayData;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg First {firstNCount}:</span>
                                  <span className="font-medium">{avgFirstVolume !== null ? `${avgFirstVolume.toFixed(1)} kg` : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Avg Last {lastNCount}:</span>
                                  <span className="font-medium">{avgLastVolume !== null ? `${avgLastVolume.toFixed(1)} kg` : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Total Change:</span>
                                  <span className={`font-medium ${volumeChange === null || isNaN(volumeChange) ? '' : volumeChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {volumeChange === null || isNaN(volumeChange) ? 'N/A' : `${volumeChange >= 0 ? '+' : ''}${volumeChange.toFixed(1)} kg`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Not enough data to show progression chart yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
            <DialogDescription>
              Update the exercise details
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name">Exercise Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bench Press"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={category} 
                onValueChange={(value: "strength" | "cardio" | "flexibility") => setCategory(value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="flexibility">Flexibility</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="muscleGroups">Muscle Groups</Label>
              <div className="flex gap-2">
                <Input
                  id="muscleGroups"
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value)}
                  placeholder="e.g., chest, shoulders"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addMuscleGroup()
                    }
                  }}
                />
                <Button 
                  type="button" 
                  onClick={addMuscleGroup}
                  variant="secondary"
                >
                  Add
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-1 mt-2">
                {muscleGroups.map((group) => (
                  <Badge key={group} className="flex items-center gap-1 capitalize">
                    {group}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeMuscleGroup(group)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="equipment">Equipment (comma-separated)</Label>
              <Input
                id="equipment"
                value={equipment.join(", ")}
                onChange={(e) => {
                  // Split string by comma, trim whitespace, filter empty strings
                  const newEquipment = e.target.value
                    .split(',')
                    .map(item => item.trim())
                    .filter(item => item !== '');
                  setEquipment(newEquipment);
                }}
                placeholder="e.g., Barbell, Dumbbell"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the exercise"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea 
                id="instructions" 
                value={instructions.join('\n')} 
                onChange={(e) => setInstructions(e.target.value.split('\n'))} 
                rows={6} 
              />
            </div>
            
            {/* --- Add Videos Section --- */}
            {exercise.videos && exercise.videos.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold mb-3">Videos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {exercise.videos.map((videoUrl: string, index: number) => {
                    // Basic check for YouTube URL
                    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                      // Attempt to extract video ID and create embed URL
                      let embedUrl = '';
                      try {
                        const url = new URL(videoUrl);
                        if (url.hostname === 'youtu.be') {
                          embedUrl = `https://www.youtube.com/embed/${url.pathname.substring(1)}`;
                        } else if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
                          const videoId = url.searchParams.get('v');
                          if (videoId) {
                            embedUrl = `https://www.youtube.com/embed/${videoId}`;
                          }
                        }
                      } catch (e) {
                        console.error("Error parsing video URL:", videoUrl, e);
                        embedUrl = ''; // Reset on error
                      }

                      // Render iframe if embedUrl is valid
                      if (embedUrl) {
                        return (
                          <div key={index} className="aspect-video"> {/* Maintain aspect ratio */}
                            <iframe
                              width="100%"
                              height="100%"
                              src={embedUrl}
                              title={`Exercise Video ${index + 1}`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy" // Add lazy loading
                            ></iframe>
                          </div>
                        );
                      } else {
                        // Fallback for unparseable YouTube URLs
                        return (
                           <p key={index} className="text-sm text-muted-foreground">
                             Unable to embed video: <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline">{videoUrl}</a>
                           </p>
                        )
                      }
                    } else {
                      // Handle non-YouTube URLs (e.g., display as link)
                      return (
                        <p key={index} className="text-sm text-muted-foreground">
                          Video Link: <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline">{videoUrl}</a>
                        </p>
                      );
                    }
                  })}
                </div>
              </div>
            )}
            {/* --- End Videos Section --- */}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <LucideSave className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete the exercise. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 