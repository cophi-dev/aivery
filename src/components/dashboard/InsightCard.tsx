'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  icon: string;
  title: string;
  description: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
  className?: string;
  delay?: number;
}

const getVariantStyles = (variant: InsightCardProps['variant']) => {
  switch (variant) {
    case 'success':
      return {
        cardClass: 'bg-gradient-to-br from-emerald-50/80 to-green-50/60 dark:from-emerald-950/40 dark:to-green-950/30 border-emerald-200/50 dark:border-emerald-800/30',
        titleClass: 'text-emerald-900 dark:text-emerald-100'
      };
    case 'warning':
      return {
        cardClass: 'bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/50 dark:border-amber-800/30',
        titleClass: 'text-amber-900 dark:text-amber-100'
      };
    case 'info':
      return {
        cardClass: 'bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/30 border-blue-200/50 dark:border-blue-800/30',
        titleClass: 'text-blue-900 dark:text-blue-100'
      };
    default:
      return {
        cardClass: 'bg-gradient-to-br from-gray-50/80 to-slate-50/60 dark:from-gray-950/40 dark:to-slate-950/30 border-gray-200/50 dark:border-gray-800/30',
        titleClass: 'text-gray-900 dark:text-gray-100'
      };
  }
};

export default function InsightCard({ 
  icon, 
  title, 
  description, 
  variant = 'default',
  className,
  delay = 0
}: InsightCardProps) {
  const { cardClass, titleClass } = getVariantStyles(variant);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay, 
        duration: 0.4, 
        ease: "easeOut",
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className={className}
    >
      <Card className={cn(
        "border backdrop-blur-sm hover:shadow-lg transition-all duration-300 cursor-default",
        cardClass
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="text-2xl mt-0.5 select-none">
              {icon}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={cn("font-semibold text-base mb-2", titleClass)}>
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 