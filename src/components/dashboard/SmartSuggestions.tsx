'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateSuggestions, type Suggestion } from "@/lib/utils/smartSuggestions";
import type { DashboardMetrics } from '@/types/dashboard';
import type { WeeklyStats } from '@/lib/stats';
import type { WorkoutData } from '@/types/db';
import { Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartSuggestionsProps {
  metrics: DashboardMetrics;
  className?: string;
}

export default function SmartSuggestions({ metrics, className }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch weekly stats and recent workouts
        const [weeklyResponse, workoutsResponse] = await Promise.all([
          fetch('/api/dashboard/progress'),
          fetch('/api/dashboard/recent-workouts')
        ]);

        if (weeklyResponse.ok && workoutsResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          const workoutsData = await workoutsResponse.json();

          const weeklyStats: WeeklyStats = weeklyData.stats?.current || {
            workouts: 0,
            duration: 0,
            volume: 0,
            distance: 0
          };

          const recentWorkouts: WorkoutData[] = workoutsData.workouts || [];

          // Generate suggestions
          const generatedSuggestions = generateSuggestions({
            metrics,
            weeklyStats,
            recentWorkouts
          });

          setSuggestions(generatedSuggestions.slice(0, 2)); // Show only top 2 for minimal design
        }
      } catch (error) {
        console.error('Error fetching data for suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [metrics]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'medium': return 'text-blue-600 dark:text-blue-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <TrendingUp className="w-4 h-4" />;
      case 'low': return <Lightbulb className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <motion.section 
        className={cn("mb-8", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="apple-card">
          <CardHeader className="pb-4">
            <CardTitle className="apple-heading-md flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-muted-foreground" />
              Training Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-3 bg-muted/30 rounded w-3/4"></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  if (suggestions.length === 0) {
    return (
      <motion.section 
        className={cn("mb-8", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="apple-card">
          <CardHeader className="pb-4">
            <CardTitle className="apple-heading-md flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              Training Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
              <span className="text-2xl">🎯</span>
              <p className="apple-body-md text-foreground">
                Your training looks well-balanced! Keep up the great work.
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
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="apple-card">
        <CardHeader className="pb-4">
          <CardTitle className="apple-heading-md flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-muted-foreground" />
            Training Insights
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="flex items-start gap-4 p-4 rounded-lg bg-secondary/20 border border-border/30"
            >
              <span className="text-xl leading-none">{suggestion.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("flex items-center gap-1", getPriorityColor(suggestion.priority))}>
                    {getPriorityIcon(suggestion.priority)}
                  </span>
                  <span className="apple-caption text-muted-foreground/60">
                    {suggestion.type}
                  </span>
                </div>
                <p className="apple-body-md text-foreground leading-relaxed">
                  {suggestion.message}
                </p>
              </div>
            </motion.div>
          ))}
          
          <div className="pt-3 border-t border-border/50">
            <p className="apple-body-sm text-muted-foreground/60">
              Insights update based on your training patterns
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 