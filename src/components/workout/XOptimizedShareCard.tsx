'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, Trophy } from 'lucide-react';
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
        label: 'Duration',
        value: formatDuration(workout.duration),
        hasPR: false
      });
    }
    
    if (workout.distance && workout.distance > 0) {
      metrics.push({
        label: 'Distance',
        value: `${workout.distance.toFixed(1)}km`,
        hasPR: personalRecords.some(pr => pr.type === 'distance' && pr.isNew)
      });
    }
    
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      metrics.push({
        label: 'Volume',
        value: `${(workout.calculatedVolume / 1000).toFixed(1)}t`,
        hasPR: personalRecords.some(pr => pr.type === 'volume' && pr.isNew)
      });
    }
    
    return metrics;
  };

  const getShareText = () => {
    const metrics = getKeyMetrics();
    const prCount = personalRecords.filter(pr => pr.isNew).length;
    
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
            toast.success('Share card downloaded! 📊');
          }, 800);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(shareText);
          const { toast } = await import('sonner');
          toast.success('Share text copied!');
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
      toast.loading('Generating share card...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: cardRef.current.offsetWidth * 2,
        height: cardRef.current.offsetHeight * 2,
      });
      
      const link = document.createElement('a');
      const timestamp = format(workout.date, 'yyyy-MM-dd');
      link.download = `aivery-${workout.type}-${timestamp}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('Share card downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getKeyMetrics();
  const hasNewPRs = personalRecords.filter(pr => pr.isNew).length > 0;

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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-blue-500 mb-6 p-3">
              <Image
                src="/icons/aivery.svg"
                alt="Aivery"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            
            <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-2 capitalize">
              {workout.type}
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 mb-1">
              {format(workout.date, 'MMM d, yyyy')}
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
                {personalRecords.filter(pr => pr.isNew).length} New PR{personalRecords.filter(pr => pr.isNew).length > 1 ? 's' : ''}
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
          {personalRecords.filter(pr => pr.isNew).length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-8 border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Personal Records
              </h3>
              <div className="space-y-2">
                {personalRecords.filter(pr => pr.isNew).map((pr, index) => (
                  <div key={index} className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>{pr.exercise || `${pr.type.charAt(0).toUpperCase() + pr.type.slice(1)}`}:</strong> {pr.value} {pr.unit}
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

export default XOptimizedShareCard; 