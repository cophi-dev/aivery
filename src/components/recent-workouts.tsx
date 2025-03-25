import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideChevronRight } from "lucide-react"

export default function RecentWorkouts() {
  const workouts = [
    {
      id: 1,
      name: "Upper Body",
      date: "Yesterday",
      duration: "65 min",
      exercises: ["Bench Press", "Shoulder Press", "Lat Pulldown", "Bicep Curls"],
      intensity: "High",
    },
    {
      id: 2,
      name: "Lower Body",
      date: "3 days ago",
      duration: "75 min",
      exercises: ["Squats", "Deadlifts", "Leg Press", "Calf Raises"],
      intensity: "High",
    },
    {
      id: 3,
      name: "Core & Cardio",
      date: "5 days ago",
      duration: "45 min",
      exercises: ["Planks", "Russian Twists", "HIIT", "Jump Rope"],
      intensity: "Medium",
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Workouts</CardTitle>
          <CardDescription>Your latest training sessions</CardDescription>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {workouts.map((workout) => (
            <div key={workout.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{workout.name}</h3>
                  <Badge
                    variant={
                      workout.intensity === "High"
                        ? "default"
                        : workout.intensity === "Medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {workout.intensity}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {workout.date} • {workout.duration}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {workout.exercises.map((exercise, i) => (
                    <Badge key={i} variant="outline" className="font-normal">
                      {exercise}
                    </Badge>
                  ))}
                </div>
              </div>
              <Link href={`/workouts/${workout.id}`}>
                <Button variant="ghost" size="icon">
                  <LucideChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

