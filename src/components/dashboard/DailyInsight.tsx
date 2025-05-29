'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { InsightCard } from '@/components/ui/InsightCard'
import { format } from 'date-fns'

interface DailyInsightData {
  message: string;
  type: 'motivation' | 'celebration' | 'guidance' | 'welcome';
  context?: {
    todayWorkouts?: number;
    weekProgress?: number;
    lastWorkoutDays?: number;
    streak?: number;
  };
}

const DailyInsight = () => {
  const [insight, setInsight] = useState<DailyInsightData>({
    message: 'Starting your day with intention...',
    type: 'motivation'
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        setIsLoading(true)
        console.log('[DailyInsight] Fetching enhanced insight')
        
        // Fetch both daily insight and some context
        const [insightRes, statsRes] = await Promise.all([
          fetch(`/api/insight/today?t=${Date.now()}`),
          fetch('/api/dashboard/progress')
        ])
        
        const insightData = await insightRes.json()
        const statsData = statsRes.ok ? await statsRes.json() : null
        
        console.log('[DailyInsight] Data received:', { insightData, statsData })
        
        // Generate more contextual insights
        const enhancedInsight = generateEnhancedInsight(insightData, statsData)
        setInsight(enhancedInsight)
        
      } catch (error) {
        console.error('[DailyInsight] Failed to fetch daily insight:', error)
        setInsight({
          message: getTimeBasedMessage(),
          type: 'motivation'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchInsight()
  }, [])

  const generateEnhancedInsight = (insightData: any, statsData: any): DailyInsightData => {
    const currentStats = statsData?.stats?.current
    const dayOfWeek = format(new Date(), 'EEEE')
    const hour = new Date().getHours()
    
    // If no workouts yet, welcome message
    if (!currentStats || currentStats.workouts === 0) {
      return {
        message: `${dayOfWeek} energy incoming! Perfect day to start building your fitness momentum.`,
        type: 'welcome'
      }
    }
    
    // Strong week going
    if (currentStats.workouts >= 4) {
      return {
        message: `${currentStats.workouts} sessions this week — you're in the zone! ${dayOfWeek} momentum continues.`,
        type: 'celebration',
        context: { weekProgress: currentStats.workouts }
      }
    }
    
    // Getting started
    if (currentStats.workouts <= 2) {
      return {
        message: `${getMotivationalPrefix()} ${dayOfWeek} is calling for movement. Ready to build on your progress?`,
        type: 'motivation',
        context: { weekProgress: currentStats.workouts }
      }
    }
    
    // Mid-week momentum
    return {
      message: `${currentStats.workouts} down, momentum building! ${dayOfWeek} is your canvas — what will you create?`,
      type: 'guidance',
      context: { weekProgress: currentStats.workouts }
    }
  }

  const getTimeBasedMessage = (): string => {
    const hour = new Date().getHours()
    const dayOfWeek = format(new Date(), 'EEEE')
    
    if (hour < 10) {
      return `Good morning! ${dayOfWeek} holds fresh possibilities for progress.`
    } else if (hour < 17) {
      return `${dayOfWeek} afternoon energy! Your body is ready for whatever comes next.`
    } else {
      return `${dayOfWeek} evening reflection. Every step today moves you forward.`
    }
  }

  const getMotivationalPrefix = (): string => {
    const prefixes = [
      "Your journey is uniquely yours.",
      "Small steps, big changes.",
      "Progress over perfection.",
      "Every rep counts.",
      "Consistency builds champions."
    ]
    return prefixes[Math.floor(Math.random() * prefixes.length)]
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Today"
    if (hour < 17) return "This Afternoon" 
    return "This Evening"
  }

  const getSubtitle = () => {
    if (insight.context?.weekProgress) {
      const { weekProgress } = insight.context
      if (weekProgress >= 4) return "You're on fire this week"
      if (weekProgress >= 2) return "Building momentum"
      return "Your next step awaits"
    }
    return "Your daily insight"
  }

  return (
    <motion.section 
      className="mb-12 md:mb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Enhanced Header with better dark mode support */}
      <div className="mb-8">
        <motion.h1 
          className="text-3xl md:text-4xl font-serif tracking-tight text-foreground mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {getGreeting()}
        </motion.h1>
        <motion.p 
          className="text-sm text-muted-foreground font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {getSubtitle()}
        </motion.p>
      </div>

      {/* Enhanced Insight Content with sophisticated dark theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7 }}
        className="relative group"
      >
        {/* Enhanced background with sophisticated gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl blur-sm -z-10" />
        
        <div className="p-8 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-xl shadow-sm dark:shadow-lg relative overflow-hidden">
          {/* Subtle inner glow for dark mode */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01] dark:from-white/[0.08] dark:via-transparent dark:to-white/[0.04] pointer-events-none" />
          
          {/* Enhanced loading state */}
          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-blue-400/60 dark:bg-blue-400/80 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400/60 dark:bg-blue-400/80 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-2 h-2 bg-blue-400/60 dark:bg-blue-400/80 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              </div>
              <span className="text-sm text-muted-foreground animate-pulse">Crafting your insight...</span>
            </div>
          ) : (
            <div className="flex items-start gap-4 relative z-10">
              {/* Enhanced emoji with better dark mode visibility */}
              <div className="text-3xl drop-shadow-sm">
                {insight.type === 'celebration' ? '🎉' : 
                 insight.type === 'welcome' ? '👋' : 
                 insight.type === 'guidance' ? '🎯' : '💫'}
              </div>
              
              {/* Enhanced text with better typography */}
              <div className="flex-1">
                <p className="text-sm md:text-base leading-relaxed font-medium text-blue-700 dark:text-blue-300 insight-text">
                  {insight.message}
                </p>
                
                {/* Subtle progress indicator if available */}
                {insight.context?.weekProgress && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                            i < (insight.context?.weekProgress ?? 0)
                              ? 'bg-blue-500 dark:bg-blue-400' 
                              : 'bg-blue-200/50 dark:bg-blue-800/30'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {insight.context?.weekProgress}/7 this week
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.section>
  )
}

export default DailyInsight 