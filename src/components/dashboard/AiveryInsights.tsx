"use client"

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { CalendarClock, Sparkles, Zap, ArrowUpRight, BarChart4, Flame, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightData {
  title?: string;
  description?: string;
  insight?: string;
  highlight?: string;
  positiveTrends?: string[];
  negativeTrends?: string[];
  milestones?: string[];
  error?: {
    message: string;
    type: string;
  } | null;
  timestamp?: number;
  isFinal?: boolean;
  generatedAt?: string;
}

// Props for AiveryInsights component
interface AiveryInsightsProps {
  dateRange?: {
    start: Date;
    end: Date;
  };
  className?: string; // Allow passing additional class names
  onLoad?: () => void; // Callback when insights are loaded
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

// Add a helper function to check if the insight is a processing placeholder
function isProcessingPlaceholder(insight: InsightData | null): boolean {
  if (!insight) return true;
  
  // If the response is marked as final, it's not a placeholder
  if (insight.isFinal) return false;
  
  // Check for the common processing message patterns
  const processingMessages = [
    "analyzing your latest activities",
    "your performance data is being processed",
    "refreshing your insights",
    "being processed",
    "being analyzed",
    "generating insights"
  ];
  
  // If there's a highlight, check if it's a processing message
  if (insight.highlight) {
    const isProcessingHighlight = processingMessages.some(msg => 
      insight.highlight!.toLowerCase().includes(msg.toLowerCase())
    );
    
    // If it's not a processing message and has actual content, it's not a placeholder
    if (!isProcessingHighlight && insight.highlight.length > 20) {
      return false;
    }
  }
  
  // Check for processing messages in positive trends
  const hasProcessingTrend = insight.positiveTrends?.length === 1 && 
    processingMessages.some(msg => 
      insight.positiveTrends![0].toLowerCase().includes(msg.toLowerCase())
    );
  
  // Consider it a placeholder if:
  // 1. It has no highlight and no trends, or
  // 2. It has processing messages in either highlight or trends
  return (!insight.highlight && (!insight.positiveTrends || insight.positiveTrends.length === 0)) ||
         (insight.highlight && processingMessages.some(msg => insight.highlight!.toLowerCase().includes(msg.toLowerCase()))) ||
         hasProcessingTrend;
}

export default function AiveryInsights({ dateRange, className, onLoad }: AiveryInsightsProps) {
  const { data: session } = useSession();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Use refs instead of state for tracking request IDs to avoid state batching issues
  const currentRequestIdRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const MAX_RETRIES = 3; // Simplified: reduce retries for faster feedback
  const RETRY_DELAY = 1500; // Increased to give more time for API
  
  const isDateRangedInsight = !!dateRange;

  // Get current day name for daily insights
  const dayName = !isDateRangedInsight ? new Date().toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const theme = !isDateRangedInsight && dayName ? (dayThemes[dayName as keyof typeof dayThemes] || dayThemes.Monday) : dayThemes.Monday;
  
  // Only re-run the effect when these values change
  const startDateString = dateRange?.start.toISOString();
  const endDateString = dateRange?.end.toISOString();

  useEffect(() => {
    console.log("[AiveryInsights] Effect triggered with dates:", { startDateString, endDateString });
    
    async function fetchInsights() {
      // Already loading? Don't start another fetch
      if (loading && currentRequestIdRef.current) {
        console.log("[AiveryInsights] Already fetching, skipping new fetch");
        return;
      }

      // No session? Can't fetch
      if (!session?.user) {
        console.log("[AiveryInsights] No session, can't fetch insights");
        setLoading(false);
          return;
      }

      // Cancel any in-progress fetch
      if (abortControllerRef.current) {
        console.log("[AiveryInsights] Aborting previous fetch");
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller and request ID
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      currentRequestIdRef.current = requestId;
      retryCountRef.current = 0;
      
      // Reset state
      setLoading(true);
      setInsight(null);
      setError(null);
      
      console.log(`[AiveryInsights] Starting new fetch with ID: ${requestId}`);

      try {
        let apiUrl = '';

        if (isDateRangedInsight) {
          if (!dateRange?.start || !dateRange?.end) {
            console.log("[AiveryInsights] Missing date range, aborting fetch");
            setLoading(false);
              return;
          }
          
          // Fix: Use the exact date range passed from parent without additional normalization
          // The parent (WorkoutDailyView) already provides the correct full-day range
          const startDateStr = dateRange.start.toISOString();
          const endDateStr = dateRange.end.toISOString();
          
          console.log("[AiveryInsights] Using exact date range from parent:", {
            start: startDateStr,
            end: endDateStr,
            originalStart: dateRange.start,
            originalEnd: dateRange.end
          });
          
          apiUrl = `/api/ai/overview-insights?start=${startDateStr}&end=${endDateStr}&t=${requestId}`;
        } else {
          apiUrl = `/api/daily-insight?t=${requestId}`;
        }
        
        console.log(`[AiveryInsights] Fetching from: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });

        if (signal.aborted) {
          console.log(`[AiveryInsights] Fetch aborted for request ${requestId}`);
          return; 
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`[AiveryInsights] Received data for request ${requestId}:`, { 
          isFinal: data.isFinal,
          hasHighlight: !!data.highlight,
          hasInsight: !!data.insight
        });

        // Handle old format where insight field is used instead of highlight
        if (data.insight && !data.highlight) {
          data.highlight = data.insight;
        }
        
        // Check if the response is a placeholder
        if (data.isFinal || !isProcessingPlaceholder(data)) {
          setInsight(data);
          setLoading(false);
        } else if (retryCountRef.current < MAX_RETRIES) {
          // This is a placeholder response, retry after delay
          console.log(`[AiveryInsights] Got placeholder response, will retry (${retryCountRef.current + 1}/${MAX_RETRIES})`);
          if (data.highlight) {
            setInsight(data); // Show the intermediate placeholder
          }
          
          retryCountRef.current++;
          setTimeout(fetchInsights, RETRY_DELAY);
        } else {
          console.log(`[AiveryInsights] Max retries reached`);
          setInsight(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (signal.aborted) {
          console.log(`[AiveryInsights] Error ignored due to abort for request ${requestId}`);
          return;
        }
        
        console.error(`[AiveryInsights] Error fetching insights:`, err);
        setError(err.message || "Failed to load insights");
        setLoading(false);
      }
    }
    
    fetchInsights();

    return () => {
      console.log("[AiveryInsights] Cleanup: aborting any pending fetch");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [session, isDateRangedInsight, startDateString, endDateString]);

  // Add effect to notify parent when loading state changes
  useEffect(() => {
    if (!loading && insight) {
      console.log("[AiveryInsights] Notifying parent that insights are loaded");
      onLoad?.();
    }
  }, [loading, insight, onLoad]);

  // Log component state before rendering
  const renderingState = {
    loading,
    error,
    insightHighlight: insight?.highlight,
    insightIsFinal: insight?.isFinal,
    hasPositiveTrends: (insight?.positiveTrends?.length ?? 0) > 0,
  };
  console.log('[AiveryInsights render]', renderingState);

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
        className={cn("w-full", className)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          whileHover={{ y: -2 }}
        >
          <div className="relative">
            {/* Enhanced background with sophisticated gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl" />
            <div className="absolute inset-0 bg-white/50 dark:bg-neutral-900/50 rounded-2xl backdrop-blur-xl" />
            
            <div className="relative z-10 p-8">
              {/* Enhanced Header */}
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <div className="flex items-center gap-4">
                  {!isDateRangedInsight && (
                    <motion.div
                      className={cn(
                        "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-sm", 
                        theme.gradient
                      )}
                      whileHover={{ 
                        scale: 1.05,
                        transition: { duration: 0.2 } 
                      }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    >
                      <motion.div
                        animate={iconAnimations[animationType]}
                      >
                        <Icon size={20} className="text-white" />
                      </motion.div>
                    </motion.div>
                  )}
                  
                  <div>
                    <h3 className="text-xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                      {isDateRangedInsight 
                        ? (insight?.title || 'Daily Insights') 
                        : `${dayName} Insights`}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                      {isDateRangedInsight
                        ? (insight?.description || 'AI-powered performance analysis')
                        : (insight?.description || "Your personalized training companion")}
                    </p>
                  </div>
                </div>
              </motion.div>
              
              {/* Enhanced Content */}
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                {isDateRangedInsight ? (
                  <div className="space-y-6">
                    {/* Enhanced highlight section */}
                    {error ? (
                      <motion.div 
                        className="p-6 rounded-2xl border border-red-200/50 dark:border-red-800/30 bg-gradient-to-br from-red-50/80 to-red-100/50 dark:from-red-950/40 dark:to-red-900/30"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                        </div>
                      </motion.div>
                    ) : insight?.error ? (
                      <motion.div 
                        className="p-6 rounded-2xl border border-red-200/50 dark:border-red-800/30 bg-gradient-to-br from-red-50/80 to-red-100/50 dark:from-red-950/40 dark:to-red-900/30"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{insight.error.message}</p>
                        </div>
                      </motion.div>
                    ) : insight?.highlight && (
                      <motion.div 
                        className="p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-2xl">💡</span>
                          <div className="flex-1">
                            <p className="text-base text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                              {insight.highlight.split('. ').map((sentence, index) => {
                                // Skip empty sentences
                                if (!sentence.trim()) return null;
                                
                                // More precise detection for actual PRs
                                const containsPR = 
                                  /\bnew pr\b|\bset a pr\b|\bpersonal record\b|\bnew personal best\b|\bbeat.*previous best\b|\bpr in\b/i.test(sentence) || 
                                  /\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps).*\b(pr|record)\b/i.test(sentence) ||
                                  /\b(pr|record)\b.*\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps)/i.test(sentence);
                                
                                return (
                                  <span key={index} className={cn(
                                    containsPR ? "font-bold text-amber-700 dark:text-amber-300" : ""
                                  )}>
                                    {containsPR ? '🏆 ' : ''}
                                    {sentence}{index < (insight.highlight?.split('. ').length || 0) - 1 ? '. ' : ''}
                                  </span>
                                );
                              })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Enhanced sections */}
                    {!error && !insight?.error && insight?.positiveTrends && insight.positiveTrends.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                      >
                        <div className="p-6 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-br from-emerald-50/80 to-green-50/80 dark:from-emerald-950/40 dark:to-green-950/40">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-xl">📈</span>
                            <h4 className="font-serif text-lg tracking-tight text-emerald-800 dark:text-emerald-200">
                              Performance Strengths
                            </h4>
                          </div>
                          <ul className="space-y-3">
                            {insight.positiveTrends.map((trend, i) => {
                              const containsPR = 
                                /\bnew pr\b|\bset a pr\b|\bpersonal record\b|\bnew personal best\b|\bbeat.*previous best\b|\bpr in\b/i.test(trend) || 
                                /\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps).*\b(pr|record)\b/i.test(trend) ||
                                /\b(pr|record)\b.*\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps)/i.test(trend);

                              return (
                                <motion.li 
                                  key={i} 
                                  className={cn(
                                    "text-sm leading-relaxed flex items-start gap-3",
                                    containsPR ? "font-semibold text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
                                  )}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.5 + (i * 0.1), duration: 0.3 }}
                                >
                                  <span className="mt-0.5">
                                    {containsPR ? '🏆' : '•'}
                                  </span>
                                  <span>{trend}</span>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </div>
                      </motion.div>
                    )}

                    {!error && !insight?.error && insight?.negativeTrends && insight.negativeTrends.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                      >
                        <div className="p-6 rounded-2xl border border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/40">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-xl">🎯</span>
                            <h4 className="font-serif text-lg tracking-tight text-amber-800 dark:text-amber-200">
                              Growth Opportunities
                            </h4>
                          </div>
                          <ul className="space-y-3">
                            {insight.negativeTrends.map((trend, i) => (
                              <motion.li 
                                key={i} 
                                className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-3"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + (i * 0.1), duration: 0.3 }}
                              >
                                <span className="mt-0.5">•</span>
                                <span>{trend}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}

                    {!error && !insight?.error && insight?.milestones && insight.milestones.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                      >
                        <div className="p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-950/40 dark:to-cyan-950/40">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-xl">📊</span>
                            <h4 className="font-serif text-lg tracking-tight text-blue-800 dark:text-blue-200">
                              Key Metrics
                            </h4>
                          </div>
                          <ul className="space-y-3">
                            {insight.milestones.map((stone, i) => (
                              <motion.li 
                                key={i} 
                                className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed flex items-start gap-3"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 + (i * 0.1), duration: 0.3 }}
                              >
                                <span className="mt-0.5">•</span>
                                <span>{stone}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Enhanced loading state */}
                    {loading && !error && !insight?.error && !insight?.highlight && (
                      <motion.div 
                        className="space-y-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40">
                          <div className="flex items-start gap-4">
                            <span className="text-2xl">🤖</span>
                            <p className="text-base text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                              Analyzing your performance data and generating personalized insights...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </motion.div>
                    )}

                    {/* Enhanced empty state */}
                    {!loading && !error && !insight?.error && !(insight?.highlight || insight?.positiveTrends?.length || insight?.negativeTrends?.length || insight?.milestones?.length) && (
                      <motion.div 
                        className="p-8 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/30 bg-gradient-to-br from-neutral-50/80 to-slate-50/80 dark:from-neutral-950/40 dark:to-slate-950/40 text-center"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="space-y-4">
                          <span className="text-4xl">📝</span>
                          <div>
                            <p className="text-base font-serif text-neutral-700 dark:text-neutral-300 mb-2">
                              Building your insights...
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              Log a few more workouts to unlock personalized performance analysis and AI-powered training insights.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-3 p-6">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-3">
                          Analyzing your training data...
                        </span>
                      </div>
                    ) : error ? (
                      <div className="p-6 rounded-2xl border border-red-200/50 dark:border-red-800/30 bg-gradient-to-br from-red-50/80 to-red-100/50 dark:from-red-950/40 dark:to-red-900/30">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                        </div>
                      </div>
                    ) : insight?.error ? (
                      <div className="p-6 rounded-2xl border border-red-200/50 dark:border-red-800/30 bg-gradient-to-br from-red-50/80 to-red-100/50 dark:from-red-950/40 dark:to-red-900/30">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{insight.error.message}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40">
                        <div className="flex items-start gap-4">
                          <span className="text-2xl">💭</span>
                          <p className="text-base text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                            {insight?.insight}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}