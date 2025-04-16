"use client"

import { useState, useEffect } from "react"
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
  LucideGauge
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { formatDate, formatDuration } from "@/lib/utils"
import { getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository"
import { WorkoutAnalysis } from "@/components/workout-analysis"

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary"> {/* Use primary background */}
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-start"></div> {/* Use accent color */}
      </div>
    )
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
  const formattedDuration = workout.duration ? formatDuration(workout.duration) : "N/A";
  const formattedDistance = workout.type !== 'strength' && workout.distance ? `${workout.distance.toFixed(2)} km` : null; // Conditional distance formatting

  // Determine overall workout type category (strength or cardio)
  const workoutCategory = workout.type === 'strength' ? 'strength' : 'cardio'; // Simplified category

  // --- Main Render ---
  return (
    <>
      {/* --- Section 1: Full-Screen AI Highlight (Fun Fact) --- */}
      {/* Only render if highlight is loaded and available */}
      {aiHighlight && !isLoadingHighlight && (
        <div className="relative flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center p-8 bg-primary text-primary-dark-bg"> {/* Use calculated height */}
          {/* Large Highlight Text - Reverted font size */}
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-4xl text-primary-dark-bg">
            {/* Removed inner div */}
            {/* Example structure, replace with actual aiHighlight content parsing if needed */}
            {/* This simple split assumes a ' - ' separator; adjust if AI format changes */}
            {aiHighlight.includes('-') ? (
              <>
                {aiHighlight.split('-')[0].trim()} -<br/>
                <span className="block mt-2 md:mt-4 text-secondary-dark-bg/90">{aiHighlight.split('-')[1]?.trim()}</span>
                {/* Optional: Add a relevant large emoji if pattern matches */}
                {/* {aiHighlight.includes("football fields") && <span className="block text-4xl md:text-5xl mt-4">🏈💨</span>} */}
              </>
            ) : (
              aiHighlight // Render plain text if specific pattern not found
            )}
          </h2>

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
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6 bg-secondary/10 border border-secondary/20"> {/* Adjusted style */}
                  <TabsTrigger value="overview" className="data-[state=active]:bg-accent-start/20 data-[state=active]:text-primary-dark-bg text-secondary-dark-bg">
                      <LucideActivity className="h-4 w-4 mr-1" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="details" className="data-[state=active]:bg-accent-start/20 data-[state=active]:text-primary-dark-bg text-secondary-dark-bg">
                      <LucideDumbbell className="h-4 w-4 mr-1" /> {workoutCategory === 'strength' ? 'Exercises' : 'Metrics'}
                  </TabsTrigger>
                  {/* Add Analysis Tab */}
                  <TabsTrigger value="analysis" className="data-[state=active]:bg-accent-start/20 data-[state=active]:text-primary-dark-bg text-secondary-dark-bg">
                     <LucideBarChart className="h-4 w-4 mr-1" /> Analysis
                  </TabsTrigger>
                </TabsList>

                {/* --- Overview Tab --- */}
                <TabsContent value="overview">
                  <Card className="bg-secondary/5 border border-secondary/10 shadow-md"> {/* Subtle card style */}
                    <CardHeader>
                       <CardTitle className="text-2xl font-semibold text-primary-dark-bg flex items-center">
                          {getWorkoutIcon(workout.type)}
                          Workout Summary
                       </CardTitle>
                       <CardDescription className="text-secondary-dark-bg">{workout.notes || "No notes provided for this workout."}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6 text-primary-dark-bg">
                       {/* Stat Item: Duration */}
                       <div className="flex items-center">
                         <LucideClock className="h-6 w-6 mr-3 text-accent-start" />
                         <div>
                           <p className="text-sm text-secondary-dark-bg">Duration</p>
                           <p className="text-lg font-medium">{formattedDuration}</p>
                         </div>
                       </div>
                       {/* Stat Item: Distance (Conditional) */}
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
                       {workoutCategory === 'strength' && workout.calculatedVolume && (
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
                   <Card className="bg-secondary/5 border border-secondary/10 shadow-md">
                       <CardHeader>
                          <CardTitle className="text-2xl font-semibold text-primary-dark-bg">
                             {workoutCategory === 'strength' ? 'Exercises Breakdown' : 'Cardio Metrics'}
                          </CardTitle>
                          {workoutCategory !== 'strength' && <CardDescription className="text-secondary-dark-bg">Detailed performance metrics.</CardDescription>}
                       </CardHeader>
                       <CardContent>
                          {workoutCategory === 'strength' ? (
                             // --- Strength Exercises List ---
                             <div className="space-y-6">
                                {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                                   workout.workoutExercises.map((exercise: any, index: number) => (
                                      <div key={exercise._id || index} className="p-4 rounded-md bg-secondary/10 border border-secondary/20">
                                         <h4 className="font-semibold text-lg mb-2 text-primary-dark-bg">{exercise.name || exercise.exerciseName || `Exercise ${index + 1}`}</h4>
                                         {exercise.sets && exercise.sets.length > 0 ? (
                                            <ul className="space-y-1 text-sm text-secondary-dark-bg pl-2">
                                              {exercise.sets.map((set: any, setIndex: number) => (
                                                <li key={set._id || setIndex} className="flex justify-between items-center">
                                                    <span>Set {setIndex + 1}:</span>
                                                    <span className="text-primary-dark-bg font-medium">
                                                      {set.weight ?? 0} kg x {set.reps ?? 0} reps
                                                      {set.notes && <span className="text-xs italic text-secondary-dark-bg/70 ml-2">({set.notes})</span>}
                                                    </span>
                                                </li>
                                              ))}
                                            </ul>
                                         ) : (
                                            <p className="text-sm text-secondary-dark-bg italic">No sets recorded for this exercise.</p>
                                         )}
                                      </div>
                                   ))
                                ) : (
                                   <p className="text-secondary-dark-bg italic">No specific exercises recorded for this strength workout.</p>
                                )}
                             </div>
                          ) : (
                             // --- Cardio Metrics ---
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-primary-dark-bg">
                                {/* Add specific cardio metrics here if available, e.g., pace, heart rate zones */}
                                {/* Example: */}
                                {workout.averagePace && (
                                  <div className="flex items-center">
                                    <LucideGauge className="h-5 w-5 mr-2 text-accent-start" /> {/* Example Icon */}
                                    <div>
                                      <p className="text-sm text-secondary-dark-bg">Average Pace</p>
                                      <p className="font-medium">{workout.averagePace} min/km</p>
                                    </div>
                                  </div>
                                )}
                                {/* If no specific metrics, show a message */}
                                {!workout.averagePace && /* Add other checks */ (
                                  <p className="text-secondary-dark-bg italic md:col-span-2">No detailed cardio metrics available for this workout.</p>
                                )}
                             </div>
                          )}
                       </CardContent>
                   </Card>
                </TabsContent>

                {/* --- Analysis Tab --- */}
                <TabsContent value="analysis">
                   <Card className="bg-secondary/5 border border-secondary/10 shadow-md">
                      <CardHeader>
                         <CardTitle className="text-2xl font-semibold text-primary-dark-bg">Workout Analysis</CardTitle>
                         <CardDescription className="text-secondary-dark-bg">Performance insights and trends compared to previous similar workouts.</CardDescription>
                      </CardHeader>
                      <CardContent>
                         {/* Embed the WorkoutAnalysis component */}
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

