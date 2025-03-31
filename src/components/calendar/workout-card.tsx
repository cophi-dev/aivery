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
        return <svg className="h-4 w-4" viewBox="0 0 512 512" fill="currentColor">
          <g>
            <path d="M370.14 457.06v-7a39.86 39.86 0 0 0-24.48-36.73L331 364.87l12.82-38.68c4.48 5.9 12 11.35 23.92 14.52l3.07-11.6c-16.64-4.41-20.19-13.2-20.8-18.25h.52a24.75 24.75 0 0 0 8.49-48l18.27-36.26 103.65-117.21-9-8-104.68 118.44-16.06 31.87a35.21 35.21 0 0 0-34.31-10.26l-5.82 1.46a23.72 23.72 0 0 1-15.48-44.65 8.48 8.48 0 0 0 4.81-9.31l11.43-7.69 90.24-132.12-9.91-6.76-88.93 130.21-8.23 5.53a16.09 16.09 0 0 0-18.17-3.93L183.69 214A23.87 23.87 0 0 0 171 244.61l64.72 161.53 53.43 51.49H94.55v12h316.66v-12h-41.1c.01-.19.03-.38.03-.57zm-17.21-158.41 7-21.14a12.76 12.76 0 0 1-7 21.14z" />
            <path d="M327.92 414.88a33.8 33.8 0 0 1 33.8 33.8v7a6.57 6.57 0 0 1-6.57 6.57h-39.71a34.32 34.32 0 0 1-23.82-9.61l-53.24-51.3L174.14 241a17.73 17.73 0 0 1 9.49-22.9l93.13-39.78a10.09 10.09 0 0 1 13.24 5.39l1.93 4.58a2.42 2.42 0 0 1-1.24 3.15a29.72 29.72 0 0 0-15.42 38.14a29.71 29.71 0 0 0 34.81 17.8l5.83-1.46a29.09 29.09 0 0 1 34.74 19.22l2.07 6.36l-30.46 91.95l16.58 54.76" />
          </g>
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