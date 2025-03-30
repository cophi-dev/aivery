import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ruler, Timer, Activity, Dumbbell, Pencil, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Workout {
  id: string
  type: string
  duration: number
  distance?: number
  cardioDetails?: {
    distance?: number
    pace?: number
  }
  intensity?: string
  date: Date
  name?: string
  notes?: string
}

interface WorkoutCardProps {
  workout: Workout
}

export function WorkoutCard({ workout }: WorkoutCardProps) {
  const distance = workout.distance || workout.cardioDetails?.distance
  const pace = distance ? (workout.duration / distance).toFixed(2) : undefined

  return (
    <Card className="w-full group hover:shadow-md transition-shadow relative">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {workout.type === 'running' && <Activity className="h-5 w-5" />}
              {workout.type === 'strength' && <Dumbbell className="h-5 w-5" />}
              <span className="font-medium capitalize">
                {workout.name || workout.type}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={workout.intensity === 'High' ? 'destructive' : 'secondary'}>
                {workout.intensity || 'Unknown'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span>{workout.duration} minutes</span>
            </div>
            
            {distance && (
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span>{distance.toFixed(2)} km</span>
              </div>
            )}

            {pace && (
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span>{pace} min/km</span>
              </div>
            )}
          </div>

          {workout.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workout.notes}
            </p>
          )}
          
          {/* Action buttons - separate from the card link */}
          <div className="flex justify-between mt-2 z-20 relative">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/workout/${workout.id}`}>
                View Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild>
              <Link href={`/workout/edit/${workout.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 