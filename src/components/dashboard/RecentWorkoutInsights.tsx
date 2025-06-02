'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  Zap, 
  Target, 
  Award,
  Activity,
  ChevronRight,
  Calendar,
  Timer,
  Route,
  Dumbbell,
  Heart,
  Flame
} from 'lucide-react';

// Type definitions matching the user's specification
type WorkoutInsight = {
  date: string;
  type: 'strength' | 'cardio' | 'running' | 'cycling' | 'swimming';
  volume?: number;
  distance?: number;
  intensity?: 'low' | 'moderate' | 'high';
  notes?: string;
  _id: string;
  name: string;
  duration?: number;
  calculatedVolume?: number;
  cardioDetails?: {
    distance?: number;
    pace?: number;
    avgHeartRate?: number;
  };
};

interface EnhancedInsight {
  id: string;
  workoutId: string;
  title: string;
  description: string;
  metric: string;
  metricValue: number;
  metricUnit: string;
  category: 'performance' | 'consistency' | 'achievement' | 'recovery';
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  comparison?: {
    type: 'improvement' | 'decline' | 'stable';
    percentage?: number;
    context: string;
  };
  actionable?: {
    suggestion: string;
    nextSteps: string[];
  };
}

const RecentWorkoutInsights = () => {
  const [workouts, setWorkouts] = useState<WorkoutInsight[]>([]);
  const [insights, setInsights] = useState<EnhancedInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentWorkouts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/dashboard/recent-workouts');
        
        if (!res.ok) {
          throw new Error('Failed to fetch recent workouts');
        }
        
        const data = await res.json();
        setWorkouts(data.workouts || []);
        
        // Generate enhanced insights for recent workouts
        if (data.workouts && data.workouts.length > 0) {
          const generatedInsights = generateEnhancedInsights(data.workouts);
          setInsights(generatedInsights);
        }
      } catch (error) {
        console.error('Failed to fetch recent workouts:', error);
        setError('Unable to load recent workout insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentWorkouts();
  }, []);

  const generateEnhancedInsights = (recentWorkouts: WorkoutInsight[]): EnhancedInsight[] => {
    const insights: EnhancedInsight[] = [];
    
    // Sort workouts by date (newest first)
    const sortedWorkouts = [...recentWorkouts].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Process the most recent workout for immediate post-session insights
    if (sortedWorkouts.length > 0) {
      const latestWorkout = sortedWorkouts[0];
      const hoursAgo = differenceInHours(new Date(), new Date(latestWorkout.date));
      const daysAgo = differenceInDays(new Date(), new Date(latestWorkout.date));
      
      // Fresh session insights (within 24 hours)
      if (hoursAgo <= 24) {
        insights.push(...generateFreshSessionInsights(latestWorkout, hoursAgo));
      }
      
      // Compare with previous similar workouts
      const similarWorkouts = sortedWorkouts.filter(w => 
        w.type === latestWorkout.type && w._id !== latestWorkout._id
      ).slice(0, 3);
      
      if (similarWorkouts.length > 0) {
        insights.push(...generateComparisonInsights(latestWorkout, similarWorkouts));
      }
    }

    // Weekly consistency insights
    const weeklyInsights = generateWeeklyConsistencyInsights(sortedWorkouts);
    insights.push(...weeklyInsights);

    // Performance trend insights
    const trendInsights = generatePerformanceTrendInsights(sortedWorkouts);
    insights.push(...trendInsights);

    // Sort by priority and return top 4 insights
    return insights
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 4);
  };

  const generateFreshSessionInsights = (workout: WorkoutInsight, hoursAgo: number): EnhancedInsight[] => {
    const insights: EnhancedInsight[] = [];
    const timeText = hoursAgo < 1 ? 'just now' : hoursAgo < 2 ? '1 hour ago' : `${Math.floor(hoursAgo)} hours ago`;
    
    // Distance achievement for cardio
    if (workout.cardioDetails?.distance || workout.distance) {
      const distance = workout.cardioDetails?.distance || workout.distance || 0;
      
      if (distance >= 10) {
        insights.push({
          id: `fresh-distance-${workout._id}`,
          workoutId: workout._id,
          title: 'Outstanding Distance!',
          description: `${distance.toFixed(1)}km ${workout.type} • ${timeText}`,
          metric: 'Distance',
          metricValue: distance,
          metricUnit: 'km',
          category: 'achievement',
          priority: 'high',
          icon: <Award className="h-5 w-5" />,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 dark:bg-amber-950/20'
        });
      } else if (distance >= 5) {
        insights.push({
          id: `fresh-distance-${workout._id}`,
          workoutId: workout._id,
          title: 'Solid Session',
          description: `${distance.toFixed(1)}km ${workout.type} • ${timeText}`,
          metric: 'Distance',
          metricValue: distance,
          metricUnit: 'km',
          category: 'performance',
          priority: 'medium',
          icon: <Route className="h-5 w-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20'
        });
      }
    }

    // Volume achievement for strength
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      const volumeInTons = workout.calculatedVolume / 1000;
      
      if (volumeInTons >= 3) {
        insights.push({
          id: `fresh-volume-${workout._id}`,
          workoutId: workout._id,
          title: 'Impressive Strength Volume!',
          description: `${volumeInTons.toFixed(1)} tons moved • ${timeText}`,
          metric: 'Volume',
          metricValue: volumeInTons,
          metricUnit: 'tons',
          category: 'achievement',
          priority: 'high',
          icon: <Dumbbell className="h-5 w-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 dark:bg-purple-950/20'
        });
      }
    }

    // Duration insights
    if (workout.duration && workout.duration > 0) {
      const durationMinutes = Math.round(workout.duration / 60);
      
      if (durationMinutes >= 90) {
        insights.push({
          id: `fresh-duration-${workout._id}`,
          workoutId: workout._id,
          title: 'Extended Session',
          description: `${durationMinutes} min ${workout.type} • ${timeText}`,
          metric: 'Duration',
          metricValue: durationMinutes,
          metricUnit: 'min',
          category: 'performance',
          priority: 'medium',
          icon: <Timer className="h-5 w-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950/20'
        });
      }
    }

    return insights;
  };

  const generateComparisonInsights = (current: WorkoutInsight, previous: WorkoutInsight[]): EnhancedInsight[] => {
    const insights: EnhancedInsight[] = [];
    
    if (previous.length === 0) return insights;
    
    const lastSimilar = previous[0];
    
    // Distance comparison
    const currentDistance = current.cardioDetails?.distance || current.distance || 0;
    const lastDistance = lastSimilar.cardioDetails?.distance || lastSimilar.distance || 0;
    
    if (currentDistance > 0 && lastDistance > 0) {
      const improvement = ((currentDistance - lastDistance) / lastDistance) * 100;
      
      if (Math.abs(improvement) >= 10) {
        insights.push({
          id: `comparison-distance-${current._id}`,
          workoutId: current._id,
          title: improvement > 0 ? 'Distance Up!' : 'Distance Down',
          description: `${Math.abs(improvement).toFixed(0)}% ${improvement > 0 ? 'increase' : 'decrease'} vs. last ${current.type}`,
          metric: 'Distance Change',
          metricValue: Math.abs(improvement),
          metricUnit: '%',
          category: 'performance',
          priority: improvement > 0 ? 'high' : 'medium',
          icon: improvement > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
          color: improvement > 0 ? 'text-green-600' : 'text-orange-600',
          bgColor: improvement > 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20',
          comparison: {
            type: improvement > 0 ? 'improvement' : 'decline',
            percentage: Math.abs(improvement),
            context: `vs. ${format(new Date(lastSimilar.date), 'MMM dd')}`
          }
        });
      }
    }

    // Volume comparison for strength workouts
    const currentVolume = current.calculatedVolume || 0;
    const lastVolume = lastSimilar.calculatedVolume || 0;
    
    if (currentVolume > 0 && lastVolume > 0) {
      const volumeImprovement = ((currentVolume - lastVolume) / lastVolume) * 100;
      
      if (Math.abs(volumeImprovement) >= 15) {
        insights.push({
          id: `comparison-volume-${current._id}`,
          workoutId: current._id,
          title: volumeImprovement > 0 ? 'Volume Up!' : 'Volume Down',
          description: `${Math.abs(volumeImprovement).toFixed(0)}% ${volumeImprovement > 0 ? 'increase' : 'decrease'} vs. last session`,
          metric: 'Volume Change',
          metricValue: Math.abs(volumeImprovement),
          metricUnit: '%',
          category: 'performance',
          priority: volumeImprovement > 0 ? 'high' : 'medium',
          icon: volumeImprovement > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
          color: volumeImprovement > 0 ? 'text-green-600' : 'text-orange-600',
          bgColor: volumeImprovement > 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20',
          comparison: {
            type: volumeImprovement > 0 ? 'improvement' : 'decline',
            percentage: Math.abs(volumeImprovement),
            context: `vs. ${format(new Date(lastSimilar.date), 'MMM dd')}`
          }
        });
      }
    }

    return insights;
  };

  const generateWeeklyConsistencyInsights = (workouts: WorkoutInsight[]): EnhancedInsight[] => {
    const insights: EnhancedInsight[] = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const thisWeekWorkouts = workouts.filter(w => new Date(w.date) >= weekAgo);
    
    if (thisWeekWorkouts.length >= 4) {
      insights.push({
        id: 'weekly-consistency-high',
        workoutId: thisWeekWorkouts[0]._id,
        title: 'Consistency Champion!',
        description: `${thisWeekWorkouts.length} workouts this week`,
        metric: 'Weekly Sessions',
        metricValue: thisWeekWorkouts.length,
        metricUnit: 'workouts',
        category: 'consistency',
        priority: 'high',
        icon: <Flame className="h-5 w-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/20'
      });
    } else if (thisWeekWorkouts.length >= 2) {
      insights.push({
        id: 'weekly-consistency-good',
        workoutId: thisWeekWorkouts[0]._id,
        title: 'Building Momentum',
        description: `${thisWeekWorkouts.length} sessions this week`,
        metric: 'Weekly Sessions',
        metricValue: thisWeekWorkouts.length,
        metricUnit: 'workouts',
        category: 'consistency',
        priority: 'medium',
        icon: <Target className="h-5 w-5" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20'
      });
    }

    return insights;
  };

  const generatePerformanceTrendInsights = (workouts: WorkoutInsight[]): EnhancedInsight[] => {
    const insights: EnhancedInsight[] = [];
    
    if (workouts.length < 3) return insights;
    
    // Analyze recent 3 workouts for trends
    const recentThree = workouts.slice(0, 3);
    const strengthWorkouts = recentThree.filter(w => w.calculatedVolume && w.calculatedVolume > 0);
    const cardioWorkouts = recentThree.filter(w => (w.cardioDetails?.distance || w.distance) && (w.cardioDetails?.distance || w.distance)! > 0);
    
    // Strength trend
    if (strengthWorkouts.length >= 2) {
      const volumes = strengthWorkouts.map(w => w.calculatedVolume || 0);
      const isIncreasing = volumes[0] > volumes[1];
      
      if (isIncreasing) {
        insights.push({
          id: 'trend-strength-up',
          workoutId: strengthWorkouts[0]._id,
          title: 'Strength Trending Up!',
          description: 'Volume consistently increasing',
          metric: 'Trend',
          metricValue: 1,
          metricUnit: 'positive',
          category: 'performance',
          priority: 'medium',
          icon: <TrendingUp className="h-5 w-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950/20'
        });
      }
    }

    // Cardio trend
    if (cardioWorkouts.length >= 2) {
      const distances = cardioWorkouts.map(w => w.cardioDetails?.distance || w.distance || 0);
      const isIncreasing = distances[0] > distances[1];
      
      if (isIncreasing) {
        insights.push({
          id: 'trend-cardio-up',
          workoutId: cardioWorkouts[0]._id,
          title: 'Endurance Building!',
          description: 'Distances progressively increasing',
          metric: 'Trend',
          metricValue: 1,
          metricUnit: 'positive',
          category: 'performance',
          priority: 'medium',
          icon: <TrendingUp className="h-5 w-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20'
        });
      }
    }

    return insights;
  };

  if (isLoading) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              Recent Workout Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className="p-4 bg-muted/30 rounded-xl animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  if (insights.length === 0) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              Recent Workout Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">Ready to Build Insights?</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Complete a few workouts to unlock personalized insights about your progress, achievements, and training patterns.
              </p>
              <Link href="/workouts/new">
                <Button size="lg" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Start Your First Workout
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-primary" />
                Recent Workout Insights
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your latest training highlights and achievements
              </p>
            </div>
            <Link href="/workouts">
              <Button variant="outline" size="sm" className="gap-2">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link href={`/workouts/${insight.workoutId}`}>
                  <Card className={`${insight.bgColor} border-0 hover:shadow-md transition-all duration-200 cursor-pointer group`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${insight.color} bg-white/50 dark:bg-black/20`}>
                            {insight.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {insight.title}
                              </h4>
                              <Badge 
                                variant={insight.priority === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {insight.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {insight.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {insight.metric}: {insight.metricValue}{insight.metricUnit}
                              </span>
                              {insight.comparison && (
                                <span className="flex items-center gap-1">
                                  {insight.comparison.type === 'improvement' ? 
                                    <TrendingUp className="h-3 w-3 text-green-600" /> : 
                                    <TrendingDown className="h-3 w-3 text-orange-600" />
                                  }
                                  {insight.comparison.context}
                                </span>
                              )}
                            </div>

                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
};

export default RecentWorkoutInsights; 