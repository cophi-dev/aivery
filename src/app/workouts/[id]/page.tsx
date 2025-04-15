"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LucideArrowLeft,
  LucideClock,
  LucideRuler,
  LucideHeartPulse,
  LucideActivity,
  LucideCalendarDays,
  LucidePencil,
  LucideTrash,
  LucideMapPin,
  LucideZap,
  LucideDumbbell,
  LucideBrainCircuit,
  LucideChevronDown
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { formatDate, formatDuration } from "@/lib/utils"
import { getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository"
import { WorkoutAnalysis } from "@/components/workout-analysis"

export default function ActivityDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiHighlight, setAiHighlight] = useState<string | null>(null)
  const [isLoadingHighlight, setIsLoadingHighlight] = useState(false)
  const [previousWorkouts, setPreviousWorkouts] = useState<any[]>([])
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Extract id directly since we're in a client component
  const { id } = params

  // Load workout data, AI highlight, and previous workouts
  useEffect(() => {
    let isMounted = true // Flag to prevent state updates on unmounted component
    console.log("=======================================");
    console.log("CLIENT-SIDE: useEffect for ActivityDetailPage START");
    console.log(`CLIENT-SIDE: ID Parameter = ${id}`);
    console.log("=======================================");
    
    const loadData = async () => {
      if (!id) {
        console.log('>>> CLIENT-SIDE: ID missing, skipping loadData');
        setIsLoading(false); 
        setError("No workout ID provided")
        return
      }

      setIsLoading(true)
      setAiHighlight(null) // Reset highlight on new load
      setIsLoadingHighlight(false) // Reset highlight loading state
      setPreviousWorkouts([]) // Reset previous workouts
      setIsLoadingPrevious(false) // Reset previous loading state
      try {
        // Fetch main workout data
        const workoutData = await fetchWorkout(id)
        console.log('>>> Fetched workout data (client-side):', workoutData);
        if (!isMounted) return // Exit if component unmounted

        if (workoutData) {
          setWorkout(workoutData)
          setError(null)
          // Add detailed log of the received workout object structure
          console.log('>>> CLIENT-SIDE: Workout state set. Structure:', JSON.stringify(workoutData, null, 2));

          // --- Fetch AI Highlight --- 
          console.log('>>> CLIENT-SIDE: Fetching AI Highlight...')
          setIsLoadingHighlight(true)
          try {
            const highlightRes = await fetch(`/api/ai/workout-highlight?workoutId=${id}`)
            if (!isMounted) return // Exit if component unmounted

            if (highlightRes.ok) {
              const highlightData = await highlightRes.json()
              console.log('>>> CLIENT-SIDE: AI Highlight Response:', highlightData)
              setAiHighlight(highlightData.highlight || 'Could not generate highlight.')
            } else {
              console.error('>>> CLIENT-SIDE: Failed to fetch AI Highlight, status:', highlightRes.status)
              setAiHighlight('Error loading AI highlight.')
            }
          } catch (highlightError) {
            if (!isMounted) return // Exit if component unmounted
            console.error('>>> CLIENT-SIDE: Error fetching AI Highlight:', highlightError)
            setAiHighlight('Error loading AI highlight.')
          } finally {
             if (isMounted) setIsLoadingHighlight(false)
          }
          // --- End Fetch AI Highlight --- 

          // --- Fetch Previous Workouts (REMOVED - Route doesn't exist and component doesn't need it) --- 
          // console.log('>>> CLIENT-SIDE: Fetching Previous Workouts...')
          // setIsLoadingPrevious(true)
          // try {
          //   const prevWkRes = await fetch(`/api/previous-workouts?userId=${workoutData.userId}&type=${workoutData.type}&currentDate=${workoutData.date}&currentWorkoutId=${id}&limit=5`);
          //   if (!isMounted) return;
            
          //   if (prevWkRes.ok) {
          //     const prevData = await prevWkRes.json();
          //     console.log('>>> CLIENT-SIDE: Previous Workouts Response:', prevData)
          //     setPreviousWorkouts(prevData.workouts || []);
          //   } else {
          //     console.error('>>> CLIENT-SIDE: Failed to fetch Previous Workouts, status:', prevWkRes.status)
          //     setPreviousWorkouts([]);
          //   }
          // } catch (prevError) {
          //   if (!isMounted) return // Exit if component unmounted
          //   console.error('>>> CLIENT-SIDE: Error fetching Previous Workouts:', prevError)
          //   setPreviousWorkouts([]);
          // } finally {
          //    if (isMounted) setIsLoadingPrevious(false)
          // }
          // --- End Fetch Previous Workouts --- 

        } else {
          setWorkout(null)
          setError("Workout not found. It may have been deleted or you don't have permission to view it.")
        }
      } catch (error) {
        if (!isMounted) return // Exit if component unmounted
        console.error(">>> ERROR fetching main workout:", error); // Clarified error log
        setWorkout(null); 
        setError(error instanceof Error ? error.message : "Failed to load workout data")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (id) { 
        loadData()
    } else {
        console.log('>>> CLIENT-SIDE: ID missing, skipping loadData');
        setIsLoading(false); 
        setError("No workout ID provided")
    }

    // Cleanup function to set isMounted to false when component unmounts
    return () => {
      isMounted = false
      console.log('CLIENT-SIDE: ActivityDetailPage unmounting, cleanup triggered.')
    }
  }, [id])

  // Handle delete
  const handleDelete = async () => {
    if (!workout) return

    if (!confirm("Are you sure you want to delete this activity?")) return

    try {
      setIsDeleting(true)
      await deleteWorkout(workout._id)
      router.push("/planner")
    } catch (error) {
      console.error("Failed to delete workout:", error)
      setIsDeleting(false)
    }
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Loading State
  if (isLoading) {
    return (
      // Centered loading indicator for initial load
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Error State / Workout Not Found
  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Activity not found</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button asChild className="mt-4">
            <Link href="/workouts">Back to Workouts List</Link>
          </Button>
        </div>
      </div>
    )
  }

  // --- Main Render --- 
  return (
    <>
      {/* --- Section 1: Full-Screen AI Highlight (Fun Fact) --- */} 
      {/* Only render if highlight is loaded and available */} 
      {aiHighlight && !isLoadingHighlight && (
        <div className="relative flex flex-col items-center justify-center min-h-screen text-center p-8 bg-background text-foreground">
          {/* Large Highlight Text */} 
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-4xl">
            {/* Example structure, replace with actual aiHighlight content parsing if needed */} 
            {aiHighlight.includes("football fields") ? (
              <>
                {aiHighlight.split('-')[0]} -<br/>
                <span className="block mt-2 md:mt-4">{aiHighlight.split('-')[1]?.trim()}</span>
                <span className="block text-4xl md:text-5xl mt-4">🏈💨</span>
              </>
            ) : (
              aiHighlight // Render plain text if specific pattern not found
            )}
          </h2>

          {/* Scroll Down Indicator */} 
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center text-muted-foreground animate-bounce">
            <span className="text-sm mb-1">Scroll for Details</span>
            <LucideChevronDown className="h-6 w-6" />
          </div>
        </div>
      )}
      
      {/* Show loading indicator if highlight is loading and main workout is ready */} 
      {isLoadingHighlight && !isLoading && (
         <div className="flex items-center justify-center min-h-screen">
             <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                 <span>Loading AI Highlight...</span>
             </div>
         </div>
      )}

      {/* --- Section 2: Main Workout Details Container --- */}
      {/* Render this section only AFTER initial loading is complete */} 
      {!isLoading && (
          <div className="container mx-auto px-4 py-8">
            {/* Header Section (Back button, Title, Edit/Delete) */}
            <div className="flex items-center mb-6">
               {/* Add back button specific to this section */} 
               <Button variant="ghost" size="sm" className="mr-4" onClick={() => router.back()}>
                 <LucideArrowLeft className="h-4 w-4 mr-2" />
                 Back
               </Button>
              <div className="flex-1">
                 <h1 className="text-3xl font-bold tracking-tight">{workout.name || 'Workout Details'}</h1>
                 <div className="flex items-center mt-1">
                   {workout.type && <Badge className="mr-2">{workout.type}</Badge>}
                   {workout.intensity && 
                     <Badge
                       variant={
                         workout.intensity === "High" ? "destructive" : workout.intensity === "Medium" ? "secondary" : "outline"
                       }
                     >
                       {workout.intensity}
                     </Badge>
                   }
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   size="icon"
                   onClick={() => router.push(`/workouts/${workout._id}/edit`)}
                   title="Edit Workout"
                 >
                   <LucidePencil className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleDelete} disabled={isDeleting} title="Delete Workout">
                   {isDeleting ? (
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive"></div>
                   ) : (
                     <LucideTrash className="h-4 w-4 mr-2" />
                   )}
                   Delete
                 </Button>
               </div>
             </div>
        
             {/* Stats Cards (Date, Duration, Distance, Volume) */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                 <Card>
                 <CardHeader className="pb-2">
                     <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                     <LucideCalendarDays className="h-4 w-4 mr-2" />
                     Date
                     </CardTitle>
                 </CardHeader>
                 <CardContent>
                     <div className="text-2xl font-bold">{formatDate(workout.date)}</div>
                 </CardContent>
                 </Card>
                 <Card>
                 <CardHeader className="pb-2">
                     <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                     <LucideClock className="h-4 w-4 mr-2" />
                     Duration
                     </CardTitle>
                 </CardHeader>
                 <CardContent>
                     <div className="text-2xl font-bold">{formatDuration(workout.duration)}</div>
                 </CardContent>
                 </Card>
                 {(workout.distance || workout.cardioDetails?.distance) && (
                 <Card>
                     <CardHeader className="pb-2">
                     <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                         <LucideRuler className="h-4 w-4 mr-2" />
                         Distance
                     </CardTitle>
                     </CardHeader>
                     <CardContent>
                     <div className="text-2xl font-bold">
                         {`${Number(workout.distance || workout.cardioDetails?.distance || 0).toFixed(1)} km`}
                     </div>
                     </CardContent>
                 </Card>
                 )}
                 {workout.type === 'strength' && workout.calculatedVolume > 0 && (
                 <Card>
                     <CardHeader className="pb-2">
                     <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                         <LucideDumbbell className="h-4 w-4 mr-2" />
                         Volume
                     </CardTitle>
                     </CardHeader>
                     <CardContent>
                     <div className="text-2xl font-bold">
                         {`${(workout.calculatedVolume / 1000).toFixed(1)} tons`}
                     </div>
                     </CardContent>
                 </Card>
                 )}
             </div>
        
             {/* Display AI Workout Highlight (Small version) */}
             <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
               <CardHeader>
                   <CardTitle className="flex items-center text-lg">
                       <LucideBrainCircuit className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                       AI Workout Highlight
                   </CardTitle>
               </CardHeader>
               <CardContent>
                   {isLoadingHighlight ? (
                       <div className="flex items-center space-x-2 text-muted-foreground">
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                           <span>Generating highlight...</span>
                       </div>
                   ) : (
                       <p className="text-muted-foreground italic">{aiHighlight || 'No highlight available.'}</p>
                   )}
               </CardContent>
             </Card>
        
             {/* Exercises Performed Card */}
             <Card className="mb-6">
                 <CardHeader>
                 <CardTitle className="flex items-center">
                     <LucideDumbbell className="h-5 w-5 mr-2 text-primary" />
                     Exercises Performed
                 </CardTitle>
                 </CardHeader>
                 <CardContent>
                 {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                     <ul className="space-y-4">
                     {workout.workoutExercises.map((exerciseDetail: any, index: number) => (
                         <li key={exerciseDetail.exerciseId?._id || index} className="border-b pb-4 last:border-b-0">
                         <h3 className="text-lg font-medium mb-2">
                             {index + 1}. {exerciseDetail.exerciseId?.name || 'Unknown Exercise'}
                         </h3>
                         <div className="space-y-2 pl-4">
                             {exerciseDetail.sets && exerciseDetail.sets.length > 0 && (
                             <div>
                                 <h4 className="font-semibold mb-1">Sets:</h4>
                                 <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                 {exerciseDetail.sets.map((set: any, setIndex: number) => (
                                     <li key={setIndex}>
                                     Set {setIndex + 1}: 
                                     {set.weight !== undefined ? ` ${set.weight}kg` : ''}
                                     {set.reps !== undefined ? ` x ${set.reps} reps` : ''}
                                     {set.duration !== undefined ? ` for ${set.duration}s` : ''}
                                     {set.distance !== undefined ? ` for ${set.distance}m` : ''}
                                     {set.notes ? ` (${set.notes})` : ''}
                                     </li>
                                 ))}
                                 </ul>
                             </div>
                             )}
                             {exerciseDetail.duration !== undefined && exerciseDetail.duration > 0 && (!exerciseDetail.sets || exerciseDetail.sets.length === 0) && (
                             <div>
                                 <h4 className="font-semibold mb-1">Performance:</h4>
                                 <p className="text-sm text-muted-foreground">Duration: {formatDuration(exerciseDetail.duration)}</p> 
                                 {exerciseDetail.distance !== undefined && <p className="text-sm text-muted-foreground">Distance: {exerciseDetail.distance} m</p>} 
                             </div>
                             )}
                             {exerciseDetail.notes && (
                             <div className="mt-2">
                                 <h4 className="font-semibold mb-1">Notes:</h4>
                                 <p className="text-sm text-muted-foreground">{exerciseDetail.notes}</p>
                             </div>
                             )}
                         </div>
                         </li>
                     ))}
                     </ul>
                 ) : (
                     <p className="text-muted-foreground">No specific exercises were recorded for this workout.</p>
                 )}
                 </CardContent>
             </Card>
        
             {/* Overall Workout Notes Card */}
             {workout.notes && (
                 <Card className="mb-6">
                     <CardHeader>
                     <CardTitle>Notes</CardTitle>
                     </CardHeader>
                     <CardContent>
                     <p className="text-muted-foreground whitespace-pre-wrap">{workout.notes}</p>
                     </CardContent>
                 </Card>
             )}
              
             {/* AI Workout Analysis Section */}
             <Card className="mb-6 border-purple-200 dark:border-purple-800">
                 <CardHeader>
                 <CardTitle className="flex items-center text-lg">
                     <LucideBrainCircuit className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                     AI Workout Analysis
                 </CardTitle>
                 <CardDescription>
                     Get personalized feedback on your {workout.name || 'workout'} from {formatDate(workout.date)}
                 </CardDescription>
                 </CardHeader>
                 <CardContent>
                 <WorkoutAnalysis 
                     workout={workout} 
                 />
                 </CardContent>
             </Card>
        
             {/* Footer Links */}
             <div className="flex justify-between items-center mt-8 pt-4 border-t">
                 <Button variant="outline" asChild>
                 <Link href="/workouts">Back to Workouts List</Link>
                 </Button>
             </div>
          </div>
      )} 
    </>
  )
}

