"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
  LucideChevronDown,
  LucideBarChart,
  LucideTag,
  LucideGauge,
  LucideMountain
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { formatDate, formatDuration, formatDistance, formatPace } from "@/lib/utils"
import { getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import ReactMarkdown from "react-markdown"
import Image from "next/image"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { Loader2 } from "lucide-react"

// Helper function to get icon based on workout type
const getWorkoutIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'strength': return <LucideDumbbell className="h-5 w-5 mr-2" />;
    case 'running': return <LucideActivity className="h-5 w-5 mr-2" />; // Use Activity for running too?
    case 'cycling': return <LucideActivity className="h-5 w-5 mr-2" />; // Use Activity for cycling?
    case 'walking': return <LucideActivity className="h-5 w-5 mr-2" />; // Use Activity for walking?
    case 'cardio': return <LucideHeartPulse className="h-5 w-5 mr-2" />;
    default: return <LucideActivity className="h-5 w-5 mr-2" />;
  }
};

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
      router.push("/workouts") // Navigate back to list after delete
    } catch (error) {
      console.error("Failed to delete workout:", error)
      setIsDeleting(false)
      // Add user feedback on error
      alert("Failed to delete activity. Please try again.")
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
    return <LoadingIndicator />
  }

  // Error State / Workout Not Found
  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-screen bg-primary text-primary-dark-bg"> {/* Adjusted padding & background */}
        <div className="text-center bg-secondary/10 p-8 rounded-lg shadow-lg"> {/* Optional card-like bg */}
          <h1 className="text-3xl font-bold mb-4 text-primary-dark-bg">Activity Not Found</h1>
          <p className="mt-2 text-secondary-dark-bg mb-6">{error || "The requested workout could not be loaded."}</p>
          <Button asChild variant="outline" className="text-primary-dark-bg border-secondary-dark-bg hover:bg-secondary/20"> {/* Adjusted button style */}
            <Link href="/workouts">Back to Workouts</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Format details for display using imported utilities
  const formattedDate = workout.date ? formatDate(workout.date) : "N/A"; // Use default format from utility
  const formattedDuration = formatDuration(workout.duration);
  
  // Get distance (assuming it's stored in KILOMETERS)
  let distanceKm: number | null = null;

  if (workout.type !== 'strength') {
    if (workout.cardioDetails?.distance != null && typeof workout.cardioDetails.distance === 'number') {
      distanceKm = workout.cardioDetails.distance;
      console.log(`>>> Distance Source: cardioDetails (${distanceKm} km)`);
    } else if (workout.workoutExercises && workout.workoutExercises[0]?.distance != null && typeof workout.workoutExercises[0].distance === 'number') {
      distanceKm = workout.workoutExercises[0].distance; // Assuming this is also KM
      console.log(`>>> Distance Source: workoutExercises[0] (${distanceKm} km)`);
    } else if (workout.distance != null && typeof workout.distance === 'number') {
      distanceKm = workout.distance;
      console.log(`>>> Distance Source: workout.distance (${distanceKm} km)`);
    }
  }

  // Format distance (formatDistance expects KM)
  const formattedDistance = distanceKm != null && distanceKm >= 0 ? formatDistance(distanceKm) : null;
  
  // Calculate pace if possible (needs distance in KM and duration in SECONDS)
  let formattedPace: string | null = null;
  if (distanceKm != null && distanceKm > 0 && workout.duration != null && workout.duration > 0) {
    // --- DEBUG LOGGING START ---
    console.log(`Pace Calculation Input: duration=${workout.duration}s, distance=${distanceKm}km`);
    // Pace (min/km) = (Duration in seconds / 60) / Distance in km
    const paceMinPerKm = (workout.duration / 60) / distanceKm;
    console.log(`Pace Calculation Output: paceMinPerKm=${paceMinPerKm}`);
    // --- DEBUG LOGGING END ---
    formattedPace = formatPace(paceMinPerKm);
  } else if (workout.cardioDetails?.pace != null) {
    // Fallback to stored pace if available
    formattedPace = formatPace(workout.cardioDetails.pace);
  }

  // Determine overall workout type category (strength or cardio)
  const workoutCategory = workout.type === 'strength' ? 'strength' : 'cardio'; // Simplified category

  // Render the standard workout details page (including the AI highlight card)
  return (
    <>
      {/* --- Section 1: Full-Screen AI Highlight (Fun Fact) - Use workout.aiHighlight --- */}
      {workout && workout.aiHighlight && (
        <div
          className="relative flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center p-6 md:p-8 text-primary-dark-bg"
          style={{ backgroundColor: 'hsl(var(--background))' }}
        >
          <div className="text-2xl md:text-4xl lg:text-5xl font-bold leading-normal text-primary-dark-bg break-words px-4 prose prose-lg dark:prose-invert max-w-prose mx-auto">
            <ReactMarkdown>
              {workout.aiHighlight}
            </ReactMarkdown>
          </div>
          <a href="#details" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <Button variant="ghost" size="icon" className="rounded-full text-secondary-dark-bg/70 hover:bg-secondary/10 hover:text-secondary-dark-bg">
              <LucideChevronDown className="h-8 w-8" />
              <span className="sr-only">Scroll for details</span>
            </Button>
          </a>
        </div>
      )}

      {/* --- Section 2: Main Workout Details Container (ensure id="details" exists) --- */}
      <div className="py-8 md:py-12" id="details">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex items-center justify-between mb-8">
              {/* Back Button */}
              <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                <LucideArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>

              {/* Edit and Delete Buttons - Adjust variants */}
              <div className="flex space-x-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/workouts/${id}/edit`}>
                    <LucidePencil className="h-4 w-4 mr-1" /> Edit
                  </Link>
                </Button>
                <Button
                  variant="destructive" // Standard destructive
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <LucideTrash className="h-4 w-4 mr-1" /> {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>

            {/* --- Workout Title and Date - Remove gradient, use theme colors */}
            <div className="mb-8 text-center md:text-left">
               <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
                 {workout.name || "Workout Details"}
               </h1>
               <p className="text-lg text-muted-foreground flex items-center justify-center md:justify-start">
                 <LucideCalendarDays className="h-5 w-5 mr-2 opacity-80" />
                 {formattedDate}
               </p>
            </div>
          </div>

          {/* Tabs for Exercises/Analysis */}
          <Tabs defaultValue="exercises">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6">
              <TabsTrigger value="overview">
                  <LucideActivity className="h-4 w-4 mr-1" /> Overview
              </TabsTrigger>
              <TabsTrigger value="details">
                  <LucideDumbbell className="h-4 w-4 mr-1" /> {workoutCategory === 'strength' ? 'Exercises' : 'Metrics'}
              </TabsTrigger>
              <TabsTrigger value="analysis">
                 <LucideBarChart className="h-4 w-4 mr-1" /> Analysis
              </TabsTrigger>
            </TabsList>

            {/* --- Overview Tab - Wrap content in Card */} 
            <TabsContent value="overview">
              <Card className="rounded-xl shadow-sm bg-card p-6"> {/* New wrapper card */}
                <div className="space-y-6"> {/* Add inner spacing */}
                  {/* Workout Summary Section */}
                  <div>
                    <CardTitle className="text-xl font-semibold flex items-center mb-2">
                        {getWorkoutIcon(workout.type)}
                        Workout Summary
                    </CardTitle>
                    <CardDescription>{workout.notes || "No notes provided for this workout."}</CardDescription>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t">
                    {/* Stat Item: Duration */}
                    <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Duration</p>
                        <p className="text-lg font-medium flex items-center"><LucideClock className="h-4 w-4 mr-1.5 text-muted-foreground" />{formattedDuration}</p>
                    </div>
                    {/* ... other stats (Distance, Volume, Type, HR, Location) - styled similarly ... */}
                    {formattedDistance && (
                      <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Distance</p>
                        <p className="text-lg font-medium flex items-center"><LucideRuler className="h-4 w-4 mr-1.5 text-muted-foreground" />{formattedDistance}</p>
                      </div>
                    )}
                    {workoutCategory === 'strength' && typeof workout.calculatedVolume === 'number' && (
                      <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Total Volume</p>
                        <p className="text-lg font-medium flex items-center"><LucideZap className="h-4 w-4 mr-1.5 text-muted-foreground" />{workout.calculatedVolume.toLocaleString()} kg</p>
                      </div>
                    )}
                    <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Type</p>
                        <p className="text-lg font-medium capitalize flex items-center"><LucideTag className="h-4 w-4 mr-1.5 text-muted-foreground" />{workout.type}</p>
                    </div>
                    {workout.averageHeartRate && (
                      <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Avg. Heart Rate</p>
                        <p className="text-lg font-medium flex items-center"><LucideHeartPulse className="h-4 w-4 mr-1.5 text-muted-foreground" />{workout.averageHeartRate} bpm</p>
                      </div>
                    )}
                    {workout.location && (
                      <div className="flex flex-col">
                        <p className="text-sm text-muted-foreground mb-1">Location</p>
                        <p className="text-lg font-medium flex items-center"><LucideMapPin className="h-4 w-4 mr-1.5 text-muted-foreground" />{workout.location}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Highlight Section */}
                  <div className="pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-2 flex items-center">
                        <LucideBrainCircuit className="h-5 w-5 mr-2 text-primary" />
                        AI Workout Highlight
                      </h3>
                      {isLoadingHighlight ? (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating highlight...
                        </div>
                      ) : aiHighlight ? (
                        <p className="text-muted-foreground italic">"{aiHighlight}"</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">AI highlight not available.</p>
                      )}
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* --- Details Tab - Wrap content in Card --- */}
            <TabsContent value="details">
               <Card className="rounded-xl shadow-sm bg-card p-6"> 
                  <CardTitle className="text-xl font-semibold mb-4">{workoutCategory === 'strength' ? 'Exercises' : 'Metrics'}</CardTitle>
                  {/* ... existing details content (exercise list or cardio metrics) ... */}
                  {/* Example: Styling for Exercise List items */}
                  {workoutCategory === 'strength' && workout.workoutExercises && workout.workoutExercises.length > 0 && (
                      <div className="space-y-4">
                          {workout.workoutExercises.map((exercise: any, index: number) => (
                             <div key={exercise._id || index} className="p-4 rounded-lg border border-border/60">
                                  <p className="font-medium mb-2">{exercise.exerciseId?.name || 'Unknown Exercise'}</p>
                                  {/* Style sets similar to log form */}
                                  <ul className="space-y-1 text-sm text-muted-foreground list-none pl-2">
                                      {(exercise.sets || []).map((set: any, setIndex: number) => (
                                          <li key={set._id || setIndex} className="flex justify-between items-center">
                                              <span>Set {setIndex + 1}: {set.weight || 0} kg x {set.reps || 0} reps</span>
                                              {set.notes && <span className="text-xs italic ml-2">({set.notes})</span>}
                                          </li>
                                      ))}
                                  </ul>
                                  {exercise.notes && <p className="text-xs mt-2 italic text-muted-foreground">Notes: {exercise.notes}</p>}
                              </div>
                          ))}
                      </div>
                  )}
                  {/* Example: Styling for Cardio Metrics */}
                  {workoutCategory !== 'strength' && (
                      <div className="grid grid-cols-2 gap-4">
                          {/* Display formatted Pace, HR etc. if available */}
                      </div>
                  )}
               </Card>
            </TabsContent>

            {/* --- Analysis Tab - Wrap content in Card --- */}
            <TabsContent value="analysis">
               <Card className="rounded-xl shadow-sm bg-card p-6">
                  <WorkoutAnalysis workout={workout} />
               </Card>
            </TabsContent>
          </Tabs>

          {/* Optional: Raw Data View (Could be a separate collapsible section or dev-only) */}
          {/* <details className="mt-8 text-secondary-dark-bg">
            <summary className="cursor-pointer text-sm hover:text-primary-dark-bg">View Raw Data</summary>
            <pre className="mt-2 p-4 bg-black/30 rounded text-xs overflow-x-auto">
              {JSON.stringify(workout, null, 2)}
            </pre>
          </details> */}

        </div>
      </div>
    </>
  )
}

