import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideCalendarDays, LucideChevronLeft, LucideChevronRight, LucideClock, LucidePlus } from "lucide-react"

export default function PlanPage() {
  // Mock data for the weekly schedule
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const currentDate = new Date()
  const currentDay = currentDate.getDay() // 0 is Sunday, 1 is Monday, etc.

  // Adjust to make Monday the first day
  const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1

  const schedule = [
    { name: "Upper Body", duration: "60-75 min", intensity: "High" },
    null,
    { name: "Lower Body", duration: "60-70 min", intensity: "High" },
    null,
    { name: "Full Body", duration: "75-90 min", intensity: "Medium" },
    null,
    { name: "Rest Day", duration: "", intensity: "" },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Workout Plan</h1>
          <p className="text-muted-foreground mt-2">Schedule and organize your training routine</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <Button variant="outline" size="icon">
            <LucideChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-medium">June 2025</div>
          <Button variant="outline" size="icon">
            <LucideChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Your training plan for this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`text-center p-2 rounded-md ${index === adjustedCurrentDay ? "bg-primary/10 font-medium" : ""}`}
              >
                {day}
              </div>
            ))}

            {schedule.map((workout, index) => (
              <div
                key={index}
                className={`border rounded-md p-3 min-h-[120px] ${index === adjustedCurrentDay ? "border-primary" : ""}`}
              >
                {workout ? (
                  <div className="h-full flex flex-col">
                    <div className="font-medium">{workout.name}</div>
                    {workout.duration && (
                      <div className="text-sm text-muted-foreground mt-1 flex items-center">
                        <LucideClock className="h-3 w-3 mr-1" />
                        {workout.duration}
                      </div>
                    )}
                    {workout.intensity && (
                      <div className="mt-2">
                        <Badge
                          variant={
                            workout.intensity === "High"
                              ? "default"
                              : workout.intensity === "Medium"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {workout.intensity}
                        </Badge>
                      </div>
                    )}
                    <div className="mt-auto pt-2">
                      {workout.name !== "Rest Day" && (
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      <LucidePlus className="h-3 w-3 mr-1" />
                      Add Workout
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Workouts</CardTitle>
            <CardDescription>Your scheduled sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-semibold">Upper Body</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center">
                    <LucideCalendarDays className="h-4 w-4 mr-1" />
                    Monday, June 10
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm">Start</Button>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-semibold">Lower Body</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center">
                    <LucideCalendarDays className="h-4 w-4 mr-1" />
                    Wednesday, June 12
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm">Start</Button>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Full Body</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center">
                    <LucideCalendarDays className="h-4 w-4 mr-1" />
                    Friday, June 14
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm">Start</Button>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training Goals</CardTitle>
            <CardDescription>Track your fitness objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Weekly Workouts</div>
                  <div className="text-sm font-medium">4/5</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-4/5"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Bench Press PR</div>
                  <div className="text-sm font-medium">90/100 kg</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[90%]"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Squat PR</div>
                  <div className="text-sm font-medium">120/150 kg</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-4/5"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Deadlift PR</div>
                  <div className="text-sm font-medium">140/180 kg</div>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 rounded-full w-[78%]"></div>
                </div>
              </div>

              <Button className="w-full mt-2">
                <LucidePlus className="h-4 w-4 mr-2" />
                Add New Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

