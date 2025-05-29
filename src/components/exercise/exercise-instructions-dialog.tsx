"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  HelpCircle, 
  Target, 
  Settings, 
  CheckCircle,
  Zap,
  Clock
} from "lucide-react"
import type { ExerciseData } from "@/types/db"

interface ExerciseInstructionsDialogProps {
  exercise: ExerciseData | null
  children?: React.ReactNode
  className?: string
}

export function ExerciseInstructionsDialog({ 
  exercise, 
  children, 
  className = "" 
}: ExerciseInstructionsDialogProps) {
  const [open, setOpen] = useState(false)

  if (!exercise) {
    return null
  }

  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'strength': return <Target className="h-4 w-4" />
      case 'cardio': return <Zap className="h-4 w-4" />
      case 'flexibility': return <Clock className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 w-8 p-0 hover:bg-muted/80 transition-colors ${className}`}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-gradient-to-br from-white/95 to-neutral-50/95 dark:from-neutral-900/95 dark:to-neutral-950/95 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50">
        <DialogHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-serif tracking-tight flex items-center gap-2">
                {getCategoryIcon(exercise.category)}
                {exercise.name}
              </DialogTitle>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-medium ${getLevelColor(exercise.level)}`}
                >
                  {exercise.level || 'Beginner'}
                </Badge>
                
                <Badge variant="outline" className="text-xs">
                  {exercise.category}
                </Badge>
                
                {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {exercise.muscleGroups.slice(0, 2).join(', ')}
                    {exercise.muscleGroups.length > 2 && ` +${exercise.muscleGroups.length - 2}`}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {exercise.description && (
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {exercise.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          {exercise.instructions && exercise.instructions.length > 0 && (
            <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Form & Technique
                </h3>
                
                <ol className="space-y-3">
                  {exercise.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3 text-sm leading-relaxed">
                      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-foreground/90">
                        {instruction}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Equipment & Muscles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Equipment */}
            {exercise.equipment && exercise.equipment.length > 0 && (
              <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Equipment
                  </h3>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.equipment.map((item, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Muscle Groups */}
            {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
              <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50 dark:border-green-800/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Primary Muscles
                  </h3>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.muscleGroups.map((muscle, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        {muscle}
                      </Badge>
                    ))}
                  </div>
                  
                  {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">Secondary:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.secondaryMuscles.map((muscle, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs"
                          >
                            {muscle}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tips */}
          {exercise.tips && exercise.tips.length > 0 && (
            <Card className="bg-gradient-to-br from-purple-50/50 to-violet-50/50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200/50 dark:border-purple-800/50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Pro Tips
                </h3>
                
                <ul className="space-y-2">
                  {exercise.tips.map((tip, index) => (
                    <li key={index} className="flex gap-3 text-sm leading-relaxed">
                      <span className="text-purple-500 dark:text-purple-400 mt-1.5">•</span>
                      <span className="text-foreground/90">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 