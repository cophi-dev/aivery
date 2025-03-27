import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import WorkoutListView from "@/components/workout-list-view"
import type { WorkoutData } from "@/types/db"

export const dynamic = 'force-dynamic'

export default async function WorkoutsPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  const userId = session.user.id
  const workouts = await getWorkoutsByUserId(userId)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
          <p className="text-muted-foreground mt-2">Track and manage your training sessions</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link href="/workout/new">
            <Button size="lg">
              <LucidePlus className="mr-2 h-5 w-5" />
              New Workout
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle>Workout History</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkoutListView initialWorkouts={workouts as WorkoutData[]} />
        </CardContent>
      </Card>
    </div>
  )
}

