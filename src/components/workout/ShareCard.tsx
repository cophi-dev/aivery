'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface ShareCardProps {
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
  realLifeComparison?: string;
  className?: string;
}

export function ShareCard({ workout, insight, realLifeComparison, className }: ShareCardProps) {
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

  const getMetrics = () => {
    const metrics = [];
    
    if (workout.duration) {
      metrics.push({
        label: 'Duration',
        value: formatDuration(workout.duration)
      });
    }
    
    if (workout.distance && workout.distance > 0) {
      const activityLabel = workout.type === 'running' ? 'Running' : 
                           workout.type === 'cycling' ? 'Cycling' :
                           workout.type === 'swimming' ? 'Swimming' :
                           workout.type === 'hiking' ? 'Hiking' : 'Distance';
      
      metrics.push({
        label: activityLabel,
        value: `${workout.distance.toFixed(1)}km`
      });
    }
    
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      metrics.push({
        label: 'Strength',
        value: `${(workout.calculatedVolume / 1000).toFixed(1)}t`
      });
    }
    
    return metrics;
  };

  const getShareText = () => {
    const metrics = getMetrics();
    
    if (workout.distance && workout.distance > 0) {
      const activityText = workout.type === 'running' ? 'Run' : 
                          workout.type === 'cycling' ? 'Ride' :
                          workout.type === 'swimming' ? 'Swim' :
                          workout.type === 'hiking' ? 'Hike' : workout.type;
      
      const metricText = metrics.map(m => m.value).join(' • ');
      return `${activityText}: ${metricText}`;
    }
    
    if (workout.calculatedVolume && workout.calculatedVolume > 0) {
      const metricText = metrics.map(m => m.value).join(' • ');
      return `Strength: ${metricText}`;
    }
    
    const metricText = metrics.map(m => m.value).join(' • ');
    return metricText ? `${workout.type}: ${metricText}` : `${workout.type} session complete`;
  };

  const handleShare = async (platform: 'x' | 'copy' | 'download') => {
    setIsSharing(true);
    
    try {
      const shareText = getShareText();
      const shareUrl = `${window.location.origin}/workouts/${workout.id}`;
      
      switch (platform) {
        case 'x':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          const { toast } = await import('sonner');
          toast.success('Copied to clipboard');
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
      toast.loading('Generating image...');
      
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        background: '#ffffff',
        logging: false,
        width: cardRef.current.offsetWidth * 2,
        height: cardRef.current.offsetHeight * 2,
      });
      
      const link = document.createElement('a');
      link.download = `aivery-${workout.type}-${format(workout.date, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
      
      toast.success('Image downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const metrics = getMetrics();

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
        <CardContent className="p-8 sm:p-12">
          {/* Header with Aivery Logo */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-4 sm:mb-6 p-2 sm:p-3">
              <Image
                src="/icons/aivery.svg"
                alt="Aivery"
                width={40}
                height={40}
                className="filter brightness-0 invert w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-light text-gray-900 dark:text-gray-100 mb-2 capitalize">
              {workout.type}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-mono mb-1">
              {format(workout.date, 'MMM d, yyyy')}
            </p>
            {session?.user?.name && (
              <p className="text-xs text-gray-400 font-mono">
                {session.user.name}
              </p>
            )}
          </div>

          {/* Insight */}
          {(insight || realLifeComparison) && (
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                {insight || realLifeComparison}
              </p>
            </div>
          )}

          {/* Metrics */}
          {metrics.length > 0 && (
            <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12">
              {metrics.map((metric, index) => (
                <div key={index} className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {metric.label}
                  </span>
                  <span className="text-lg sm:text-xl font-light text-gray-900 dark:text-gray-100">
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="text-center">
            <div className="text-xs text-gray-400 font-mono mb-4 sm:mb-6">
              aivery
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => handleShare('x')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-xs font-mono text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 w-full sm:w-auto"
              >
                <XLogo className="h-3 w-3 mr-2" />
                Share
              </Button>
              
              <Button
                onClick={() => handleShare('download')}
                disabled={isSharing}
                size="sm"
                variant="ghost"
                className="text-xs font-mono text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 w-full sm:w-auto"
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

export default ShareCard; 