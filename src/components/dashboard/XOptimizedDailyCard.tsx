'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy } from 'lucide-react';
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
        label: stats.sessions > 1 ? 'Sessions' : 'Session',
        value: stats.sessions.toString(),
        hasPR: false
      });
    }
    
    if (stats.totalDuration > 0) {
      const hours = Math.floor(stats.totalDuration / 3600);
      const minutes = Math.floor((stats.totalDuration % 3600) / 60);
      metrics.push({
        label: 'Duration',
        value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        hasPR: dailyPRs.some(pr => pr.type === 'time')
      });
    }
    
    if (stats.totalDistance > 0) {
      metrics.push({
        label: 'Distance',
        value: `${stats.totalDistance.toFixed(1)}km`,
        hasPR: dailyPRs.some(pr => pr.type === 'distance')
      });
    }
    
    if (stats.totalVolume > 0) {
      metrics.push({
        label: 'Volume',
        value: `${(stats.totalVolume / 1000).toFixed(1)}t`,
        hasPR: dailyPRs.some(pr => pr.type === 'volume')
      });
    }
    
    return metrics;
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
            toast.success('Daily workout shared! 💪');
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Daily summary copied!');
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
        width: cardRef.current.offsetWidth * 2,
        height: cardRef.current.offsetHeight * 2,
      });
      
      const link = document.createElement('a');
      const dateStr = format(today, 'yyyy-MM-dd');
      link.download = `aivery-daily-${dateStr}.png`;
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-green-500 mb-6 p-3">
              <Image
                src="/icons/aivery.svg"
                alt="Aivery"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            
            <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-2">
              Today's Progress
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 mb-1">
              {format(today, 'MMM d, yyyy')}
            </p>
            {session?.user?.nickname || session?.user?.name && (
              <p className="text-sm text-gray-600 dark:text-gray-500">
                {session.user.nickname || session.user.name}
              </p>
            )}
          </div>

          {/* PR Badge */}
          {hasNewPRs && (
            <div className="text-center mb-8">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full border-0">
                <Trophy className="h-4 w-4 mr-1" />
                {dailyPRs.length} New PR{dailyPRs.length > 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {/* Simple Metrics */}
          <div className="space-y-6 mb-12">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {metric.label}
                  {metric.hasPR && <span className="text-amber-500 ml-1">★</span>}
                </span>
                <span className={cn(
                  "text-xl font-light",
                  metric.hasPR ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
                )}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>

          {/* Actual PRs Section */}
          {dailyPRs.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-8 border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Today's Personal Records
              </h3>
              <div className="space-y-2">
                {dailyPRs.map((pr, index) => (
                  <div key={index} className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || `${pr.type.charAt(0).toUpperCase() + pr.type.slice(1)}`}:</strong> {pr.value} {pr.unit}
                    {pr.improvement && (
                      <span className="text-xs text-amber-600 dark:text-amber-500 ml-2">
                        ({pr.improvement})
                      </span>
                    )}
                  </div>
                ))}
              </div>
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

export default XOptimizedDailyCard; 