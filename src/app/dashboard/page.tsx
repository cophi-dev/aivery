import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Dumbbell, Calendar, BarChart, Zap, MessageSquare } from "lucide-react"
import dbConnect from "@/lib/db/mongoose"
import UserModel from "@/lib/db/models/user"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import type { WorkoutData } from "@/types/db"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { AvatarLoader } from "@/components/avatar-loader"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  // Server-side auth check
  const session = await getServerSession(authOptions)

  // Simple redirect if no session
  if (!session?.user?.id) {
    console.log("No valid session found in dashboard - redirecting to login")
    redirect("/login?error=session_required")
  }

  try {
    // Connect to database 
    await dbConnect()

    // Get user and handle errors
    const user = await UserModel.findOne({ email: session.user.email })

    if (!user) {
      console.log("User not found in database despite valid session")
      redirect("/login?error=user_not_found")
    }

    // Simple empty array for workouts if we can't fetch them
    let workouts: WorkoutData[] = [];
    let recentWorkouts: WorkoutData[] = [];
    let workoutCount = 0;

    try {
      workouts = await getWorkoutsByUserId(session.user.id)
      workoutCount = workouts.length
      
      // Sort workouts by date (newest first) and take the 5 most recent
      recentWorkouts = workouts
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
    } catch (workoutError) {
      console.error("Error fetching workouts:", workoutError)
    }

    // Get some user-specific data (basic version for now)
    const hasWorkouts = workoutCount > 0
    const hasPlans = user.plans?.length > 0
    const planCount = hasPlans ? user.plans.length : 0

    return (
      <div className="container mx-auto px-4 py-6">
        <section className="mb-8 p-6 bg-card rounded-xl">
          <div className="flex items-center gap-4">
            <AvatarLoader name={user.name} size="lg" />
            <div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground">Welcome to your fitness dashboard</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* First row - Key statistics and quick access */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Dumbbell className="mr-2 h-5 w-5" />
                Workouts
              </CardTitle>
              <CardDescription>View and track your workouts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{workoutCount}</div>
              <p className="text-muted-foreground">Total workouts logged</p>
            </CardContent>
            <CardFooter>
              <Link href="/workouts" className="w-full">
                <Button className="w-full">
                  {workoutCount > 0 ? "View Workouts" : "Start First Workout"}
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Training Plans
              </CardTitle>
              <CardDescription>Manage your training plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{planCount}</div>
              <p className="text-muted-foreground">Active training plans</p>
            </CardContent>
            <CardFooter>
              <Link href="/plan" className="w-full">
                <Button className="w-full" variant="outline">
                  {planCount > 0 ? "View Plans" : "Create a Plan"}
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                AI Coach
              </CardTitle>
              <CardDescription>Get personalized guidance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Ask questions, get workout suggestions, and more</p>
            </CardContent>
            <CardFooter>
              <Link href="/chat" className="w-full">
                <Button className="w-full" variant="outline">Talk to AI Coach</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/workout/new">
                  <Button variant="secondary" className="w-full" size="sm">
                    Log Workout
                  </Button>
                </Link>
                <Link href="/chat?q=suggest+workout">
                  <Button variant="secondary" className="w-full" size="sm">
                    Get Suggestion
                  </Button>
                </Link>
                <Link href="/plan/new">
                  <Button variant="secondary" className="w-full" size="sm">
                    Create Plan
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="secondary" className="w-full" size="sm">
                    Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your latest workouts</CardDescription>
            </CardHeader>
            <CardContent>
              {hasWorkouts ? (
                <div className="space-y-3">
                  {recentWorkouts.map((workout) => (
                    <div key={workout._id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <h3 className="font-medium">{workout.name || `${workout.type} workout`}</h3>
                        <p className="text-sm text-muted-foreground">{format(new Date(workout.date), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{workout.duration} min</Badge>
                        <Link href={`/workout/${workout._id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No workouts logged yet</p>
              )}
            </CardContent>
            {hasWorkouts && (
              <CardFooter>
                <Link href="/workouts" className="w-full">
                  <Button className="w-full" variant="outline">
                    View All Activity
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Progress Analytics */}
        <div className="grid gap-6 md:grid-cols-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <BarChart className="mr-2 h-5 w-5" />
                Progress
              </CardTitle>
              <CardDescription>Track your fitness progress</CardDescription>
            </CardHeader>
            <CardContent>
              {workoutCount > 0 ? (
                <p className="text-muted-foreground mb-4">View your progress statistics and performance over time</p>
              ) : (
                <p className="text-muted-foreground mb-4">Start logging workouts to track progress and see analytics</p>
              )}
            </CardContent>
            <CardFooter>
              <Link href="/analytics" className="w-full">
                <Button className="w-full" variant={workoutCount > 0 ? "default" : "outline"}>
                  View Analytics
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  } catch (userError) {
    console.error("Error fetching user data:", userError);
    redirect("/login")
  }
} 