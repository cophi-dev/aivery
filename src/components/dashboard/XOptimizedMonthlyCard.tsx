'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy, TrendingUp, Calendar, Star, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// X Logo Component
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface MonthlyStats {
  workouts: number;
  distance: number;
  volume: number;
  duration: number;
  activeDays: number;
}

interface MonthlyDelta {
  workoutsDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
  distanceDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
  volumeDelta: { direction: 'up' | 'down' | 'same'; percentage: number };
}

interface MonthlyPR {
  type: 'distance' | 'volume' | 'exercise' | 'consistency';
  exercise?: string;
  value: number;
  unit: string;
  date: Date;
  achievement?: string;
}

interface XOptimizedMonthlyCardProps {
  monthlyStats: {
    current: MonthlyStats;
    previous: MonthlyStats;
    deltas: MonthlyDelta;
  };
  monthlyPRs?: MonthlyPR[];
  className?: string;
}

export function XOptimizedMonthlyCard({ 
  monthlyStats, 
  monthlyPRs = [],
  className 
}: XOptimizedMonthlyCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // X-optimized dimensions: 1200 x 675 (16:9 aspect ratio)
  const CARD_WIDTH = 1200;
  const CARD_HEIGHT = 675;

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const getKeyMetrics = () => {
    const metrics = [];
    const { current } = monthlyStats;
    
    if (current.workouts > 0) {
      metrics.push({
        icon: '🎯',
        label: 'Sessions',
        value: current.workouts.toString(),
        delta: monthlyStats.deltas.workoutsDelta,
        highlight: false
      });
    }
    
    if (current.distance > 0) {
      metrics.push({
        icon: '🌍',
        label: 'Distance',
        value: `${current.distance.toFixed(0)}km`,
        delta: monthlyStats.deltas.distanceDelta,
        highlight: monthlyPRs.some(pr => pr.type === 'distance')
      });
    }
    
    if (current.volume > 0) {
      metrics.push({
        icon: '🏋️‍♂️',
        label: 'Volume',
        value: `${(current.volume / 1000).toFixed(1)}t`,
        delta: monthlyStats.deltas.volumeDelta,
        highlight: monthlyPRs.some(pr => pr.type === 'volume')
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

  const getMilestone = () => {
    const { current } = monthlyStats;
    
    if (current.workouts >= 25) return "🔥 Beast Mode - 25+ Sessions";
    if (current.workouts >= 20) return "💪 Unstoppable - 20+ Sessions";
    if (current.workouts >= 15) return "⚡ Consistent Champion";
    if (current.workouts >= 10) return "📈 Building Momentum";
    if (current.activeDays >= 20) return "🗓️ Daily Dedication";
    if (current.distance >= 100) return "🌍 Century Club - 100km+";
    if (current.volume >= 50000) return "🏋️‍♂️ Volume King - 50t+";
    
    return null;
  };

  const getShareText = () => {
    const { current } = monthlyStats;
    const prCount = monthlyPRs.length;
    const milestone = getMilestone();
    
    let text = '';
    
    if (milestone) {
      text = `${milestone} `;
    }
    
    if (prCount > 0) {
      text += `🏆 ${prCount} monthly PR${prCount > 1 ? 's' : ''}! `;
    }
    
    const parts = [];
    if (current.workouts > 0) parts.push(`${current.workouts} sessions`);
    if (current.distance > 0) parts.push(`${current.distance.toFixed(0)}km`);
    if (current.activeDays > 0) parts.push(`${current.activeDays} active days`);
    
    text += `${format(monthStart, 'MMMM')}: ${parts.join(' • ')}`;
    
    if (prCount > 0 || milestone) {
      text += ' #MonthlyGoals #FitnessJourney #PersonalRecord';
    } else {
      text += ' #MonthlyProgress #FitnessJourney #Consistency';
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
              'Monthly summary downloaded! 🏆',
              { 
                duration: 6000,
                description: 'Share your monthly achievements with the world!'
              }
            );
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Monthly summary copied!', {
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
      toast.loading('Generating monthly summary...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: CARD_WIDTH * 2,
        height: CARD_HEIGHT * 2,
      });
      
      const link = document.createElement('a');
      const monthStr = format(monthStart, 'MMMM-yyyy');
      link.download = `aivery-monthly-x-share-${monthStr}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('Monthly summary downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getKeyMetrics();
  const hasNewPRs = monthlyPRs.length > 0;
  const milestone = getMilestone();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-lg mx-auto", className)}
    >
      <Card 
        ref={cardRef}
        data-share-card
        className="border-0 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
      >
        <CardContent className="p-12">
          {/* Header with Simple Logo */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-purple-500 mb-6 p-3">
              <Image
                src="/icons/aivery.svg"
                alt="Aivery"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            
            <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-2">
              {format(monthStart, 'MMMM yyyy')}
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 mb-1">
              Monthly Summary
            </p>
            {session?.user?.nickname || session?.user?.name && (
              <p className="text-sm text-gray-600 dark:text-gray-500">
                {session.user.nickname || session.user.name}
              </p>
            )}
          </div>

          {/* PR Badge */}
          {(hasNewPRs || milestone) && (
            <div className="text-center mb-8">
              <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-full border-0">
                {hasNewPRs ? (
                  <>
                    <Trophy className="h-4 w-4 mr-1" />
                    {monthlyPRs.length} Monthly PR{monthlyPRs.length > 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    <Award className="h-4 w-4 mr-1" />
                    Achievement
                  </>
                )}
              </Badge>
            </div>
          )}

          {/* Simple Metrics */}
          <div className="space-y-6 mb-12">
            {metrics.map((metric, index) => {
              const deltaFormatted = formatDelta(metric.delta);
              return (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {metric.label}
                    {metric.highlight && <span className="text-amber-500 ml-1">★</span>}
                  </span>
                  <div className="text-right">
                    <span className={cn(
                      "text-xl font-light",
                      metric.highlight ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
                    )}>
                      {metric.value}
                    </span>
                    {deltaFormatted.show && (
                      <div className={cn("text-sm", deltaFormatted.color)}>
                        {deltaFormatted.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly PRs */}
          {monthlyPRs.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-8 border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Monthly Personal Records
              </h3>
              <div className="space-y-2">
                {monthlyPRs.map((pr, index) => (
                  <div key={index} className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || pr.achievement || `${pr.type.charAt(0).toUpperCase() + pr.type.slice(1)}`}:</strong> {pr.value} {pr.unit}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone Achievement */}
          {!hasNewPRs && milestone && (
            <div className="text-center mb-8 p-6 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl">
              <div className="text-3xl mb-3">🏆</div>
              <p className="text-lg text-purple-700 dark:text-purple-300 font-medium">
                {milestone}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                Incredible dedication this month!
              </p>
            </div>
          )}

          {/* Simple Footer */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">aivery</span>
            <div className="flex gap-3">
              <Button
                onClick={() => handleShare('x')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-gray-600"
              >
                <XLogo className="h-4 w-4 mr-1" />
                Share
              </Button>
              
              <Button
                onClick={() => handleShare('download')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-gray-600"
              >
                <Download className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default XOptimizedMonthlyCard; 