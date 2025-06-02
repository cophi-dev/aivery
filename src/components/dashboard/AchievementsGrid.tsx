'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Star, Sparkles, ArrowRight, Zap } from 'lucide-react';
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
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xp?: number; // For future XP system
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
      const sevenDaysAgo = subDays(new Date(), 7);
      
      const processedAchievements: Achievement[] = allPRs.map((pr, index) => {
        const exerciseName = pr.exerciseName.toLowerCase();
        const icon = EXERCISE_ICONS[exerciseName] || EXERCISE_ICONS['default'];
        const prDate = new Date(pr.date);
        const isNew = isAfter(prDate, sevenDaysAgo);
        
        // Determine rarity based on value and type
        let rarity: Achievement['rarity'] = 'common';
        let xp = 10; // Base XP
        
        if (pr.type === 'weight') {
          if (pr.value >= 100) rarity = 'legendary';
          else if (pr.value >= 80) rarity = 'epic';
          else if (pr.value >= 60) rarity = 'rare';
          xp = Math.round(pr.value / 2);
        } else if (pr.type === 'reps' || pr.type === 'daily_reps') {
          if (pr.value >= 100) rarity = 'legendary';
          else if (pr.value >= 50) rarity = 'epic';
          else if (pr.value >= 25) rarity = 'rare';
          xp = Math.round(pr.value * 0.5);
        } else if (pr.type === 'distance') {
          if (pr.value >= 20) rarity = 'legendary';
          else if (pr.value >= 10) rarity = 'epic';
          else if (pr.value >= 5) rarity = 'rare';
          xp = Math.round(pr.value * 2);
        }

        // Format detail based on type
        let detail = `${pr.value} ${pr.unit}`;
        if (pr.type === 'daily_reps') {
          detail = `${pr.value} ${pr.unit}`;
        } else if (pr.type === 'weight') {
          detail = `${pr.value}kg personal best`;
        } else if (pr.type === 'reps') {
          detail = `${pr.value} reps in one set`;
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
          rarity,
          xp
        };
      });

      // Sort by relevance: new achievements first, then by rarity, then by value
      const sorted = processedAchievements.sort((a, b) => {
        // New achievements first
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        
        // Then by rarity
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        const rarityDiff = rarityOrder[b.rarity] - rarityOrder[a.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        
        // Finally by value
        return b.value - a.value;
      });

      setAchievements(sorted.slice(0, 6)); // Show top 6 achievements
    };

    processAchievements();
  }, [exercisePRs, randomPRs]);

  const getRarityStyles = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return {
          cardClass: 'bg-gradient-to-br from-amber-50/90 to-yellow-50/80 dark:from-amber-950/50 dark:to-yellow-950/40 border-amber-300/50 dark:border-amber-700/50',
          badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
          iconClass: 'text-amber-600 dark:text-amber-400',
          glowClass: 'shadow-amber-200/50 dark:shadow-amber-900/30'
        };
      case 'epic':
        return {
          cardClass: 'bg-gradient-to-br from-purple-50/90 to-indigo-50/80 dark:from-purple-950/50 dark:to-indigo-950/40 border-purple-300/50 dark:border-purple-700/50',
          badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
          iconClass: 'text-purple-600 dark:text-purple-400',
          glowClass: 'shadow-purple-200/50 dark:shadow-purple-900/30'
        };
      case 'rare':
        return {
          cardClass: 'bg-gradient-to-br from-blue-50/90 to-cyan-50/80 dark:from-blue-950/50 dark:to-cyan-950/40 border-blue-300/50 dark:border-blue-700/50',
          badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
          iconClass: 'text-blue-600 dark:text-blue-400',
          glowClass: 'shadow-blue-200/50 dark:shadow-blue-900/30'
        };
      default:
        return {
          cardClass: 'bg-gradient-to-br from-gray-50/90 to-slate-50/80 dark:from-gray-950/50 dark:to-slate-950/40 border-gray-300/50 dark:border-gray-700/50',
          badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300',
          iconClass: 'text-gray-600 dark:text-gray-400',
          glowClass: 'shadow-gray-200/50 dark:shadow-gray-900/30'
        };
    }
  };

  const getRarityIcon = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return <Trophy className="w-3 h-3" />;
      case 'epic': return <Medal className="w-3 h-3" />;
      case 'rare': return <Star className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  if (achievements.length === 0) {
    return (
      <motion.section 
        className={`mb-12 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border-0 bg-gradient-to-br from-slate-50/50 to-gray-50/30 dark:from-slate-950/50 dark:to-gray-950/30">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Hall of Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">
                Complete workouts to unlock your first achievements!
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
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
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Hall of Progress
            </CardTitle>
            {achievements.some(a => a.isNew) && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  New!
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement, index) => {
              const styles = getRarityStyles(achievement.rarity);
              
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    delay: index * 0.1, 
                    duration: 0.4,
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  className={cn(
                    "relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 cursor-default",
                    styles.cardClass,
                    styles.glowClass,
                    achievement.isNew && "shadow-lg"
                  )}
                >
                  {/* New badge */}
                  {achievement.isNew && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                  
                  {/* Achievement content */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-2xl">{achievement.icon}</div>
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        styles.badgeClass
                      )}>
                        {getRarityIcon(achievement.rarity)}
                        <span className="capitalize">{achievement.rarity}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-sm text-foreground mb-1">
                        {achievement.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {achievement.detail}
                      </p>
                    </div>
                    
                    {/* Date and XP */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground/80">
                      <span>{format(new Date(achievement.date), 'MMM d')}</span>
                      {achievement.xp && (
                        <span className={cn("font-medium", styles.iconClass)}>
                          +{achievement.xp} XP
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Footer */}
          <div className="pt-4 border-t border-border/20">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/80">
                Your recent milestones and achievements
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1.5 px-3">
                View all milestones <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 