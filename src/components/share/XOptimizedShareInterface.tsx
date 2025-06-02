'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trophy, Target, TrendingUp, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Import the new X-optimized components
import { XOptimizedShareCard } from '../workout/XOptimizedShareCard';
import { XOptimizedDailyCard } from '../dashboard/XOptimizedDailyCard';
import { XOptimizedWeeklyCard } from '../dashboard/XOptimizedWeeklyCard';
import { XOptimizedMonthlyCard } from '../dashboard/XOptimizedMonthlyCard';

interface XOptimizedShareInterfaceProps {
  // Workout data - now supports multiple workouts
  workouts?: Array<{
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
  }>;
  
  // Daily data - now supports multiple days
  dailyWorkoutsByDate?: Record<string, Array<{
    id: string;
    type: string;
    date: Date;
    duration?: number;
    distance?: number;
    calculatedVolume?: number;
  }>>;
  
  // Weekly data - now supports multiple weeks
  weeklyStatsByDate?: Record<string, {
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
  }>;
  
  // Monthly data - now supports multiple months
  monthlyStatsByDate?: Record<string, {
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
  }>;
  
  // PR data by timeframe
  personalRecordsByDate?: Record<string, Array<{
    type: 'weight' | 'reps' | 'distance' | 'volume' | 'time';
    exercise?: string;
    value: number;
    unit: string;
    isNew?: boolean;
  }>>;
  
  // Insights
  insight?: string;
  
  className?: string;
}

