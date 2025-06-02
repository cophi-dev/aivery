'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy,
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  Target, 
  Award,
  Activity,
  ChevronRight,
  Timer,
  Route,
  Dumbbell,
  Heart,
  Flame,
  Star,
  CheckCircle,
  ArrowRight,
  Calendar,
  BarChart3,
  Share2
} from 'lucide-react';

interface WorkoutData {
  _id: string;
  name: string;
  type: string;
  date: string;
  duration?: number;
  distance?: number;
  calculatedVolume?: number;
  intensity?: 'low' | 'moderate' | 'high';
  cardioDetails?: {
    distance?: number;
    pace?: number;
    avgHeartRate?: number;
    calories?: number;
  };
  workoutExercises?: Array<{
    exerciseId: {
      name: string;
      category: string;
    };
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
    }>;
  }>;
}

interface PostWorkoutInsight {
  id: string;
  type: 'achievement' | 'comparison' | 'recovery' | 'next_goal';
  title: string;
  description: string;
  metric?: {
    label: string;
    value: number;
    unit: string;
    comparison?: {
      type: 'improvement' | 'decline' | 'stable';
      percentage: number;
      context: string;
    };
  };
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  priority: number;
  actionable?: {
    suggestion: string;
    actions: Array<{
      label: string;
      href?: string;
      action?: () => void;
    }>;
  };
}

interface PostWorkoutInsightsProps {
  workout: WorkoutData;
  onClose?: () => void;
  showShareButton?: boolean;
}

