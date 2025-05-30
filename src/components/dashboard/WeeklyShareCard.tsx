'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Share2, Download, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { WeeklyStats, StatsDelta, PercentChange } from '@/lib/stats';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// X Logo Component
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface WeeklyShareCardProps {
  weeklyStats: {
    current: WeeklyStats;
    previous: WeeklyStats;
    deltas: StatsDelta;
  };
  className?: string;
}

export function WeeklyShareCard({ weeklyStats, className }: WeeklyShareCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

  // Check if user has significant progress to share
  const hasSignificantProgress = () => {
    const { current } = weeklyStats;
    return current.workouts >= 3 || current.distance >= 5 || current.volume >= 1000;
  };

  const getShareableMoment = () => {
    const { current } = weeklyStats;
    if (current.workouts >= 5) return "🔥 Consistency Champion";
    if (current.distance >= 20) return "🏃‍♂️ Distance Dominator";
    if (current.volume >= 5000) return "💪 Strength Superstar";
    if (current.workouts >= 3) return "✨ Progress Maker";
    return "🌟 Fitness Journey";
  };

  const getMinimalCopy = () => {
    const { current } = weeklyStats;
    const parts = [];
    
    if (current.workouts > 0) {
      parts.push(`${current.workouts} session${current.workouts > 1 ? 's' : ''}`);
    }
    
    if (current.distance > 0) {
      parts.push(`${current.distance.toFixed(1)}km`);
    }
    
    if (current.volume > 0) {
      parts.push(`${(current.volume / 1000).toFixed(1)}t strength`);
    }
    
    return parts.join(' • ');
  };

  const getShareText = () => {
    const summary = getMinimalCopy();
    return summary ? `This week: ${summary}` : 'Building consistency';
  };

  const formatDelta = (delta: PercentChange) => {
    if (delta.direction === 'up' && delta.percentage > 0) {
      return { text: `+${Math.round(delta.percentage)}%`, show: true };
    } else if (delta.direction === 'down' && delta.percentage > 0) {
      return { text: `-${Math.round(delta.percentage)}%`, show: true };
    }
    return { text: '', show: false };
  };

  const handleShare = async (platform: 'x' | 'copy' | 'download') => {
    setIsSharing(true);
    
    // Track share action for analytics
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'share_weekly_summary', {
          method: platform,
          content_type: 'weekly_summary',
          item_id: `week-${format(new Date(), 'yyyy-MM-dd')}`,
          custom_parameters: {
            workouts_count: weeklyStats.current.workouts,
            has_distance: weeklyStats.current.distance > 0,
            has_volume: weeklyStats.current.volume > 0
          }
        });
      }
    } catch (e) {
      // Silent fail for analytics
    }
    
    try {
      const shareText = getShareText();
      
      switch (platform) {
        case 'x':
          await downloadCardAsImage();
          setTimeout(() => {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
          }, 1000);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Copied');
          break;
          
        case 'download':
          await downloadCardAsImage();
          break;
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const downloadCardAsImage = async () => {
    if (!cardRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `week-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      const { toast } = await import('sonner');
      toast.success('Downloaded');
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const workoutDelta = formatDelta(weeklyStats.deltas.workoutsDelta);
  const distanceDelta = formatDelta(weeklyStats.deltas.distanceDelta);
  const volumeDelta = formatDelta(weeklyStats.deltas.volumeDelta);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-lg mx-auto", className)}
    >
      <Card 
        ref={cardRef}
        className="border-0 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
      >
        <CardContent className="p-12">
          {/* Header with Aivery Logo */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-6 p-3">
              <Image
                src="/icons/aivery.svg"
                alt="Aivery"
                width={40}
                height={40}
                className="filter brightness-0 invert w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-light text-gray-900 dark:text-gray-100 mb-2">
              Weekly Summary
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-1">
              {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
            </p>
            {session?.user?.name && (
              <p className="text-xs text-gray-400 font-mono">
                {session.user.name}
              </p>
            )}
          </div>

          {/* Metrics */}
          <div className="space-y-8 mb-12">
            {weeklyStats.current.workouts > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                  Sessions
                </span>
                <div className="flex items-center gap-3">
                  {workoutDelta.show && (
                    <span className="text-xs text-gray-400 font-mono">
                      {workoutDelta.text}
                    </span>
                  )}
                  <span className="text-xl font-light text-gray-900 dark:text-gray-100">
                    {weeklyStats.current.workouts}
                  </span>
                </div>
              </div>
            )}

            {weeklyStats.current.distance > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                  Cardio
                </span>
                <div className="flex items-center gap-3">
                  {distanceDelta.show && (
                    <span className="text-xs text-gray-400 font-mono">
                      {distanceDelta.text}
                    </span>
                  )}
                  <span className="text-xl font-light text-gray-900 dark:text-gray-100">
                    {weeklyStats.current.distance.toFixed(1)}km
                  </span>
                </div>
              </div>
            )}

            {weeklyStats.current.volume > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                  Strength
                </span>
                <div className="flex items-center gap-3">
                  {volumeDelta.show && (
                    <span className="text-xs text-gray-400 font-mono">
                      {volumeDelta.text}
                    </span>
                  )}
                  <span className="text-xl font-light text-gray-900 dark:text-gray-100">
                    {(weeklyStats.current.volume / 1000).toFixed(1)}t
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center">
            <div className="text-xs text-gray-400 font-mono mb-6">
              aivery
            </div>
            
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => handleShare('x')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-xs font-mono text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <XLogo className="h-3 w-3 mr-2" />
                Share
              </Button>
              
              <Button
                onClick={() => handleShare('download')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-xs font-mono text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <Download className="h-3 w-3 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default WeeklyShareCard; 