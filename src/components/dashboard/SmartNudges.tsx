'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getBestNudge, getTopNudges, type SmartNudge } from '@/lib/insights';
import { InsightCard, MultiInsightCard } from '@/components/ui/insight-card';
import type { WeeklyStats, StatsDelta } from '@/lib/stats';

interface WeeklyStatsResponse {
  current: WeeklyStats;
  previous: WeeklyStats;
  deltas: StatsDelta;
}

interface SmartNudgesProps {
  className?: string;
  mode?: 'single' | 'multiple';
  maxNudges?: number;
  title?: string;
}

export default function SmartNudges({ 
  className, 
  mode = 'single',
  maxNudges = 2,
  title = "Smart Insights"
}: SmartNudgesProps) {
  const [stats, setStats] = useState<WeeklyStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nudges, setNudges] = useState<SmartNudge[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/dashboard/progress');
        
        if (!res.ok) {
          throw new Error('Failed to fetch progress data');
        }
        
        const data = await res.json();
        setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch stats for nudges:', error);
        setError('Unable to load insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    if (stats) {
      const generatedNudges = mode === 'single' 
        ? [getBestNudge(stats.current, stats.previous)]
        : getTopNudges(stats.current, stats.previous, maxNudges);
      
      setNudges(generatedNudges);
    }
  }, [stats, mode, maxNudges]);

  if (isLoading) {
    return (
      <motion.div 
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="space-y-3">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded-lg" />
        </div>
      </motion.div>
    );
  }

  if (error || !stats) {
    // Fallback nudge when there's an error or no data
    const fallbackNudge: SmartNudge = {
      message: "Ready to start your fitness journey? Every step counts!",
      type: 'encouragement',
      priority: 1,
      emoji: '🌟'
    };

    return (
      <div className={className}>
        {mode === 'single' ? (
          <InsightCard nudge={fallbackNudge} />
        ) : (
          <MultiInsightCard nudges={[fallbackNudge]} title={title} />
        )}
      </div>
    );
  }

  if (nudges.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {mode === 'single' ? (
        <InsightCard nudge={nudges[0]} />
      ) : (
        <MultiInsightCard nudges={nudges} title={title} maxDisplay={maxNudges} />
      )}
    </div>
  );
}

// Simple variant for just showing a single nudge message
interface SimpleNudgeProps {
  className?: string;
  showEmoji?: boolean;
}

export function SimpleNudge({ className, showEmoji = true }: SimpleNudgeProps) {
  return (
    <SmartNudges 
      className={className} 
      mode="single"
    />
  );
} 