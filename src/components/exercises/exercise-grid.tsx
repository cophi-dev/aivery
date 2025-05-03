'use client';

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dumbbell, Timer, Activity } from "lucide-react"
import Link from "next/link"
import type { ExerciseData } from "@/types/db"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const MotionCard = motion(Card);

export function ExerciseGrid({ exercises }: { exercises: ExerciseData[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {exercises.map((exercise, i) => (
        <MotionCard
          key={exercise._id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
          className="overflow-hidden hover:shadow-lg transition-all duration-300 group"
        >
          <Link href={`/exercises/${exercise._id}`} className="block h-full">
            <div className="p-6 bg-gradient-to-br from-card to-muted/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {exercise.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "capitalize font-medium",
                        exercise.category === "strength" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                        exercise.category === "cardio" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                        exercise.category === "flexibility" && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      )}
                    >
                      {exercise.category}
                    </Badge>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  {exercise.category === "strength" && <Dumbbell className="h-5 w-5" />}
                  {exercise.category === "cardio" && <Timer className="h-5 w-5" />}
                  {exercise.category === "flexibility" && <Activity className="h-5 w-5" />}
                </div>
              </div>
              
              <div className="space-y-3">
                {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.muscleGroups.map((muscle) => (
                      <Badge 
                        key={muscle} 
                        variant="outline" 
                        className="capitalize text-xs bg-background/50"
                      >
                        {muscle}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {exercise.equipment && exercise.equipment.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Equipment:</span>{' '}
                    {exercise.equipment.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </Link>
        </MotionCard>
      ))}
    </div>
  );
} 