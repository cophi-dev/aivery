import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import WorkoutListView from "@/components/workout-list-view"
import type { WorkoutData } from "@/types/db"
import { cookies } from "next/headers"
import { VERSION } from "../version"

// Force dynamic rendering with maximum cache prevention
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function WorkoutsPage() {
  console.log("[WORKOUTS_PAGE] Starting to render workouts page")
  
  // Generate unique timestamp for this render to make content visibly different
  const timestamp = new Date().toISOString()
  const shortVersion = VERSION.substring(0, 12)
  
  // Inspect cookies for debugging
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const hasSessionCookie = allCookies.some(c => 
    c.name.includes('session') || c.name.includes('next-auth')
  );
  
  console.log("[WORKOUTS_PAGE] Cookies:", JSON.stringify({
    cookieCount: allCookies.length,
    hasSessionCookie,
    cookieNames: allCookies.map(c => c.name)
  }));
  
  // Try to get the session
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log("[WORKOUTS_PAGE] Session:", JSON.stringify({ 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      userId: session?.user?.id,
      userEmail: session?.user?.email 
    }));
  } catch (error) {
    console.error("[WORKOUTS_PAGE] Error getting session:", error);
    // Show detailed error information
    return (
      <div className="container mx-auto px-4 py-8">
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h2 className="text-2xl font-bold mb-3">Authentication Debugging</h2>
          <p>Error getting session. Check server logs.</p>
          <p>Cookies found: {allCookies.length}</p>
          <p>Has auth cookies: {hasSessionCookie ? 'Yes' : 'No'}</p>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">Authentication Error</h1>
        <div className="mt-4 text-red-500">
          There was a problem with your authentication. Please try <Link href="/login" className="underline">logging in</Link> again.
        </div>
      </div>
    );
  }

  // If no session, show login suggestion with debug info
  if (!session || !session.user) {
    console.log("[WORKOUTS_PAGE] No session or user, showing login suggestion");
    return (
      <div className="container mx-auto px-4 py-8">
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h2 className="text-2xl font-bold mb-3">Authentication Debugging</h2>
          <p>No valid session found.</p>
          <p>Cookies found: {allCookies.length}</p>
          <p>Has auth cookies: {hasSessionCookie ? 'Yes' : 'No'}</p>
          <p>Cookie names: {allCookies.map(c => c.name).join(', ')}</p>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4">
          <p>Please <Link href="/login" className="text-blue-500 underline">login</Link> to view your workouts.</p>
        </div>
      </div>
    );
  }

  const userId = session.user.id;
  console.log("[WORKOUTS_PAGE] Fetching workouts for user:", userId);
  
  try {
    const workouts = await getWorkoutsByUserId(userId);
    console.log("[WORKOUTS_PAGE] Fetched workouts:", workouts?.length || 0);

    return (
      <div className="container mx-auto px-4 py-8">
        {/* DEBUG VISUAL CHANGE - Bright background with version and timestamp */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h2 className="text-2xl font-bold mb-3">NEW DESIGN - Workout Tracker</h2>
          <p>This is the new design deployed on {timestamp}</p>
          <p>Version: {shortVersion}</p>
          <p>Cache-busting ID: {Math.random().toString(36).substring(2, 8)}</p>
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
            <CardTitle>Workouts ({timestamp.substring(11, 19)})</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutListView initialWorkouts={workouts as WorkoutData[]} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("[WORKOUTS_PAGE] Error fetching workouts:", error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
        <div className="mt-4 text-red-500">Error loading workouts. Please try again later.</div>
      </div>
    );
  }
}

