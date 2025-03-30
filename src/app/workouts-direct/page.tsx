import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import WorkoutListView from "@/components/workout-list-view"
import type { WorkoutData } from "@/types/db"
import { VERSION } from "@/app/version"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function WorkoutsDirectPage() {
  // Get user session
  const session = await getServerSession(authOptions);
  
  // If not authenticated, show login message
  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4">
          <p>Please <Link href="/login" className="text-blue-500 underline">login</Link> to view your workouts.</p>
        </div>
      </div>
    );
  }

  try {
    // Fetch workouts for the authenticated user
    const workouts = await getWorkoutsByUserId(session.user.id);
    const shortVersion = VERSION.substring(0, 8);
    const timestamp = new Date().toISOString();

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
            <p className="text-muted-foreground mt-2">Track and manage your training sessions</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link href="/workout/new" prefetch={false}>
              <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600">
                <LucidePlus className="mr-2 h-5 w-5" />
                New Workout
              </Button>
            </Link>
          </div>
        </div>

        <Card className="mb-8 border-2 border-indigo-200">
          <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-cyan-50">
            <CardTitle>Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutListView initialWorkouts={workouts as WorkoutData[]} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("Error fetching workouts:", error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4 text-red-500">Error loading workouts. Please try again later.</div>
      </div>
    );
  }
} 