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
import { LucideArrowLeft, LucideSave, LucideTrash, LucideEdit, LucideTrendingUp, LucidePlus } from "lucide-react"
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

// Fallback data if no history is available
const fallbackHistoryData = [
  { date: '2023-01-10', weight: 60, reps: 10 },
  { date: '2023-01-17', weight: 65, reps: 8 },
  { date: '2023-01-24', weight: 65, reps: 10 },
  { date: '2023-01-31', weight: 70, reps: 8 },
  { date: '2023-02-07', weight: 70, reps: 10 },
  { date: '2023-02-14', weight: 75, reps: 8 },
  { date: '2023-02-21', weight: 75, reps: 10 },
  { date: '2023-02-28', weight: 80, reps: 8 },
]

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
  
  // State for exercise form
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<"strength" | "cardio" | "flexibility">("strength")
  const [equipment, setEquipment] = useState("")
  const [instructions, setInstructions] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("")
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  
  useEffect(() => {
    async function loadExercise() {
      try {
        setIsLoading(true)
        const exerciseData = await fetchExercise(params.id)
        
        if (!exerciseData) {
          setError("Exercise not found")
          return
        }
        
        setExercise(exerciseData)
        
        // Also populate edit form fields
        setName(exerciseData.name)
        setDescription(exerciseData.description || "")
        setCategory(exerciseData.category as "strength" | "cardio" | "flexibility")
        setEquipment(exerciseData.equipment || "")
        setInstructions(exerciseData.instructions || "")
        setMuscleGroups(exerciseData.muscleGroups || [])
        
        // Load exercise history
        try {
          const historyData = await getExerciseHistory(params.id)
          setHistory(historyData)
          
          // Process history data for charts
          processHistoryData(historyData)
        } catch (historyErr) {
          console.error("Error loading exercise history:", historyErr)
          // Use fallback data if real data is not available
          setChartData(fallbackHistoryData)
        }
      } catch (err) {
        setError("Failed to load exercise")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadExercise()
  }, [params.id])
  
  // Process workout history data for display and charts
  const processHistoryData = (historyData: WorkoutExerciseData[]) => {
    if (!historyData.length) {
      setChartData(fallbackHistoryData)
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
        muscleGroups
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
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading exercise...</div>
      </div>
    )
  }
  
  if (!exercise) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          {error || "Exercise not found"}
        </div>
        <div className="flex justify-center mt-4">
          <Link href="/exercises">
            <Button>Back to Exercises</Button>
          </Link>
        </div>
      </div>
    )
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
          
          <Link href={`/workout/new?exercise=${params.id}`}>
            <Button variant="default">
              <LucidePlus className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
          </Link>
          
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
                <div>
                  <h3 className="font-medium mb-1">Category</h3>
                  <p className="capitalize">{exercise.category}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-1">Target Muscle Groups</h3>
                  <div className="flex flex-wrap gap-1">
                    {exercise.muscleGroups.map(muscle => (
                      <Badge key={muscle} variant="secondary" className="capitalize">
                        {muscle}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {exercise.equipment && (
                  <div>
                    <h3 className="font-medium mb-1">Equipment</h3>
                    <p>{exercise.equipment}</p>
                  </div>
                )}
                
                {exercise.description && (
                  <div>
                    <h3 className="font-medium mb-1">Description</h3>
                    <p>{exercise.description}</p>
                  </div>
                )}
                
                {exercise.instructions && (
                  <div>
                    <h3 className="font-medium mb-1">Instructions</h3>
                    <p className="whitespace-pre-line">{exercise.instructions}</p>
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
              <Label htmlFor="equipment">Equipment (Optional)</Label>
              <Input
                id="equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
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
              <Label htmlFor="instructions">Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step-by-step instructions for performing the exercise"
                rows={5}
              />
            </div>
            
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