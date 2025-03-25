import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Dumbbell, Calendar, BarChart, Zap, MessageSquare } from "lucide-react"
import dbConnect from "@/lib/db/mongoose"
import UserModel from "@/lib/db/models/user"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  // Connect to database and get user data
  await dbConnect()
  const user = await UserModel.findOne({ email: session.user.email })

  if (!user) {
    redirect("/login")
  }

  // Get some user-specific data (basic version for now)
  const hasWorkouts = user.workouts?.length > 0
  const hasPlans = user.plans?.length > 0
  const workoutCount = hasWorkouts ? user.workouts.length : 0
  const planCount = hasPlans ? user.plans.length : 0

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome, {session.user.name}!</h1>
        <p className="text-muted-foreground">Track workouts, plan your training, and get AI coaching</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workouts">Workouts</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                <Link href="/workout" className="w-full">
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
                <Link href="/planner" className="w-full">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest workouts</CardDescription>
              </CardHeader>
              <CardContent>
                {workoutCount > 0 ? (
                  <p>View your recent workouts in the workouts tab</p>
                ) : (
                  <p className="text-muted-foreground">No workouts logged yet</p>
                )}
              </CardContent>
              <CardFooter>
                <Link href="/workouts" className="w-full">
                  <Button className="w-full" variant="outline">
                    View All Activity
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <BarChart className="mr-2 h-5 w-5" />
                  Progress
                </CardTitle>
                <CardDescription>Track your fitness progress</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {workoutCount > 0 
                    ? "Check the analytics tab to see your progress" 
                    : "Start logging workouts to track progress"}
                </p>
              </CardContent>
              <CardFooter>
                <Link href="/analytics" className="w-full">
                  <Button className="w-full" variant="outline">
                    View Analytics
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workouts">
          <Card>
            <CardHeader>
              <CardTitle>Workouts</CardTitle>
              <CardDescription>View and manage your workout history</CardDescription>
            </CardHeader>
            <CardContent>
              {workoutCount > 0 ? (
                <p>Your workout history will be displayed here</p>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You haven't logged any workouts yet</p>
                  <Link href="/workout/new">
                    <Button>Log Your First Workout</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Training Plans</CardTitle>
              <CardDescription>Manage your workout schedules and plans</CardDescription>
            </CardHeader>
            <CardContent>
              {planCount > 0 ? (
                <p>Your training plans will be displayed here</p>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You don't have any training plans yet</p>
                  <Link href="/planner">
                    <Button>Create Your First Plan</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Track your fitness progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Analytics will be available as you log more workouts</p>
                <Link href="/workout/new">
                  <Button>Log a Workout</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 