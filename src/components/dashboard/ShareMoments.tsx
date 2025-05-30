'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, Trophy, TrendingUp, Sparkles, Camera, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { WeeklyShareCard } from './WeeklyShareCard';

interface ShareMomentsProps {
  className?: string;
}

export function ShareMoments({ className }: ShareMomentsProps) {
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareCard, setShowShareCard] = useState(false);

  useEffect(() => {
    const fetchWeeklyStats = async () => {
      try {
        const response = await fetch('/api/dashboard/progress');
        if (response.ok) {
          const data = await response.json();
          if (data.stats && data.stats.current) {
            setWeeklyStats(data.stats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch weekly stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeklyStats();
  }, []);

  if (isLoading) return null;

  if (!weeklyStats?.current || weeklyStats.current.workouts === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={className}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-foreground mb-2">
            Share Your Journey
          </h2>
          <p className="text-sm text-muted-foreground">
            Transform your achievements into inspiring content
          </p>
        </div>
        
        <div className="relative group">
          {/* Enhanced background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl blur-sm -z-10" />
          
          <div className="p-8 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-950/40 dark:to-pink-950/40 rounded-2xl border border-purple-200/50 dark:border-purple-800/30 backdrop-blur-xl">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-400/20 dark:to-pink-400/20 flex items-center justify-center">
                <Camera className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Ready to Inspire?</h3>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Every workout is a story worth sharing. Start your first session to unlock beautiful, shareable moments that celebrate your progress.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/workouts/new">
                  <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg">
                    <Sparkles className="h-5 w-5 mr-2" />
                    Start Your Journey
                  </Button>
                </Link>
                <Link href="/share">
                  <Button variant="outline" size="lg" className="border-purple-200 dark:border-purple-800">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Explore Examples
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const getStoryHeadline = () => {
    const { current } = weeklyStats;
    if (current.workouts >= 6) return "Unstoppable This Week";
    if (current.workouts >= 4) return "Building Strong Momentum";
    if (current.workouts >= 2) return "Consistency Taking Shape";
    return "Your Week in Motion";
  };

  const getStorySubtitle = () => {
    const { current } = weeklyStats;
    const achievements = [];
    
    if (current.workouts >= 5) achievements.push(`${current.workouts} sessions`);
    if (current.distance >= 15) achievements.push(`${current.distance.toFixed(1)}km covered`);
    if (current.volume >= 5000) achievements.push(`${(current.volume/1000).toFixed(1)}t moved`);
    
    if (achievements.length > 0) {
      return achievements.join(" • ");
    }
    return "Every step forward matters";
  };

  const getShareableHighlight = () => {
    const { current } = weeklyStats;
    if (current.workouts >= 5) return { 
      icon: Trophy, 
      label: "Consistency Champion", 
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30"
    };
    if (current.distance >= 20) return { 
      icon: TrendingUp, 
      label: "Distance Hero", 
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
    };
    if (current.volume >= 5000) return { 
      icon: Sparkles, 
      label: "Strength Star", 
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30"
    };
    return { 
      icon: Share2, 
      label: "Progress Maker", 
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    };
  };

  if (showShareCard) {
    return (
      <motion.div 
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif tracking-tight text-foreground mb-1">
              Your Share Card
            </h2>
            <p className="text-sm text-muted-foreground">
              Ready to inspire your community
            </p>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setShowShareCard(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to overview
          </Button>
        </div>
        <WeeklyShareCard weeklyStats={weeklyStats} className="max-w-md" />
      </motion.div>
    );
  }

  const highlight = getShareableHighlight();
  const IconComponent = highlight.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-serif tracking-tight text-foreground mb-2">
          {getStoryHeadline()}
        </h2>
        <p className="text-sm text-muted-foreground">
          {getStorySubtitle()}
        </p>
      </div>

      {/* Main Content */}
      <div className="relative group">
        {/* Enhanced background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl blur-sm -z-10" />
        
        <div className="p-8 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-xl shadow-sm dark:shadow-lg">
          {/* Header with achievement badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${highlight.bgColor} shadow-sm`}>
                <IconComponent className={`h-5 w-5 ${highlight.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{highlight.label}</h3>
                <p className="text-xs text-muted-foreground">This week's achievement</p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className="bg-white/70 dark:bg-gray-800/70 text-foreground border-0 shadow-sm backdrop-blur-sm"
            >
              Shareable
            </Badge>
          </div>

          {/* Key Metrics - More visual, less data-heavy */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {weeklyStats.current.workouts > 0 && (
              <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {weeklyStats.current.workouts}
                </div>
                <div className="text-xs text-muted-foreground font-medium">Sessions</div>
              </div>
            )}
            {weeklyStats.current.distance > 0 && (
              <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {weeklyStats.current.distance.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground font-medium">Kilometers</div>
              </div>
            )}
            {weeklyStats.current.volume > 0 && (
              <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {(weeklyStats.current.volume / 1000).toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground font-medium">Tons Lifted</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowShareCard(true)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-lg font-medium"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Create Share Card
            </Button>
            <Link href="/share">
              <Button variant="outline" className="border-blue-200 dark:border-blue-800 text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4 mr-1" />
                Explore
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ShareMoments; 