'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getCurrentStreak, getStreakMessage } from '@/lib/utils/getCurrentStreak';

const StreakCard = () => {
  const [streak, setStreak] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/dashboard/workout-dates');
        
        if (!res.ok) {
          throw new Error('Failed to fetch workout dates');
        }
        
        const data = await res.json();
        const currentStreak = getCurrentStreak(data.dates || []);
        setStreak(currentStreak);
      } catch (error) {
        console.error('Failed to fetch streak data:', error);
        setError('Unable to load streak');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreak();
  }, []);

  const streakInfo = getStreakMessage(streak);

  if (error) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="p-6 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
          <p className="text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
        </div>
      </motion.section>
    );
  }

  if (isLoading) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="p-6 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-2/3"></div>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl backdrop-blur-sm shadow-sm border border-orange-200/50 dark:border-orange-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
              {streakInfo.emoji}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                {streakInfo.message}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {streak > 0 ? (
                  <>Keep the momentum going – consistency is key to reaching your goals!</>
                ) : (
                  <>Today is a perfect day to start building healthy habits.</>
                )}
              </p>
            </div>
          </div>
          
          {/* Action Button */}
          {streak === 0 ? (
            <Link href="/workouts/new">
              <motion.button 
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Today
              </motion.button>
            </Link>
          ) : (
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {streak}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Day{streak !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
        
        {/* Micro-achievements for longer streaks */}
        {streak > 0 && (
          <div className="mt-4 pt-4 border-t border-orange-200/50 dark:border-orange-700/50">
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span>
                {streak >= 7 ? '🏆 Week Champion' : 
                 streak >= 3 ? '📈 Building Habit' : 
                 '🌱 Getting Started'}
              </span>
              <span>
                {streak < 3 ? `${3 - streak} more for habit` :
                 streak < 7 ? `${7 - streak} more for weekly goal` :
                 streak < 14 ? `${14 - streak} more for 2-week streak` :
                 'Incredible consistency!'}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-2 w-full bg-orange-200/50 dark:bg-orange-800/30 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-orange-500 to-red-500 h-1.5 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, (streak / 14) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default StreakCard; 