'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface ProgressData {
  weeklyWorkouts: number
  previousWeekWorkouts: number
  weeklyDuration: number
  previousWeekDuration: number
  weeklyVolume: number
  previousWeekVolume: number
  weeklyDistance: number
  previousWeekDistance: number
}

const ProgressPulse = () => {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setIsLoading(true)
        // This would typically call your metrics API
        const res = await fetch('/api/dashboard/metrics')
        
        if (!res.ok) {
          throw new Error('Failed to fetch progress data')
        }
        
        const data = await res.json()
        
        // Transform the data to match our interface
        setProgress({
          weeklyWorkouts: data.workoutCount || 0,
          previousWeekWorkouts: data.previousWorkoutCount || 0,
          weeklyDuration: data.cardioDurationLast7Days || 0,
          previousWeekDuration: data.cardioDurationPrevious7Days || 0,
          weeklyVolume: data.strengthVolumeLast7Days || 0,
          previousWeekVolume: data.strengthVolumePrevious7Days || 0,
          weeklyDistance: (data.runningDistanceLast7Days || 0) + (data.swimmingDistanceLast7Days || 0) + (data.bikingDistanceLast7Days || 0),
          previousWeekDistance: (data.runningDistancePrevious7Days || 0) + (data.swimmingDistancePrevious7Days || 0) + (data.bikingDistancePrevious7Days || 0)
        })
      } catch (error) {
        console.error('Failed to fetch progress:', error)
        setError('Unable to load progress data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProgress()
  }, [])

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDistance = (meters: number) => {
    const km = meters / 1000
    return `${km.toFixed(1)}km`
  }

  const formatVolume = (kg: number) => {
    const tons = kg / 1000
    return `${tons.toFixed(1)}t`
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (change < 0) return 'text-orange-600 dark:text-orange-400'
    return 'text-zinc-500 dark:text-zinc-400'
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗'
    if (change < 0) return '↘'
    return '→'
  }

  const ProgressMetric = ({ 
    label, 
    current, 
    previous, 
    formatter 
  }: { 
    label: string
    current: number
    previous: number
    formatter: (value: number) => string
  }) => {
    const change = calculateChange(current, previous)
    
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
          <div className={`flex items-center gap-1 ${getChangeColor(change)}`}>
            <span className="text-sm">{getChangeIcon(change)}</span>
            <span className="text-sm font-medium">{Math.abs(change).toFixed(0)}%</span>
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

  if (!progress) {
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
            Start tracking workouts to see your progress
          </p>
        </div>
      </motion.section>
    )
  }

  // Prepare metrics for 2x2 grid
  const metrics = [
    {
      label: 'workouts',
      current: progress.weeklyWorkouts,
      previous: progress.previousWeekWorkouts,
      formatter: (val: number) => val.toString()
    }
  ]

  if (progress.weeklyDuration > 0) {
    metrics.push({
      label: 'duration',
      current: progress.weeklyDuration,
      previous: progress.previousWeekDuration,
      formatter: formatDuration
    })
  }

  if (progress.weeklyDistance > 0) {
    metrics.push({
      label: 'distance',
      current: progress.weeklyDistance,
      previous: progress.previousWeekDistance,
      formatter: formatDistance
    })
  }

  if (progress.weeklyVolume > 0) {
    metrics.push({
      label: 'volume',
      current: progress.weeklyVolume,
      previous: progress.previousWeekVolume,
      formatter: formatVolume
    })
  }

  // Fill remaining slots if less than 4 metrics
  while (metrics.length < 4 && metrics.length > 1) {
    metrics.push({
      label: '',
      current: 0,
      previous: 0,
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
                previous={metric.previous}
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