const PostWorkoutInsights: React.FC<PostWorkoutInsightsProps> = ({ 
  workout, 
  onClose, 
  showShareButton = true 
}) => {
  const [insights, setInsights] = useState<PostWorkoutInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [similarWorkouts, setSimilarWorkouts] = useState<WorkoutData[]>([]);

  useEffect(() => {
    const generatePostWorkoutInsights = async () => {
      try {
        setIsLoading(true);
        
        // Fetch similar workouts for comparison
        const response = await fetch(`/api/workouts/similar?type=${workout.type}&limit=5`);
        const similarData = response.ok ? await response.json() : { workouts: [] };
        setSimilarWorkouts(similarData.workouts || []);
        
        // Generate insights based on the workout
        const generatedInsights = createWorkoutInsights(workout, similarData.workouts || []);
        setInsights(generatedInsights);
      } catch (error) {
        console.error('Failed to generate post-workout insights:', error);
        // Generate basic insights without comparison
        const basicInsights = createWorkoutInsights(workout, []);
        setInsights(basicInsights);
      } finally {
        setIsLoading(false);
      }
    };

    generatePostWorkoutInsights();
  }, [workout]);

  const createWorkoutInsights = (currentWorkout: WorkoutData, previousWorkouts: WorkoutData[]): PostWorkoutInsight[] => {
    const insights: PostWorkoutInsight[] = [];
    
    // 1. Immediate Achievement Insight
    insights.push(createAchievementInsight(currentWorkout));
    
    // 2. Performance Comparison (if we have previous data)
    if (previousWorkouts.length > 0) {
      const comparisonInsight = createComparisonInsight(currentWorkout, previousWorkouts);
      if (comparisonInsight) insights.push(comparisonInsight);
    }
    
    // 3. Recovery Recommendation
    insights.push(createRecoveryInsight(currentWorkout));
    
    // 4. Next Goal Suggestion
    insights.push(createNextGoalInsight(currentWorkout, previousWorkouts));
    
    return insights.sort((a, b) => a.priority - b.priority);
  };

  const createAchievementInsight = (workout: WorkoutData): PostWorkoutInsight => {
    const duration = workout.duration ? Math.round(workout.duration / 60) : 0;
    const distance = workout.cardioDetails?.distance || workout.distance || 0;
    const volume = workout.calculatedVolume ? (workout.calculatedVolume / 1000).toFixed(1) : null;
    
    // Determine the primary achievement
    if (distance >= 10) {
      return {
        id: 'achievement-distance',
        type: 'achievement',
        title: 'Outstanding Distance Achievement!',
        description: `You crushed ${distance.toFixed(1)}km in your ${workout.type} session. That's serious endurance work!`,
        metric: {
          label: 'Distance Covered',
          value: distance,
          unit: 'km'
        },
        icon: <Trophy className="h-6 w-6" />,
        color: 'text-amber-600',
        bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
        priority: 1,
        actionable: {
          suggestion: 'Great endurance work! Focus on recovery and hydration.',
          actions: [
            { label: 'Log Recovery Notes', href: `/workouts/${workout._id}/edit` },
            { label: 'Plan Next Session', href: '/workouts/new' }
          ]
        }
      };
    }
    
    if (volume && parseFloat(volume) >= 3) {
      return {
        id: 'achievement-volume',
        type: 'achievement',
        title: 'Impressive Strength Volume!',
        description: `${volume} tons moved! Your strength training is paying off with serious volume.`,
        metric: {
          label: 'Total Volume',
          value: parseFloat(volume),
          unit: 'tons'
        },
        icon: <Dumbbell className="h-6 w-6" />,
        color: 'text-purple-600',
        bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20',
        priority: 1,
        actionable: {
          suggestion: 'Excellent strength work! Prioritize protein and rest.',
          actions: [
            { label: 'Track Nutrition', href: '/nutrition' },
            { label: 'Schedule Rest Day', href: '/calendar' }
          ]
        }
      };
    }
    
    if (duration >= 90) {
      return {
        id: 'achievement-duration',
        type: 'achievement',
        title: 'Extended Training Session!',
        description: `${duration} minutes of focused training. Your dedication is showing!`,
        metric: {
          label: 'Session Duration',
          value: duration,
          unit: 'min'
        },
        icon: <Timer className="h-6 w-6" />,
        color: 'text-green-600',
        bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
        priority: 1
      };
    }
    
    // Default achievement for any completed workout
    return {
      id: 'achievement-completion',
      type: 'achievement',
      title: 'Workout Complete!',
      description: `Another ${workout.type} session in the books. Consistency builds champions!`,
      icon: <CheckCircle className="h-6 w-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
      priority: 1,
      actionable: {
        suggestion: 'Keep the momentum going with your next session.',
        actions: [
          { label: 'Plan Next Workout', href: '/workouts/new' }
        ]
      }
    };
  };

  const createComparisonInsight = (current: WorkoutData, previous: WorkoutData[]): PostWorkoutInsight | null => {
    if (previous.length === 0) return null;
    
    const lastSimilar = previous[0];
    const currentDistance = current.cardioDetails?.distance || current.distance || 0;
    const lastDistance = lastSimilar.cardioDetails?.distance || lastSimilar.distance || 0;
    const currentVolume = current.calculatedVolume || 0;
    const lastVolume = lastSimilar.calculatedVolume || 0;
    
    // Distance comparison for cardio
    if (currentDistance > 0 && lastDistance > 0) {
      const improvement = ((currentDistance - lastDistance) / lastDistance) * 100;
      
      if (Math.abs(improvement) >= 10) {
        return {
          id: 'comparison-distance',
          type: 'comparison',
          title: improvement > 0 ? 'Distance Improvement!' : 'Distance Variation',
          description: `${Math.abs(improvement).toFixed(0)}% ${improvement > 0 ? 'increase' : 'decrease'} from your last ${current.type} session.`,
          metric: {
            label: 'Distance Change',
            value: Math.abs(improvement),
            unit: '%',
            comparison: {
              type: improvement > 0 ? 'improvement' : 'decline',
              percentage: Math.abs(improvement),
              context: `vs. ${format(new Date(lastSimilar.date), 'MMM dd')}`
            }
          },
          icon: improvement > 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />,
          color: improvement > 0 ? 'text-green-600' : 'text-orange-600',
          bgColor: improvement > 0 ? 
            'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' : 
            'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20',
          priority: 2
        };
      }
    }
    
    // Volume comparison for strength
    if (currentVolume > 0 && lastVolume > 0) {
      const improvement = ((currentVolume - lastVolume) / lastVolume) * 100;
      
      if (Math.abs(improvement) >= 15) {
        return {
          id: 'comparison-volume',
          type: 'comparison',
          title: improvement > 0 ? 'Strength Progress!' : 'Volume Adjustment',
          description: `${Math.abs(improvement).toFixed(0)}% ${improvement > 0 ? 'increase' : 'decrease'} in training volume from last session.`,
          metric: {
            label: 'Volume Change',
            value: Math.abs(improvement),
            unit: '%',
            comparison: {
              type: improvement > 0 ? 'improvement' : 'decline',
              percentage: Math.abs(improvement),
              context: `vs. ${format(new Date(lastSimilar.date), 'MMM dd')}`
            }
          },
          icon: improvement > 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />,
          color: improvement > 0 ? 'text-green-600' : 'text-orange-600',
          bgColor: improvement > 0 ? 
            'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' : 
            'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20',
          priority: 2
        };
      }
    }
    
    return null;
  };

  const createRecoveryInsight = (workout: WorkoutData): PostWorkoutInsight => {
    const duration = workout.duration ? Math.round(workout.duration / 60) : 0;
    const intensity = workout.intensity || 'moderate';
    const isHighIntensity = intensity === 'high' || duration >= 90;
    
    if (isHighIntensity) {
      return {
        id: 'recovery-high',
        type: 'recovery',
        title: 'Recovery Focus Needed',
        description: 'This was an intense session. Prioritize recovery to maximize your gains.',
        icon: <Heart className="h-6 w-6" />,
        color: 'text-red-600',
        bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20',
        priority: 3,
        actionable: {
          suggestion: 'Focus on sleep, hydration, and nutrition for optimal recovery.',
          actions: [
            { label: 'Set Sleep Reminder', action: () => console.log('Sleep reminder set') },
            { label: 'Log Recovery Notes', href: `/workouts/${workout._id}/edit` }
          ]
        }
      };
    }
    
    return {
      id: 'recovery-normal',
      type: 'recovery',
      title: 'Active Recovery Ready',
      description: 'Great session! Light activity tomorrow will help with recovery.',
      icon: <Zap className="h-6 w-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
      priority: 3,
      actionable: {
        suggestion: 'Consider light stretching or walking tomorrow.',
        actions: [
          { label: 'Plan Recovery Day', href: '/workouts/new?type=recovery' }
        ]
      }
    };
  };

  const createNextGoalInsight = (current: WorkoutData, previous: WorkoutData[]): PostWorkoutInsight => {
    const currentDistance = current.cardioDetails?.distance || current.distance || 0;
    const currentVolume = current.calculatedVolume || 0;
    
    if (currentDistance > 0) {
      const nextDistanceGoal = currentDistance < 5 ? 5 : currentDistance < 10 ? 10 : Math.ceil(currentDistance * 1.1);
      
      return {
        id: 'next-goal-distance',
        type: 'next_goal',
        title: 'Next Distance Target',
        description: `You're ready to aim for ${nextDistanceGoal}km in your next ${current.type} session.`,
        metric: {
          label: 'Target Distance',
          value: nextDistanceGoal,
          unit: 'km'
        },
        icon: <Target className="h-6 w-6" />,
        color: 'text-indigo-600',
        bgColor: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20',
        priority: 4,
        actionable: {
          suggestion: 'Gradually increase distance by 10% each session.',
          actions: [
            { label: 'Plan Next Session', href: '/workouts/new' },
            { label: 'Set Goal', href: '/goals' }
          ]
        }
      };
    }
    
    if (currentVolume > 0) {
      const nextVolumeGoal = Math.ceil(currentVolume * 1.05); // 5% increase
      
      return {
        id: 'next-goal-volume',
        type: 'next_goal',
        title: 'Next Volume Target',
        description: `Aim for ${(nextVolumeGoal / 1000).toFixed(1)} tons in your next strength session.`,
        metric: {
          label: 'Target Volume',
          value: nextVolumeGoal / 1000,
          unit: 'tons'
        },
        icon: <Target className="h-6 w-6" />,
        color: 'text-indigo-600',
        bgColor: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20',
        priority: 4,
        actionable: {
          suggestion: 'Progressive overload: small increases lead to big gains.',
          actions: [
            { label: 'Plan Next Session', href: '/workouts/new' },
            { label: 'Track Progress', href: '/analytics' }
          ]
        }
      };
    }
    
    return {
      id: 'next-goal-consistency',
      type: 'next_goal',
      title: 'Consistency Goal',
      description: 'Keep the momentum! Aim for 3-4 sessions this week.',
      icon: <Calendar className="h-6 w-6" />,
      color: 'text-indigo-600',
      bgColor: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20',
      priority: 4,
      actionable: {
        suggestion: 'Schedule your next 2-3 workouts to maintain momentum.',
        actions: [
          { label: 'View Calendar', href: '/calendar' },
          { label: 'Plan Week', href: '/planner' }
        ]
      }
    };
  };

  if (isLoading) {
    return (
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-xl">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Analyzing Your Session...</h3>
            <p className="text-muted-foreground">Generating personalized insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header */}
      <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-xl">
        <CardContent className="p-6">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Trophy className="h-10 w-10 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Workout Complete! 🎉</h2>
            <p className="text-muted-foreground mb-4">
              {workout.name} • {format(new Date(workout.date), 'MMM dd, yyyy')}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm">
              {workout.duration && (
                <div className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  {Math.round(workout.duration / 60)} min
                </div>
              )}
              {(workout.cardioDetails?.distance || workout.distance) && (
                <div className="flex items-center gap-1">
                  <Route className="h-4 w-4" />
                  {(workout.cardioDetails?.distance || workout.distance)?.toFixed(1)} km
                </div>
              )}
              {workout.calculatedVolume && (
                <div className="flex items-center gap-1">
                  <Dumbbell className="h-4 w-4" />
                  {(workout.calculatedVolume / 1000).toFixed(1)} tons
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4">
        {insights.map((insight, index) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
          >
            <Card className={`${insight.bgColor} border-0 shadow-lg hover:shadow-xl transition-all duration-200`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${insight.color} bg-white/50 dark:bg-black/20 flex-shrink-0`}>
                    {insight.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-2">{insight.title}</h3>
                    <p className="text-muted-foreground mb-3">{insight.description}</p>
                    
                    {insight.metric && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{insight.metric.label}</span>
                          <span className="font-bold">
                            {insight.metric.value}{insight.metric.unit}
                          </span>
                        </div>
                        {insight.metric.comparison && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {insight.metric.comparison.type === 'improvement' ? 
                              <TrendingUp className="h-3 w-3 text-green-600" /> : 
                              <TrendingDown className="h-3 w-3 text-orange-600" />
                            }
                            <span>{insight.metric.comparison.context}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {insight.actionable && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">
                          💡 {insight.actionable.suggestion}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {insight.actionable.actions.map((action, i) => (
                            action.href ? (
                              <Link key={i} href={action.href}>
                                <Button variant="outline" size="sm" className="text-xs">
                                  {action.label}
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            ) : (
                              <Button 
                                key={i} 
                                variant="outline" 
                                size="sm" 
                                className="text-xs"
                                onClick={action.action}
                              >
                                {action.label}
                              </Button>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Link href={`/workouts/${workout._id}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <BarChart3 className="h-4 w-4" />
            View Full Analysis
          </Button>
        </Link>
        {showShareButton && (
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share Achievement
          </Button>
        )}
        <Link href="/workouts/new" className="flex-1">
          <Button className="w-full gap-2">
            <Zap className="h-4 w-4" />
            Plan Next Workout
          </Button>
        </Link>
      </motion.div>

      {onClose && (
        <div className="text-center">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Close Insights
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default PostWorkoutInsights; 