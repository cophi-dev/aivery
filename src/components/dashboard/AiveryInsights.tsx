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
          
          const normalizedStart = new Date(Date.UTC(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate(), 12, 0, 0, 0));
          const normalizedEnd = new Date(Date.UTC(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate(), 12, 0, 0, 0));
          apiUrl = `/api/ai/overview-insights?start=${normalizedStart.toISOString()}&end=${normalizedEnd.toISOString()}&t=${requestId}`;
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
        className={cn("w-full h-full", className)}
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
            className
          )}>
            {/* Background gradient */}
            {!isDateRangedInsight && (
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
            )}
            
            <div className="relative z-10 p-6 flex flex-col h-full">
              {/* Header with day theme icon or generic title */}
              <motion.div 
                className="flex items-center justify-between mb-4"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-center gap-2">
                  {!isDateRangedInsight && (
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
                  )}
                  
                  <motion.div variants={itemVariants}>
                    <h3 className="font-medium text-lg tracking-tight">
                      {isDateRangedInsight 
                        ? (insight?.title || 'Overview Insights') 
                        : `${dayName} ${insight?.title || 'Insights'}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isDateRangedInsight
                        ? (insight?.description || 'Performance analysis and optimization insights')
                        : (insight?.description || "Data-driven training analysis")}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
              
              {/* Content */}
              <motion.div
                className="space-y-4"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                {isDateRangedInsight ? (
                  <motion.div
                    variants={itemVariants}
                    className="space-y-4"
                  >
                    {/* Overview insights display */}
                    {error ? (
                      <div className="p-4 rounded-lg border border-destructive/10 bg-destructive/5">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    ) : insight?.error ? (
                      <div className="p-4 rounded-lg border border-destructive/10 bg-destructive/5">
                        <p className="text-sm text-destructive">⚠️ {insight.error.message}</p>
                      </div>
                    ) : insight?.highlight && (
                      <div className="p-4 rounded-lg border border-primary/10 bg-primary/5">
                        <p className="text-base text-primary/80">
                          {insight.highlight.split('. ').map((sentence, index) => {
                            // Skip empty sentences
                            if (!sentence.trim()) return null;
                            
                            // More precise detection for actual PRs, not just any positive content
                            const containsPR = 
                              // Use stricter matching patterns for actual PRs
                              /\bnew pr\b|\bset a pr\b|\bpersonal record\b|\bnew personal best\b|\bbeat.*previous best\b|\bpr in\b/i.test(sentence) || 
                              // Check for specific patterns like "X kg PR" or "PR of X km"
                              /\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps).*\b(pr|record)\b/i.test(sentence) ||
                              /\b(pr|record)\b.*\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps)/i.test(sentence);
                            
                            return (
                              <span key={index} className={cn(
                                containsPR ? "font-bold text-amber-600 dark:text-amber-400" : ""
                              )}>
                                {containsPR ? '🏆 ' : ''}
                                {sentence}{index < (insight.highlight?.split('. ').length || 0) - 1 ? '. ' : ''}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    )}
                    
                    {!error && !insight?.error && insight?.positiveTrends && insight.positiveTrends.length > 0 && (
                      <div>
                        <strong className="text-green-700 dark:text-green-400">Performance Strengths:</strong>
                        <ul className="mt-2 space-y-1">
                          {insight.positiveTrends.map((trend, i) => {
                            // More precise detection for actual PRs
                            const containsPR = 
                              // Use stricter matching patterns for actual PRs
                              /\bnew pr\b|\bset a pr\b|\bpersonal record\b|\bnew personal best\b|\bbeat.*previous best\b|\bpr in\b/i.test(trend) || 
                              // Check for specific patterns like "X kg PR" or "PR of X km"
                              /\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps).*\b(pr|record)\b/i.test(trend) ||
                              /\b(pr|record)\b.*\b\d+(\.\d+)?\s*(kg|km|mi|miles|ton|tons|t|rep|reps)/i.test(trend);

                            return (
                              <li key={i} className={cn(
                                "text-sm",
                                containsPR ? "font-semibold text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                              )}>
                                {containsPR ? '🏆 ' : '• '}
                                {trend}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {!error && !insight?.error && insight?.negativeTrends && insight.negativeTrends.length > 0 && (
                      <div>
                        <strong className="text-amber-700 dark:text-amber-400">Optimization Opportunities:</strong>
                        <ul className="mt-2 space-y-1">
                          {insight.negativeTrends.map((trend, i) => (
                            <li key={i} className="text-sm text-amber-600 dark:text-amber-400">• {trend}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!error && !insight?.error && insight?.milestones && insight.milestones.length > 0 && (
                      <div>
                        <strong className="text-blue-700 dark:text-blue-400">Key Metrics:</strong>
                        <ul className="mt-2 space-y-1">
                          {insight.milestones.map((stone, i) => (
                            <li key={i} className="text-sm text-blue-600 dark:text-blue-400">• {stone}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Show loading indicator only if loading is true and no error and no actual highlight */}
                    {loading && !error && !insight?.error && !insight?.highlight && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg border border-primary/10 bg-primary/5">
                          <p className="text-base text-primary/80">Analyzing performance data for your selected timeframe...</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                          <span>Processing training metrics</span>
                        </div>
                      </div>
                    )}

                    {/* Fallback for no data when not loading and no error */}
                    {!loading && !error && !insight?.error && !(insight?.highlight || insight?.positiveTrends?.length || insight?.negativeTrends?.length || insight?.milestones?.length) && (
                       <div className="p-4 rounded-lg border border-slate-200/50 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Insufficient training data for comprehensive analysis. Log more workouts to generate detailed performance insights.</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    variants={itemVariants}
                    className="space-y-2"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        <span>Analyzing your training data...</span>
                      </div>
                    ) : error ? (
                      <div className="p-4 rounded-lg border border-destructive/10 bg-destructive/5">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    ) : insight?.error ? (
                      <div className="p-4 rounded-lg border border-destructive/10 bg-destructive/5">
                        <p className="text-sm text-destructive">⚠️ {insight.error.message}</p>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <p className="text-base leading-relaxed text-foreground">
                          {insight?.insight}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
              
              {/* Visual indicator for day context */}
              {!isDateRangedInsight && (
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
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}