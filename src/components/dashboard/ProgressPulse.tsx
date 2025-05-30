'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Zap, Target, Clock, MapPin, Dumbbell } from 'lucide-react'
import { getPercentChange, statsFormatters, type WeeklyStats, type StatsDelta } from '@/lib/stats'

interface WeeklyStatsResponse {
  current: WeeklyStats;
  previous: WeeklyStats;
  deltas: StatsDelta;
}

const ProgressPulse = () => {
  const [stats, setStats] = useState<WeeklyStatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/api/dashboard/progress')
        
        if (!res.ok) {
          throw new Error('Failed to fetch progress data')
        }
        
        const data = await res.json()
        setStats(data.stats)
      } catch (error) {
        console.error('Failed to fetch progress:', error)
        setError('Unable to load progress data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProgress()
  }, [])

  const getStoryNarrative = () => {
    if (!stats) return { headline: "Progress Pulse", subtitle: "This week vs last week" };
    
    const { current, deltas } = stats;
    
    // Calculate overall trend
    const significantChanges = [
      deltas.workoutsDelta,
      deltas.durationDelta,
      deltas.distanceDelta,
      deltas.volumeDelta
    ].filter(delta => Math.abs(delta.percentage) >= 10);

    const upTrends = significantChanges.filter(delta => delta.direction === 'up').length;
    const downTrends = significantChanges.filter(delta => delta.direction === 'down').length;

    if (current.workouts === 0 && stats.previous.workouts === 0) {
      return {
        headline: "Your Story Begins",
        subtitle: "Ready to create your first chapter"
      };
    }

    if (current.workouts === 0) {
      return {
        headline: "Recharge Week",
        subtitle: "Sometimes rest is the strongest choice"
      };
    }

    if (upTrends > downTrends && upTrends >= 2) {
      return {
        headline: "Momentum Building",
        subtitle: `${current.workouts} sessions • Trending upward`
      };
    }

    if (current.workouts >= 5) {
      return {
        headline: "Peak Performance",
        subtitle: `${current.workouts} sessions • Elite consistency`
      };
    }

    if (current.workouts >= 3) {
      return {
        headline: "Steady Progress",
        subtitle: `${current.workouts} sessions • Strong rhythm`
      };
    }

    return {
      headline: "Building Foundation",
      subtitle: `${current.workouts} sessions • Every step counts`
    };
  };

  const getKeyInsight = () => {
    if (!stats) return null;
    
    const { current, deltas } = stats;
    
    // Find the most significant positive change
    const changes = [
      { type: 'workouts', delta: deltas.workoutsDelta, icon: Target, label: 'Consistency', color: 'text-blue-600 dark:text-blue-400' },
      { type: 'duration', delta: deltas.durationDelta, icon: Clock, label: 'Endurance', color: 'text-green-600 dark:text-green-400' },
      { type: 'distance', delta: deltas.distanceDelta, icon: MapPin, label: 'Distance', color: 'text-purple-600 dark:text-purple-400' },
      { type: 'volume', delta: deltas.volumeDelta, icon: Dumbbell, label: 'Strength', color: 'text-orange-600 dark:text-orange-400' }
    ];

    const significantChange = changes
      .filter(change => Math.abs(change.delta.percentage) >= 15 && change.delta.direction === 'up')
      .sort((a, b) => b.delta.percentage - a.delta.percentage)[0];

    if (significantChange) {
      return {
        ...significantChange,
        message: `${significantChange.label} up ${Math.round(significantChange.delta.percentage)}%`
      };
    }

    // Fallback to overall session count
    if (current.workouts > 0) {
      return {
        type: 'workouts',
        icon: Target,
        label: 'Active',
        color: 'text-blue-600 dark:text-blue-400',
        message: `${current.workouts} sessions this week`
      };
    }

    return null;
  };

  const getProgressMetrics = () => {
    if (!stats) return [];
    
    const { current } = stats;
    const metrics = [];

    if (current.workouts > 0) {
      metrics.push({
        label: 'Sessions',
        value: current.workouts,
        formatter: (val: number) => val.toString()
      });
    }

    if (current.duration > 0) {
      metrics.push({
        label: 'Hours',
        value: current.duration,
        formatter: (val: number) => (val / 60).toFixed(0) + 'h'
      });
    }

    if (current.distance > 0) {
      metrics.push({
        label: 'Distance',
        value: current.distance,
        formatter: (val: number) => val.toFixed(1) + 'km'
      });
    }

    if (current.volume > 0) {
      metrics.push({
        label: 'Volume',
        value: current.volume,
        formatter: (val: number) => (val / 1000).toFixed(1) + 't'
      });
    }

    return metrics.slice(0, 3); // Show max 3 for clean layout
  };

  if (error) {
    return (
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-foreground mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      </motion.section>
    )
  }

  if (isLoading) {
    return (
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-foreground mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-muted-foreground">
            Reading your week's story...
          </p>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl blur-sm -z-10" />
          
          <div className="p-8 bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/40 dark:to-emerald-950/40 rounded-2xl border border-green-200/50 dark:border-green-800/30 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-4 h-4 bg-green-400/60 dark:bg-green-400/80 rounded-full animate-pulse"></div>
              <div className="w-32 h-6 bg-green-200/60 dark:bg-green-700/60 rounded animate-pulse"></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="w-16 h-8 bg-green-200/60 dark:bg-green-700/60 rounded animate-pulse"></div>
                  <div className="w-12 h-4 bg-green-200/60 dark:bg-green-700/60 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    )
  }

  // Check if user has insufficient data
  const hasInsufficientData = !stats || (stats.current.workouts === 0 && stats.previous.workouts === 0);
  
  if (hasInsufficientData) {
    return (
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-foreground mb-2">
            Your Story Awaits
          </h2>
          <p className="text-sm text-muted-foreground">
            Progress tracking begins with your first workout
          </p>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-gray-950/30 dark:to-slate-950/30 rounded-2xl blur-sm -z-10" />
          
          <div className="p-8 bg-gradient-to-br from-gray-50/80 to-slate-50/80 dark:from-gray-950/40 dark:to-slate-950/40 rounded-2xl border border-gray-200/50 dark:border-gray-800/30 backdrop-blur-xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/20 dark:to-purple-400/20 flex items-center justify-center">
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg text-foreground font-medium mb-2">Ready to Begin?</p>
            <p className="text-muted-foreground">
              Your progress story starts with the first session. Every journey begins with a single step.
            </p>
          </div>
        </div>
      </motion.section>
    )
  }

  const narrative = getStoryNarrative();
  const keyInsight = getKeyInsight();
  const metrics = getProgressMetrics();

  return (
    <motion.section 
      className="mb-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Narrative Header */}
      <div className="mb-6">
        <motion.h2 
          className="text-2xl font-serif tracking-tight text-foreground mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {narrative.headline}
        </motion.h2>
        <motion.p 
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {narrative.subtitle}
        </motion.p>
      </div>

      {/* Progress Content */}
      <motion.div 
        className="relative group"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl blur-sm -z-10" />
        
        <div className="p-8 bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/40 dark:to-emerald-950/40 rounded-2xl border border-green-200/50 dark:border-green-800/30 backdrop-blur-xl shadow-sm dark:shadow-lg">
          {/* Key Insight */}
          {keyInsight && (
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-green-200/50 dark:border-green-800/30">
              <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm">
                <keyInsight.icon className={`h-5 w-5 ${keyInsight.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{keyInsight.label} Focus</h3>
                <p className="text-sm text-muted-foreground">{keyInsight.message}</p>
              </div>
            </div>
          )}

          {/* Weekly Metrics */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  className="text-center p-4 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                >
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {metric.formatter(metric.value)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {metric.label}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.section>
  )
}

export default ProgressPulse 