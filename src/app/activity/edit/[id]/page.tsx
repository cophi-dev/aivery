"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LucideArrowLeft, LucideSave } from "lucide-react"
import { fetchWorkout, updateWorkout } from "@/lib/workout-actions"

export default function EditWorkoutPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [workout, setWorkout] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    duration: 0,
    intensity: "Medium",
    type: "running",
    notes: ""
  })
  
  // For cardio workouts
  const [distance, setDistance] = useState("")
  const [includeHeartRate, setIncludeHeartRate] = useState(false)
  const [avgHeartRate, setAvgHeartRate] = useState("")
  const [maxHeartRate, setMaxHeartRate] = useState("")
  const [elevationGain, setElevationGain] = useState("")

  // Load workout data
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        const data = await fetchWorkout(params.id)
        
        if (!data) {
          console.error("Workout not found")
          router.push("/planner")
          return
        }
        
        setWorkout(data)
        setFormData({
          name: data.name || "",
          date: data.date ? new Date(data.date).toISOString().split("T")[0] : "",
          duration: data.duration || 0,
          intensity: data.intensity || "Medium",
          type: data.type || "running",
          notes: data.notes || ""
        })
        
        // Set cardio specific fields if applicable
        if (data.type === "running" || data.type === "cycling" || data.type === "swimming") {
          setDistance(data.cardioDetails?.distance?.toString() || "")
          setElevationGain(data.cardioDetails?.elevationGain?.toString() || "")
          
          if (data.cardioDetails?.heartRate) {
            setIncludeHeartRate(true)
            setAvgHeartRate(data.cardioDetails.heartRate.average?.toString() || "")
            setMaxHeartRate(data.cardioDetails.heartRate.max?.toString() || "")
          }
        }
      } catch (error) {
        console.error("Failed to load workout:", error)
        router.push("/planner")
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkout()
  }, [params.id, router])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workout) return

    try {
      setIsSaving(true)

      // Create a deep copy to avoid modifying the original
      const updatedWorkout = { 
        ...JSON.parse(JSON.stringify(workout)),
        name: formData.name,
        date: new Date(formData.date),
        duration: Number(formData.duration),
        intensity: formData.intensity as "Low" | "Medium" | "High",
        notes: formData.notes
      }

      // Add cardio details if applicable
      if (workout.type === "running" || workout.type === "cycling" || workout.type === "swimming") {
        updatedWorkout.cardioDetails = {
          ...(workout.cardioDetails || {}),
          distance: distance ? Number(distance) : null,
          duration: Number(formData.duration),
          elevationGain: elevationGain ? Number(elevationGain) : null,
          heartRate: includeHeartRate
            ? {
                average: avgHeartRate ? Number(avgHeartRate) : null,
                max: maxHeartRate ? Number(maxHeartRate) : null
              }
            : null
        }
      }

      console.log("Saving workout:", updatedWorkout);
      await updateWorkout(updatedWorkout)
      router.push(`/activity/${workout._id}`)
    } catch (error) {
      console.error("Failed to update workout:", error)
      alert("Error updating workout. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Workout not found</h1>
          <p className="mt-2 text-muted-foreground">
            The workout you're looking for doesn't exist or has been deleted.
          </p>
          <Button asChild className="mt-4">
            <Link href="/planner">Back to Planner</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href={`/activity/${workout._id}`}>
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit {workout.name}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Details</CardTitle>
            <CardDescription>Edit the basic information about your workout</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Workout Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter workout name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intensity">Intensity</Label>
                <Select
                  value={formData.intensity}
                  onValueChange={(value) => setFormData({ ...formData, intensity: value })}
                >
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

              {(workout.type === "running" || workout.type === "cycling" || workout.type === "swimming") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="0.01"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="elevation">Elevation Gain (m)</Label>
                    <Input
                      id="elevation"
                      type="number"
                      value={elevationGain}
                      onChange={(e) => setElevationGain(e.target.value)}
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
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-heart-rate">Maximum Heart Rate (bpm)</Label>
                        <Input
                          id="max-heart-rate"
                          type="number"
                          value={maxHeartRate}
                          onChange={(e) => setMaxHeartRate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <LucideSave className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
} 