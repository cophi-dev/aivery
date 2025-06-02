'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy, TrendingUp, Zap, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// X Logo Component
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface PersonalRecord {
  type: 'weight' | 'reps' | 'distance' | 'volume' | 'time';
  exercise?: string;
  value: number;
  unit: string;
  isNew?: boolean;
}

interface XOptimizedShareCardProps {
  workout: {
    id: string;
    type: string;
    date: Date;
    duration?: number;
    distance?: number;
    calculatedVolume?: number;
    name?: string;
    user?: {
      name?: string;
      image?: string;
    };
  };
  insight?: string;
  personalRecords?: PersonalRecord[];
  className?: string;
}

export function XOptimizedShareCard({ 
  workout, 
  insight, 
  personalRecords = [],
  className 
}: XOptimizedShareCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // X-optimized dimensions: 1200 x 675 (16:9 aspect ratio)
  const CARD_WIDTH = 1200;
  const CARD_HEIGHT = 675;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const getKeyMetrics = () => {
    const metrics = [];
    
    if (workout.duration) {
      metrics.push({
        icon: '⏱️',
        label: 'Duration',
        value: formatDuration(workout.duration),
        highlight: false
      });
    }
    
    if (workout.distance && workout.distance > 0) {
      metrics.push({
        icon: '🏃‍♂️',
        label: 'Distance',
        value: `${workout.distance.toFixed(1)}km`,
        highlight: personalRecords.some(pr => pr.type === 'distance')
      });
    }
    
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      metrics.push({
        icon: '💪',
        label: 'Volume',
        value: `${(workout.calculatedVolume / 1000).toFixed(1)}t`,
        highlight: personalRecords.some(pr => pr.type === 'volume')
      });
    }
    
    return metrics.slice(0, 3); // Max 3 key metrics for clean design
  };

  const getShareText = () => {
    const metrics = getKeyMetrics();
    const prCount = personalRecords.length;
    
    let text = '';
    
    if (prCount > 0) {
      text = `🏆 ${prCount} new PR${prCount > 1 ? 's' : ''} today! `;
    }
    
    const activityText = workout.type === 'running' ? 'Run' : 
                        workout.type === 'cycling' ? 'Ride' :
                        workout.type === 'swimming' ? 'Swim' :
                        workout.type === 'hiking' ? 'Hike' : 
                        workout.type;
    
    const metricText = metrics.map(m => m.value).join(' • ');
    text += `${activityText}: ${metricText}`;
    
    if (prCount > 0) {
      text += ' #PersonalRecord #FitnessGoals';
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
              'Share card downloaded! 📊',
              { 
                duration: 6000,
                description: 'Add the image to your tweet for maximum impact!'
              }
            );
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Share text copied!', {
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
      toast.loading('Generating X-optimized image...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: CARD_WIDTH * 2,
        height: CARD_HEIGHT * 2,
      });
      
      const link = document.createElement('a');
      const timestamp = format(workout.date, 'yyyy-MM-dd');
      link.download = `aivery-${workout.type}-x-share-${timestamp}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('X-optimized image downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getKeyMetrics();
  const hasNewPRs = personalRecords.length > 0;

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
        className="border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl overflow-hidden"
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
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 p-4">
                <Image
                  src="/icons/aivery.svg"
                  alt="Aivery"
                  width={48}
                  height={48}
                  className="filter brightness-0 invert w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-4xl font-light text-gray-900 dark:text-gray-100 capitalize">
                  {workout.type}
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 font-mono">
                  {format(workout.date, 'MMM d, yyyy')}
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
                {personalRecords.length} New PR{personalRecords.length > 1 ? 's' : ''}
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

          {/* Personal Records Highlight */}
          {personalRecords.length > 0 && (
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-8 mb-16">
              <div className="flex items-center gap-4 mb-4">
                <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                <h3 className="text-2xl font-medium text-amber-800 dark:text-amber-300">
                  Personal Records Achieved
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {personalRecords.slice(0, 4).map((pr, index) => (
                  <div key={index} className="text-lg text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || `${pr.type} PR`}:</strong> {pr.value} {pr.unit}
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

export default XOptimizedShareCard; 