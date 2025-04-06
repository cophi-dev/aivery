"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideChevronLeft, LucideChevronRight, LucideClock, LucidePlus, LucideCalendarDays } from "lucide-react"
import { fetchWorkouts, createWorkout } from "@/lib/workout-actions"
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay } from "date-fns"
import type { WorkoutData } from "@/types/db"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function PlanPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [workoutName, setWorkoutName] = useState("")
  const [workoutType, setWorkoutType] = useState("strength")
  const [workoutDuration, setWorkoutDuration] = useState("60")
  const [workoutIntensity, setWorkoutIntensity] = useState("Medium")
  const [workoutNotes, setWorkoutNotes] = useState("")
  
  // Get the current week dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Start on Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }) // End on Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  
  // Load workouts
  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        setIsLoading(true)
        const data = await fetchWorkouts()
        setWorkouts(data)
      } catch (error) {
        console.error("Failed to load workouts:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadWorkouts()
  }, [])
  
  // Navigate to previous week
  const goToPreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1))
  }
  
  // Navigate to next week
  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1))
  }
  
  // Get workouts for a specific day
  const getWorkoutsForDay = (date: Date) => {
    return workouts.filter(workout => {
      const workoutDate = new Date(workout.date)
      return isSameDay(workoutDate, date)
    })
  }
  
  // Handle opening the create workout dialog
  const handleAddWorkout = (date: Date) => {
    setSelectedDay(date)
    setWorkoutName("")
    setWorkoutType("strength")
    setWorkoutDuration("60")
    setWorkoutIntensity("Medium")
    setWorkoutNotes("")
    setIsDialogOpen(true)
  }
  
  // Handle creating a new workout
  const handleCreateWorkout = async () => {
    if (!selectedDay) return
    
    try {
      const workoutData = {
        name: workoutName || `${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout`,
        date: selectedDay,
        duration: Number(workoutDuration),
        intensity: workoutIntensity as "Low" | "Medium" | "High",
        type: workoutType,
        notes: workoutNotes,
      }
      
      const newWorkout = await createWorkout(workoutData)
      setWorkouts([...workouts, newWorkout])
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Failed to create workout:", error)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workout Plan</h1>
          <p className="text-muted-foreground mt-2">Schedule and organize your training routine</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <LucideChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-medium">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <LucideChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Your training plan for this week</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={`text-center p-2 rounded-md ${
                    isSameDay(day, new Date()) ? "bg-primary/10 font-medium" : ""
                  }`}
                >
                  <div className="font-medium">{format(day, "EEE")}</div>
                  <div className="text-sm text-muted-foreground">{format(day, "d")}</div>
                </div>
              ))}

              {weekDays.map((day, index) => {
                const dayWorkouts = getWorkoutsForDay(day)
                return (
                  <div
                    key={`workout-${index}`}
                    className={`border rounded-md p-3 min-h-[150px] ${
                      isSameDay(day, new Date()) ? "border-primary" : ""
                    }`}
                  >
                    {dayWorkouts.length > 0 ? (
                      <div className="h-full flex flex-col space-y-2">
                        {dayWorkouts.map((workout) => (
                          <div key={workout._id} className="p-2 border rounded-md hover:bg-secondary/20 transition-colors">
                            <div className="font-medium truncate">{workout.name}</div>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center">
                              <LucideClock className="h-3 w-3 mr-1" />
                              {workout.duration} min
                            </div>
                            <div className="mt-2">
                              <Badge
                                variant={
                                  workout.intensity === "High"
                                    ? "default"
                                    : workout.intensity === "Medium"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="text-xs"
                              >
                                {workout.intensity}
                              </Badge>
                            </div>
                            <div className="mt-2">
                              <Button variant="outline" size="sm" className="w-full text-xs" 
                                onClick={() => router.push(`/workout/start/${workout._id}`)}>
                                Start
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="mt-auto h-8 text-xs"
                          onClick={() => handleAddWorkout(day)}>
                          <LucidePlus className="h-3 w-3 mr-1" />
                          Add Workout
                        </Button>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center">
                        <Button variant="ghost" size="sm" className="h-8 text-xs"
                          onClick={() => handleAddWorkout(day)}>
                          <LucidePlus className="h-3 w-3 mr-1" />
                          Add Workout
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Workouts</CardTitle>
            <CardDescription>Your scheduled sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : workouts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No workouts scheduled yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workouts
                  .filter(workout => new Date(workout.date) >= new Date())
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5)
                  .map((workout) => (
                    <div key={workout._id} className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">{workout.name}</h3>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center">
                          <LucideCalendarDays className="h-4 w-4 mr-1" />
                          {format(new Date(workout.date), "EEEE, MMMM d")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => router.push(`/workout/start/${workout._id}`)}>Start</Button>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/workout/edit/${workout._id}`)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Workout Templates</CardTitle>
            <CardDescription>Quick access to common workouts</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="p-4 border rounded-md hover:border-primary cursor-pointer" 
                  onClick={() => router.push("/workouts/new")}>
                  <div className="font-medium">Create New Template</div>
                  <p className="text-sm text-muted-foreground mt-1">Design a custom workout template</p>
                </div>
                
                {Array.from(new Set(workouts.map(w => w.type)))
                  .map(type => {
                    const typeWorkouts = workouts.filter(w => w.type === type);
                    const lastWorkout = typeWorkouts.sort((a, b) => 
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                    )[0];
                    
                    if (!lastWorkout) return null;
                    
                    return (
                      <div key={type} className="p-4 border rounded-md hover:border-primary cursor-pointer"
                        onClick={() => router.push(`/workout/${lastWorkout._id}`)}>
                        <div className="font-medium">{type.charAt(0).toUpperCase() + type.slice(1)}</div>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-sm text-muted-foreground">
                            Last: {format(new Date(lastWorkout.date), "MMM d")}
                          </p>
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/workout/edit/${lastWorkout._id}`);
                          }}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Create Workout Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New Workout
              {selectedDay && (
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  {format(selectedDay, "EEEE, MMMM d")}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Plan your workout details for this day
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workout-name" className="col-span-4">
                Workout Name
              </Label>
              <Input
                id="workout-name"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="col-span-4"
                placeholder="e.g., Upper Body, Leg Day"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workout-type" className="col-span-4">
                Workout Type
              </Label>
              <Select value={workoutType} onValueChange={setWorkoutType}>
                <SelectTrigger className="col-span-4">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength Training</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="cycling">Cycling</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="flexibility">Flexibility</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workout-duration" className="col-span-4">
                Duration (minutes)
              </Label>
              <Input
                id="workout-duration"
                type="number"
                value={workoutDuration}
                onChange={(e) => setWorkoutDuration(e.target.value)}
                className="col-span-4"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workout-intensity" className="col-span-4">
                Intensity
              </Label>
              <Select value={workoutIntensity} onValueChange={setWorkoutIntensity}>
                <SelectTrigger className="col-span-4">
                  <SelectValue placeholder="Select intensity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workout-notes" className="col-span-4">
                Notes
              </Label>
              <Textarea
                id="workout-notes"
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                className="col-span-4"
              />
            </div>
          </div>
          
          <CardFooter className="ml-auto">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkout}>Create Workout</Button>
          </CardFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

