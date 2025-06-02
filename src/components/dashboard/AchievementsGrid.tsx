'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Star, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isAfter, subDays } from 'date-fns';

interface Achievement {
  id: string;
  icon: string;
  title: string;
  detail: string;
  date: string;
  type: 'reps' | 'weight' | 'distance' | 'time' | 'daily_reps' | 'volume';
  value: number;
  isNew?: boolean;
  tier: 'bronze' | 'silver' | 'gold';
}

interface DashboardPREntry {
  _id: string;
  exerciseName: string;
  value: number;
  unit: string;
  type: string;
  date: string;
  workoutId: string | null;
}

interface AchievementsGridProps {
  exercisePRs: DashboardPREntry[];
  randomPRs: DashboardPREntry[];
  className?: string;
}

const EXERCISE_ICONS: Record<string, string> = {
  // Strength exercises
  'bench press': '🏋️‍♂️',
  'squat': '🏋️',
  'deadlift': '💪',
  'overhead press': '🏋️‍♀️',
  'pull-up': '🔗',
  'push-up': '💪',
  'kettlebell swing': '⚡',
  'sit-up': '🔥',
  'air squat': '🏋️',
  'burpee': '💥',
  
  // Cardio exercises
  'running': '🏃‍♂️',
  'cycling': '🚴‍♂️',
  'swimming': '🏊‍♂️',
  'walking': '🚶‍♂️',
  
  // Default
  'default': '🎯'
};

export default function AchievementsGrid({ exercisePRs, randomPRs, className }: AchievementsGridProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    const processAchievements = () => {
      const allPRs = [...exercisePRs, ...randomPRs];
      
      // Deduplicate achievements based on title + date composite key
      const deduplicatedPRs = Array.from(
        new Map(allPRs.map(item => [item.exerciseName + item.date, item])).values()
      );
      
      const sevenDaysAgo = subDays(new Date(), 7);
      
      const processedAchievements: Achievement[] = deduplicatedPRs.map((pr, index) => {
        const exerciseName = pr.exerciseName.toLowerCase();
        const icon = EXERCISE_ICONS[exerciseName] || EXERCISE_ICONS['default'];
        const prDate = new Date(pr.date);
        const isNew = isAfter(prDate, sevenDaysAgo);
        
        // Determine tier based on value and type (simplified from rarity system)
        let tier: Achievement['tier'] = 'bronze';
        
        if (pr.type === 'weight') {
          if (pr.value >= 100) tier = 'gold';
          else if (pr.value >= 60) tier = 'silver';
        } else if (pr.type === 'reps' || pr.type === 'daily_reps') {
          if (pr.value >= 50) tier = 'gold';
          else if (pr.value >= 25) tier = 'silver';
        } else if (pr.type === 'distance') {
          if (pr.value >= 15) tier = 'gold';
          else if (pr.value >= 8) tier = 'silver';
        }

        // Format detail based on type
        let detail = `${pr.value} ${pr.unit}`;
        if (pr.type === 'weight') {
          detail = `${pr.value}kg`;
        } else if (pr.type === 'reps') {
          detail = `${pr.value} reps`;
        } else if (pr.type === 'distance') {
          detail = `${pr.value} ${pr.unit}`;
        }

        return {
          id: pr._id || `achievement-${index}`,
          icon,
          title: pr.exerciseName,
          detail,
          date: pr.date,
          type: pr.type as Achievement['type'],
          value: pr.value,
          isNew,
          tier
        };
      });

      // Sort by relevance: new achievements first, then by tier, then by value
      const sorted = processedAchievements.sort((a, b) => {
        // New achievements first
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        
        // Then by tier
        const tierOrder = { gold: 3, silver: 2, bronze: 1 };
        const tierDiff = tierOrder[b.tier] - tierOrder[a.tier];
        if (tierDiff !== 0) return tierDiff;
        
        // Finally by value
        return b.value - a.value;
      });

      setAchievements(sorted.slice(0, 6)); // Show top 6 achievements
    };

    processAchievements();
  }, [exercisePRs, randomPRs]);

  const getTierIcon = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'gold': return <Trophy className="w-3 h-3" />;
      case 'silver': return <Medal className="w-3 h-3" />;
      default: return <Star className="w-3 h-3" />;
    }
  };

  const getTierColor = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'gold': return 'text-amber-600 dark:text-amber-400';
      case 'silver': return 'text-gray-500 dark:text-gray-400';
      default: return 'text-orange-600 dark:text-orange-400';
    }
  };

  if (achievements.length === 0) {
    return (
      <motion.section 
        className={cn("mb-8", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="apple-card">
          <CardHeader className="pb-4">
            <CardTitle className="apple-heading-md flex items-center gap-3">
              <Trophy className="w-5 h-5 text-muted-foreground" />
              Recent Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="apple-body-sm text-muted-foreground/60">
                Complete workouts to track your progress
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  return (
    <motion.section 
      className={cn("mb-8", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="apple-card">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="apple-heading-md flex items-center gap-3">
              <Trophy className="w-5 h-5 text-muted-foreground" />
              Recent Milestones
            </CardTitle>
            {achievements.some(a => a.isNew) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 dark:bg-foreground/10">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="apple-caption text-foreground">New</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: index * 0.05, 
                  duration: 0.3,
                  ease: "easeOut"
                }}
                className={cn(
                  "relative p-4 rounded-lg border bg-card/50 backdrop-blur-sm transition-all duration-200",
                  "hover:bg-card/80 hover:shadow-sm hover:-translate-y-0.5",
                  "dark:border-white/[0.05] dark:bg-card/30 dark:hover:bg-card/50"
                )}
              >
                {/* New indicator */}
                {achievement.isNew && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full" />
                )}
                
                {/* Achievement content */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className={cn("flex items-center gap-1", getTierColor(achievement.tier))}>
                      {getTierIcon(achievement.tier)}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="apple-heading-sm font-medium text-foreground mb-1">
                      {achievement.title}
                    </h3>
                    <p className="apple-body-sm text-muted-foreground">
                      {achievement.detail}
                    </p>
                  </div>
                  
                  {/* Date */}
                  <div className="flex items-center justify-between">
                    <span className="apple-caption text-muted-foreground/60">
                      {format(new Date(achievement.date), 'MMM d')}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Footer */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="apple-body-sm text-muted-foreground/60">
                Your recent personal records
              </p>
              <Button variant="ghost" size="sm" className="apple-body-sm h-auto py-2 px-3 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 