import { getWorkoutById } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  Timer,
  Ruler,
  ArrowLeft,
  Pencil,
  Heart,
  TrendingUp,
  Zap,
  BarChart
} from "lucide-react"
import { format } from "date-fns"

interface CardioDetails {
  distance?: number
  pace?: number
  heartRate?: {
    average?: number
    max?: number
  }
  elevationGain?: number
  power?: {
    average?: number
  }
}

interface Workout {
  id: string
  type: string
  name?: string
  duration: number
  distance?: number
  intensity: string
  date: Date
  notes?: string
  cardioDetails?: CardioDetails
}

export default async function WorkoutPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/signin")
  }

  const workout = await getWorkoutById(params.id) as Workout | null
  if (!workout) {
    redirect("/calendar")
  }

  const distance = workout.distance || workout.cardioDetails?.distance
  const pace = distance ? (workout.duration / distance).toFixed(2) : undefined
  const avgHeartRate = workout.cardioDetails?.heartRate?.average
  const maxHeartRate = workout.cardioDetails?.heartRate?.max
  const elevationGain = workout.cardioDetails?.elevationGain
  const power = workout.cardioDetails?.power?.average

  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/calendar">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to calendar</span>
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6" />
            <h1 className="text-2xl font-bold">{workout.name || workout.type}</h1>
            <Badge variant={workout.intensity === 'High' ? 'destructive' : 'secondary'}>
              {workout.intensity}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {format(new Date(workout.date), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button asChild>
          <Link href={`/workout/edit/${workout.id}`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Workout
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{workout.duration} min</span>
            </div>
          </CardContent>
        </Card>

        {distance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Distance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{distance.toFixed(2)} km</span>
              </div>
            </CardContent>
          </Card>
        )}

        {pace && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Pace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{pace} min/km</span>
              </div>
            </CardContent>
          </Card>
        )}

        {avgHeartRate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Heart Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{avgHeartRate} bpm</span>
                {maxHeartRate && (
                  <span className="text-sm text-muted-foreground ml-2">
                    max {maxHeartRate}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {elevationGain && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Elevation Gain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{elevationGain} m</span>
              </div>
            </CardContent>
          </Card>
        )}

        {power && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Power
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{power} W</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {workout.notes && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{workout.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              AI Workout Analysis
            </CardTitle>
            <Button>
              Analyze Workout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Get personalized feedback on your workout including:
          </p>
          <ul className="mt-4 space-y-2">
            <li className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Pace and effort analysis
            </li>
            <li className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Heart rate zone breakdown
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Progress tracking compared to previous workouts
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Recovery recommendations
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

