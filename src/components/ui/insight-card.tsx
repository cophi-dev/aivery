'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SmartNudge } from '@/lib/insights';

interface InsightCardProps {
  nudge: SmartNudge;
  className?: string;
  showEmoji?: boolean;
  animate?: boolean;
}

const typeStyles = {
  achievement: {
    background: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
    border: 'border-emerald-200/50 dark:border-emerald-800/50',
    text: 'text-emerald-700 dark:text-emerald-300'
  },
  celebration: {
    background: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    border: 'border-amber-200/50 dark:border-amber-800/50', 
    text: 'text-amber-700 dark:text-amber-300'
  },
  encouragement: {
    background: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    border: 'border-blue-200/50 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300'
  },
  suggestion: {
    background: 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20',
    border: 'border-purple-200/50 dark:border-purple-800/50',
    text: 'text-purple-700 dark:text-purple-300'
  }
};

export function InsightCard({ 
  nudge, 
  className, 
  showEmoji = true,
  animate = true 
}: InsightCardProps) {
  const style = typeStyles[nudge.type];

  const cardContent = (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 hover:shadow-md',
      style.border,
      className
    )}>
      <CardContent className={cn(
        'p-4 bg-gradient-to-br',
        style.background
      )}>
        <div className="flex items-start gap-3">
          {showEmoji && nudge.emoji && (
            <div className="text-2xl flex-shrink-0 mt-0.5">
              {nudge.emoji}
            </div>
          )}
          <p className={cn(
            'text-sm leading-relaxed font-medium',
            style.text
          )}>
            {nudge.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (!animate) {
    return cardContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.23, 1, 0.32, 1]
      }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
    >
      {cardContent}
    </motion.div>
  );
}

interface MultiInsightCardProps {
  nudges: SmartNudge[];
  title?: string;
  className?: string;
  maxDisplay?: number;
}

export function MultiInsightCard({ 
  nudges, 
  title = "Smart Insights", 
  className,
  maxDisplay = 2 
}: MultiInsightCardProps) {
  const displayNudges = nudges.slice(0, maxDisplay);

  if (displayNudges.length === 0) {
    return null;
  }

  return (
    <motion.div 
      className={cn("space-y-3", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <div className="space-y-3">
        {displayNudges.map((nudge, index) => (
          <motion.div
            key={`${nudge.type}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.4,
              delay: index * 0.1,
              ease: "easeOut"
            }}
          >
            <InsightCard nudge={nudge} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
} 