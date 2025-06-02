'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardMetrics {
  strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  strengthVolumePrevious7Days: number;
  cardioDurationPrevious7Days: number;
  cardioDistancePrevious7Days: number;
  workoutCount: number;
  previousWorkoutCount: number;
  runningDistanceLast7Days: number;
  swimmingDistanceLast7Days: number;
  bikingDistanceLast7Days: number;
  runningDistancePrevious7Days: number;
  swimmingDistancePrevious7Days: number;
  bikingDistancePrevious7Days: number;
}

interface StatItem {
  label: string;
  value: string;
  delta: string;
  direction: 'up' | 'down' | 'neutral';
  change: number;
}

interface UnifiedKeyMetricsProps {
  metrics: DashboardMetrics;
  className?: string;
}

export default function UnifiedKeyMetrics({ metrics, className }: UnifiedKeyMetricsProps) {
  const [stats, setStats] = useState<StatItem[]>([]);

  useEffect(() => {
    const calculateDelta = (current: number, previous: number): { delta: string; direction: 'up' | 'down' | 'neutral'; change: number } => {
      if (previous === 0 && current === 0) {
        return { delta: '0%', direction: 'neutral', change: 0 };
      }
      if (previous === 0) {
        return { delta: 'New!', direction: 'up', change: 100 };
      }
      
      const percentChange = ((current - previous) / previous) * 100;
      const direction = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'neutral';
      const delta = Math.abs(percentChange) < 1 ? '0%' : `${percentChange > 0 ? '+' : ''}${Math.round(percentChange)}%`;
      
      return { delta, direction, change: percentChange };
    };

    const formatDuration = (minutes: number): string => {
      if (minutes === 0) return '0h';
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    };

    const formatDistance = (km: number): string => {
      if (km === 0) return '0km';
      return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
    };

    const formatVolume = (kg: number): string => {
      if (kg === 0) return '0kg';
      return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
    };

    // Use cardioDistanceLast7Days as the total distance (already includes all cardio types)
    // Don't double-count by adding individual exercise distances
    const totalDistanceCurrent = metrics.cardioDistanceLast7Days;
    const totalDistancePrevious = metrics.cardioDistancePrevious7Days;

    // Use the actual previous workout count from the metrics

    const newStats: StatItem[] = [
      {
        label: 'Sessions',
        value: metrics.workoutCount.toString(),
        ...calculateDelta(metrics.workoutCount, metrics.previousWorkoutCount)
      },
      {
        label: 'Distance',
        value: formatDistance(totalDistanceCurrent),
        ...calculateDelta(totalDistanceCurrent, totalDistancePrevious)
      },
      {
        label: 'Strength Volume',
        value: formatVolume(metrics.strengthVolumeLast7Days),
        ...calculateDelta(metrics.strengthVolumeLast7Days, metrics.strengthVolumePrevious7Days)
      },
      {
        label: 'Total Time',
        value: formatDuration(metrics.cardioDurationLast7Days),
        ...calculateDelta(metrics.cardioDurationLast7Days, metrics.cardioDurationPrevious7Days)
      }
    ];

    // Only include stats that have values
    const relevantStats = newStats.filter(stat => stat.value !== '0h' && stat.value !== '0km' && stat.value !== '0kg' && stat.value !== '0');
    
    // Always show sessions, but ensure we have at least 2 stats to display
    if (!relevantStats.find(s => s.label === 'Sessions') && metrics.workoutCount > 0) {
      relevantStats.unshift(newStats[0]); // Add sessions back
    }

    setStats(relevantStats.slice(0, 4)); // Max 4 stats for clean layout
  }, [metrics]);

  const getIcon = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />;
      case 'down':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getColorClasses = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30';
      case 'down':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
      default:
        return 'text-muted-foreground bg-muted/50';
    }
  };

  if (stats.length === 0) {
    return null;
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
          <CardTitle className="text-lg font-medium text-foreground">Weekly Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4",
            stats.length === 1 ? "grid-cols-1" :
            stats.length === 2 ? "grid-cols-2" :
            stats.length === 3 ? "grid-cols-3" :
            "grid-cols-2 md:grid-cols-4"
          )}>
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/40 hover:border-border/60 transition-all duration-200"
              >
                {/* Value */}
                <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                
                {/* Label */}
                <div className="text-xs text-muted-foreground font-medium mb-2">
                  {stat.label}
                </div>
                
                {/* Delta with icon */}
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  getColorClasses(stat.direction)
                )}>
                  {getIcon(stat.direction)}
                  <span>{stat.delta}</span>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Small disclaimer */}
          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            Compared to previous week
          </p>
        </CardContent>
      </Card>
    </motion.section>
  );
} 