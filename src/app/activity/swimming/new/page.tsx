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
import { Switch } from "@/components/ui/switch"
import { LucideArrowLeft, LucidePlus, LucideTrash, LucideSave } from "lucide-react"
import { createWorkout } from "@/lib/workout-actions"

export default function NewSwimmingActivityPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [includeHeartRate, setIncludeHeartRate] = useState(false)
  const [trackLaps, setTrackLaps] = useState(true)

  // Form state
  const [activityName, setActivityName] = useState("Pool Swim")
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0])
  const [distance, setDistance] = useState("1000")
  const [hours, setHours] = useState("0")
  const [minutes, setMinutes] = useState("30")
  const [seconds, setSeconds] = useState("0")
  const [poolLength, setPoolLength] = useState("25")
  const [poolLengthUnit, setPoolLengthUnit] = useState("m")
  const [strokeType, setStrokeType] = useState("freestyle")
  const [avgHeartRate, setAvgHeartRate] = useState("")
  const [maxHeartRate, setMaxHeartRate] = useState("")
  const [intensity, setIntensity] = useState("Medium")
  const [notes, setNotes] = useState("")
  const [laps, setLaps] = useState([
    { number: 1, distance: 100, duration: 120 }, // 2 minutes for 100m
  ])

  // Calculate total duration in minutes
  const calculateTotalDuration = () => {
    return Number.parseInt(hours) * 60 + Number.parseInt(minutes) + Number.parseInt(seconds) / 60
  }

  // Add a new lap
  const addLap = () => {
    const lastLap = laps[laps.length - 1]
    setLaps([
      ...laps,
      {
        number: lastLap.number + 1,
        distance: lastLap.distance,
        duration: lastLap.duration,
      },
    ])
  }

  // Remove a lap
  const removeLap = (index: number) => {
    if (laps.length === 1) return
    const newLaps = [...laps]
    newLaps.splice(index, 1)
    // Renumber laps
    newLaps.forEach((lap, i) => {
      lap.number = i + 1
    })
    setLaps(newLaps)
  }

  // Update lap data
  const updateLap = (index: number, field: "distance" | "duration", value: number) => {
    const newLaps = [...laps]
    newLaps[index][field] = value
    setLaps(newLaps)
  }

  // Calculate total distance from laps
  const calculateTotalDistance = () => {
    if (!trackLaps) return Number.parseFloat(distance)
    return laps.reduce((total, lap) => total + lap.distance, 0)
  }

  // Calculate total duration from laps
  const calculateTotalDurationFromLaps = () => {
    if (!trackLaps) return calculateTotalDuration()
    const totalSeconds = laps.reduce((total, lap) => total + lap.duration, 0)
    return totalSeconds / 60
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)

      const totalDistance = calculateTotalDistance()
      const totalDuration = trackLaps ? calculateTotalDurationFromLaps() : calculateTotalDuration()

      const workoutData = {
        name: activityName,
        date: new Date(activityDate),
        type: "swimming" as const,
        duration: totalDuration,
        intensity: intensity as "Low" | "Medium" | "High",
        cardioDetails: {
          distance: totalDistance,
          duration: totalDuration,
          pace: totalDistance > 0 ? totalDuration / totalDistance : 0,
          heartRate: includeHeartRate
            ? {
                average: Number.parseInt(avgHeartRate),
                max: Number.parseInt(maxHeartRate),
              }
            : undefined,
          laps: trackLaps
            ? laps.map((lap) => ({
                number: lap.number,
                distance: lap.distance,
                duration: lap.duration,
                pace: lap.distance > 0 ? lap.duration / 60 / lap.distance : 0,
              }))
            : undefined,
          poolLength: Number.parseInt(poolLength),
          strokeType,
        },
        notes,
      }

      const newWorkout = await createWorkout(workoutData)
      if (newWorkout?._id) {
        router.push(`/workouts/${newWorkout._id}`)
      } else {
        console.error("Failed to get workout ID after creation.")
        alert("Workout saved, but failed to redirect. Please go to your workout history.")
      }
    } catch (error) {
      console.error("Failed to create swimming activity:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/workouts/new">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Log Swimming Activity</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Activity Details</CardTitle>
            <CardDescription>Enter the details of your swim</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="activity-name">Activity Name</Label>
                <Input
                  id="activity-name"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="e.g., Morning Swim, Pool Training"
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
                <Label htmlFor="pool-length">Pool Length</Label>
                <div className="flex gap-2">
                  <Input
                    id="pool-length"
                    type="number"
                    value={poolLength}
                    onChange={(e) => setPoolLength(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={poolLengthUnit} onValueChange={setPoolLengthUnit}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">m</SelectItem>
                      <SelectItem value="yd">yd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stroke-type">Primary Stroke</Label>
                <Select value={strokeType} onValueChange={setStrokeType}>
                  <SelectTrigger id="stroke-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freestyle">Freestyle</SelectItem>
                    <SelectItem value="backstroke">Backstroke</SelectItem>
                    <SelectItem value="breaststroke">Breaststroke</SelectItem>
                    <SelectItem value="butterfly">Butterfly</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="track-laps" className="cursor-pointer">
                    Track Individual Laps
                  </Label>
                  <Switch id="track-laps" checked={trackLaps} onCheckedChange={setTrackLaps} />
                </div>
              </div>

              {!trackLaps && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="distance">Total Distance (m)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="25"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="e.g., 1000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Total Duration</Label>
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
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-heart-rate" className="cursor-pointer">
                    Include Heart Rate Data
                  </Label>
                  <Switch id="include-heart-rate" checked={includeHeartRate} onCheckedChange={setIncludeHeartRate} />
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
                  placeholder="How did you feel? Any achievements?"
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {trackLaps && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lap Details</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLap}>
                  <LucidePlus className="h-4 w-4 mr-2" />
                  Add Lap
                </Button>
              </div>
              <CardDescription>Track individual lap distances and times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                  <div className="col-span-2">Lap</div>
                  <div className="col-span-4">Distance (m)</div>
                  <div className="col-span-5">Duration (seconds)</div>
                  <div className="col-span-1"></div>
                </div>

                {laps.map((lap, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 font-medium">{lap.number}</div>
                    <div className="col-span-4">
                      <Input
                        type="number"
                        value={lap.distance}
                        onChange={(e) => updateLap(index, "distance", Number.parseInt(e.target.value))}
                        step="25"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        type="number"
                        value={lap.duration}
                        onChange={(e) => updateLap(index, "duration", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLap(index)}
                        disabled={laps.length === 1}
                      >
                        <LucideTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Total Distance:</span>
                    <span className="font-medium">{calculateTotalDistance()} m</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span>Total Duration:</span>
                    <span className="font-medium">
                      {Math.floor(calculateTotalDurationFromLaps() / 60)}h{" "}
                      {Math.floor(calculateTotalDurationFromLaps() % 60)}m{" "}
                      {Math.round((calculateTotalDurationFromLaps() % 1) * 60)}s
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
    </div>
  )
}

