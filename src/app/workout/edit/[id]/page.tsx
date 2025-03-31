"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function EditWorkoutRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  useEffect(() => {
    // Check for query parameters
    const searchParams = new URLSearchParams(window.location.search);
    const duplicateIndex = searchParams.get('duplicate');
    
    // Build the redirect URL
    let redirectUrl = `/workout/new?edit=true&id=${params.id}`;
    
    // If we have a duplicate exercise instruction, add it to the URL
    if (duplicateIndex) {
      redirectUrl += `&duplicate=${duplicateIndex}`;
    }
    
    // Redirect to the new workout page with appropriate parameters
    router.push(redirectUrl);
  }, [params.id, router])
  
  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-lg font-medium mb-2">Redirecting to editor...</h2>
        <p className="text-muted-foreground">Please wait while we prepare your workout for editing.</p>
      </div>
    </div>
  )
}

