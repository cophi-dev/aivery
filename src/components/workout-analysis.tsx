"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideBrain, LucideArrowRight } from "lucide-react"
import type { WorkoutData } from "@/types/db"

interface WorkoutAnalysisProps {
  workout: WorkoutData
  variant?: "card" | "inline"
}

export function WorkoutAnalysis({ workout, variant = "card" }: WorkoutAnalysisProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleAnalyze = () => {
    setIsLoading(true)
    router.push(`/chat?analyze=${workout._id}`)
  }

  if (variant === "inline") {
    return (
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <LucideBrain className="h-5 w-5 mr-2 text-primary" />
          AI Workout Analysis
        </h3>
        <p className="text-sm text-muted-foreground">
          Get personalized feedback and suggestions to improve your {workout.name} workout.
        </p>
        <Button onClick={handleAnalyze} disabled={isLoading} className="mt-2">
          {isLoading ? "Loading..." : "Analyze Workout"}
          <LucideArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <LucideBrain className="h-5 w-5 mr-2 text-primary" />
          AI Workout Analysis
        </CardTitle>
        <CardDescription>Get personalized feedback on your {workout.name} workout</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Aivery can analyze your workout and provide:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5 mb-4">
          <li>Feedback on exercise selection and balance</li>
          <li>Volume and intensity assessment</li>
          <li>Progress tracking compared to previous workouts</li>
          <li>Suggestions for improvement</li>
          <li>Recovery recommendations</li>
        </ul>
        <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
          {isLoading ? "Loading..." : "Analyze Workout"}
          <LucideArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

