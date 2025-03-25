"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LucideArrowLeft,
  LucideDumbbell,
  LucideActivity,
  LifeBuoyIcon as LucideSwimming,
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
      icon: <LucideDumbbell className="h-6 w-6" />,
      description: "Weight lifting, bodyweight exercises, resistance training",
    },
    {
      id: "running",
      name: "Running",
      icon: <LucideActivity className="h-6 w-6" />,
      description: "Outdoor runs, treadmill, track workouts, jogging",
    },
    {
      id: "swimming",
      name: "Swimming",
      icon: <LucideSwimming className="h-6 w-6" />,
      description: "Pool swimming, open water, different strokes",
    },
    {
      id: "cycling",
      name: "Cycling",
      icon: <LucideBike className="h-6 w-6" />,
      description: "Road cycling, mountain biking, indoor cycling, spinning",
    },
    {
      id: "hiit",
      name: "HIIT",
      icon: <LucideHeartPulse className="h-6 w-6" />,
      description: "High-intensity interval training, circuit training",
    },
  ]

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivity(activityId)

    // Navigate to the appropriate form based on activity type
    if (activityId === "strength") {
      router.push("/workout/new")
    } else {
      router.push(`/activity/${activityId}/new`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Log Activity</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose Activity Type</CardTitle>
          <CardDescription>Select the type of activity you want to log</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activityTypes.map((activity) => (
              <Card
                key={activity.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  selectedActivity === activity.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => handleActivitySelect(activity.id)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div
                    className={`p-3 rounded-full mb-4 ${
                      selectedActivity === activity.id ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {activity.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{activity.name}</h3>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

