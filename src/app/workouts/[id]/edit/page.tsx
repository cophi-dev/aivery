"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditWorkoutRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    const redirectUrl = `/workouts/new?edit=true&id=${params.id}`;
    router.push(redirectUrl);
  }, [params.id, router]);

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-lg font-medium mb-2">Redirecting to editor...</h2>
        <p className="text-muted-foreground">Please wait while we prepare your workout for editing.</p>
      </div>
    </div>
  );
} 