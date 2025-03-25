import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LucideCalendarDays, LucideClock, LucideDumbbell, LucidePlus } from "lucide-react"

export default function WorkoutsPage() {
  const workoutTemplates = [
    {
      id: 1,
      name: "Upper Body",
      description: "Focus on chest, shoulders, back and arms",
      exercises: 8,
      duration: "60-75 min",
      lastPerformed: "2 days ago",
    },
    {
      id: 2,
      name: "Lower Body",
      description: "Focus on quads, hamstrings, glutes and calves",
      exercises: 7,
      duration: "60-70 min",
      lastPerformed: "4 days ago",
    },
    {
      id: 3,
      name: "Full Body",
      description: "Complete body workout with compound movements",
      exercises: 10,
      duration: "75-90 min",
      lastPerformed: "7 days ago",
    },
    {
      id: 4,
      name: "Core & Cardio",
      description: "Abdominal focus with cardio intervals",
      exercises: 6,
      duration: "45-60 min",
      lastPerformed: "5 days ago",
    },
  ]

  const completedWorkouts = [
    {
      id: 1,
      name: "Upper Body",
      date: "Yesterday",
      duration: "65 min",
      volume: "3,240 kg",
    },
    {
      id: 2,
      name: "Lower Body",
      date: "3 days ago",
      duration: "75 min",
      volume: "4,560 kg",
    },
    {
      id: 3,
      name: "Core & Cardio",
      date: "5 days ago",
      duration: "45 min",
      volume: "1,120 kg",
    },
    {
      id: 4,
      name: "Upper Body",
      date: "1 week ago",
      duration: "70 min",
      volume: "3,180 kg",
    },
    {
      id: 5,
      name: "Lower Body",
      date: "9 days ago",
      duration: "80 min",
      volume: "4,320 kg",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workouts</h1>
          <p className="text-muted-foreground mt-2">Track and manage your training sessions</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button size="lg">
            <LucidePlus className="mr-2 h-5 w-5" />
            New Workout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workoutTemplates.map((template) => (
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
                    <Button className="flex-1">Start</Button>
                    <Button variant="outline" className="flex-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed flex flex-col items-center justify-center p-6">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <LucidePlus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-2">Create New Template</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">Build a custom workout routine</p>
              <Button variant="outline">Create Template</Button>
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
                      <Badge variant="outline" className="flex items-center">
                        <LucideDumbbell className="h-3 w-3 mr-1" />
                        {workout.volume}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

