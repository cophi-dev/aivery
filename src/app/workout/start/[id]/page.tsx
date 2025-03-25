"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createWorkoutFromExisting, fetchWorkout } from "@/lib/workout-actions"
import { LucideArrowLeft } from "lucide-react"

// This component acts as a bridge that copies the workout and redirects to the session page
export default function StartWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // On load, copy the workout and redirect
  useEffect(() => {
    const prepareWorkout = async () => {
      try {
        // Fetch the original workout
        const workout = await fetchWorkout(params.id)
        
        if (!workout) {
          setError("Workout not found. Please try another workout.")
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
        setError("Something went wrong while preparing your workout.")
      }
    }
    
    prepareWorkout()
  }, [params.id, router])
  
  // Display a loading message or error state
  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
      {error ? (
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">{error}</h1>
          <Button asChild>
            <Link href="/plan">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Back to Workout Plan
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mb-4"></div>
          <h1 className="text-2xl font-bold">Preparing your workout...</h1>
          <p className="text-muted-foreground mt-2">Please wait while we set up your workout session.</p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href="/plan">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Link>
          </Button>
        </>
      )}
    </div>
  )
} 