"use client"

import { useRouter } from "next/navigation"

export default function EditWorkoutRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()
  console.log(`[EditWorkoutRedirect] Rendering for id: ${params?.id}`);
  
  // --- Attempt direct redirect (diagnostic step) --- 
  // Note: This is not standard React practice, usually done in useEffect
  if (typeof window !== 'undefined') { // Basic check to ensure client-side
    console.log('[EditWorkoutRedirect] Attempting direct redirect...');
    const redirectUrl = `/workouts/new?edit=true&id=${params.id}`;
    try {
      router.push(redirectUrl); 
      console.log('[EditWorkoutRedirect] Direct router.push called.');
    } catch (error) {
      console.error('[EditWorkoutRedirect] Error during direct router.push:', error);
    }
  } else {
    console.log('[EditWorkoutRedirect] Skipping direct redirect on server render.');
  }
  // --- End diagnostic step ---
  
  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-lg font-medium mb-2">Redirecting to editor...</h2>
        <p className="text-muted-foreground">Please wait while we prepare your workout for editing.</p>
      </div>
    </div>
  )
}

