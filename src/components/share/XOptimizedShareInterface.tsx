'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trophy, Target, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import the new X-optimized components
import { XOptimizedShareCard } from '../workout/XOptimizedShareCard';
import { XOptimizedDailyCard } from '../dashboard/XOptimizedDailyCard';
import { XOptimizedWeeklyCard } from '../dashboard/XOptimizedWeeklyCard';
import { XOptimizedMonthlyCard } from '../dashboard/XOptimizedMonthlyCard';

interface XOptimizedShareInterfaceProps {
  // Workout data
  workout?: {
    id: string;
    type: string;
    date: Date;
    duration?: number;
    distance?: number;
    calculatedVolume?: number;
    name?: string;
    user?: {
      name?: string;
      image?: string;
    };
  };
  
  // Daily data
  dailyWorkouts?: Array<{
    id: string;
    type: string;
    date: Date;
    duration?: number;
    distance?: number;
    calculatedVolume?: number;
  }>;
  
  // Weekly data
  weeklyStats?: {
    current: {
      workouts: number;
      distance: number;
      volume: number;
      duration: number;
    };
    previous: {
      workouts: number;
      distance: number;
      volume: number;
      duration: number;
    };
    deltas: {
      workoutsDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
      distanceDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
      volumeDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
    };
  };
  
  // Monthly data
  monthlyStats?: {
    current: {
      workouts: number;
      distance: number;
      volume: number;
      duration: number;
      activeDays: number;
    };
    previous: {
      workouts: number;
      distance: number;
      volume: number;
      duration: number;
      activeDays: number;
    };
    deltas: {
      workoutsDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
      distanceDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
      volumeDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
    };
  };
  
  // PR data
  personalRecords?: Array<{
    type: 'weight' | 'reps' | 'distance' | 'volume' | 'time';
    exercise?: string;
    value: number;
    unit: string;
    isNew?: boolean;
  }>;
  
  // Insights
  insight?: string;
  
  className?: string;
}

export function XOptimizedShareInterface({
  workout,
  dailyWorkouts = [],
  weeklyStats,
  monthlyStats,
  personalRecords = [],
  insight,
  className
}: XOptimizedShareInterfaceProps) {
  const [activeTab, setActiveTab] = useState('workout');
  
  // Filter PRs by timeframe
  const workoutPRs = personalRecords.filter(pr => pr.isNew);
  const dailyPRs = personalRecords.filter(pr => pr.isNew === true).map(pr => ({ ...pr, isNew: true as const })); // For today
  
  // Map PRs to weekly format (only distance, volume, or exercise types)
  const weeklyPRs = personalRecords
    .filter(pr => pr.isNew === true && ['distance', 'volume'].includes(pr.type))
    .map(pr => ({ 
      ...pr, 
      date: new Date(),
      type: pr.type as 'distance' | 'volume'
    }));
    
  // Map PRs to monthly format (distance, volume, exercise, or consistency types)
  const monthlyPRs = personalRecords
    .filter(pr => pr.isNew === true && ['distance', 'volume'].includes(pr.type))
    .map(pr => ({ 
      ...pr, 
      date: new Date(),
      type: pr.type as 'distance' | 'volume'
    }));

  const getTabInfo = () => {
    const tabs = [];
    
    // Workout tab - show if we have a specific workout
    if (workout) {
      tabs.push({
        value: 'workout',
        label: 'Workout',
        icon: <Target className="h-4 w-4" />,
        badge: workoutPRs.length > 0 ? `${workoutPRs.length} PR${workoutPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share this specific workout'
      });
    }
    
    // Daily tab - show if we have workouts today
    if (dailyWorkouts.length > 0) {
      tabs.push({
        value: 'daily',
        label: 'Today',
        icon: <Calendar className="h-4 w-4" />,
        badge: dailyPRs.length > 0 ? `${dailyPRs.length} PR${dailyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share today\'s progress'
      });
    }
    
    // Weekly tab - show if we have weekly stats
    if (weeklyStats) {
      tabs.push({
        value: 'weekly',
        label: 'Weekly',
        icon: <TrendingUp className="h-4 w-4" />,
        badge: weeklyPRs.length > 0 ? `${weeklyPRs.length} PR${weeklyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share weekly summary'
      });
    }
    
    // Monthly tab - show if we have monthly stats
    if (monthlyStats) {
      tabs.push({
        value: 'monthly',
        label: 'Monthly',
        icon: <Trophy className="h-4 w-4" />,
        badge: monthlyPRs.length > 0 ? `${monthlyPRs.length} PR${monthlyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share monthly achievements'
      });
    }
    
    // Set the first available tab as active if current is not available
    if (tabs.length > 0 && !tabs.find(tab => tab.value === activeTab)) {
      setActiveTab(tabs[0].value);
    }
    
    return tabs;
  };

  const tabs = getTabInfo();
  
  if (tabs.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="text-4xl mb-4">📊</div>
        <p className="text-lg text-muted-foreground">
          Complete a workout to create shareable content!
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-4xl mx-auto", className)}
    >
      <Card className="border-0 bg-background/50 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">X-Optimized Share Cards</CardTitle>
          </div>
          <p className="text-muted-foreground">
            Create beautiful, X-optimized share cards that showcase your fitness achievements
          </p>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="flex items-center gap-2 relative"
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.badge && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1 text-xs bg-amber-100 text-amber-700 border-amber-300"
                    >
                      {tab.badge}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <AnimatePresence mode="wait">
              {/* Workout Tab */}
              {workout && (
                <TabsContent value="workout" className="mt-0">
                  <motion.div
                    key="workout"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-medium">Workout Achievement Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Perfect for sharing immediately after your workout
                      </p>
                    </div>
                    <XOptimizedShareCard
                      workout={workout}
                      insight={insight}
                      personalRecords={workoutPRs}
                    />
                  </motion.div>
                </TabsContent>
              )}

              {/* Daily Tab */}
              {dailyWorkouts.length > 0 && (
                <TabsContent value="daily" className="mt-0">
                  <motion.div
                    key="daily"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-medium">Daily Progress Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Showcase today's dedication and achievements
                      </p>
                    </div>
                    <XOptimizedDailyCard
                      workouts={dailyWorkouts}
                      dailyPRs={dailyPRs}
                      insight={insight}
                    />
                  </motion.div>
                </TabsContent>
              )}

              {/* Weekly Tab */}
              {weeklyStats && (
                <TabsContent value="weekly" className="mt-0">
                  <motion.div
                    key="weekly"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-medium">Weekly Summary Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Celebrate a week of consistency and progress
                      </p>
                    </div>
                    <XOptimizedWeeklyCard
                      weeklyStats={weeklyStats}
                      weeklyPRs={weeklyPRs}
                    />
                  </motion.div>
                </TabsContent>
              )}

              {/* Monthly Tab */}
              {monthlyStats && (
                <TabsContent value="monthly" className="mt-0">
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-medium">Monthly Achievements Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Highlight your biggest accomplishments and milestones
                      </p>
                    </div>
                    <XOptimizedMonthlyCard
                      monthlyStats={monthlyStats}
                      monthlyPRs={monthlyPRs}
                    />
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </Tabs>

          {/* Instructions */}
          <div className="mt-8 p-6 bg-muted/50 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-2">X-Optimized for Maximum Impact</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Perfect 16:9 aspect ratio (1200x675px) for X timeline</li>
                  <li>• Automatic PR highlighting with golden accents</li>
                  <li>• Clean, minimalist design that stands out</li>
                  <li>• Smart share text with relevant hashtags</li>
                  <li>• High-quality image generation for crisp sharing</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default XOptimizedShareInterface; 