"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, HelpCircle } from "lucide-react"
import { ExerciseInstructionsDialog } from "./exercise-instructions-dialog"
import { ExerciseFormHints } from "./exercise-form-hints"
import type { ExerciseData } from "@/types/db"

// Mock exercise data to demonstrate the integration
const mockExercise: ExerciseData = {
  _id: "mock-bench-press",
  name: "Bench Press",
  description: "A compound upper-body exercise where weight is pressed upward while lying on a bench",
  muscleGroups: ["chest", "triceps", "shoulders"],
  category: "strength",
  level: "beginner",
  equipment: ["barbell", "bench"],
  instructions: [
    "Lie back on a flat bench with feet firmly on the ground",
    "Grip the barbell with hands slightly wider than shoulder-width",
    "Lower the bar to your mid-chest with control",
    "Press the bar back up to the starting position",
    "Keep your core tight and maintain proper form throughout"
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

interface Set {
  id: string
  weight: string
  reps: string
}

export function ExerciseIntegrationDemo() {
  const [sets, setSets] = useState<Set[]>([
    { id: "set-1", weight: "", reps: "" }
  ])

  const addSet = () => {
    setSets(prev => [...prev, {
      id: `set-${Date.now()}`,
      weight: "",
      reps: ""
    }])
  }

  const removeSet = (id: string) => {
    setSets(prev => prev.filter(set => set.id !== id))
  }

  const updateSet = (id: string, field: 'weight' | 'reps', value: string) => {
    setSets(prev => prev.map(set => 
      set.id === id ? { ...set, [field]: value } : set
    ))
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Exercise Form Instructions Demo</h1>
        <p className="text-muted-foreground">
          See how form instructions integrate seamlessly into your workout logging experience
        </p>
      </div>

      <Card className="bg-gradient-to-br from-white/95 to-neutral-50/95 dark:from-neutral-900/95 dark:to-neutral-950/95">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">{mockExercise.name}</CardTitle>
              {/* Full instructions dialog - click the help icon */}
              <ExerciseInstructionsDialog exercise={mockExercise}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                </Button>
              </ExerciseInstructionsDialog>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs">
                {mockExercise.level}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {mockExercise.muscleGroups.join(', ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Compact inline form hints */}
          <ExerciseFormHints 
            exercise={mockExercise} 
            variant="compact"
          />

          {/* Sets tracking */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Sets</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addSet}
                className="h-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {sets.map((set, index) => (
              <div key={set.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}
                </span>
                <Input
                  placeholder="Weight (kg)"
                  value={set.weight}
                  onChange={(e) => updateSet(set.id, 'weight', e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                  className="flex-1"
                />
                {sets.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSet(set.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Minimal form hint example */}
          <ExerciseFormHints 
            exercise={mockExercise} 
            variant="minimal"
            className="mt-4"
          />
        </CardContent>
      </Card>

      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Integration Options:
        </h3>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <div>• <strong>Help Icon:</strong> Click the ? icon for full detailed instructions in a dialog</div>
          <div>• <strong>Compact Tips:</strong> Collapsible form hints that show key technique points</div>
          <div>• <strong>Minimal Hints:</strong> Quick inline tip shown at the bottom</div>
          <div>• <strong>Responsive:</strong> Form instructions adapt to your screen size and user preferences</div>
        </div>
      </div>
    </div>
  )
} 