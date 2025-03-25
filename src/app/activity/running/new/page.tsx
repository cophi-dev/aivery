"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { LucideArrowLeft, LucideSave } from "lucide-react"
import { createCardioWorkout } from "@/lib/workout-actions"

export default function NewRunningActivityPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [entryMethod, setEntryMethod] = useState<"manual" | "import">("manual")
  const [includeHeartRate, setIncludeHeartRate] = useState(false)
  const [includeRoute, setIncludeRoute] = useState(false)

  // Form state
  const [activityName, setActivityName] = useState("Morning Run")
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0])
  const [distance, setDistance] = useState("")
  const [duration, setDuration] = useState("")
  const [hours, setHours] = useState("0")
  const [minutes, setMinutes] = useState("30")
  const [seconds, setSeconds] = useState("0")
  const [elevationGain, setElevationGain] = useState("")
  const [avgHeartRate, setAvgHeartRate] = useState("")
  const [maxHeartRate, setMaxHeartRate] = useState("")
  const [intensity, setIntensity] = useState("Medium")
  const [notes, setNotes] = useState("")

  // Calculate pace
  const calculatePace = () => {
    if (!distance || !hours || !minutes || !seconds) return "0:00"

    const totalMinutes = Number.parseInt(hours) * 60 + Number.parseInt(minutes) + Number.parseInt(seconds) / 60
    const distanceValue = Number.parseFloat(distance)

    if (distanceValue === 0) return "0:00"

    const paceMinutes = totalMinutes / distanceValue
    const paceMinutesWhole = Math.floor(paceMinutes)
    const paceSeconds = Math.round((paceMinutes - paceMinutesWhole) * 60)

    return `${paceMinutesWhole}:${paceSeconds.toString().padStart(2, "0")}`
  }

  // Calculate total duration in minutes
  const calculateTotalDuration = () => {
    return Number.parseInt(hours) * 60 + Number.parseInt(minutes) + Number.parseInt(seconds) / 60
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)

      const workoutData = {
        name: activityName,
        date: new Date(activityDate),
        type: "running" as const,
        duration: calculateTotalDuration(),
        intensity: intensity as "Low" | "Medium" | "High",
        cardioDetails: {
          distance: Number.parseFloat(distance),
          duration: calculateTotalDuration(),
          pace: Number.parseFloat(distance) > 0 ? calculateTotalDuration() / Number.parseFloat(distance) : 0,
          elevationGain: elevationGain ? Number.parseFloat(elevationGain) : undefined,
          heartRate: includeHeartRate
            ? {
                average: Number.parseInt(avgHeartRate),
                max: Number.parseInt(maxHeartRate),
              }
            : undefined,
        },
        notes,
      }

      const newWorkoutId = await createCardioWorkout(workoutData)
      router.push(`/activity/${newWorkoutId}`)
    } catch (error) {
      console.error("Failed to create running activity:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/activity/new">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Log Running Activity</h1>
      </div>

      <Tabs defaultValue="manual" onValueChange={(value) => setEntryMethod(value as "manual" | "import")}>
        <TabsList className="mb-6">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="import">Import from Device</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <form onSubmit={handleSubmit}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Activity Details</CardTitle>
                <CardDescription>Enter the details of your run</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="activity-name">Activity Name</Label>
                    <Input
                      id="activity-name"
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      placeholder="e.g., Morning Run, Trail Run"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activity-date">Date</Label>
                    <Input
                      id="activity-date"
                      type="date"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="0.01"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="e.g., 5.2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          type="number"
                          min="0"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          placeholder="Hours"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={minutes}
                          onChange={(e) => setMinutes(e.target.value)}
                          placeholder="Minutes"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={seconds}
                          onChange={(e) => setSeconds(e.target.value)}
                          placeholder="Seconds"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Pace</Label>
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-muted-foreground">
                      {calculatePace()} min/km
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="elevation">Elevation Gain (m)</Label>
                    <Input
                      id="elevation"
                      type="number"
                      value={elevationGain}
                      onChange={(e) => setElevationGain(e.target.value)}
                      placeholder="e.g., 120"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-heart-rate" className="cursor-pointer">
                        Include Heart Rate Data
                      </Label>
                      <Switch
                        id="include-heart-rate"
                        checked={includeHeartRate}
                        onCheckedChange={setIncludeHeartRate}
                      />
                    </div>
                  </div>

                  {includeHeartRate && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="avg-heart-rate">Average Heart Rate (bpm)</Label>
                        <Input
                          id="avg-heart-rate"
                          type="number"
                          value={avgHeartRate}
                          onChange={(e) => setAvgHeartRate(e.target.value)}
                          placeholder="e.g., 145"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-heart-rate">Maximum Heart Rate (bpm)</Label>
                        <Input
                          id="max-heart-rate"
                          type="number"
                          value={maxHeartRate}
                          onChange={(e) => setMaxHeartRate(e.target.value)}
                          placeholder="e.g., 175"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="intensity">Intensity</Label>
                    <Select value={intensity} onValueChange={setIntensity}>
                      <SelectTrigger id="intensity">
                        <SelectValue placeholder="Select intensity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="How did you feel? Weather conditions? Any achievements?"
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button variant="outline" type="button" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <LucideSave className="h-4 w-4 mr-2" />
                    Save Activity
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Import from Device or App</CardTitle>
              <CardDescription>Connect with your favorite fitness apps and devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-muted rounded-full p-2">
                      <img src="/placeholder.svg?height=40&width=40" alt="Strava" className="h-10 w-10" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Strava</h3>
                      <p className="text-sm text-muted-foreground">Connect to import your activities from Strava</p>
                    </div>
                    <Button>Connect</Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-muted rounded-full p-2">
                      <img src="/placeholder.svg?height=40&width=40" alt="Garmin Connect" className="h-10 w-10" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Garmin Connect</h3>
                      <p className="text-sm text-muted-foreground">
                        Connect to import your activities from Garmin devices
                      </p>
                    </div>
                    <Button>Connect</Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-muted rounded-full p-2">
                      <img src="/placeholder.svg?height=40&width=40" alt="Apple Health" className="h-10 w-10" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Apple Health</h3>
                      <p className="text-sm text-muted-foreground">
                        Connect to import your activities from Apple Health
                      </p>
                    </div>
                    <Button>Connect</Button>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <p className="text-sm text-muted-foreground mb-4">Or upload a file directly</p>
                  <Button variant="outline">Upload GPX/TCX File</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

