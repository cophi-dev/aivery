import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LucideCalendarDays, LucideClock, LucideDumbbell, LucidePlus, LucideRuler } from "lucide-react"
import Link from "next/link"
import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function WorkoutsPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  const userId = session.user.id
  const workouts = await getWorkoutsByUserId(userId)

  // Group workouts by type to create templates
  const workoutTemplates = Array.from(new Set(workouts.map(w => w.type)))
    .map(type => {
      const typeWorkouts = workouts.filter(w => w.type === type)
      const lastWorkout = typeWorkouts.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
      
      return {
        id: type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        description: `${type} workout`,
        exercises: lastWorkout?.exercises?.length || 0,
        duration: `${lastWorkout?.duration || 0} min`,
        lastPerformed: lastWorkout ? `${format(new Date(lastWorkout.date), 'MMM d, yyyy')}` : 'Never'
      }
    })

  // Sort workouts by date (newest first)
  const completedWorkouts = [...workouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10) // Show only the 10 most recent workouts
    .map(workout => ({
      id: workout._id,
      name: workout.name,
      date: format(new Date(workout.date), 'MMM d, yyyy'),
      duration: `${workout.duration} min`,
      volume: workout.volume ? `${workout.volume} kg` : undefined,
      distance: workout.distance || workout.cardioDetails?.distance,
      type: workout.type
    }))

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

      <Tabs defaultValue="history" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutTemplates.length > 0 ? workoutTemplates.map((template) => (
              <Card key={template.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center">
                      <LucideDumbbell className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-sm">{template.exercises} exercises</span>
                    </div>
                    <div className="flex items-center">
                      <LucideClock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-sm">{template.duration}</span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <LucideCalendarDays className="h-4 w-4 mr-1" />
                    <span>Last performed: {template.lastPerformed}</span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/workout/new?type=${template.id}`}>
                      <Button className="flex-1">Start</Button>
                    </Link>
                    <Button variant="outline" className="flex-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p>No workout templates found. Start by creating a new workout.</p>
            )}

            <Card className="border-dashed flex flex-col items-center justify-center p-6">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <LucidePlus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-2">Create New Template</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">Build a custom workout routine</p>
              <Link href="/workout/new">
                <Button variant="outline">Create Template</Button>
              </Link>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Workout History</CardTitle>
              <CardDescription>Your completed training sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {completedWorkouts.length > 0 ? (
                <div className="space-y-6">
                  {completedWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <h3 className="font-semibold">{workout.name}</h3>
                        <div className="text-sm text-muted-foreground mt-1">{workout.date}</div>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 md:mt-0">
                        <Badge variant="outline" className="flex items-center">
                          <LucideClock className="h-3 w-3 mr-1" />
                          {workout.duration}
                        </Badge>
                        {workout.type === 'strength' ? (
                          <Badge variant="outline" className="flex items-center">
                            <LucideDumbbell className="h-3 w-3 mr-1" />
                            {workout.volume || 'N/A'}
                          </Badge>
                        ) : (
                          workout.distance && (
                            <Badge variant="outline" className="flex items-center">
                              <LucideRuler className="h-3 w-3 mr-1" />
                              {workout.distance} km
                            </Badge>
                          )
                        )}
                        <Link href={`/workout/${workout.id}`}>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No workout history found. Start by creating a new workout.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

