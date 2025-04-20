"use client"

import { useState, useEffect } from "react"
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

// Fallback data if no history is available
// const fallbackHistoryData = [
//   { date: '2023-01-10', weight: 60, reps: 10 },
//   { date: '2023-01-17', weight: 65, reps: 8 },
//   { date: '2023-01-24', weight: 65, reps: 10 },
//   { date: '2023-01-31', weight: 70, reps: 8 },
//   { date: '2023-02-07', weight: 70, reps: 10 },
//   { date: '2023-02-14', weight: 75, reps: 8 },
//   { date: '2023-02-21', weight: 75, reps: 10 },
//   { date: '2023-02-28', weight: 80, reps: 8 },
// ]

export default function ExerciseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [exercise, setExercise] = useState<ExerciseData | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [history, setHistory] = useState<WorkoutExerciseData[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [personalBest, setPersonalBest] = useState<{ weight: number, reps: number } | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  
  // State for exercise form
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<"strength" | "cardio" | "flexibility">("strength")
  const [equipment, setEquipment] = useState<string[]>([])
  const [instructions, setInstructions] = useState<string[]>([])
  const [muscleGroup, setMuscleGroup] = useState("")
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  
  useEffect(() => {
    let isMounted = true
    
    async function loadExerciseAndHistory() {
      try {
        setIsLoading(true)
        setError("")

        const exerciseData = await fetchExercise(params.id)
        
        if (!exerciseData) {
          if (isMounted) setError("Exercise not found")
          return
        }
        
        if (isMounted) {
          setExercise(exerciseData)
          console.log("Fetched Exercise Data:", exerciseData);
          
          // Also populate edit form fields
          setName(exerciseData.name)
          setDescription(exerciseData.description || "")
          setCategory(exerciseData.category as "strength" | "cardio" | "flexibility")
          setEquipment(exerciseData.equipment || [])
          setInstructions(exerciseData.instructions || [])
          setMuscleGroups(exerciseData.primaryMuscles || [])
          
          // Fetch history (no longer fetching API details here)
          try {
            const historyData = await getExerciseHistory(params.id)
            if (isMounted) {
              setHistory(historyData)
              processHistoryData(historyData)
            }
          } catch (historyErr) {
            console.error("Error loading exercise history:", historyErr)
            if (isMounted) {
              setHistory([])
              processHistoryData([])
            }
          }
        }
        
      } catch (err) {
        console.error("Failed to load exercise page data:", err)
        if (isMounted) setError("Failed to load exercise data. Please try again.")
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadExerciseAndHistory()

    // Cleanup function to set isMounted to false when the component unmounts
    return () => {
      isMounted = false
    }
  }, [params.id])
  
  // Process workout history data for display and charts
  const processHistoryData = (historyData: WorkoutExerciseData[]) => {
    if (!historyData.length) {
      // setChartData(fallbackHistoryData) - REMOVED
      setChartData([]) // Set empty array instead
      return
    }
    
    // Sort history by date (newest first)
    historyData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    // Find personal best
    let bestWeight = 0
    let bestReps = 0
    let bestTotal = 0
    
    // Process data for chart
    const chartPoints = historyData.map(workout => {
      // Find the best set for this workout
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
        
        // Update overall personal best
        if (total > bestTotal) {
          bestWeight = weight
          bestReps = reps
          bestTotal = total
        }
      })
      
      return {
        date: new Date(workout.createdAt).toISOString().split('T')[0],
        weight: maxWeight,
        reps: maxReps,
        total: maxTotal
      }
    })
    
    // Reverse to get chronological order for chart
    setChartData(chartPoints.reverse())
    
    // Set personal best
    if (bestTotal > 0) {
      setPersonalBest({ weight: bestWeight, reps: bestReps })
    }
  }
  
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
        primaryMuscles: muscleGroups
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
                    {(exercise.primaryMuscles || []).map((muscle: string) => (
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
                      {personalBest 
                        ? `${personalBest.weight} kg × ${personalBest.reps}` 
                        : "No data yet"}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm text-muted-foreground">Last Workout</h3>
                    <p>
                      {history.length > 0 
                        ? formatDate(history[0].createdAt) 
                        : "No workouts yet"}
                    </p>
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
                  {history.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Best Weight</div>
                          <div className="text-xl font-bold">
                            {Math.max(...history.map(w => Math.max(...w.sets.map(s => Number(s.weight) || 0))))} kg
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Best Reps</div>
                          <div className="text-xl font-bold">
                            {Math.max(...history.map(w => Math.max(...w.sets.map(s => Number(s.reps) || 0))))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Weight</div>
                          <div className="text-xl font-bold">
                            {(history.reduce((sum, w) => sum + w.sets.reduce((s, set) => s + (Number(set.weight) || 0), 0), 0) / 
                              history.reduce((sum, w) => sum + w.sets.length, 0)).toFixed(1)} kg
                          </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Reps</div>
                          <div className="text-xl font-bold">
                            {(history.reduce((sum, w) => sum + w.sets.reduce((s, set) => s + (Number(set.reps) || 0), 0), 0) / 
                              history.reduce((sum, w) => sum + w.sets.length, 0)).toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Volume</div>
                        <div className="text-xl font-bold">
                          {history.reduce((sum, w) => sum + w.sets.reduce((s, set) => s + ((Number(set.weight) || 0) * (Number(set.reps) || 0)), 0), 0)} kg
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No training history yet
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
                      <tr>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Sets</th>
                        <th scope="col" className="px-6 py-3">Best Set</th>
                        <th scope="col" className="px-6 py-3">Volume</th>
                        <th scope="col" className="px-6 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((workout, index) => {
                        // Calculate best set and total volume
                        let bestSet = { weight: 0, reps: 0 }
                        let bestVolume = 0
                        let totalVolume = 0
                        
                        workout.sets.forEach(set => {
                          const weight = Number(set.weight) || 0
                          const reps = Number(set.reps) || 0
                          const volume = weight * reps
                          
                          totalVolume += volume
                          
                          if (volume > bestVolume) {
                            bestSet = { weight, reps }
                            bestVolume = volume
                          }
                        })
                        
                        return (
                          <tr key={index} className="border-b">
                            <td className="px-6 py-4">{formatDate(workout.createdAt)}</td>
                            <td className="px-6 py-4">{workout.sets.length}</td>
                            <td className="px-6 py-4">
                              {bestSet.weight > 0 ? `${bestSet.weight} kg × ${bestSet.reps}` : "N/A"}
                            </td>
                            <td className="px-6 py-4">{totalVolume} kg</td>
                            <td className="px-6 py-4 max-w-xs truncate">{workout.notes || "-"}</td>
                          </tr>
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
                Your strength progression over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value: number, name: string) => [`${value} ${name === 'weight' ? 'kg' : ''}`, name === 'weight' ? 'Weight' : 'Reps']}
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
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium mb-2">Weight Progression</h3>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Starting Weight:</span>
                          <span className="font-medium">{chartData[0].weight} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Weight:</span>
                          <span className="font-medium">{chartData[chartData.length - 1].weight} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Increase:</span>
                          <span className="font-medium text-green-500">
                            +{(chartData[chartData.length - 1].weight - chartData[0].weight).toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium mb-2">Rep Progression</h3>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Starting Reps:</span>
                          <span className="font-medium">{chartData[0].reps}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Reps:</span>
                          <span className="font-medium">{chartData[chartData.length - 1].reps}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Change:</span>
                          <span className={`font-medium ${chartData[chartData.length - 1].reps - chartData[0].reps >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {chartData[chartData.length - 1].reps - chartData[0].reps >= 0 ? '+' : ''}
                            {chartData[chartData.length - 1].reps - chartData[0].reps}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium mb-2">Volume Progression</h3>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Starting Volume:</span>
                          <span className="font-medium">{chartData[0].total} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Volume:</span>
                          <span className="font-medium">{chartData[chartData.length - 1].total} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Increase:</span>
                          <span className="font-medium text-green-500">
                            +{(chartData[chartData.length - 1].total - chartData[0].total).toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Not enough data to show progression chart.
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