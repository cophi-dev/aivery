'use client';

import { XOptimizedShareInterface } from '@/components/share/XOptimizedShareInterface';
import { useState, useEffect } from 'react';
import { subDays, subWeeks, subMonths, format } from 'date-fns';

export default function ShareTestPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [dailyWorkoutsByDate, setDailyWorkoutsByDate] = useState<Record<string, any[]>>({});
  const [weeklyStatsByDate, setWeeklyStatsByDate] = useState<Record<string, any>>({});
  const [monthlyStatsByDate, setMonthlyStatsByDate] = useState<Record<string, any>>({});
  const [personalRecordsByDate, setPersonalRecordsByDate] = useState<Record<string, any>>({});
  const [insight, setInsight] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch recent workouts
        const workoutsResponse = await fetch('/api/dashboard/recent-workouts');
        if (!workoutsResponse.ok) {
          throw new Error('Failed to fetch workouts');
        }
        const workoutsData = await workoutsResponse.json();
        
        // Fetch dashboard metrics for PRs and stats
        const metricsResponse = await fetch('/api/dashboard/metrics');
        if (!metricsResponse.ok) {
          throw new Error('Failed to fetch metrics');
        }
        const metricsData = await metricsResponse.json();
        
        // Transform workouts data
        const recentWorkouts = workoutsData.workouts || [];
        
        // Map workouts to expected format
        const mappedWorkouts = recentWorkouts.map((w: any) => ({
          id: w._id || w.id,
          type: w.type,
          date: new Date(w.date),
          duration: w.duration || 0,
          distance: w.cardioDetails?.distance || w.distance || 0,
          calculatedVolume: w.calculatedVolume || 0,
          name: w.name || `${w.type} Workout`
        }));
        
        // Group workouts by date for daily view
        const dailyWorkouts: Record<string, any[]> = {};
        mappedWorkouts.forEach((w: any) => {
          const dateKey = format(new Date(w.date), 'yyyy-MM-dd');
          if (!dailyWorkouts[dateKey]) {
            dailyWorkouts[dateKey] = [];
          }
          dailyWorkouts[dateKey].push(w);
        });
        
        // Calculate weekly stats from recent workouts
        const weeklyStats: Record<string, any> = {};
        const today = new Date();
        
        // Current week
        const currentWeek = format(today, 'yyyy-MM-dd');
        const currentWeekWorkouts = mappedWorkouts.filter((w: any) => {
          const workoutDate = new Date(w.date);
          const weekStart = subDays(today, today.getDay());
          return workoutDate >= weekStart;
        });
        
        // Previous week
        const previousWeekWorkouts = mappedWorkouts.filter((w: any) => {
          const workoutDate = new Date(w.date);
          const previousWeekStart = subDays(today, today.getDay() + 7);
          const previousWeekEnd = subDays(today, today.getDay() + 1);
          return workoutDate >= previousWeekStart && workoutDate < previousWeekEnd;
        });
        
        // Calculate stats
        const currentWeekStats = {
          workouts: currentWeekWorkouts.length,
          distance: currentWeekWorkouts.reduce((sum: number, w: any) => sum + (w.distance || 0), 0),
          volume: currentWeekWorkouts.reduce((sum: number, w: any) => sum + (w.calculatedVolume || 0), 0),
          duration: currentWeekWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0)
        };
        
        const previousWeekStats = {
          workouts: previousWeekWorkouts.length,
          distance: previousWeekWorkouts.reduce((sum: number, w: any) => sum + (w.distance || 0), 0),
          volume: previousWeekWorkouts.reduce((sum: number, w: any) => sum + (w.calculatedVolume || 0), 0),
          duration: previousWeekWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0)
        };
        
        // Calculate deltas
        const calculateDelta = (current: number, previous: number) => {
          if (previous === 0) return { direction: 'neutral' as const, percentage: 0 };
          const percentage = Math.round(((current - previous) / previous) * 100);
          return {
            direction: percentage > 0 ? 'up' as const : percentage < 0 ? 'down' as const : 'neutral' as const,
            percentage: Math.abs(percentage)
          };
        };
        
        weeklyStats[currentWeek] = {
          current: currentWeekStats,
          previous: previousWeekStats,
          deltas: {
            workoutsDelta: calculateDelta(currentWeekStats.workouts, previousWeekStats.workouts),
            distanceDelta: calculateDelta(currentWeekStats.distance, previousWeekStats.distance),
            volumeDelta: calculateDelta(currentWeekStats.volume, previousWeekStats.volume)
          }
        };
        
        // Calculate monthly stats (simplified)
        const currentMonth = format(today, 'yyyy-MM-dd');
        const currentMonthWorkouts = mappedWorkouts.filter((w: any) => {
          const workoutDate = new Date(w.date);
          return workoutDate.getMonth() === today.getMonth() && workoutDate.getFullYear() === today.getFullYear();
        });
        
        const previousMonthWorkouts = mappedWorkouts.filter((w: any) => {
          const workoutDate = new Date(w.date);
          const previousMonth = subMonths(today, 1);
          return workoutDate.getMonth() === previousMonth.getMonth() && workoutDate.getFullYear() === previousMonth.getFullYear();
        });
        
        const currentMonthStats = {
          workouts: currentMonthWorkouts.length,
          distance: currentMonthWorkouts.reduce((sum: number, w: any) => sum + (w.distance || 0), 0),
          volume: currentMonthWorkouts.reduce((sum: number, w: any) => sum + (w.calculatedVolume || 0), 0),
          duration: currentMonthWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
          activeDays: new Set(currentMonthWorkouts.map((w: any) => format(new Date(w.date), 'yyyy-MM-dd'))).size
        };
        
        const previousMonthStats = {
          workouts: previousMonthWorkouts.length,
          distance: previousMonthWorkouts.reduce((sum: number, w: any) => sum + (w.distance || 0), 0),
          volume: previousMonthWorkouts.reduce((sum: number, w: any) => sum + (w.calculatedVolume || 0), 0),
          duration: previousMonthWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0),
          activeDays: new Set(previousMonthWorkouts.map((w: any) => format(new Date(w.date), 'yyyy-MM-dd'))).size
        };
        
        const monthlyStats: Record<string, any> = {};
        monthlyStats[currentMonth] = {
          current: currentMonthStats,
          previous: previousMonthStats,
          deltas: {
            workoutsDelta: calculateDelta(currentMonthStats.workouts, previousMonthStats.workouts),
            distanceDelta: calculateDelta(currentMonthStats.distance, previousMonthStats.distance),
            volumeDelta: calculateDelta(currentMonthStats.volume, previousMonthStats.volume)
          }
        };
        
        // Get PRs from metrics data
        const prs: Record<string, any> = {};
        if (metricsData.exercisePRs && metricsData.exercisePRs.length > 0) {
          const todayKey = format(today, 'yyyy-MM-dd');
          prs[todayKey] = metricsData.exercisePRs.map((pr: any) => ({
            id: pr._id,
            exerciseName: pr.exerciseName,
            value: pr.value,
            unit: pr.unit,
            type: pr.type,
            date: pr.date,
            isNew: false // Real PRs aren't necessarily new
          }));
        }
        
        // Set all data
        setWorkouts(mappedWorkouts);
        setDailyWorkoutsByDate(dailyWorkouts);
        setWeeklyStatsByDate(weeklyStats);
        setMonthlyStatsByDate(monthlyStats);
        setPersonalRecordsByDate(prs);
        setInsight(metricsData.insight || 'Keep up the great work with your fitness journey!');
        
      } catch (error) {
        console.error('Error fetching real data:', error);
        setError('Failed to load real workout data. Please make sure you have some workouts logged.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">X-Optimized Share Cards Test</h1>
            <p className="text-muted-foreground">Loading your real workout data...</p>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">X-Optimized Share Cards Test</h1>
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">X-Optimized Share Cards Test</h1>
          <p className="text-muted-foreground">
            Browse through your real workout data across different timeframes!
          </p>
        </div>

        <XOptimizedShareInterface
          workouts={workouts}
          dailyWorkoutsByDate={dailyWorkoutsByDate}
          weeklyStatsByDate={weeklyStatsByDate}
          monthlyStatsByDate={monthlyStatsByDate}
          personalRecordsByDate={personalRecordsByDate}
          insight={insight}
        />
      </div>
    </div>
  );
} 