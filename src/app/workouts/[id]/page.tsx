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
  
  // NEW Distance Calculation (Assume stored values are METERS)
  let rawDistanceMeters: number | null = null;
  
  if (workout.type !== 'strength') { 
    if (workout.cardioDetails?.distance != null && typeof workout.cardioDetails.distance === 'number') {
        rawDistanceMeters = workout.cardioDetails.distance;
        console.log(`>>> Distance Source: cardioDetails (${rawDistanceMeters} m)`);
    } else if (workout.workoutExercises && workout.workoutExercises[0]?.distance != null && typeof workout.workoutExercises[0].distance === 'number') {
        rawDistanceMeters = workout.workoutExercises[0].distance;
        console.log(`>>> Distance Source: workoutExercises[0] (${rawDistanceMeters} m)`);
    } else if (workout.distance != null && typeof workout.distance === 'number') {
        rawDistanceMeters = workout.distance;
        console.log(`>>> Distance Source: workout.distance (${rawDistanceMeters} m)`);
    }
  }

  // Use formatDistance utility which expects meters
  const formattedDistance = rawDistanceMeters != null && rawDistanceMeters >= 0 ? formatDistance(rawDistanceMeters) : null;
  
  // Calculate pace if possible (needs distance in METERS and duration in SECONDS)
  let formattedPace: string | null = null;
  if (rawDistanceMeters != null && rawDistanceMeters > 0 && workout.duration != null && workout.duration > 0) {
    const paceMinPerKm = (workout.duration / 60) / (rawDistanceMeters / 1000);
    formattedPace = formatPace(paceMinPerKm);
  } else if (workout.cardioDetails?.pace != null) {
    // Fallback to stored pace if available
    formattedPace = formatPace(workout.cardioDetails.pace);
  }

  // Determine overall workout type category (strength or cardio)
  const workoutCategory = workout.type === 'strength' ? 'strength' : 'cardio'; // Simplified category

  // --- Main Render ---
  return (
    <>
      {/* --- Section 1: Full-Screen AI Highlight (Fun Fact) --- */}
      {/* Only render if highlight is loaded and available */}
      {aiHighlight && !isLoadingHighlight && (
        <div className="relative flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center p-6 md:p-8 bg-primary text-primary-dark-bg"> {/* Adjusted padding */}
          {/* Large Highlight Text - Use ReactMarkdown */} 
          <div className="text-2xl md:text-4xl lg:text-5xl font-bold leading-normal text-primary-dark-bg break-words px-4 prose prose-lg dark:prose-invert max-w-prose mx-auto"> {/* Added prose styles */}
            <ReactMarkdown>
              {aiHighlight} 
            </ReactMarkdown>
          </div>

          {/* Scroll Down Hint - Centered */}
          <a href="#details" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <Button variant="ghost" size="icon" className="rounded-full text-secondary-dark-bg/70 hover:bg-secondary/10 hover:text-secondary-dark-bg">
              <LucideChevronDown className="h-8 w-8" />
              <span className="sr-only">Scroll for details</span>
            </Button>
          </a>
        </div>
      )}

      {/* Show loading indicator ONLY if highlight is loading AND main workout isn't (to avoid double loaders) */}
      {isLoadingHighlight && !isLoading && (
         <div className="flex items-center justify-center min-h-screen bg-primary">
             <div className="flex flex-col items-center space-y-2 text-secondary-dark-bg">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-start"></div>
                 <span>Loading AI Highlight...</span>
             </div>
         </div>
      )}

      {/* --- Section 2: Main Workout Details Container --- */}
      {/* Render this section only AFTER initial loading is complete (workout data ready) */}
      {!isLoading && workout && ( // Also ensure workout exists before rendering details
          <div className="bg-primary text-primary-dark-bg py-8 md:py-12"> {/* Removed min-h-screen here, it's applied above */}
            <div className="container mx-auto px-4">

              {/* --- Header Section --- */}
              <div className="flex items-center justify-between mb-8">
                {/* Back Button */}
                <Button variant="ghost" onClick={() => router.back()} className="text-secondary-dark-bg hover:text-primary-dark-bg">
                  <LucideArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </Button>

                {/* Edit and Delete Buttons */}
                <div className="flex space-x-2">
                  <Button asChild variant="outline" size="sm" className="text-primary-dark-bg border-secondary-dark-bg hover:bg-secondary/20">
                    <Link href={`/workouts/${id}/edit`}>
                      <LucidePencil className="h-4 w-4 mr-1" /> Edit
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <LucideTrash className="h-4 w-4 mr-1" /> {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>

              {/* --- Workout Title and Date --- */}
              <div className="mb-8 text-center md:text-left">
                 <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-accent-start to-accent-end bg-clip-text text-transparent">
                   {workout.name || "Workout Details"}
                 </h1>
                 <p className="text-lg text-secondary-dark-bg flex items-center justify-center md:justify-start">
                   <LucideCalendarDays className="h-5 w-5 mr-2 opacity-80" />
                   {formattedDate}
                 </p>
              </div>

              {/* --- Main Content Area (Tabs or Grid) --- */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6 bg-secondary/10 rounded-md p-1">
                  <TabsTrigger 
                    value="overview" 
                    className="rounded-md transition-colors data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 text-primary-dark-bg/80 hover:bg-secondary/20 py-1.5"
                  >
                      <LucideActivity className="h-4 w-4 mr-1" /> Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="details" 
                    className="rounded-md transition-colors data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 text-primary-dark-bg/80 hover:bg-secondary/20 py-1.5"
                  >
                      <LucideDumbbell className="h-4 w-4 mr-1" /> {workoutCategory === 'strength' ? 'Exercises' : 'Metrics'}
                  </TabsTrigger>
                  {/* Add Analysis Tab */}
                  <TabsTrigger 
                    value="analysis" 
                    className="rounded-md transition-colors data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 text-primary-dark-bg/80 hover:bg-secondary/20 py-1.5"
                  >
                     <LucideBarChart className="h-4 w-4 mr-1" /> Analysis
                  </TabsTrigger>
                </TabsList>

                {/* --- Overview Tab --- */}
                <TabsContent value="overview">
                  <Card className="bg-secondary/5 border border-secondary/40 shadow-md">
                    <CardHeader>
                       <CardTitle className="text-2xl font-semibold text-primary-dark-bg flex items-center">
                          {getWorkoutIcon(workout.type)}
                          Workout Summary
                       </CardTitle>
                       <CardDescription className="text-secondary-dark-bg">{workout.notes || "No notes provided for this workout."}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6 text-primary-dark-bg p-6">
                       {/* Stat Item: Duration */}
                       <div className="flex items-center">
                         <LucideClock className="h-6 w-6 mr-3 text-accent-start" />
                         <div>
                           <p className="text-sm text-secondary-dark-bg">Duration</p>
                           <p className="text-lg font-medium">{formattedDuration}</p>
                         </div>
                       </div>
                       {/* Stat Item: Distance (Conditional) - ADDED HERE */}
                       {formattedDistance && (
                         <div className="flex items-center">
                           <LucideRuler className="h-6 w-6 mr-3 text-accent-start" />
                           <div>
                             <p className="text-sm text-secondary-dark-bg">Distance</p>
                             <p className="text-lg font-medium">{formattedDistance}</p>
                           </div>
                         </div>
                       )}
                       {/* Stat Item: Volume (Conditional) */}
                       {workoutCategory === 'strength' && typeof workout.calculatedVolume === 'number' && (
                         <div className="flex items-center">
                           <LucideZap className="h-6 w-6 mr-3 text-accent-start" /> {/* Use Zap for volume */}
                           <div>
                             <p className="text-sm text-secondary-dark-bg">Total Volume</p>
                             <p className="text-lg font-medium">{workout.calculatedVolume.toLocaleString()} kg</p>
                           </div>
                         </div>
                       )}
                        {/* Stat Item: Workout Type */}
                        <div className="flex items-center">
                           <LucideTag className="h-6 w-6 mr-3 text-accent-start" /> {/* Use Tag for type */}
                           <div>
                             <p className="text-sm text-secondary-dark-bg">Type</p>
                             <p className="text-lg font-medium capitalize">{workout.type}</p>
                           </div>
                         </div>
                         {/* Stat Item: Avg Heart Rate (Conditional) */}
                        {workout.averageHeartRate && (
                           <div className="flex items-center">
                             <LucideHeartPulse className="h-6 w-6 mr-3 text-accent-start" />
                             <div>
                               <p className="text-sm text-secondary-dark-bg">Avg. Heart Rate</p>
                               <p className="text-lg font-medium">{workout.averageHeartRate} bpm</p>
                             </div>
                           </div>
                         )}
                         {/* Stat Item: Location (Conditional) */}
                        {workout.location && (
                           <div className="flex items-center col-span-2 md:col-span-1"> {/* Allow wrapping */}
                             <LucideMapPin className="h-6 w-6 mr-3 text-accent-start" />
                             <div>
                               <p className="text-sm text-secondary-dark-bg">Location</p>
                               <p className="text-lg font-medium">{workout.location}</p>
                             </div>
                           </div>
                         )}
                    </CardContent>
                     {/* AI Highlight Section (Moved inside Overview Card) */}
                     <CardFooter className="pt-6 border-t border-secondary/10 mt-6">
                          <div className="w-full">
                               <h3 className="text-lg font-semibold mb-3 flex items-center text-primary-dark-bg">
                                 <LucideBrainCircuit className="h-5 w-5 mr-2 text-accent-end" />
                                 AI Workout Highlight
                               </h3>
                               {isLoadingHighlight ? (
                                 <div className="flex items-center text-sm text-secondary-dark-bg">
                                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-end mr-2"></div>
                                   Generating highlight...
                                 </div>
                               ) : aiHighlight ? (
                                 <p className="text-secondary-dark-bg italic">"{aiHighlight}"</p>
                               ) : (
                                 <p className="text-sm text-secondary-dark-bg">AI highlight not available.</p>
                               )}
                          </div>
                     </CardFooter>
                  </Card>
                </TabsContent>

                {/* --- Details Tab (Exercises or Cardio Metrics) --- */}
                <TabsContent value="details">
                   <Card className="bg-secondary/5 border border-secondary/40 shadow-md">
                       <CardHeader>
                          <CardTitle className="text-2xl font-semibold text-primary-dark-bg">
                             {workoutCategory === 'strength' ? 'Exercises Breakdown' : 'Cardio Metrics'}
                          </CardTitle>
                          {workoutCategory !== 'strength' && <CardDescription className="text-secondary-dark-bg">Detailed performance metrics.</CardDescription>}
                       </CardHeader>
                       <CardContent className="p-6">
                          {workoutCategory === 'strength' ? (
                             <div className="space-y-4">
                               <h3 className="text-lg font-semibold mb-3">Strength metrics</h3>
                               {/* Display Strength metrics - CHECK workoutExercises */}
                               {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                                 <ul className="space-y-3">
                                   {workout.workoutExercises.map((exercise: any, index: number) => (
                                     <li key={exercise._id || index} className="border-b pb-3 last:border-b-0"> {/* Use exercise._id for key */}
                                       <p className="font-medium text-primary-dark-bg">{exercise.exerciseId?.name || 'Unnamed Exercise'}</p> {/* Use name from populated exerciseId */}
                                       <div className="text-sm text-secondary-dark-bg grid grid-cols-3 gap-2 mt-1">
                                         {/* Map through sets if they exist */}
                                         {exercise.sets && exercise.sets.length > 0 ? (
                                           exercise.sets.map((set: any, setIndex: number) => (
                                             <React.Fragment key={set._id || setIndex}>
                                               <span>Set {setIndex + 1}</span>
                                               <span>Reps: {set.reps ?? 'N/A'}</span>
                                               <span>Weight: {set.weight != null ? `${set.weight} kg` : 'N/A'}</span>
                                             </React.Fragment>
                                           ))
                                         ) : (
                                           <span className="col-span-3 italic text-muted-foreground">No sets recorded</span>
                                         )}
                                       </div>
                                     </li>
                                   ))}
                                 </ul>
                               ) : (
                                 <p className="text-muted-foreground italic">No specific exercises logged.</p>
                               )}
                             </div>
                          ) : (
                             <div className="space-y-4">
                               <h3 className="text-lg font-semibold mb-3">Cardio metrics</h3>
                               {workout.cardioDetails ? (
                                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                   {/* --- Re-add Cardio Metric Blocks --- */}
                                   {rawDistanceMeters != null && rawDistanceMeters >= 0 && (
                                     <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                       <LucideRuler className="h-5 w-5 text-accent-medium" />
                                       <div>
                                         <p className="text-sm text-secondary-dark-bg">Distance</p>
                                         {/* Use formatDistance which handles KM conversion */}
                                         <p className="font-semibold text-primary-dark-bg">{formattedDistance || 'N/A'}</p>
                                       </div>
                                     </div>
                                   )}
                                   {workout.cardioDetails.duration != null && (
                                      <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                       <LucideClock className="h-5 w-5 text-accent-medium" />
                                       <div>
                                         <p className="text-sm text-secondary-dark-bg">Duration</p>
                                         {/* Use formattedDuration helper */}
                                         <p className="font-semibold text-primary-dark-bg">{formattedDuration}</p>
                                       </div>
                                     </div>
                                   )}
                                   {/* --- Pace Metric Block --- */}
                                   {formattedPace && (
                                     <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                       <LucideGauge className="h-5 w-5 text-accent-medium" />
                                       <div>
                                         <p className="text-sm text-secondary-dark-bg">Avg Pace</p>
                                         <p className="font-semibold text-primary-dark-bg">{formattedPace}</p>
                                       </div>
                                     </div>
                                   )}
                                   {workout.cardioDetails.elevationGain != null && (
                                     <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                       <LucideMountain className="h-5 w-5 text-accent-medium" />
                                       <div>
                                         <p className="text-sm text-secondary-dark-bg">Elevation gain</p>
                                         <p className="font-semibold text-primary-dark-bg">{workout.cardioDetails.elevationGain} m</p>
                                       </div>
                                     </div>
                                   )}
                                   {workout.cardioDetails.heartRate?.average != null && (
                                      <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                       <LucideHeartPulse className="h-5 w-5 text-accent-medium" />
                                       <div>
                                         <p className="text-sm text-secondary-dark-bg">Avg heart rate</p>
                                         <p className="font-semibold text-primary-dark-bg">{workout.cardioDetails.heartRate.average} bpm</p>
                                       </div>
                                     </div>
                                   )}
                                    {workout.cardioDetails.heartRate?.max != null && (
                                      <div className="flex items-center space-x-2 p-3 bg-secondary/10 rounded-md">
                                        <LucideHeartPulse className="h-5 w-5 text-red-500" /> {/* Maybe different color for max? */}
                                        <div>
                                         <p className="text-sm text-secondary-dark-bg">Max heart rate</p>
                                         <p className="font-semibold text-primary-dark-bg">{workout.cardioDetails.heartRate.max} bpm</p>
                                       </div>
                                     </div>
                                   )}
                                    {/* Message if cardioDetails exists but is empty */}
                                    {Object.keys(workout.cardioDetails).length === 0 && (
                                        <p className="text-muted-foreground italic sm:col-span-2 lg:col-span-3">No detailed cardio metrics logged for this session.</p>
                                    )}
                                 </div>
                               ) : (
                                 <p className="text-muted-foreground italic">No detailed cardio metrics available for this workout.</p>
                               )}
                             </div>
                          )}
                       </CardContent>
                   </Card>
                </TabsContent>

                {/* --- Analysis Tab --- */}
                <TabsContent value="analysis">
                   <Card className="bg-secondary/5 border border-secondary/40 shadow-md">
                      <CardContent className="p-6">
                         <WorkoutAnalysis workout={workout} />
                      </CardContent>
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
      )}
    </>
  )
}

