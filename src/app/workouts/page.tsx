import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import WorkoutListView from "@/components/workout-list-view"
import { VERSION } from "../version"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import type { WorkoutData } from "@/types/db"

// Caching behaviour is now handled by the client component
// export const dynamic = 'force-dynamic'
// export const revalidate = 0
// export const fetchCache = 'force-no-store'

export default async function WorkoutsPage() {
  // Get user session
  const session = await getServerSession(authOptions);
  
  // If not authenticated, redirect to login
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
    // // Fetch workouts on the server
    // const workouts: WorkoutData[] = await getWorkoutsByUserId(session.user.id);
    // console.log(`[Workouts Page RSC] Fetched ${workouts.length} workouts. Newest workout ID: ${workouts[0]?._id}, Date: ${workouts[0]?.date}`);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col mb-8">
          <div className="mb-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Workouts</h1>
            <p className="text-muted-foreground mt-2">Track and manage your training sessions</p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Your Workouts</h1>
            <div className="space-x-2">
              <Link href="/workouts/new" prefetch={false}>
                <Button>
                  <LucidePlus className="h-4 w-4 mr-2" />
                  New Workout
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <Card className="mb-8 border-2 border-indigo-200">
          <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-cyan-50">
            <CardTitle>Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutListView />
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

