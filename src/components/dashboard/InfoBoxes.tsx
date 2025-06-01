'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  ArrowRight, 
  Edit3, 
  Upload, 
  Activity,
  Crown,
  Settings,
  Zap
} from 'lucide-react';

interface InfoBoxData {
  isSubscribed: boolean;
  hasAiPreferences: boolean;
  workoutCount: number;
  isLoading: boolean;
}

interface InfoBoxesProps {
  className?: string;
}

export default function InfoBoxes({ className }: InfoBoxesProps) {
  const { data: session, status } = useSession();
  const [infoData, setInfoData] = useState<InfoBoxData>({
    isSubscribed: true, // Default to true to avoid showing upgrade until we know for sure
    hasAiPreferences: true, // Default to true to avoid showing until we know for sure
    workoutCount: 1, // Default to 1 to avoid showing until we know for sure
    isLoading: true
  });

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInfoData();
    }
  }, [status]);

  const fetchInfoData = async () => {
    try {
      // Fetch user subscription data
      const userResponse = await fetch('/api/user');
      if (!userResponse.ok) {
        throw new Error(`User API failed with status: ${userResponse.status}`);
      }
      const userData = await userResponse.json();
      
      // Fetch dashboard metrics for workout count and AI preferences
      const metricsResponse = await fetch('/api/dashboard/metrics');
      if (!metricsResponse.ok) {
        throw new Error(`Metrics API failed with status: ${metricsResponse.status}`);
      }
      const metricsData = await metricsResponse.json();
      
      console.log('InfoBoxes data fetched:', {
        userTier: userData.user?.tier,
        hasAiPreferences: metricsData.hasAiPreferences,
        workoutCount: metricsData.workoutCount
      });
      
      setInfoData({
        isSubscribed: userData.user?.tier !== 'free',
        hasAiPreferences: metricsData.hasAiPreferences || false,
        workoutCount: metricsData.workoutCount || 0,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch info data:', error);
      setInfoData(prev => ({ ...prev, isLoading: false }));
    }
  };

  if (status === 'loading' || infoData.isLoading) {
    return null; // Don't show anything while loading
  }

  const infoBoxes = [];

  // 1. No workouts logged yet
  if (infoData.workoutCount === 0) {
    infoBoxes.push(
      <motion.div
        key="no-workouts"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-medium text-foreground">
                      Welcome to Your Fitness Journey
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      Getting Started
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Ready to start tracking your progress and get AI-powered insights? 
                  Log your first workout or connect Strava to begin.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/workouts/new">
                    <Button size="sm" className="w-full sm:w-auto font-medium">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Log First Workout
                    </Button>
                  </Link>
                  <Link href="/integrations">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto font-medium">
                      <Upload className="w-4 h-4 mr-2" />
                      Connect Strava
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // 2. AI preferences not set (only show if user has workouts)
  if (infoData.workoutCount > 0 && !infoData.hasAiPreferences) {
    infoBoxes.push(
      <motion.div
        key="ai-preferences"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card className="border-2 border-amber-200/50 bg-gradient-to-r from-amber-50/50 via-yellow-50/30 to-amber-50/50 dark:border-amber-400/20 dark:from-amber-950/20 dark:via-yellow-950/10 dark:to-amber-950/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-medium text-foreground">
                      Unlock Personalized AI Insights
                    </h3>
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      AI Enhancement
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Set your fitness goals and preferences to receive personalized AI coaching, 
                  insights, and workout recommendations tailored just for you.
                </p>
                <Link href="/settings?tab=ai">
                  <Button size="sm" className="font-medium bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500">
                    <Settings className="w-4 h-4 mr-2" />
                    Set AI Preferences
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Note: In premium-only mode, non-subscribers should not be able to access the dashboard
  // This component should primarily focus on AI preferences and getting started flows
  // Subscription enforcement is handled at the middleware level

  // Don't render if no info boxes to show
  if (infoBoxes.length === 0) {
    return null;
  }

  return (
    <motion.section 
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="space-y-6">
        {infoBoxes}
      </div>
    </motion.section>
  );
} 