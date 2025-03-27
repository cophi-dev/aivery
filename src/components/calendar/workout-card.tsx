import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ruler, Timer, Activity, Dumbbell, Pencil } from "lucide-react"
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
    <Card className="w-full group hover:shadow-md transition-shadow">
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
              <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/workout/edit/${workout.id}`}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit workout</span>
                </Link>
              </Button>
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

          <Link 
            href={`/workout/${workout.id}`} 
            className="absolute inset-0 z-10"
            aria-label={`View details for ${workout.name || workout.type} workout`}
          >
            <span className="sr-only">View workout details</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
} 