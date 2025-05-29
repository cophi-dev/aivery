'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import Link from 'next/link'
import { formatters, type LastWorkoutData } from '@/lib/dashboard-utils'

interface WorkoutInsight {
  message: string;
  type: 'achievement' | 'progress' | 'consistency' | 'motivation';
  emoji: string;
}

const LastWorkout = () => {
  const [workout, setWorkout] = useState<LastWorkoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workoutInsight, setWorkoutInsight] = useState<WorkoutInsight | null>(null)

  useEffect(() => {
    const fetchLastWorkout = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/api/dashboard/last-workout')
        
        if (!res.ok) {
          throw new Error('Failed to fetch last workout')
        }
        
        const data = await res.json()
        setWorkout(data.workout)
        
        // Generate insights for the workout
        if (data.workout) {
          const insight = generateWorkoutInsight(data.workout)
          setWorkoutInsight(insight)
        }
      } catch (error) {
        console.error('Failed to fetch last workout:', error)
        setError('Unable to load your last workout')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLastWorkout()
  }, [])

  const generateWorkoutInsight = (workout: LastWorkoutData): WorkoutInsight => {
    const workoutDate = new Date(workout.date)
    const daysAgo = differenceInDays(new Date(), workoutDate)
    const isToday = daysAgo === 0
    const isYesterday = daysAgo === 1
    
    // Recent workout insights
    if (isToday) {
      if (workout.type.toLowerCase().includes('running') && workout.distance && workout.distance > 10) {
        return {
          message: "Fresh double-digit run! Your endurance is building beautifully.",
          type: 'achievement',
          emoji: '🏃‍♂️'
        }
      }
      
      if (workout.calculatedVolume && workout.calculatedVolume > 10) {
        return {
          message: "Strong session today! That training volume shows real dedication.",
          type: 'achievement', 
          emoji: '💪'
        }
      }
      
      return {
        message: "Today's session complete! Consistency is your superpower.",
        type: 'consistency',
        emoji: '✨'
      }
    }
    
    if (isYesterday) {
      return {
        message: "Yesterday's momentum carries forward. What's next on your agenda?",
        type: 'motivation',
        emoji: '🚀'
      }
    }
    
    // Workout timing insights
    if (daysAgo <= 3) {
      const dayText = daysAgo === 2 ? "2 days ago" : "3 days ago"
      return {
        message: `${dayText} session keeping you sharp. Regular rhythm, real results.`,
        type: 'consistency',
        emoji: '🎯'
      }
    }
    
    if (daysAgo <= 7) {
      return {
        message: "Last week's session still inspiring this week's potential. Ready to move?",
        type: 'motivation',
        emoji: '⚡'
      }
    }
    
    // Longer gaps - motivational
    return {
      message: "Every comeback starts with a single step. Your body remembers the joy of movement.",
      type: 'motivation',
      emoji: '🌟'
    }
  }

  const getTimeSinceWorkout = () => {
    if (!workout) return ""
    
    const workoutDate = new Date(workout.date)
    const daysAgo = differenceInDays(new Date(), workoutDate)
    
    if (daysAgo === 0) return "Today"
    if (daysAgo === 1) return "Yesterday"
    return formatDistanceToNow(workoutDate, { addSuffix: true })
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
            Last Workout
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
            Last Workout
          </h2>
          <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
          </div>
        </div>
      </motion.section>
    )
  }

  if (!workout) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Last Workout
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ready to start your fitness journey?
          </p>
        </div>
        
        <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-[1rem] text-neutral-600 dark:text-neutral-400 mb-6 font-serif italic">
            Your fitness journey awaits. Every champion started with session one.
          </p>
          <Link href="/workouts/new">
            <motion.button 
              className="px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              + Log First Workout
            </motion.button>
          </Link>
        </div>
      </motion.section>
    )
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
          Last Workout
        </motion.h2>
        <motion.p 
          className="text-sm text-zinc-500 dark:text-zinc-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {getTimeSinceWorkout()}
        </motion.p>
      </div>

      <Link href={`/workouts/${workout.id}`}>
        <motion.div 
          className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 hover:shadow-md transition-all duration-300 cursor-pointer"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
          whileHover={{ 
            y: -2,
            transition: { duration: 0.3, ease: "easeOut" }
          }}
        >
          <div className="space-y-6">
            {/* Workout Header with Insight */}
            <div>
              <h3 className="text-[1rem] font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                {formatters.workoutType(workout.type)}
              </h3>
              
              {/* Enhanced Insight Section */}
              {workoutInsight && (
                <motion.div 
                  className="mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xl">
                      {workoutInsight.emoji}
                    </div>
                    <p className="text-sm leading-relaxed font-medium text-emerald-700 dark:text-emerald-300">
                      {workoutInsight.message}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Workout Metrics - Enhanced with context */}
            <div className="flex gap-8">
              {workout.duration && (
                <div>
                  <p className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
                    {formatters.duration(workout.duration)}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {workout.duration > 3600 ? "endurance session" : 
                     workout.duration > 1800 ? "solid duration" : "focused session"}
                  </p>
                </div>
              )}
              
              {workout.distance && (
                <div>
                  <p className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
                    {formatters.distance(workout.distance)}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {workout.distance > 10 ? "distance champion" :
                     workout.distance > 5 ? "great coverage" : "good movement"}
                  </p>
                </div>
              )}
              
              {workout.calculatedVolume && (
                <div>
                  <p className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
                    {formatters.volume(workout.calculatedVolume)}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {workout.calculatedVolume > 20 ? "heavy lifting" :
                     workout.calculatedVolume > 10 ? "solid volume" : "quality work"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.section>
  )
}

export default LastWorkout 