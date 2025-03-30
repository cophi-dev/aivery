import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ruler, Timer, Activity, Dumbbell } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

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
  volume?: number
  exercises?: Array<{
    name: string;
    sets: Array<{
      weight: number;
      reps: number;
    }>;
  }>;
}

interface WorkoutCardProps {
  workout: Workout
}

export function WorkoutCard({ workout }: WorkoutCardProps) {
  const distance = workout.distance || workout.cardioDetails?.distance
  const pace = distance ? (workout.duration / distance).toFixed(2) : undefined
  
  const formatDate = (date: Date) => {
    try {
      return format(date, "EEE, MMM d")
    } catch (e) {
      return "Unknown date"
    }
  }
  
  // Get icon based on workout type
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "running":
        return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4v16"></path>
          <path d="M17 4v16"></path>
          <path d="M21 4v16"></path>
          <path d="M8 8l-5 3v5l5 3z"></path>
        </svg>
      case "cycling":
        return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      case "swimming":
        return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h20"></path>
          <path d="M4 8c1.333-1.333 2.667-2 4-2 1.333 0 2.667.667 4 2 1.333 1.333 2.667 2 4 2 1.333 0 2.667-.667 4-2"></path>
          <path d="M4 16c1.333-1.333 2.667-2 4-2 1.333 0 2.667.667 4 2 1.333 1.333 2.667 2 4 2 1.333 0 2.667-.667 4-2"></path>
        </svg>
      case "strength":
        return <Dumbbell className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }
  
  // Get workout volume
  const getVolume = () => {
    if (workout.type.toLowerCase() === "running" || 
        workout.type.toLowerCase() === "cycling" || 
        workout.type.toLowerCase() === "swimming") {
      return distance ? `${distance.toFixed(1)} km` : "";
    } else if (workout.type.toLowerCase() === "strength") {
      // Calculate total volume if not stored directly
      if (workout.volume !== undefined) {
        return `${workout.volume.toFixed(0)} kg`;
      }
      
      let totalVolume = 0;
      if (workout.exercises && workout.exercises.length > 0) {
        workout.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            totalVolume += set.weight * set.reps;
          });
        });
      }
      return totalVolume > 0 ? `${totalVolume.toFixed(0)} kg` : "";
    }
    return "";
  }

  return (
    <Link href={`/workout/${workout.id}`} className="block">
      <Card className="w-full hover:shadow-sm transition-shadow border-muted/60">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="font-medium text-sm">{formatDate(new Date(workout.date))}</div>
                <div className="flex items-center mt-0.5">
                  {getTypeIcon(workout.type)}
                  <span className="text-xs ml-1 capitalize">
                    {workout.name || workout.type}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <Badge variant={workout.intensity === 'High' ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                  {workout.intensity || 'Unknown'}
                </Badge>
                <div className="text-[10px] mt-0.5 text-muted-foreground whitespace-nowrap">{getVolume()}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center">
                <Timer className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] ml-0.5">{workout.duration} min</span>
              </div>
              
              {pace && (
                <div className="flex items-center">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] ml-0.5">{pace} min/km</span>
                </div>
              )}
            </div>

            {workout.notes && (
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {workout.notes}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
} 