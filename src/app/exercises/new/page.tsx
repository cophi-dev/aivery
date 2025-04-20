"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select"
import { LucideArrowLeft, LucideSave } from "lucide-react"
import { createExerciseAction } from "@/lib/exercise-actions"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

export default function NewExercisePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<"strength" | "cardio" | "flexibility">("strength")
  const [equipment, setEquipment] = useState<string[]>([])
  const [instructions, setInstructions] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("")
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [error, setError] = useState("")

  const addMuscleGroup = () => {
    if (muscleGroup.trim() === "") return
    if (!muscleGroups.includes(muscleGroup.toLowerCase().trim())) {
      setMuscleGroups([...muscleGroups, muscleGroup.toLowerCase().trim()])
    }
    setMuscleGroup("")
  }

  const removeMuscleGroup = (group: string) => {
    setMuscleGroups(muscleGroups.filter(g => g !== group))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!name) {
      setError("Exercise name is required")
      return
    }
    
    if (muscleGroups.length === 0) {
      setError("At least one muscle group is required")
      return
    }
    
    setError("")
    setIsSubmitting(true)
    
    try {
      // Split instructions string into array by newline before sending
      const instructionsArray = instructions.split('\n').filter(line => line.trim() !== '');
      
      await createExerciseAction({
        name,
        description,
        category,
        equipment,
        instructions: instructionsArray,
        primaryMuscles: muscleGroups
      })
      
      router.push("/exercises")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create exercise")
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/exercises">
          <Button variant="ghost" size="sm" className="mr-4">
            <LucideArrowLeft className="h-4 w-4 mr-2" />
            Back to Exercises
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">New Exercise</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add Exercise</CardTitle>
          <CardDescription>
            Create a new exercise for your workouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name">Exercise Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bench Press"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={category} 
                onValueChange={(value: "strength" | "cardio" | "flexibility") => setCategory(value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="flexibility">Flexibility</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="muscleGroups">Muscle Groups</Label>
              <div className="flex gap-2">
                <Input
                  id="muscleGroups"
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value)}
                  placeholder="e.g., chest, shoulders"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addMuscleGroup()
                    }
                  }}
                />
                <Button 
                  type="button" 
                  onClick={addMuscleGroup}
                  variant="secondary"
                >
                  Add
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-1 mt-2">
                {muscleGroups.map((group) => (
                  <Badge key={group} className="flex items-center gap-1 capitalize">
                    {group}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeMuscleGroup(group)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="equipment">Equipment (comma-separated)</Label>
              <Input
                id="equipment"
                value={equipment.join(', ')}
                onChange={(e) => {
                  const newEquipment = e.target.value
                    .split(',')
                    .map(item => item.trim())
                    .filter(item => item !== '');
                  setEquipment(newEquipment);
                }}
                placeholder="e.g., Barbell, Dumbbell"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the exercise"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step-by-step instructions for performing the exercise"
                rows={5}
              />
            </div>
            
            <div className="flex justify-end gap-4">
              <Link href="/exercises">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating..." : <><LucideSave className="h-4 w-4 mr-2" />Create Exercise</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 