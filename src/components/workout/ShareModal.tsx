'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Copy, Twitter, ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShareCard } from './ShareCard';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export function ShareModal({ isOpen, onClose, workout, insight }: ShareModalProps) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [realLifeComparison, setRealLifeComparison] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Generate real-life comparison and insights
  useEffect(() => {
    if (isOpen && workout) {
      generateRealLifeComparison();
    }
  }, [isOpen, workout]);

  const generateRealLifeComparison = async () => {
    try {
      setIsLoading(true);
      
      // Generate real-life comparison
      const response = await fetch('/api/workout-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: workout.type,
          duration: workout.duration,
          distance: workout.distance,
          volume: workout.calculatedVolume
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRealLifeComparison(data.comparison || '');
      }
    } catch (error) {
      console.error('Failed to generate comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareImage = async () => {
    try {
      setIsGeneratingImage(true);
      
      const response = await fetch(`/api/workout/${workout.id}/share-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight: insight || realLifeComparison,
          comparison: realLifeComparison
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `aivery-workout-${workout.id}.png`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        const { toast } = await import('sonner');
        toast.success('Share image downloaded');
      }
    } catch (error) {
      console.error('Failed to generate share image:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-0 bg-background/95 backdrop-blur-sm">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-medium text-foreground/90 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100/80 to-indigo-100/80 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center border border-blue-200/30 dark:border-blue-700/30">
                <Share2 className="h-4 w-4" />
              </div>
              Share Your Achievement
            </DialogTitle>
            
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="rounded-full h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-muted-foreground text-sm leading-relaxed">
            Celebrate your progress and inspire others with your workout achievement.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Share Card Preview */}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5"
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                  <span className="text-sm">Generating insights...</span>
                </div>
              </div>
            )}
            
            <ShareCard
              workout={workout}
              insight={insight}
              realLifeComparison={realLifeComparison}
              className="mx-auto"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleShareImage}
              disabled={isGeneratingImage || isLoading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingImage ? 'Generating...' : 'Download Card'}
            </Button>
            
            <Button
              onClick={async () => {
                // Generate image first, then share
                await handleShareImage();
                setTimeout(() => {
                  const shareText = `Just completed a ${workout.type} workout! ${insight || realLifeComparison || '💪'}\n\n#FitnessJourney #WorkoutComplete #AiveryPowered\n\nTrack your progress with @aivery_app ✨`;
                  const shareUrl = `${window.location.origin}/workouts/${workout.id}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                }, 1000);
              }}
              variant="outline"
              className="flex-1"
              disabled={isGeneratingImage || isLoading}
            >
              <Twitter className="h-4 w-4 mr-2" />
              Share with Image
            </Button>
          </div>

          {/* Additional Share Options */}
          <div className="bg-muted/30 border border-border/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-foreground/80 mb-3">More sharing options</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={async () => {
                  const shareText = `Just completed a ${workout.type} workout! ${insight || realLifeComparison || '💪'}\n\n${window.location.origin}/workouts/${workout.id}`;
                  await navigator.clipboard.writeText(shareText);
                  const { toast } = await import('sonner');
                  toast.success('Copied to clipboard');
                }}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy Link
              </Button>
              
              <Button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${workout.type} Workout Complete`,
                      text: insight || realLifeComparison || 'Just completed an amazing workout!',
                      url: `${window.location.origin}/workouts/${workout.id}`
                    });
                  }
                }}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Native Share
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareModal; 