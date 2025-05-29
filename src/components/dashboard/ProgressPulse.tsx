'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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

  const getChangeColor = (direction: 'up' | 'down' | 'same') => {
    if (direction === 'up') return 'text-emerald-600 dark:text-emerald-400'
    if (direction === 'down') return 'text-orange-600 dark:text-orange-400'
    return 'text-zinc-500 dark:text-zinc-400'
  }

  const getChangeIcon = (direction: 'up' | 'down' | 'same') => {
    if (direction === 'up') return '↗'
    if (direction === 'down') return '↘'
    return '→'
  }

  const ProgressMetric = ({ 
    label, 
    current, 
    delta,
    formatter 
  }: { 
    label: string
    current: number
    delta: { value: number; percentage: number; direction: 'up' | 'down' | 'same' }
    formatter: (value: number) => string
  }) => {
    return (
      <motion.div 
        className="space-y-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="flex items-baseline gap-3">
          <p className="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
            {formatter(current)}
          </p>
          <div className={`flex items-center gap-1 ${getChangeColor(delta.direction)}`}>
            <span className="text-sm">{getChangeIcon(delta.direction)}</span>
            <span className="text-sm font-medium">{delta.percentage.toFixed(0)}%</span>
          </div>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {error}
          </p>
        </div>
      </motion.section>
    )
  }

  if (isLoading) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This week vs last week
          </p>
        </div>
        
        <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
          <div className="grid grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="w-16 h-6 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"></div>
                <div className="w-20 h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    )
  }

  if (!stats) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This week vs last week
          </p>
        </div>
        
        <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 text-center">
          <p className="text-[1rem] text-neutral-600 dark:text-neutral-400 font-serif italic">
            Not enough data yet for weekly progress. Check back soon!
          </p>
        </div>
      </motion.section>
    )
  }

  // Check if user has insufficient data (no workouts this week AND no workouts last week)
  const hasInsufficientData = stats.current.workouts === 0 && stats.previous.workouts === 0;
  
  if (hasInsufficientData) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Pulse
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Building your foundation
          </p>
        </div>
        
        <div className="p-8 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/50 text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-[1rem] text-purple-700 dark:text-purple-300 font-serif italic">
            Your progress story starts here. A few workouts will unlock meaningful insights.
          </p>
        </div>
      </motion.section>
    )
  }

  // Prepare metrics for 2x2 grid using new stats structure
  const metrics = [
    {
      label: 'workouts',
      current: stats.current.workouts,
      delta: stats.deltas.workoutsDelta,
      formatter: statsFormatters.workouts
    }
  ]

  if (stats.current.duration > 0) {
    metrics.push({
      label: 'duration',
      current: stats.current.duration,
      delta: stats.deltas.durationDelta,
      formatter: statsFormatters.duration
    })
  }

  if (stats.current.distance > 0) {
    metrics.push({
      label: 'distance',
      current: stats.current.distance,
      delta: stats.deltas.distanceDelta,
      formatter: statsFormatters.distance
    })
  }

  if (stats.current.volume > 0) {
    metrics.push({
      label: 'volume',
      current: stats.current.volume,
      delta: stats.deltas.volumeDelta,
      formatter: statsFormatters.volume
    })
  }

  // Fill remaining slots if less than 4 metrics
  while (metrics.length < 4 && metrics.length > 1) {
    metrics.push({
      label: '',
      current: 0,
      delta: { value: 0, percentage: 0, direction: 'same' as const },
      formatter: () => ''
    })
  }

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="mb-6">
        <motion.h2 
          className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Progress Pulse
        </motion.h2>
        <motion.p 
          className="text-sm text-zinc-500 dark:text-zinc-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          This week vs last week
        </motion.p>
      </div>

      <motion.div 
        className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
      >
        <div className="grid grid-cols-2 gap-8">
          {metrics.map((metric, index) => 
            metric.label ? (
              <ProgressMetric
                key={index}
                label={metric.label}
                current={metric.current}
                delta={metric.delta}
                formatter={metric.formatter}
              />
            ) : (
              <div key={index} /> // Empty slot
            )
          )}
        </div>
      </motion.div>
    </motion.section>
  )
}

export default ProgressPulse 