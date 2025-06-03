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
  Flame,
  ArrowUpRight,
  Brain,
  Lightbulb
} from 'lucide-react';

// Enhanced insight types for sophisticated analysis
type SmartInsight = {
  id: string;
  workoutId: string;
  type: 'achievement' | 'improvement' | 'concern' | 'tip' | 'milestone';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  context: string;
  actionable_tip?: string;
  trend_data?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  icon: React.ReactNode;
  color: string;
  bgColor: string;
};

type WorkoutData = {
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

const RecentWorkoutInsights = () => {
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/dashboard/recent-workouts');
        
        if (!res.ok) {
          throw new Error('Failed to fetch recent workouts');
        }
        
        const data = await res.json();
        setWorkouts(data.workouts || []);
        
        // Generate sophisticated insights
        if (data.workouts && data.workouts.length > 0) {
          const generatedInsights = generateSmartInsights(data.workouts);
          setInsights(generatedInsights);
        }
      } catch (error) {
        console.error('Failed to fetch workout data:', error);
        setError('Unable to load workout insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const generateSmartInsights = (recentWorkouts: WorkoutData[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    
    // Sort workouts by date (newest first)
    const sortedWorkouts = [...recentWorkouts].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (sortedWorkouts.length === 0) return insights;

    // 1. Recent Achievement Analysis
    const recentAchievements = analyzeRecentAchievements(sortedWorkouts);
    insights.push(...recentAchievements);

    // 2. Training Consistency Insights
    const consistencyInsights = analyzeTrainingConsistency(sortedWorkouts);
    insights.push(...consistencyInsights);

    // 3. Performance Progression Analysis
    const progressionInsights = analyzePerformanceProgression(sortedWorkouts);
    insights.push(...progressionInsights);

    // 4. Recovery and Balance Tips
    const recoveryInsights = analyzeRecoveryAndBalance(sortedWorkouts);
    insights.push(...recoveryInsights);

    // Sort by priority and return top 3 insights
    return insights
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 3);
  };

  const analyzeRecentAchievements = (workouts: WorkoutData[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    const latest = workouts[0];
    const hoursAgo = differenceInHours(new Date(), new Date(latest.date));
    
    // Recent session context
    if (hoursAgo <= 24) {
      const distance = latest.cardioDetails?.distance || latest.distance || 0;
      const volume = latest.calculatedVolume || 0;
      const duration = latest.duration || 0;

      // Significant distance achievement
      if (distance >= 10) {
        insights.push({
          id: `achievement-distance-${latest._id}`,
          workoutId: latest._id,
          type: 'achievement',
          priority: 'high',
          title: 'Outstanding Endurance Session',
          description: `${distance.toFixed(1)}km ${latest.type} completed`,
          context: `This puts you in the top tier of endurance athletes. Your cardiovascular fitness is clearly developing well.`,
          actionable_tip: 'Consider adding recovery-focused sessions to maintain this performance level sustainably.',
          icon: <Award className="h-5 w-5" />,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 dark:bg-amber-950/20'
        });
      }

      // Volume milestone for strength
      if (volume >= 3000) {
        const volumeInTons = volume / 1000;
        insights.push({
          id: `achievement-volume-${latest._id}`,
          workoutId: latest._id,
          type: 'achievement',
          priority: 'high',
          title: 'Impressive Training Volume',
          description: `${volumeInTons.toFixed(1)} tons moved in single session`,
          context: `This level of volume indicates serious strength development. Your work capacity is expanding significantly.`,
          actionable_tip: 'Focus on protein intake within 2 hours post-workout to maximize recovery from this high-volume session.',
          icon: <Dumbbell className="h-5 w-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 dark:bg-purple-950/20'
        });
      }
    }

    return insights;
  };

  const analyzeTrainingConsistency = (workouts: WorkoutData[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekWorkouts = workouts.filter(w => new Date(w.date) >= weekAgo);
    
    // Consistency patterns
    if (thisWeekWorkouts.length >= 4) {
      const workoutTypes = Array.from(new Set(thisWeekWorkouts.map(w => w.type)));
      
      insights.push({
        id: 'consistency-champion',
        workoutId: thisWeekWorkouts[0]._id,
        type: 'milestone',
        priority: 'high',
        title: 'Consistency is Your Superpower',
        description: `${thisWeekWorkouts.length} sessions this week across ${workoutTypes.length} modalities`,
        context: `This frequency creates the hormonal and neurological adaptations that drive real fitness gains.`,
        actionable_tip: 'Consider planning a lighter week next week to allow full adaptation to this training stimulus.',
        icon: <Flame className="h-5 w-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/20'
      });
    } else if (thisWeekWorkouts.length === 1) {
      const daysSinceLastWorkout = differenceInDays(new Date(), new Date(thisWeekWorkouts[0].date));
      
      insights.push({
        id: 'momentum-builder',
        workoutId: thisWeekWorkouts[0]._id,
        type: 'tip',
        priority: 'medium',
        title: 'Perfect Time to Build Momentum',
        description: `One quality session completed, ${6 - daysSinceLastWorkout} days left this week`,
        context: `Single sessions maintain fitness, but consistency drives progress. You're positioned perfectly to accelerate.`,
        actionable_tip: 'Aim for 2-3 more sessions this week. Even 20-minute sessions create meaningful adaptation.',
        icon: <Target className="h-5 w-5" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20'
      });
    }

    return insights;
  };

  const analyzePerformanceProgression = (workouts: WorkoutData[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    
    if (workouts.length < 3) return insights;

    // Compare recent 3 workouts of same type
    const workoutsByType: Record<string, WorkoutData[]> = {};
    workouts.forEach(w => {
      if (!workoutsByType[w.type]) workoutsByType[w.type] = [];
      workoutsByType[w.type].push(w);
    });

    Object.entries(workoutsByType).forEach(([type, typeWorkouts]) => {
      if (typeWorkouts.length >= 3) {
        const recent = typeWorkouts.slice(0, 3);
        
        // Volume progression for strength
        if (type === 'strength' && recent.every(w => w.calculatedVolume)) {
          const volumes = recent.map(w => w.calculatedVolume || 0);
          const isIncreasing = volumes[0] > volumes[1] && volumes[1] > volumes[2];
          
          if (isIncreasing) {
            const improvement = ((volumes[0] - volumes[2]) / volumes[2]) * 100;
            insights.push({
              id: `progression-${type}`,
              workoutId: recent[0]._id,
              type: 'improvement',
              priority: 'high',
              title: 'Strength Gains Accelerating',
              description: `Training volume up ${improvement.toFixed(0)}% over recent sessions`,
              context: `This progression indicates your neuromuscular system is adapting efficiently to your training stimulus.`,
              actionable_tip: 'This is an ideal time to add a new movement pattern or increase training frequency while avoiding volume jumps.',
              trend_data: {
                direction: 'up',
                percentage: improvement,
                period: 'last 3 sessions'
              },
              icon: <TrendingUp className="h-5 w-5" />,
              color: 'text-green-600',
              bgColor: 'bg-green-50 dark:bg-green-950/20'
            });
          }
        }

        // Distance progression for cardio
        if (['running', 'cycling', 'cardio'].includes(type)) {
          const distances = recent.map(w => w.cardioDetails?.distance || w.distance || 0).filter(d => d > 0);
          if (distances.length >= 3) {
            const isIncreasing = distances[0] > distances[1] && distances[1] > distances[2];
            
            if (isIncreasing) {
              const improvement = ((distances[0] - distances[2]) / distances[2]) * 100;
              insights.push({
                id: `progression-${type}`,
                workoutId: recent[0]._id,
                type: 'improvement',
                priority: 'high',
                title: 'Endurance Building Beautifully',
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} distance up ${improvement.toFixed(0)}%`,
                context: `Your aerobic system is responding well to training. This steady progression builds a strong foundation.`,
                actionable_tip: 'Add one tempo or interval session weekly to complement this steady aerobic development.',
                trend_data: {
                  direction: 'up',
                  percentage: improvement,
                  period: 'recent trend'
                },
                icon: <Route className="h-5 w-5" />,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50 dark:bg-blue-950/20'
              });
            }
          }
        }
      }
    });

    return insights;
  };

  const analyzeRecoveryAndBalance = (workouts: WorkoutData[]): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    const recentWeek = workouts.filter(w => 
      differenceInDays(new Date(), new Date(w.date)) <= 7
    );

    // Training balance analysis
    const strengthSessions = recentWeek.filter(w => w.type === 'strength').length;
    const cardioSessions = recentWeek.filter(w => ['running', 'cycling', 'cardio', 'swimming'].includes(w.type)).length;
    
    if (recentWeek.length >= 3) {
      if (strengthSessions === 0 && cardioSessions > 0) {
        insights.push({
          id: 'balance-strength',
          workoutId: recentWeek[0]._id,
          type: 'tip',
          priority: 'medium',
          title: 'Consider Adding Strength Training',
          description: `${cardioSessions} cardio sessions, no strength work this week`,
          context: `Strength training enhances power output, injury resilience, and metabolic efficiency for all activities.`,
          actionable_tip: 'Add 2 strength sessions weekly: one upper body, one lower body. Even bodyweight exercises create meaningful adaptation.',
          icon: <Dumbbell className="h-5 w-5" />,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 dark:bg-orange-950/20'
        });
      } else if (cardioSessions === 0 && strengthSessions > 0) {
        insights.push({
          id: 'balance-cardio',
          workoutId: recentWeek[0]._id,
          type: 'tip',
          priority: 'medium',
          title: 'Balance with Cardiovascular Work',
          description: `${strengthSessions} strength sessions, no cardio this week`,
          context: `Cardiovascular fitness supports strength training recovery and overall health markers.`,
          actionable_tip: 'Add 2-3 cardio sessions weekly. Even 20-minute walks enhance recovery between strength sessions.',
          icon: <Heart className="h-5 w-5" />,
          color: 'text-pink-600',
          bgColor: 'bg-pink-50 dark:bg-pink-950/20'
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
              <Brain className="h-6 w-6 text-primary animate-pulse" />
              Analyzing Your Training...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  if (error) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">{error}</p>
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
              <Lightbulb className="h-6 w-6 text-primary" />
              Training Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Build Your Training History</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Complete a few more workouts to unlock personalized insights about your progress, training patterns, and optimization opportunities.
              </p>
              <Link href="/workouts/new">
                <Button size="lg" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Log Next Workout
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
                <Brain className="h-6 w-6 text-primary" />
                Training Insights
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered analysis of your recent sessions
              </p>
            </div>
            <Link href="/workouts">
              <Button variant="outline" size="sm" className="gap-2">
                View History
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Link href={`/workouts/${insight.workoutId}`}>
                <div className={`group cursor-pointer rounded-lg p-4 transition-all duration-200 hover:shadow-md ${insight.bgColor}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 p-2 rounded-lg bg-white/80 ${insight.color}`}>
                      {insight.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {insight.title}
                        </h4>
                        <Badge 
                          variant={insight.type === 'achievement' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {insight.type}
                        </Badge>
                      </div>
                      
                      <p className="text-sm font-medium text-foreground/90 mb-2">
                        {insight.description}
                      </p>
                      
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {insight.context}
                      </p>
                      
                      {insight.actionable_tip && (
                        <div className="flex items-start gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-md">
                          <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground/80 font-medium">
                            {insight.actionable_tip}
                          </p>
                        </div>
                      )}
                      
                      {insight.trend_data && (
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {insight.trend_data.direction === 'up' ? 
                              <TrendingUp className="h-3 w-3 text-green-600" /> : 
                              <TrendingDown className="h-3 w-3 text-orange-600" />
                            }
                            <span>{insight.trend_data.percentage.toFixed(0)}% over {insight.trend_data.period}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.section>
  );
};

export default RecentWorkoutInsights; 