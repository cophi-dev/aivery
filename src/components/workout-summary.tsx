import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideClock, LucideDumbbell, FlameIcon as LucideFire } from "lucide-react"

export default function WorkoutSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Last Workout Summary</CardTitle>
        <CardDescription>Upper Body - Yesterday</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-primary/10 p-2 rounded-full mr-3">
                <LucideDumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Exercises</p>
                <p className="text-muted-foreground text-sm">Total exercises completed</p>
              </div>
            </div>
            <span className="text-xl font-bold">8</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-primary/10 p-2 rounded-full mr-3">
                <LucideClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Duration</p>
                <p className="text-muted-foreground text-sm">Total workout time</p>
              </div>
            </div>
            <span className="text-xl font-bold">65 min</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-primary/10 p-2 rounded-full mr-3">
                <LucideFire className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Volume</p>
                <p className="text-muted-foreground text-sm">Total weight lifted</p>
              </div>
            </div>
            <span className="text-xl font-bold">3,240 kg</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

