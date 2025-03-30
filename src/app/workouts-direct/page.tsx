import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import WorkoutListView from "@/components/workout-list-view"
import type { WorkoutData } from "@/types/db"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function WorkoutsDirectPage() {
  console.log("[WORKOUTS_DIRECT_PAGE] Starting to render direct workouts page")
  
  // Try to get the session
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log("[WORKOUTS_DIRECT_PAGE] Session:", JSON.stringify({ 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      userId: session?.user?.id 
    }));
  } catch (error) {
    console.error("[WORKOUTS_DIRECT_PAGE] Error getting session:", error);
    // Don't redirect here, show a friendly error instead
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Authentication Error</h1>
        <div className="mt-4 text-red-500">
          There was a problem with your authentication. Please try <Link href="/login" className="underline">logging in</Link> again.
        </div>
      </div>
    );
  }

  // Don't redirect - just show workouts or a message
  if (!session || !session.user) {
    console.log("[WORKOUTS_DIRECT_PAGE] No session or user, showing login suggestion");
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4">
          <p>Please <Link href="/login" className="text-blue-500 underline">login</Link> to view your workouts.</p>
        </div>
      </div>
    );
  }

  const userId = session.user.id;
  console.log("[WORKOUTS_DIRECT_PAGE] Fetching workouts for user:", userId);
  
  try {
    const workouts = await getWorkoutsByUserId(userId);
    console.log("[WORKOUTS_DIRECT_PAGE] Fetched workouts:", workouts?.length || 0);

    return (
      <div className="container mx-auto px-4 py-8">
        {/* DEBUG VISUAL CHANGE - Bright background */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h2 className="text-2xl font-bold mb-3">NEW DESIGN - Workout Tracker</h2>
          <p>This is the new design deployed on {new Date().toLocaleString()}</p>
        </div>
        
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
    console.error("[WORKOUTS_DIRECT_PAGE] Error fetching workouts:", error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4 text-red-500">Error loading workouts. Please try again later.</div>
      </div>
    );
  }
} 