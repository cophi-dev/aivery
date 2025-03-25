"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createWorkoutFromExisting, fetchWorkout } from "@/lib/workout-actions"

// This component acts as a bridge that copies the workout and redirects to the session page
export default function StartWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  // On load, copy the workout and redirect
  useEffect(() => {
    const prepareWorkout = async () => {
      try {
        // Fetch the original workout
        const workout = await fetchWorkout(params.id)
        
        if (!workout) {
          console.error("Workout not found")
          router.push("/planner")
          return
        }
        
        // Create a new workout session based on the original
        const newWorkoutId = await createWorkoutFromExisting({
          ...workout,
          date: new Date(),
        })
        
        // Redirect to the session page
        router.push(`/workout/session/${newWorkoutId}`)
      } catch (error) {
        console.error("Failed to prepare workout:", error)
        router.push("/planner")
      }
    }
    
    prepareWorkout()
  }, [params.id, router])
  
  // Display a loading message
  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mb-4"></div>
      <h1 className="text-2xl font-bold">Preparing your workout...</h1>
      <p className="text-muted-foreground mt-2">Please wait while we set up your workout session.</p>
    </div>
  )
} 