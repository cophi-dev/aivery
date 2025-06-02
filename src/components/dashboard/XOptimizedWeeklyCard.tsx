'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy, TrendingUp, Calendar, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// X Logo Component
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface WeeklyStats {
  workouts: number;
  distance: number;
  volume: number;
  duration: number;
}

interface StatsDelta {
  workoutsDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
  distanceDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
  volumeDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
}

interface WeeklyPR {
  type: 'distance' | 'volume' | 'exercise';
  exercise?: string;
  value: number;
  unit: string;
  date: Date;
}

interface XOptimizedWeeklyCardProps {
  weeklyStats: {
    current: WeeklyStats;
    previous: WeeklyStats;
    deltas: StatsDelta;
  };
  weeklyPRs?: WeeklyPR[];
  className?: string;
}

export function XOptimizedWeeklyCard({ 
  weeklyStats, 
  weeklyPRs = [],
  className 
}: XOptimizedWeeklyCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // X-optimized dimensions: 1200 x 675 (16:9 aspect ratio)
  const CARD_WIDTH = 1200;
  const CARD_HEIGHT = 675;

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

  const getKeyMetrics = () => {
    const metrics = [];
    const { current } = weeklyStats;
    
    if (current.workouts > 0) {
      metrics.push({
        icon: '🎯',
        label: 'Sessions',
        value: current.workouts.toString(),
        delta: weeklyStats.deltas.workoutsDelta,
        highlight: false
      });
    }
    
    if (current.distance > 0) {
      metrics.push({
        icon: '🏃‍♂️',
        label: 'Distance',
        value: `${current.distance.toFixed(1)}km`,
        delta: weeklyStats.deltas.distanceDelta,
        highlight: weeklyPRs.some(pr => pr.type === 'distance')
      });
    }
    
    if (current.volume > 0) {
      metrics.push({
        icon: '💪',
        label: 'Volume',
        value: `${(current.volume / 1000).toFixed(1)}t`,
        delta: weeklyStats.deltas.volumeDelta,
        highlight: weeklyPRs.some(pr => pr.type === 'volume')
      });
    }
    
    return metrics.slice(0, 3);
  };

  const formatDelta = (delta: { direction: 'up' | 'down' | 'same'; percentage: number }) => {
    if (delta.direction === 'up' && delta.percentage > 0) {
      return { text: `+${Math.round(delta.percentage)}%`, color: 'text-green-600', show: true };
    } else if (delta.direction === 'down' && delta.percentage > 0) {
      return { text: `-${Math.round(delta.percentage)}%`, color: 'text-red-500', show: true };
    }
    return { text: '', color: '', show: false };
  };

  const getShareText = () => {
    const { current } = weeklyStats;
    const prCount = weeklyPRs.length;
    
    let text = '';
    
    if (prCount > 0) {
      text = `🏆 ${prCount} weekly PR${prCount > 1 ? 's' : ''}! `;
    }
    
    const parts = [];
    if (current.workouts > 0) parts.push(`${current.workouts} sessions`);
    if (current.distance > 0) parts.push(`${current.distance.toFixed(1)}km`);
    if (current.volume > 0) parts.push(`${(current.volume / 1000).toFixed(1)}t lifted`);
    
    text += `Week summary: ${parts.join(' • ')}`;
    
    if (prCount > 0) {
      text += ' #WeeklyGoals #PersonalRecord';
    } else {
      text += ' #ConsistencyIsKey #FitnessJourney';
    }
    
    return text;
  };

  const handleShare = async (platform: 'x' | 'copy' | 'download') => {
    setIsSharing(true);
    
    try {
      const shareText = getShareText();
      
      switch (platform) {
        case 'x':
          await downloadCardAsImage();
          setTimeout(async () => {
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(twitterUrl, '_blank', 'width=600,height=400');
            
            const { toast } = await import('sonner');
            toast.success(
              'Weekly summary downloaded! 📊',
              { 
                duration: 6000,
                description: 'Add the image to your tweet to inspire your followers!'
              }
            );
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Weekly summary copied!', {
            description: "Ready to paste and add your image"
          });
          break;
          
        case 'download':
          await downloadCardAsImage();
          break;
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      const { toast } = await import('sonner');
      toast.error('Sharing failed. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadCardAsImage = async () => {
    if (!cardRef.current) return;
    
    try {
      const { toast } = await import('sonner');
      toast.loading('Generating weekly summary...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: CARD_WIDTH * 2,
        height: CARD_HEIGHT * 2,
      });
      
      const link = document.createElement('a');
      const weekStartStr = format(weekStart, 'MMM-dd');
      const weekEndStr = format(weekEnd, 'MMM-dd-yyyy');
      link.download = `aivery-weekly-x-share-${weekStartStr}-to-${weekEndStr}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('Weekly summary downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getKeyMetrics();
  const hasNewPRs = weeklyPRs.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full mx-auto", className)}
      style={{ maxWidth: `${CARD_WIDTH/2}px` }}
    >
      <Card 
        ref={cardRef}
        data-share-card
        className="border-0 bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-blue-900/20 shadow-2xl overflow-hidden"
        style={{ 
          width: `${CARD_WIDTH}px`, 
          height: `${CARD_HEIGHT}px`,
          transform: 'scale(0.5)',
          transformOrigin: 'top left'
        }}
      >
        <CardContent className="p-16 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-blue-500 p-3">
                <Image
                  src="/icons/aivery.svg"
                  alt="Aivery"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100">
                  Weekly Summary
                </h1>
                <p className="text-base text-gray-500 dark:text-gray-400">
                  {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
                </p>
                {session?.user?.nickname || session?.user?.name && (
                  <p className="text-sm text-gray-600 dark:text-gray-500">
                    {session.user.nickname || session.user.name}
                  </p>
                )}
              </div>
            </div>
            
            {/* PR Badge */}
            {hasNewPRs && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full border-0">
                <Trophy className="h-4 w-4 mr-1" />
                {weeklyPRs.length} Weekly PR{weeklyPRs.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-8 mb-16 flex-1">
            {metrics.map((metric, index) => {
              const deltaFormatted = formatDelta(metric.delta);
              return (
                <div 
                  key={index} 
                  className={cn(
                    "text-center p-8 rounded-2xl border-2 transition-all",
                    metric.highlight 
                      ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-700" 
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className="text-6xl mb-4">{metric.icon}</div>
                  <div className={cn(
                    "text-4xl font-light mb-2",
                    metric.highlight ? "text-amber-700 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
                  )}>
                    {metric.value}
                  </div>
                  <div className="text-lg text-gray-600 dark:text-gray-400 font-mono">
                    {metric.label}
                    {metric.highlight && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        <Star className="h-4 w-4 inline" />
                      </span>
                    )}
                  </div>
                  {deltaFormatted.show && (
                    <div className={cn("text-sm font-mono mt-2", deltaFormatted.color)}>
                      {deltaFormatted.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weekly PRs Highlight */}
          {weeklyPRs.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-8 border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                This Week's Personal Records
              </h3>
              <div className="space-y-2">
                {weeklyPRs.map((pr, index) => (
                  <div key={index} className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || `${pr.type.charAt(0).toUpperCase() + pr.type.slice(1)}`}:</strong> {pr.value} {pr.unit}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consistency Message */}
          {!hasNewPRs && weeklyStats.current.workouts >= 3 && (
            <div className="text-center mb-12 p-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
              <div className="text-4xl mb-4">🔥</div>
              <p className="text-xl text-blue-700 dark:text-blue-300 font-medium">
                Consistency Champion
              </p>
              <p className="text-lg text-blue-600 dark:text-blue-400 mt-2">
                {weeklyStats.current.workouts} sessions this week - building unstoppable momentum!
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="text-lg text-gray-400 font-mono">
              aivery.app
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={() => handleShare('x')}
                disabled={isSharing}
                size="lg"
                className="bg-black hover:bg-gray-800 text-white px-8 py-3 text-lg font-mono"
              >
                <XLogo className="h-5 w-5 mr-3" />
                Share on X
              </Button>
              
              <Button
                onClick={() => handleShare('download')}
                disabled={isSharing}
                size="lg"
                variant="outline"
                className="px-8 py-3 text-lg font-mono border-2"
              >
                <Download className="h-5 w-5 mr-3" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default XOptimizedWeeklyCard; 