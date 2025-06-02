'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, ArrowRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardMetrics {
  strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  strengthVolumePrevious7Days: number;
  cardioDurationPrevious7Days: number;
  cardioDistancePrevious7Days: number;
  workoutCount: number;
  previousWorkoutCount: number;
  runningDistanceLast7Days: number;
  swimmingDistanceLast7Days: number;
  bikingDistanceLast7Days: number;
}

interface AiverySuggestion {
  id: string;
  icon: string;
  text: string;
  type: 'recovery' | 'training' | 'variety' | 'consistency' | 'balance';
  completed: boolean;
}

interface AiveryCardProps {
  metrics: DashboardMetrics;
  className?: string;
}

export default function AiveryCard({ metrics, className }: AiveryCardProps) {
  const [suggestions, setSuggestions] = useState<AiverySuggestion[]>([]);
  const [completedSuggestions, setCompletedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const generateSuggestions = (): AiverySuggestion[] => {
      const newSuggestions: AiverySuggestion[] = [];
      let suggestionId = 1;

      // Recovery Analysis
      if (metrics.workoutCount >= 6) {
        newSuggestions.push({
          id: `recovery-${suggestionId++}`,
          icon: '✅',
          text: 'Take a recovery day — your body earned it.',
          type: 'recovery',
          completed: false
        });
      } else if (metrics.workoutCount >= 4) {
        newSuggestions.push({
          id: `recovery-${suggestionId++}`,
          icon: '😴',
          text: 'Schedule a lighter day this week for recovery.',
          type: 'recovery',
          completed: false
        });
      }

      // Cross-training Analysis
      const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
      if (totalCardio > 0) {
        const runningPercent = (metrics.runningDistanceLast7Days / totalCardio) * 100;
        if (runningPercent >= 85 && totalCardio > 8) {
          newSuggestions.push({
            id: `variety-${suggestionId++}`,
            icon: '🚴‍♂️',
            text: 'Consider cross-training to balance the heavy running.',
            type: 'variety',
            completed: false
          });
        } else if (runningPercent >= 85 && totalCardio > 3) {
          newSuggestions.push({
            id: `variety-${suggestionId++}`,
            icon: '🏊‍♀️',
            text: 'Try swimming or cycling to add variety.',
            type: 'variety',
            completed: false
          });
        }
      }

      // Strength/Cardio Balance
      const hasStrength = metrics.strengthVolumeLast7Days > 0;
      const hasCardio = metrics.cardioDistanceLast7Days > 0;
      
      if (hasStrength && !hasCardio && metrics.workoutCount >= 3) {
        newSuggestions.push({
          id: `balance-${suggestionId++}`,
          icon: '🏃‍♀️',
          text: 'Add 20-30 minutes of light cardio for heart health.',
          type: 'balance',
          completed: false
        });
      } else if (hasCardio && !hasStrength && metrics.workoutCount >= 3) {
        newSuggestions.push({
          id: `balance-${suggestionId++}`,
          icon: '💪',
          text: 'Include 2 strength sessions to build muscle.',
          type: 'balance',
          completed: false
        });
      }

      // Consistency Building
      if (metrics.workoutCount <= 2 && metrics.previousWorkoutCount > 2) {
        newSuggestions.push({
          id: `consistency-${suggestionId++}`,
          icon: '🎯',
          text: 'Aim for 3-4 sessions this week to rebuild momentum.',
          type: 'consistency',
          completed: false
        });
      } else if (metrics.workoutCount === 3 && metrics.previousWorkoutCount <= 2) {
        newSuggestions.push({
          id: `consistency-${suggestionId++}`,
          icon: '📈',
          text: 'Great progress! Try adding one more session.',
          type: 'consistency',
          completed: false
        });
      }

      // Progressive Overload
      const strengthChange = metrics.strengthVolumePrevious7Days > 0 
        ? ((metrics.strengthVolumeLast7Days - metrics.strengthVolumePrevious7Days) / metrics.strengthVolumePrevious7Days) * 100
        : 0;

      if (strengthChange > 15) {
        newSuggestions.push({
          id: `training-${suggestionId++}`,
          icon: '⚖️',
          text: 'Volume increased well — maintain this level next week.',
          type: 'training',
          completed: false
        });
      } else if (strengthChange < -10 && metrics.strengthVolumeLast7Days > 0) {
        newSuggestions.push({
          id: `training-${suggestionId++}`,
          icon: '📊',
          text: 'Consider increasing weights or reps gradually.',
          type: 'training',
          completed: false
        });
      }

      // Default suggestions for minimal data
      if (newSuggestions.length === 0) {
        if (metrics.workoutCount > 0) {
          newSuggestions.push({
            id: `default-${suggestionId++}`,
            icon: '🌟',
            text: 'Keep building your routine — consistency is key.',
            type: 'consistency',
            completed: false
          });
          newSuggestions.push({
            id: `default-${suggestionId++}`,
            icon: '📱',
            text: 'Track your next workout for better insights.',
            type: 'training',
            completed: false
          });
        } else {
          newSuggestions.push({
            id: `start-${suggestionId++}`,
            icon: '🚀',
            text: 'Start with 2-3 workouts this week.',
            type: 'consistency',
            completed: false
          });
        }
      }

      return newSuggestions.slice(0, 3); // Max 3 suggestions
    };

    setSuggestions(generateSuggestions());
    
    // Load completed suggestions from localStorage
    const saved = localStorage.getItem('aivery-completed-suggestions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompletedSuggestions(new Set(parsed));
      } catch (e) {
        console.warn('Failed to parse saved suggestions');
      }
    }
  }, [metrics]);

  const toggleSuggestion = (suggestionId: string) => {
    const newCompleted = new Set(completedSuggestions);
    if (newCompleted.has(suggestionId)) {
      newCompleted.delete(suggestionId);
    } else {
      newCompleted.add(suggestionId);
    }
    setCompletedSuggestions(newCompleted);
    
    // Save to localStorage
    localStorage.setItem('aivery-completed-suggestions', JSON.stringify(Array.from(newCompleted)));
  };

  const completedCount = suggestions.filter(s => completedSuggestions.has(s.id)).length;
  const progressPercent = suggestions.length > 0 ? (completedCount / suggestions.length) * 100 : 0;

  const getTypeColor = (type: AiverySuggestion['type']) => {
    switch (type) {
      case 'recovery': return 'text-blue-600 dark:text-blue-400';
      case 'variety': return 'text-purple-600 dark:text-purple-400';
      case 'balance': return 'text-green-600 dark:text-green-400';
      case 'consistency': return 'text-orange-600 dark:text-orange-400';
      case 'training': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <motion.section 
      className={`mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="border-0 bg-gradient-to-br from-indigo-50/80 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/30 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent pointer-events-none" />
        
        <CardHeader className="pb-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-medium text-foreground">
                Here's what I'd do next
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Personalized suggestions based on your training
              </p>
            </div>
            {progressPercent > 0 && (
              <div className="text-right">
                <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {completedCount}/{suggestions.length}
                </div>
                <div className="w-16 h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mt-1">
                  <div 
                    className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 relative">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/40 hover:border-border/60 transition-all duration-200 cursor-pointer",
                completedSuggestions.has(suggestion.id) && "opacity-75 bg-green-50/80 dark:bg-green-950/30"
              )}
              onClick={() => toggleSuggestion(suggestion.id)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  completedSuggestions.has(suggestion.id)
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-muted-foreground/30 hover:border-indigo-400"
                )}>
                  {completedSuggestions.has(suggestion.id) ? (
                    <Check className="w-3 h-3" />
                  ) : null}
                </div>
                
                <div className="text-lg mr-2">{suggestion.icon}</div>
                
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  completedSuggestions.has(suggestion.id) 
                    ? "line-through text-muted-foreground" 
                    : "text-foreground"
                )}>
                  {suggestion.text}
                </span>
              </div>
              
              <div className={cn("text-xs px-2 py-1 rounded-full bg-background/80", getTypeColor(suggestion.type))}>
                {suggestion.type}
              </div>
            </motion.div>
          ))}
          
          {/* Footer */}
          <div className="pt-4 border-t border-border/20">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/80">
                Updated based on your training trend this week
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1.5 px-3">
                Adjust Plan <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 