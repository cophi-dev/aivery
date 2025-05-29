"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ExerciseData } from "@/types/db"

interface ExerciseFormHintsProps {
  exercise: ExerciseData | null
  className?: string
  variant?: 'inline' | 'compact' | 'minimal'
}

export function ExerciseFormHints({ 
  exercise, 
  className = "",
  variant = 'inline'
}: ExerciseFormHintsProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!exercise?.instructions || exercise.instructions.length === 0) {
    return null
  }

  // For minimal variant, show just the first instruction as a hint
  if (variant === 'minimal') {
    return (
      <div className={`text-xs text-muted-foreground italic ${className}`}>
        💡 {exercise.instructions[0]}
      </div>
    )
  }

  // For compact variant, show a small collapsible
  if (variant === 'compact') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3 w-3 mr-1.5" />
            Form Tips
            {isOpen ? (
              <ChevronUp className="h-3 w-3 ml-1.5" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1.5" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
            <CardContent className="p-3">
              <ol className="space-y-1.5 text-xs">
                {exercise.instructions.slice(0, 3).map((instruction, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="flex-shrink-0 text-blue-600 dark:text-blue-400 font-medium">
                      {index + 1}.
                    </span>
                    <span className="text-foreground/80 leading-relaxed">
                      {instruction}
                    </span>
                  </li>
                ))}
                {exercise.instructions.length > 3 && (
                  <li className="text-blue-600 dark:text-blue-400 text-xs italic mt-2">
                    +{exercise.instructions.length - 3} more steps...
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Default inline variant
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20"
        >
          <HelpCircle className="h-3 w-3 mr-1.5" />
          {isOpen ? 'Hide' : 'Show'} Form Guide
          {isOpen ? (
            <ChevronUp className="h-3 w-3 ml-1.5" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-1.5" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3">
        <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
                Proper Form
              </h4>
            </div>
            
            <ol className="space-y-2 text-sm">
              {exercise.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-foreground/90 leading-relaxed">
                    {instruction}
                  </span>
                </li>
              ))}
            </ol>
            
            {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Targets:</span>
                  <span>{exercise.muscleGroups.join(', ')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
} 