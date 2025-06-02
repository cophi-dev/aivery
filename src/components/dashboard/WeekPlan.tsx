'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Check, ChevronRight, Target, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface DashboardMetrics {
  strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  workoutCount: number;
  runningDistanceLast7Days: number;
  swimmingDistanceLast7Days: number;
  bikingDistanceLast7Days: number;
}

interface DayPlan {
  title: string;
  description: string;
  type: 'recovery' | 'strength' | 'cardio' | 'cross-training' | 'rest';
  completed: boolean;
}

interface WeekPlanProps {
  metrics: DashboardMetrics;
  className?: string;
}

export default function WeekPlan({ metrics, className }: WeekPlanProps) {
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null);
  const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const generateWeekPlan = () => {
      const today = new Date();
      const tomorrow = addDays(today, 1);
      
      // Load completion status from localStorage
      const todayKey = `plan-${format(today, 'yyyy-MM-dd')}`;
      const tomorrowKey = `plan-${format(tomorrow, 'yyyy-MM-dd')}`;
      const savedTodayCompleted = localStorage.getItem(todayKey) === 'true';
      const savedTomorrowCompleted = localStorage.getItem(tomorrowKey) === 'true';
      
      // Generate today's plan based on metrics
      let todayPlanData: DayPlan;
      
      if (metrics.workoutCount >= 6) {
        // High volume week - recommend recovery
        todayPlanData = {
          title: 'Recovery Day',
          description: '20-30 min stretching, light walk, or complete rest',
          type: 'recovery',
          completed: savedTodayCompleted
        };
      } else if (metrics.workoutCount <= 2) {
        // Low volume - recommend strength or cardio
        const hasStrength = metrics.strengthVolumeLast7Days > 0;
        if (!hasStrength) {
          todayPlanData = {
            title: 'Strength Focus',
            description: 'Upper body or lower body strength session',
            type: 'strength',
            completed: savedTodayCompleted
          };
        } else {
          todayPlanData = {
            title: 'Cardio Session',
            description: '30-45 min moderate intensity cardio',
            type: 'cardio',
            completed: savedTodayCompleted
          };
        }
      } else {
        // Moderate volume - check for variety needs
        const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
        const runningPercent = totalCardio > 0 ? (metrics.runningDistanceLast7Days / totalCardio) * 100 : 0;
        
        if (runningPercent >= 80 && totalCardio > 5) {
          todayPlanData = {
            title: 'Cross-Training',
            description: 'Try cycling, swimming, or rowing to balance running',
            type: 'cross-training',
            completed: savedTodayCompleted
          };
        } else {
          todayPlanData = {
            title: 'Active Recovery',
            description: 'Light activity: yoga, stretching, or easy walk',
            type: 'recovery',
            completed: savedTodayCompleted
          };
        }
      }
      
      // Generate tomorrow's plan (complementary to today)
      let tomorrowPlanData: DayPlan;
      
      if (todayPlanData.type === 'recovery') {
        // If today is recovery, tomorrow should be active
        const hasStrength = metrics.strengthVolumeLast7Days > 0;
        const hasCardio = metrics.cardioDistanceLast7Days > 0;
        
        if (!hasStrength) {
          tomorrowPlanData = {
            title: 'Strength Training',
            description: 'Full body or targeted muscle groups',
            type: 'strength',
            completed: savedTomorrowCompleted
          };
        } else if (!hasCardio) {
          tomorrowPlanData = {
            title: 'Cardio Session',
            description: 'Running, cycling, or other cardio activity',
            type: 'cardio',
            completed: savedTomorrowCompleted
          };
        } else {
          tomorrowPlanData = {
            title: 'Cross-Training',
            description: 'Mix it up with a new activity',
            type: 'cross-training',
            completed: savedTomorrowCompleted
          };
        }
      } else if (todayPlanData.type === 'strength') {
        // If today is strength, tomorrow could be cardio or recovery
        tomorrowPlanData = {
          title: 'Active Recovery',
          description: 'Light cardio or mobility work',
          type: 'recovery',
          completed: savedTomorrowCompleted
        };
      } else {
        // If today is cardio/cross-training, tomorrow could be strength
        tomorrowPlanData = {
          title: 'Strength Focus',
          description: 'Build muscle with resistance training',
          type: 'strength',
          completed: savedTomorrowCompleted
        };
      }
      
      setTodayPlan(todayPlanData);
      setTomorrowPlan(tomorrowPlanData);
    };

    // Calculate streak from localStorage
    const calculateStreak = () => {
      let currentStreak = 0;
      const today = new Date();
      
      // Check backwards from yesterday (today might not be complete yet)
      for (let i = 1; i <= 30; i++) {
        const checkDate = addDays(today, -i);
        const key = `plan-${format(checkDate, 'yyyy-MM-dd')}`;
        if (localStorage.getItem(key) === 'true') {
          currentStreak++;
        } else {
          break;
        }
      }
      
      setStreak(currentStreak);
    };

    generateWeekPlan();
    calculateStreak();
  }, [metrics]);

  const toggleCompletion = (day: 'today' | 'tomorrow') => {
    const date = day === 'today' ? new Date() : addDays(new Date(), 1);
    const key = `plan-${format(date, 'yyyy-MM-dd')}`;
    const plan = day === 'today' ? todayPlan : tomorrowPlan;
    
    if (!plan) return;
    
    const newCompleted = !plan.completed;
    localStorage.setItem(key, newCompleted.toString());
    
    const updatedPlan = { ...plan, completed: newCompleted };
    
    if (day === 'today') {
      setTodayPlan(updatedPlan);
      // Update streak if today was just completed
      if (newCompleted) {
        setStreak(prev => prev + 1);
      }
    } else {
      setTomorrowPlan(updatedPlan);
    }
  };

  const getTypeIcon = (type: DayPlan['type']) => {
    switch (type) {
      case 'recovery': return '😴';
      case 'strength': return '💪';
      case 'cardio': return '🏃‍♂️';
      case 'cross-training': return '🚴‍♂️';
      case 'rest': return '✨';
      default: return '🎯';
    }
  };

  const getTypeColor = (type: DayPlan['type']) => {
    switch (type) {
      case 'recovery': return 'text-blue-600 dark:text-blue-400';
      case 'strength': return 'text-red-600 dark:text-red-400';
      case 'cardio': return 'text-green-600 dark:text-green-400';
      case 'cross-training': return 'text-purple-600 dark:text-purple-400';
      case 'rest': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-orange-600 dark:text-orange-400';
    }
  };

  if (!todayPlan || !tomorrowPlan) {
    return null;
  }

  return (
    <motion.section 
      className={`mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="border-0 bg-gradient-to-br from-slate-50/50 to-gray-50/30 dark:from-slate-950/50 dark:to-gray-950/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              This Week's Plan
            </CardTitle>
            {streak > 0 && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Flame className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  {streak} day streak
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Today's Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/40 hover:border-border/60 transition-all duration-200",
              todayPlan.completed && "bg-green-50/80 dark:bg-green-950/30 opacity-75"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleCompletion('today')}
              className={cn(
                "w-8 h-8 p-0 rounded-full border-2 transition-colors",
                todayPlan.completed
                  ? "bg-green-500 border-green-500 text-white hover:bg-green-600"
                  : "border-muted-foreground/30 hover:border-blue-400"
              )}
            >
              {todayPlan.completed && <Check className="w-4 h-4" />}
            </Button>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-lg">{getTypeIcon(todayPlan.type)}</div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Today: {todayPlan.title}
                  </h3>
                  <p className={cn("text-xs font-medium capitalize", getTypeColor(todayPlan.type))}>
                    {todayPlan.type}
                  </p>
                </div>
              </div>
              <p className={cn(
                "text-sm transition-colors",
                todayPlan.completed 
                  ? "line-through text-muted-foreground" 
                  : "text-muted-foreground"
              )}>
                {todayPlan.description}
              </p>
            </div>
            
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          </motion.div>

          {/* Tomorrow's Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/40 hover:border-border/60 transition-all duration-200",
              tomorrowPlan.completed && "bg-green-50/80 dark:bg-green-950/30 opacity-75"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleCompletion('tomorrow')}
              className={cn(
                "w-8 h-8 p-0 rounded-full border-2 transition-colors",
                tomorrowPlan.completed
                  ? "bg-green-500 border-green-500 text-white hover:bg-green-600"
                  : "border-muted-foreground/30 hover:border-blue-400"
              )}
            >
              {tomorrowPlan.completed && <Check className="w-4 h-4" />}
            </Button>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-lg">{getTypeIcon(tomorrowPlan.type)}</div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Tomorrow: {tomorrowPlan.title}
                  </h3>
                  <p className={cn("text-xs font-medium capitalize", getTypeColor(tomorrowPlan.type))}>
                    {tomorrowPlan.type}
                  </p>
                </div>
              </div>
              <p className={cn(
                "text-sm transition-colors",
                tomorrowPlan.completed 
                  ? "line-through text-muted-foreground" 
                  : "text-muted-foreground"
              )}>
                {tomorrowPlan.description}
              </p>
            </div>
            
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          </motion.div>
          
          {/* Footer */}
          <div className="pt-4 border-t border-border/20">
            <p className="text-xs text-muted-foreground/80 text-center">
              Your plan evolves as Aivery analyzes your training patterns
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 