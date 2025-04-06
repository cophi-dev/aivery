"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LucideArrowLeft,
  LucideDumbbell,
  LucideFootprints,
  LucideWaves,
  LucideBike,
  LucideHeartPulse,
} from "lucide-react"

export default function NewActivityPage() {
  const router = useRouter()
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)

  const activityTypes = [
    {
      id: "strength",
      name: "Strength Training",
      icon: <LucideDumbbell className="h-8 w-8" />,
      description: "Weight lifting, bodyweight exercises, resistance training",
      color: "bg-orange-500/10 text-orange-500",
    },
    {
      id: "running",
      name: "Running",
      icon: <LucideFootprints className="h-8 w-8" />,
      description: "Outdoor runs, treadmill, track workouts, jogging",
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      id: "swimming",
      name: "Swimming",
      icon: <LucideWaves className="h-8 w-8" />,
      description: "Pool swimming, open water, different strokes",
      color: "bg-cyan-500/10 text-cyan-500",
    },
    {
      id: "cycling",
      name: "Cycling",
      icon: <LucideBike className="h-8 w-8" />,
      description: "Road cycling, mountain biking, indoor cycling, spinning",
      color: "bg-green-500/10 text-green-500",
    },
    {
      id: "hiit",
      name: "HIIT",
      icon: <LucideHeartPulse className="h-8 w-8" />,
      description: "High-intensity interval training, circuit training",
      color: "bg-red-500/10 text-red-500",
    },
  ]

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivity(activityId)

    // Navigate to the appropriate form based on activity type
    if (activityId === "strength") {
      router.push("/workouts/new")
    } else {
      alert(`Logging ${activityId} workouts is not yet implemented.`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mr-2">
            <LucideArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Log Activity</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {activityTypes.map((activity) => (
          <div
            key={activity.id}
            className={`cursor-pointer rounded-xl border transition-all duration-200 ${
              selectedActivity === activity.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleActivitySelect(activity.id)}
          >
            <div className="p-4 flex flex-col items-center text-center h-full">
              <div
                className={`p-5 rounded-full mb-3 ${
                  selectedActivity === activity.id ? activity.color : "bg-muted"
                }`}
              >
                {activity.icon}
              </div>
              <h3 className="font-medium text-sm">{activity.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

