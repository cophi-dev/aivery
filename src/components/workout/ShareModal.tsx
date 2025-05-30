'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Copy, Twitter, ExternalLink, Sparkles, CheckCircle } from 'lucide-react';
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
  const [step, setStep] = useState<'preview' | 'downloading' | 'ready'>('preview');

  // Generate real-life comparison and insights
  useEffect(() => {
    if (isOpen && workout) {
      generateRealLifeComparison();
      setStep('preview'); // Reset step when modal opens
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

  const generateShareText = () => {
    return `Just completed a ${workout.type} workout! ${insight || realLifeComparison || '💪'}\n\n#FitnessJourney #WorkoutComplete #AiveryPowered\n\nTrack your progress with @aivery_app ✨`;
  };

  const handleSmartShare = async () => {
    try {
      setIsGeneratingImage(true);
      setStep('downloading');
      
      // Generate and download the image
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
        
        // Create a well-named download
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const workoutType = workout.type.toLowerCase().replace(/\s+/g, '-');
        const filename = `aivery-${workoutType}-${timestamp}.png`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
        
        // Move to ready state
        setStep('ready');
        
        const { toast } = await import('sonner');
        toast.success(`Image saved as "${filename}"`, { 
          duration: 4000,
          description: "Ready to share on Twitter!"
        });
        
        // Wait a moment for download to register, then open Twitter
        setTimeout(() => {
          const shareText = generateShareText();
          const shareUrl = `${window.location.origin}/workouts/${workout.id}`;
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
          
          window.open(twitterUrl, '_blank', 'width=600,height=400');
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to generate share image:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image. Please try again.');
      setStep('preview');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadOnly = async () => {
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
        
        const timestamp = new Date().toISOString().split('T')[0];
        const workoutType = workout.type.toLowerCase().replace(/\s+/g, '-');
        const filename = `aivery-${workoutType}-${timestamp}.png`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
        
        const { toast } = await import('sonner');
        toast.success(`Image downloaded as "${filename}"`);
      }
    } catch (error) {
      console.error('Failed to generate share image:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyText = async () => {
    const shareText = generateShareText();
    const shareUrl = `${window.location.origin}/workouts/${workout.id}`;
    const fullText = `${shareText}\n\n${shareUrl}`;
    
    await navigator.clipboard.writeText(fullText);
    const { toast } = await import('sonner');
    toast.success('Tweet text copied!', {
      description: "Paste it on Twitter and add your downloaded image"
    });
  };

  const renderContent = () => {
    if (step === 'downloading') {
      return (
        <div className="text-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 mx-auto mb-4 text-blue-600"
          >
            <Download className="h-12 w-12" />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Preparing Your Share Card</h3>
          <p className="text-muted-foreground text-sm">
            Creating your beautiful workout card and opening Twitter...
          </p>
        </div>
      );
    }

    if (step === 'ready') {
      return (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <h3 className="text-lg font-medium mb-2">Ready to Share!</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Your image has been downloaded and Twitter is opening. In Twitter:
          </p>
          <div className="bg-muted/30 rounded-lg p-4 text-left space-y-2 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">1</span>
              Click "Add photos" or the image icon
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">2</span>
              Select your downloaded Aivery image
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">3</span>
              Tweet away! 🚀
            </div>
          </div>
          <div className="flex gap-2 mt-6 justify-center">
            <Button onClick={handleCopyText} variant="outline" size="sm">
              <Copy className="h-3 w-3 mr-1" />
              Copy Text
            </Button>
            <Button onClick={() => setStep('preview')} variant="outline" size="sm">
              Back to Preview
            </Button>
          </div>
        </div>
      );
    }

    // Default preview step
    return (
      <>
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

        {/* Tweet Preview */}
        <div className="bg-muted/30 border border-border/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            Your Tweet Preview
          </h4>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border text-sm">
            <p className="whitespace-pre-line">{generateShareText()}</p>
            <p className="text-blue-600 mt-2 text-xs">{window.location.origin}/workouts/{workout.id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Primary Action */}
          <Button
            onClick={handleSmartShare}
            disabled={isGeneratingImage || isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 h-12"
          >
            <Twitter className="h-4 w-4 mr-2" />
            {isGeneratingImage ? 'Preparing...' : 'Share on Twitter with Image'}
          </Button>
          
          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownloadOnly}
              disabled={isGeneratingImage || isLoading}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Only
            </Button>
            
            <Button
              onClick={() => {
                const shareText = generateShareText();
                const shareUrl = `${window.location.origin}/workouts/${workout.id}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
              }}
              variant="outline"
              disabled={isLoading}
            >
              <Twitter className="h-4 w-4 mr-2" />
              Text Only
            </Button>
          </div>
        </div>

        {/* Additional Options */}
        <div className="bg-muted/30 border border-border/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-foreground/80 mb-3">More options</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleCopyText}
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
            >
              <Copy className="h-3 w-3 mr-2" />
              Copy Text
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
      </>
    );
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
            {step === 'preview' && "Celebrate your progress and inspire others with your workout achievement."}
            {step === 'downloading' && "Creating your personalized share card..."}
            {step === 'ready' && "Your share card is ready! Follow the steps to post on Twitter."}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareModal; 