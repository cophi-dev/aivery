'use client';

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const DailyInsight = () => {
  const [insight, setInsight] = useState('Loading your insight...')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        setIsLoading(true)
        console.log('[DailyInsight] Fetching insight from /api/insight/today')
        
        // Add cache-busting parameter
        const res = await fetch(`/api/insight/today?t=${Date.now()}`)
        const data = await res.json()
        
        console.log('[DailyInsight] Response received:', data)
        
        if (data.error) {
          console.log('[DailyInsight] Error in response, using fallback')
          setInsight('Take a moment to reflect on your fitness journey today.')
        } else {
          console.log('[DailyInsight] Setting insight:', data.message)
          setInsight(data.message || 'Stay consistent with your fitness goals.')
        }
      } catch (error) {
        console.error('[DailyInsight] Failed to fetch daily insight:', error)
        setInsight('Every day is a new opportunity for progress.')
      } finally {
        setIsLoading(false)
        console.log('[DailyInsight] Loading complete')
      }
    }

    fetchInsight()
  }, [])

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Typography-led Header */}
      <div className="mb-6">
        <motion.h1 
          className="text-3xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Today
        </motion.h1>
        <motion.p 
          className="text-sm text-zinc-500 dark:text-zinc-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          Your daily insight
        </motion.p>
      </div>

      {/* Insight Content - Card with smooth padding */}
      <motion.div 
        className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 hover:shadow-md transition-all duration-300"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
      >
        <motion.div 
          className={`text-[1.125rem] leading-relaxed font-serif italic text-neutral-800 dark:text-neutral-200 transition-all duration-500 ${isLoading ? 'opacity-60' : 'opacity-100'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0.6 : 1 }}
          transition={{ duration: 0.5 }}
        >
          {insight}
        </motion.div>
        
        {/* Subtle loading indicator */}
        {isLoading && (
          <motion.div 
            className="mt-6 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  )
}

export default DailyInsight 