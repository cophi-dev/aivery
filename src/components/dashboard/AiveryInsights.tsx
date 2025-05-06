"use client"

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { CalendarClock, Sparkles, Zap, ArrowUpRight, BarChart4, Flame, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightData {
  title: string;
  description: string;
  insight: string;
  error?: {
    message: string;
    type: string;
  } | null;
}

// Enhanced day themes with more Apple-like aesthetics
const dayThemes = {
  'Monday': {
    icon: Zap,
    gradient: 'from-blue-500 to-purple-500',
    motionIcon: 'wave',
    shadow: '0 0 15px rgba(99, 102, 241, 0.2)'
  },
  'Tuesday': {
    icon: Sparkles,
    gradient: 'from-amber-400 to-orange-500',
    motionIcon: 'sparkle',
    shadow: '0 0 15px rgba(251, 191, 36, 0.2)'
  },
  'Wednesday': {
    icon: CalendarClock,
    gradient: 'from-teal-400 to-cyan-500',
    motionIcon: 'pulse',
    shadow: '0 0 15px rgba(45, 212, 191, 0.2)'
  },
  'Thursday': {
    icon: ArrowUpRight,
    gradient: 'from-indigo-400 to-blue-600',
    motionIcon: 'rise',
    shadow: '0 0 15px rgba(99, 102, 241, 0.2)'
  },
  'Friday': {
    icon: BarChart4,
    gradient: 'from-fuchsia-500 to-violet-600',
    motionIcon: 'rhythm',
    shadow: '0 0 15px rgba(217, 70, 239, 0.2)'
  },
  'Saturday': {
    icon: Flame,
    gradient: 'from-red-400 to-pink-500',
    motionIcon: 'energize',
    shadow: '0 0 15px rgba(251, 113, 133, 0.2)'
  },
  'Sunday': {
    icon: RefreshCw,
    gradient: 'from-emerald-400 to-green-500',
    motionIcon: 'cycle',
    shadow: '0 0 15px rgba(52, 211, 153, 0.2)'
  }
};

export default function AiveryInsights() {
  const { data: session } = useSession();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get current day name
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const theme = dayThemes[dayName as keyof typeof dayThemes] || dayThemes.Monday;
  
  useEffect(() => {
    async function fetchInsight() {
      if (!session?.user) return;
      
      try {
        setLoading(true);
        const cacheBuster = Date.now();
        const response = await fetch(`/api/fetch-daily-insight?t=${cacheBuster}`, {
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch insight: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("[AiveryInsights] Raw data received from /api/fetch-daily-insight:", JSON.stringify(data, null, 2));
        setInsight(data);
      } catch (err) {
        console.error('Error fetching daily insight:', err);
        setError(err instanceof Error ? err.message : 'Failed to load daily insight');
      } finally {
        setLoading(false);
      }
    }
    
    fetchInsight();
  }, [session, dayName]);

  // Icon animation variants based on day
  const iconAnimations = {
    wave: {
      y: [0, -5, 0],
      transition: { repeat: Infinity, duration: 3, ease: "easeInOut" }
    },
    sparkle: {
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1],
      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" }
    },
    pulse: {
      scale: [1, 1.05, 1],
      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" }
    },
    rise: {
      x: [0, 3, 0],
      y: [0, -3, 0],
      transition: { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
    },
    rhythm: {
      rotate: [0, 3, 0, -3, 0],
      transition: { repeat: Infinity, duration: 4, ease: "easeInOut" }
    },
    energize: {
      scale: [1, 1.1, 1],
      filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
      transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
    },
    cycle: {
      rotate: [0, 360],
      transition: { repeat: Infinity, duration: 10, ease: "linear" }
    }
  };

  // Content animation variants
  const contentVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0 }
  };

  const Icon = theme.icon;
  const animationType = theme.motionIcon as keyof typeof iconAnimations;
  
  // Card animation variants
  const cardVariants = {
    initial: { 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
    },
    hover: { 
      boxShadow: `0 8px 20px rgba(0, 0, 0, 0.08), ${theme.shadow}`,
      borderColor: 'rgba(226, 232, 240, 0.8)',
      scale: 1.01,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full"
      >
        <motion.div
          variants={cardVariants}
          initial="initial"
          whileHover="hover"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <Card className={cn(
            "relative overflow-hidden backdrop-blur-xl bg-opacity-20",
            "h-full rounded-xl transition-all duration-300",
            "dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50",
            "hover:border-slate-300/80 dark:hover:border-slate-600/80",
          )}>
            {/* Background gradient */}
            <motion.div 
              className={cn(
                "absolute inset-0 opacity-10 bg-gradient-to-br", 
                theme.gradient
              )}
              animate={{
                opacity: isHovered ? 0.15 : 0.1,
                transition: { duration: 0.3 }
              }}
            />
            
            <div className="relative z-10 p-6 flex flex-col h-full">
              {/* Header with day theme icon */}
              <motion.div 
                className="flex items-center justify-between mb-4"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-center gap-2">
                  {/* Animated icon container */}
                  <motion.div
                    className={cn(
                      "p-2 rounded-full bg-gradient-to-br", 
                      theme.gradient,
                      "text-white shadow-sm"
                    )}
                    whileHover={{ 
                      scale: 1.05,
                      transition: { duration: 0.2 } 
                    }}
                    variants={itemVariants}
                  >
                    <motion.div
                      animate={iconAnimations[animationType]}
                    >
                      <Icon size={18} />
                    </motion.div>
                  </motion.div>
                  
                  <motion.div variants={itemVariants}>
                    <h3 className="font-medium text-lg tracking-tight">
                      {`${dayName} ${insight?.title || 'Insights'}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {insight?.description || "Your daily fitness insight"}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
              
              {/* Content */}
              <motion.div 
                className="flex-1"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2.5"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/4 mb-2.5"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                  </div>
                ) : error ? (
                  <motion.p 
                    className="text-sm text-red-500"
                    variants={itemVariants}
                  >
                    {error}
                  </motion.p>
                ) : insight?.error ? (
                  <motion.p 
                    className="text-sm text-amber-500"
                    variants={itemVariants}
                  >
                    {insight.error.message}
                  </motion.p>
                ) : (
                  <motion.div
                    variants={itemVariants}
                    className="space-y-2"
                  >
                    <p className="text-base font-light leading-relaxed">
                      {insight?.insight}
                    </p>
                  </motion.div>
                )}
              </motion.div>
              
              {/* Visual indicator for day context */}
              <motion.div 
                className="pt-4 mt-auto"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const currentDayIndex = days.indexOf(dayName);
                    const isCurrentDay = i === currentDayIndex;
                    return (
                      <motion.div 
                        key={i} 
                        className={cn(
                          "h-1.5 rounded-full flex-1 transition-all",
                          isCurrentDay 
                            ? `bg-gradient-to-r ${theme.gradient}` 
                            : "bg-slate-300/30 dark:bg-slate-700/30"
                        )}
                        variants={itemVariants}
                        whileHover={{
                          scaleY: isCurrentDay ? 1.3 : 1.1,
                          transition: { duration: 0.2 }
                        }}
                        animate={isCurrentDay ? {
                          opacity: [0.7, 1, 0.7],
                          transition: { 
                            repeat: Infinity,
                            duration: 3,
                            ease: "easeInOut"
                          }
                        } : {}}
                      />
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}