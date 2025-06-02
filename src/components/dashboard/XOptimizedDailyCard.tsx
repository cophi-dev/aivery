'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy, TrendingUp, Zap, Star, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// X Logo Component
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface DailyWorkout {
  id: string;
  type: string;
  date: Date;
  duration?: number;
  distance?: number;
  calculatedVolume?: number;
  exercises?: Array<{
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
  }>;
}

interface DailyPR {
  type: 'weight' | 'reps' | 'distance' | 'volume' | 'time';
  exercise?: string;
  value: number;
  unit: string;
  isNew: boolean;
  improvement?: string;
}

interface XOptimizedDailyCardProps {
  workouts: DailyWorkout[];
  dailyPRs?: DailyPR[];
  insight?: string;
  className?: string;
}

export function XOptimizedDailyCard({ 
  workouts, 
  dailyPRs = [],
  insight,
  className 
}: XOptimizedDailyCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // X-optimized dimensions: 1200 x 675 (16:9 aspect ratio)
  const CARD_WIDTH = 1200;
  const CARD_HEIGHT = 675;

  const today = new Date();
  const todaysWorkouts = workouts.filter(w => isToday(w.date));

  const getTodayStats = () => {
    const stats = {
      sessions: todaysWorkouts.length,
      totalDistance: todaysWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0),
      totalVolume: todaysWorkouts.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0),
      totalDuration: todaysWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0),
      primaryType: todaysWorkouts.length > 0 ? todaysWorkouts[0].type : ''
    };
    
    return stats;
  };

  const getKeyMetrics = () => {
    const stats = getTodayStats();
    const metrics = [];
    
    if (stats.sessions > 0) {
      metrics.push({
        icon: stats.sessions > 1 ? '🎯' : getActivityIcon(stats.primaryType),
        label: stats.sessions > 1 ? 'Sessions' : 'Session',
        value: stats.sessions.toString(),
        highlight: false
      });
    }
    
    if (stats.totalDistance > 0) {
      metrics.push({
        icon: '🏃‍♂️',
        label: 'Distance',
        value: `${stats.totalDistance.toFixed(1)}km`,
        highlight: dailyPRs.some(pr => pr.type === 'distance')
      });
    }
    
    if (stats.totalDuration > 0) {
      const hours = Math.floor(stats.totalDuration / 3600);
      const minutes = Math.floor((stats.totalDuration % 3600) / 60);
      metrics.push({
        icon: '⏱️',
        label: 'Duration',
        value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        highlight: dailyPRs.some(pr => pr.type === 'time')
      });
    }
    
    if (stats.totalVolume > 0) {
      metrics.push({
        icon: '💪',
        label: 'Volume',
        value: `${(stats.totalVolume / 1000).toFixed(1)}t`,
        highlight: dailyPRs.some(pr => pr.type === 'volume')
      });
    }
    
    return metrics.slice(0, 3);
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'running': return '🏃‍♂️';
      case 'cycling': return '🚴‍♂️';
      case 'swimming': return '🏊‍♂️';
      case 'strength': return '🏋️‍♂️';
      case 'yoga': return '🧘‍♀️';
      case 'hiking': return '🥾';
      default: return '💪';
    }
  };

  const getShareText = () => {
    const stats = getTodayStats();
    const prCount = dailyPRs.length;
    
    let text = '';
    
    if (prCount > 0) {
      text = `🏆 ${prCount} PR${prCount > 1 ? 's' : ''} today! `;
    }
    
    if (stats.sessions > 1) {
      text += `Double session day: `;
    } else if (stats.sessions === 1) {
      const activityText = stats.primaryType === 'running' ? 'Run' : 
                          stats.primaryType === 'cycling' ? 'Ride' :
                          stats.primaryType === 'swimming' ? 'Swim' :
                          stats.primaryType === 'strength' ? 'Strength' :
                          stats.primaryType;
      text += `${activityText} complete: `;
    }
    
    const parts = [];
    if (stats.totalDistance > 0) parts.push(`${stats.totalDistance.toFixed(1)}km`);
    if (stats.totalDuration > 0) {
      const minutes = Math.floor(stats.totalDuration / 60);
      parts.push(`${minutes}min`);
    }
    if (stats.totalVolume > 0) parts.push(`${(stats.totalVolume / 1000).toFixed(1)}t`);
    
    text += parts.join(' • ');
    
    if (prCount > 0) {
      text += ' #PersonalRecord #ProgressMade';
    } else {
      text += ' #WorkoutComplete #FitnessJourney';
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
              'Daily workout shared! 💪',
              { 
                duration: 6000,
                description: 'Inspire others with your daily dedication!'
              }
            );
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Daily summary copied!', {
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
      toast.loading('Generating daily share card...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: CARD_WIDTH * 2,
        height: CARD_HEIGHT * 2,
      });
      
      const link = document.createElement('a');
      const dateStr = format(today, 'yyyy-MM-dd');
      link.download = `aivery-daily-x-share-${dateStr}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('Daily workout card downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getKeyMetrics();
  const hasNewPRs = dailyPRs.length > 0;

  if (todaysWorkouts.length === 0) {
    return null; // Don't show daily card if no workouts today
  }

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
        className="border-0 bg-gradient-to-br from-white to-green-50 dark:from-gray-900 dark:to-green-900/20 shadow-2xl overflow-hidden"
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
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 p-4">
                <Image
                  src="/icons/aivery.svg"
                  alt="Aivery"
                  width={48}
                  height={48}
                  className="filter brightness-0 invert w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-4xl font-light text-gray-900 dark:text-gray-100">
                  Today's Progress
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 font-mono">
                  {format(today, 'MMM d, yyyy')}
                </p>
                {session?.user?.nickname || session?.user?.name && (
                  <p className="text-base text-gray-400 font-mono">
                    {session.user.nickname || session.user.name}
                  </p>
                )}
              </div>
            </div>
            
            {/* PR Badge */}
            {hasNewPRs && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg px-6 py-3 rounded-full border-0">
                <Trophy className="h-5 w-5 mr-2" />
                {dailyPRs.length} New PR{dailyPRs.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-8 mb-16 flex-1">
            {metrics.map((metric, index) => (
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
              </div>
            ))}
          </div>

          {/* Daily PRs Highlight */}
          {dailyPRs.length > 0 && (
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-8 mb-16">
              <div className="flex items-center gap-4 mb-4">
                <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                <h3 className="text-2xl font-medium text-amber-800 dark:text-amber-300">
                  Personal Records Today
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {dailyPRs.slice(0, 4).map((pr, index) => (
                  <div key={index} className="text-lg text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || `${pr.type} PR`}:</strong> {pr.value} {pr.unit}
                    {pr.improvement && (
                      <span className="text-sm text-amber-600 dark:text-amber-500 ml-2">
                        ({pr.improvement})
                      </span>
                    )}
                  </div>
                ))}
              </div>
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

export default XOptimizedDailyCard; 