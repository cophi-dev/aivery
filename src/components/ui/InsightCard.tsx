'use client';

import { motion } from 'framer-motion'

interface InsightCardProps {
  message: string;
  isLoading?: boolean;
  isNewUser?: boolean;
  className?: string;
}

export function InsightCard({ 
  message, 
  isLoading = false, 
  isNewUser = false,
  className = ""
}: InsightCardProps) {
  return (
    <motion.div 
      className={`p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 hover:shadow-md transition-all duration-300 ${className}`}
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
        {message}
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
      
      {/* Welcome decoration for new users */}
      {isNewUser && !isLoading && (
        <motion.div 
          className="mt-4 flex items-center gap-2 text-sm text-neutral-500"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <span>✨</span>
          <span>Welcome to your fitness journey</span>
        </motion.div>
      )}
    </motion.div>
  )
} 