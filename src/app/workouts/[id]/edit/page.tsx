"use client" // Required for using hooks like useSearchParams

import { useSearchParams, useParams } from 'next/navigation'
import NewWorkoutPage from '@/app/workouts/new/page'
import { Suspense } from 'react'

// Helper component to access params and pass them via search params
function EditWorkoutRenderer() {
  const params = useParams()
  
  // Add null check for params
  if (!params) {
    // Handle the case where params are null, perhaps show an error or redirect
    return <div>Error: Could not load workout ID. Invalid route.</div>;
  }
  
  const workoutId = params.id as string

  // We simulate passing the ID via search params to the NewWorkoutPage
  // Create a URLSearchParams object to easily manage query parameters
  const searchParams = new URLSearchParams();
  if (workoutId) {
    searchParams.set('edit', workoutId);
  }

  // Re-render NewWorkoutPage, passing the 'edit' search param
  // We need access to the *original* useSearchParams hook within NewWorkoutPage,
  // so we don't directly pass props here. Instead, we rely on NewWorkoutPage
  // reading the ?edit=... parameter from the URL itself.
  // Note: This approach assumes NewWorkoutPage correctly uses useSearchParams().
  // Since the component needs searchParams, wrap it in Suspense
  return <NewWorkoutPage />
}


export default function EditWorkoutPage() {
  // Need Suspense because EditWorkoutRenderer uses useParams/useSearchParams
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <EditWorkoutRenderer />
    </Suspense>
  )
} 