export function XOptimizedShareInterface({
  workouts = [],
  dailyWorkoutsByDate = {},
  weeklyStatsByDate = {},
  monthlyStatsByDate = {},
  personalRecordsByDate = {},
  insight,
  className
}: XOptimizedShareInterfaceProps) {
  const [activeTab, setActiveTab] = useState('workout');
  
  // Navigation indices for each tab
  const [workoutIndex, setWorkoutIndex] = useState(0);
  const [dailyIndex, setDailyIndex] = useState(0);
  const [weeklyIndex, setWeeklyIndex] = useState(0);
  const [monthlyIndex, setMonthlyIndex] = useState(0);

  // Get available dates for each timeframe
  const availableDailyDates = Object.keys(dailyWorkoutsByDate).sort().reverse();
  const availableWeeklyDates = Object.keys(weeklyStatsByDate).sort().reverse();
  const availableMonthlyDates = Object.keys(monthlyStatsByDate).sort().reverse();

  // Get current data based on indices
  const currentWorkout = workouts[workoutIndex];
  const currentDailyDate = availableDailyDates[dailyIndex];
  const currentDailyWorkouts = currentDailyDate ? dailyWorkoutsByDate[currentDailyDate] : [];
  const currentWeeklyDate = availableWeeklyDates[weeklyIndex];
  const currentWeeklyStats = currentWeeklyDate ? weeklyStatsByDate[currentWeeklyDate] : undefined;
  const currentMonthlyDate = availableMonthlyDates[monthlyIndex];
  const currentMonthlyStats = currentMonthlyDate ? monthlyStatsByDate[currentMonthlyDate] : undefined;

  // Get PRs for current timeframes
  const getPersonalRecords = (dateKey?: string) => {
    return dateKey ? (personalRecordsByDate[dateKey] || []) : [];
  };

  const workoutPRs = getPersonalRecords(currentWorkout?.date.toISOString().split('T')[0]);
  const dailyPRs = getPersonalRecords(currentDailyDate);
  const weeklyPRs = getPersonalRecords(currentWeeklyDate);
  const monthlyPRs = getPersonalRecords(currentMonthlyDate);

  // Navigation helpers
  const NavigationControls = ({ 
    current, 
    total, 
    onPrev, 
    onNext, 
    label,
    formatDate 
  }: {
    current: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
    label: string;
    formatDate?: (index: number) => string;
  }) => {
    if (total <= 1) return null;
    
    return (
      <div className="flex items-center justify-between mb-4 px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={current >= total - 1}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="text-center">
          <div className="text-sm font-medium">
            {formatDate ? formatDate(current) : `${label} ${current + 1} of ${total}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {current + 1} of {total}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={current <= 0}
          className="flex items-center gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const getTabInfo = () => {
    const tabs = [];
    
    // Workout tab - show if we have workouts
    if (workouts.length > 0) {
      tabs.push({
        value: 'workout',
        label: 'Workout',
        icon: <Target className="h-4 w-4" />,
        badge: workoutPRs.length > 0 ? `${workoutPRs.length} PR${workoutPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share specific workouts',
        count: workouts.length
      });
    }
    
    // Daily tab - show if we have daily data
    if (availableDailyDates.length > 0) {
      tabs.push({
        value: 'daily',
        label: 'Daily',
        icon: <Calendar className="h-4 w-4" />,
        badge: dailyPRs.length > 0 ? `${dailyPRs.length} PR${dailyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share daily progress',
        count: availableDailyDates.length
      });
    }
    
    // Weekly tab - show if we have weekly data
    if (availableWeeklyDates.length > 0) {
      tabs.push({
        value: 'weekly',
        label: 'Weekly',
        icon: <TrendingUp className="h-4 w-4" />,
        badge: weeklyPRs.length > 0 ? `${weeklyPRs.length} PR${weeklyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share weekly summaries',
        count: availableWeeklyDates.length
      });
    }
    
    // Monthly tab - show if we have monthly data
    if (availableMonthlyDates.length > 0) {
      tabs.push({
        value: 'monthly',
        label: 'Monthly',
        icon: <Trophy className="h-4 w-4" />,
        badge: monthlyPRs.length > 0 ? `${monthlyPRs.length} PR${monthlyPRs.length > 1 ? 's' : ''}` : null,
        description: 'Share monthly achievements',
        count: availableMonthlyDates.length
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
            <TabsList className={cn("grid w-full mb-8", `grid-cols-${tabs.length}`)}>
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="flex items-center gap-2 relative"
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count > 1 && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {tab.count}
                    </Badge>
                  )}
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
              {workouts.length > 0 && (
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
                    
                    <NavigationControls
                      current={workoutIndex}
                      total={workouts.length}
                      onPrev={() => setWorkoutIndex(prev => Math.min(prev + 1, workouts.length - 1))}
                      onNext={() => setWorkoutIndex(prev => Math.max(prev - 1, 0))}
                      label="Workout"
                      formatDate={(index) => currentWorkout ? format(currentWorkout.date, 'MMM d, yyyy') : ''}
                    />
                    
                    {currentWorkout && (
                      <XOptimizedShareCard
                        workout={currentWorkout}
                        insight={insight}
                        personalRecords={workoutPRs.filter(pr => pr.isNew)}
                      />
                    )}
                  </motion.div>
                </TabsContent>
              )}

              {/* Daily Tab */}
              {availableDailyDates.length > 0 && (
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
                        Showcase daily dedication and achievements
                      </p>
                    </div>
                    
                    <NavigationControls
                      current={dailyIndex}
                      total={availableDailyDates.length}
                      onPrev={() => setDailyIndex(prev => Math.min(prev + 1, availableDailyDates.length - 1))}
                      onNext={() => setDailyIndex(prev => Math.max(prev - 1, 0))}
                      label="Day"
                      formatDate={(index) => currentDailyDate ? format(new Date(currentDailyDate), 'MMM d, yyyy') : ''}
                    />
                    
                    {currentDailyWorkouts.length > 0 && (
                      <XOptimizedDailyCard
                        workouts={currentDailyWorkouts}
                        dailyPRs={dailyPRs.filter(pr => pr.isNew).map(pr => ({ ...pr, isNew: true as const }))}
                        insight={insight}
                      />
                    )}
                  </motion.div>
                </TabsContent>
              )}

              {/* Weekly Tab */}
              {availableWeeklyDates.length > 0 && (
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
                    
                    <NavigationControls
                      current={weeklyIndex}
                      total={availableWeeklyDates.length}
                      onPrev={() => setWeeklyIndex(prev => Math.min(prev + 1, availableWeeklyDates.length - 1))}
                      onNext={() => setWeeklyIndex(prev => Math.max(prev - 1, 0))}
                      label="Week"
                      formatDate={(index) => {
                        if (!currentWeeklyDate) return '';
                        const weekStart = startOfWeek(new Date(currentWeeklyDate));
                        const weekEnd = endOfWeek(new Date(currentWeeklyDate));
                        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
                      }}
                    />
                    
                    {currentWeeklyStats && (
                      <XOptimizedWeeklyCard
                        weeklyStats={currentWeeklyStats}
                        weeklyPRs={weeklyPRs.filter(pr => pr.isNew && ['distance', 'volume'].includes(pr.type)).map(pr => ({ 
                          ...pr, 
                          date: new Date(),
                          type: pr.type as 'distance' | 'volume'
                        }))}
                      />
                    )}
                  </motion.div>
                </TabsContent>
              )}

              {/* Monthly Tab */}
              {availableMonthlyDates.length > 0 && (
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
                    
                    <NavigationControls
                      current={monthlyIndex}
                      total={availableMonthlyDates.length}
                      onPrev={() => setMonthlyIndex(prev => Math.min(prev + 1, availableMonthlyDates.length - 1))}
                      onNext={() => setMonthlyIndex(prev => Math.max(prev - 1, 0))}
                      label="Month"
                      formatDate={(index) => currentMonthlyDate ? format(new Date(currentMonthlyDate), 'MMMM yyyy') : ''}
                    />
                    
                    {currentMonthlyStats && (
                      <XOptimizedMonthlyCard
                        monthlyStats={currentMonthlyStats}
                        monthlyPRs={monthlyPRs.filter(pr => pr.isNew && ['distance', 'volume'].includes(pr.type)).map(pr => ({ 
                          ...pr, 
                          date: new Date(),
                          type: pr.type as 'distance' | 'volume'
                        }))}
                      />
                    )}
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
                  <li>• Navigate through different timeframes with arrow controls</li>
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