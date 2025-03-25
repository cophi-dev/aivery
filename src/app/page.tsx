import Link from "next/link"
import { LucideDumbbell, LucideCalendarCheck, LucideMessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import WorkoutSummary from "@/components/workout-summary"
import RecentWorkouts from "@/components/recent-workouts"
import ProgressChart from "@/components/progress-chart"

export default function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to Aivery</h1>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Your AI-powered fitness companion to track, plan and analyze your fitness journey
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Button size="lg" asChild>
            <Link href="/chat">
              <LucideMessageSquare className="mr-2 h-5 w-5" />
              Chat with AI Coach
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/planner">
              <LucideCalendarCheck className="mr-2 h-5 w-5" />
              Workout Planner
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/activity/new">
              <LucideDumbbell className="mr-2 h-5 w-5" />
              Log Workout
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Weekly Workouts</CardTitle>
            <CardDescription>Your workout consistency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">4/5</div>
            <p className="text-muted-foreground">Goal: 5 workouts per week</p>
            <div className="w-full bg-secondary h-2 rounded-full mt-4">
              <div className="bg-primary h-2 rounded-full w-4/5"></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Volume</CardTitle>
            <CardDescription>Weight lifted this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12,450 kg</div>
            <p className="text-muted-foreground">+8% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Personal Records</CardTitle>
            <CardDescription>New PRs this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-muted-foreground">Bench Press, Squat, Deadlift</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <WorkoutSummary />
        <ProgressChart />
      </div>

      <RecentWorkouts />
    </div>
  )
}

