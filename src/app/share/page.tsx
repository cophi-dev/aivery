'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShareCard } from '@/components/workout/ShareCard';
import { ShareModal } from '@/components/workout/ShareModal';
import { WeeklyShareCard } from '@/components/dashboard/WeeklyShareCard';
import { Badge } from '@/components/ui/badge';
import { Share2, Trophy, Calendar, Activity, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { generateDistanceComparisonText } from '@/lib/workout-distance-comparisons';

// Sample workout data
const sampleWorkouts = [
  {
    id: 'sample-1',
    type: 'running',
    date: new Date(),
    duration: 2400, // 40 minutes
    distance: 8.5, // 8.5km
    calculatedVolume: 0,
    name: 'Morning Run',
    user: { name: 'You', image: undefined }
  },
  {
    id: 'sample-2',
    type: 'strength',
    date: new Date(Date.now() - 86400000), // Yesterday
    duration: 3600, // 60 minutes
    distance: 0,
    calculatedVolume: 4500, // 4.5 tons
    name: 'Upper Body Strength',
    user: { name: 'You', image: undefined }
  },
  {
    id: 'sample-3',
    type: 'cycling',
    date: new Date(Date.now() - 172800000), // 2 days ago
    duration: 5400, // 90 minutes
    distance: 32.1, // 32.1km
    calculatedVolume: 0,
    name: 'Weekend Ride',
    user: { name: 'You', image: undefined }
  }
];

// Sample insights and comparisons
const sampleInsights = [
  "Amazing run! Your 8.5km was like running from Central Park to Times Square in New York! 🏃‍♂️",
  "Incredible strength session! You moved 4.5 tons - that's equivalent to lifting 3 cars! 💪",
  "Epic cycling adventure! Your 32.1km ride could have taken you across Manhattan twice! 🚴‍♂️"
];

// Sample weekly stats
const sampleWeeklyStats = {
  current: {
    workouts: 6,
    duration: 420, // 7 hours
    distance: 45.2, // 45.2km
    volume: 8500 // 8.5 tons
  },
  previous: {
    workouts: 4,
    duration: 300, // 5 hours
    distance: 28.1, // 28.1km
    volume: 6200 // 6.2 tons
  },
  deltas: {
    workoutsDelta: { value: 2, percentage: 50, direction: 'up' as const },
    durationDelta: { value: 120, percentage: 40, direction: 'up' as const },
    distanceDelta: { value: 17.1, percentage: 61, direction: 'up' as const },
    volumeDelta: { value: 2300, percentage: 37, direction: 'up' as const }
  }
};

// Helper function to generate volume comparisons for strength workouts
function generateVolumeComparisonText(volumeKg: number): string | null {
  if (!volumeKg || volumeKg <= 0) return null;
  
  // Objects to compare volume to
  const comparisons = [
    { name: "car", weight: 1500, description: "an average car" },
    { name: "elephant", weight: 5000, description: "an adult elephant" },
    { name: "grand piano", weight: 400, description: "a concert grand piano" },
    { name: "refrigerator", weight: 100, description: "a typical household refrigerator" },
    { name: "washing machine", weight: 70, description: "a washing machine" },
    { name: "adult male lion", weight: 190, description: "an adult male lion" },
    { name: "adult tiger", weight: 220, description: "a Bengal tiger" },
    { name: "motorcycle", weight: 180, description: "a motorcycle" },
    { name: "office desk", weight: 50, description: "a standard office desk" }
  ];
  
  // Find the most appropriate comparison
  let bestComparison = null;
  let bestRatio = 0;
  let isMultiple = false;
  
  for (const comp of comparisons) {
    const ratio = volumeKg / comp.weight;
    
    // If we're dealing with a good-sized fraction or multiple
    if ((ratio >= 0.1 && ratio < 1) || ratio >= 1) {
      if (!bestComparison || Math.abs(ratio - Math.round(ratio)) < Math.abs(bestRatio - Math.round(bestRatio))) {
        bestComparison = comp;
        bestRatio = ratio;
        isMultiple = ratio >= 1;
      }
    }
  }
  
  if (!bestComparison) {
    // Fallback for small volumes
    return `You lifted a total volume of ${volumeKg.toLocaleString()} kg today! That's like lifting a stack of ${Math.floor(volumeKg / 20)} medium-sized car tires.`;
  }
  
  // Format the comparison text
  const formattedRatio = isMultiple ? 
    Math.round(bestRatio) === bestRatio ? bestRatio.toString() : bestRatio.toFixed(1) : 
    (bestRatio * 100).toFixed(0) + '%';
  
  if (isMultiple) {
    return `You lifted a total volume of ${volumeKg.toLocaleString()} kg, equivalent to about ${formattedRatio} times the weight of ${bestComparison.description}!`;
  } else {
    return `Your total volume of ${volumeKg.toLocaleString()} kg is about ${formattedRatio} of the weight of ${bestComparison.description}!`;
  }
}

export default function SharePage() {
  const [selectedWorkout, setSelectedWorkout] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session, status } = useSession();

  // Fetch user's real data when authenticated
  useEffect(() => {
    if (session) {
      fetchUserData();
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [session, status]);

  const fetchUserData = async () => {
    try {
      console.log('[SharePage] Starting data fetch...');
      
      // Fetch weekly stats
      const weeklyResponse = await fetch('/api/dashboard/progress');
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        console.log('[SharePage] Weekly data:', weeklyData);
        if (weeklyData.stats) {
          setWeeklyStats(weeklyData.stats);
        }
      }

      // Fetch recent workouts (get more for better selection)
      const workoutsResponse = await fetch('/api/workouts?limit=10');
      if (workoutsResponse.ok) {
        const workoutsData = await workoutsResponse.json();
        console.log('[SharePage] Raw workouts response:', workoutsData);
        console.log('[SharePage] Workouts array length:', workoutsData.workouts?.length);
        
        if (workoutsData.workouts && workoutsData.workouts.length > 0) {
          // Log each workout to see what we're getting
          workoutsData.workouts.forEach((workout: any, index: number) => {
            console.log(`[SharePage] Workout ${index}:`, {
              id: workout._id || workout.id,
              type: workout.type,
              date: workout.date,
              name: workout.name,
              distance: workout.distance,
              duration: workout.duration,
              volume: workout.calculatedVolume
            });
          });
          
          setRecentWorkouts(workoutsData.workouts);
          console.log('[SharePage] Set recent workouts:', workoutsData.workouts.length);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate insights for real workout data using proper comparison functions
  const generateInsight = (workout: any) => {
    const type = workout.type;
    const distance = workout.distance;
    const duration = workout.duration;
    const volume = workout.calculatedVolume;
    const userName = session?.user?.name || 'You';

    // For cardio workouts with distance - use landmark comparison
    if (['running', 'cycling', 'walking', 'hiking', 'swimming'].includes(type) && distance && distance > 0) {
      try {
        // Generate landmark comparison
        const landmarkComparison = generateDistanceComparisonText(distance);
        if (landmarkComparison) {
          return `${userName}, you covered ${distance.toFixed(1)}km! ${landmarkComparison} 🔥`;
        }
      } catch (error) {
        console.error('Error generating landmark comparison:', error);
      }
      
      // Fallback distance insights with improved accuracy
      if (distance >= 42.2) {
        return `${userName}, you went the full marathon distance! Absolutely incredible! 🏆`;
      } else if (distance >= 21.1) {
        return `${userName}, that's a half marathon distance! Major achievement! 🏅`;
      } else if (distance >= 10) {
        return `${userName}, solid 10K+ distance! Your endurance is building strong! 🔥`;
      } else if (distance >= 5) {
        return `${userName}, you nailed a 5K distance! Perfect for fitness building! ✨`;
      } else if (distance >= 1) {
        return `${userName}, every kilometer counts! You're building consistency! 💪`;
      } else {
        return `${userName}, great ${type} session! Every step forward matters! 🌟`;
      }
    }
    
    // For strength workouts with volume - use volume comparison
    if (type === 'strength' && volume && volume > 0) {
      try {
        const volumeComparison = generateVolumeComparisonText(volume);
        if (volumeComparison) {
          return `${userName}, amazing strength session! ${volumeComparison} 💪`;
        }
      } catch (error) {
        console.error('Error generating volume comparison:', error);
      }
      
      // Fallback volume insights with better accuracy
      const volumeInTons = (volume / 1000).toFixed(1);
      if (volume >= 10000) {
        return `${userName}, you hit the 10-ton club! That's elite-level volume! 🏆`;
      } else if (volume >= 5000) {
        return `${userName}, over 5 tons moved! You're getting seriously strong! 🔥`;
      } else if (volume >= 2000) {
        return `${userName}, 2+ tons moved! Your strength is building fast! 💪`;
      } else if (volume >= 1000) {
        return `${userName}, you moved over a ton! That's a solid strength session! 👍`;
      } else {
        return `${userName}, great strength work! Total volume: ${volumeInTons}t - keep building! 💪`;
      }
    }
    
    // Duration-based insights for other workout types
    if (duration && duration > 0) {
      const minutes = Math.round(duration / 60);
      if (minutes >= 90) {
        return `${userName}, ${minutes}-minute ${type} session! That's serious dedication! 🔥`;
      } else if (minutes >= 60) {
        return `${userName}, solid hour-long ${type} workout! Great consistency! 💪`;
      } else if (minutes >= 30) {
        return `${userName}, ${minutes}-minute ${type} session! Perfect workout length! ✨`;
      } else {
        return `${userName}, efficient ${minutes}-minute ${type} session! Quality over quantity! 👍`;
      }
    }
    
    // Final fallback
    return `${userName}, amazing ${type} workout! You're crushing your fitness goals! 🔥`;
  };

  // Use real data if available, fallback to samples only when no real data
  const displayWorkouts = recentWorkouts.length > 0 ? recentWorkouts.slice(0, 6) : sampleWorkouts;
  const displayWeeklyStats = weeklyStats || sampleWeeklyStats;

  console.log('[SharePage] Render state:', {
    status,
    sessionExists: !!session,
    isLoading,
    recentWorkoutsLength: recentWorkouts.length,
    displayWorkoutsLength: displayWorkouts.length,
    usingRealData: recentWorkouts.length > 0,
    firstWorkout: displayWorkouts[0]
  });

  // Ensure selectedWorkout stays within bounds
  const safeSelectedWorkout = Math.min(selectedWorkout, displayWorkouts.length - 1);
  
  // Update selectedWorkout if it's out of bounds
  useEffect(() => {
    if (selectedWorkout >= displayWorkouts.length && displayWorkouts.length > 0) {
      setSelectedWorkout(0);
    }
  }, [displayWorkouts.length, selectedWorkout]);

  // Show loading state
  if (status === 'loading' || (session && isLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/10">
        <div className="container mx-auto px-6 py-12 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
              <Share2 className="h-4 w-4 mr-2" />
              Share Your Progress
            </Badge>
            <h1 className="text-4xl font-bold mb-4">Shareable Moments</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
              Loading your workout data...
            </p>
            
            {/* Loading skeleton */}
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-6">
                <div className="h-8 bg-muted/50 rounded animate-pulse max-w-xs mx-auto" />
                <div className="h-96 bg-muted/30 rounded-xl animate-pulse" />
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
                <div className="h-32 bg-muted/30 rounded-xl animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show login prompt for unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/10">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
              <Share2 className="h-4 w-4 mr-2" />
              Share Your Progress
            </Badge>
            <h1 className="text-4xl font-bold mb-4">Shareable Moments</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Transform your workout achievements into beautiful, shareable content that motivates and inspires your fitness community.
            </p>
            
            {/* Preview cards for unauthenticated users */}
            <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Workout Achievement Cards</h3>
                <ShareCard
                  workout={sampleWorkouts[0]}
                  insight={sampleInsights[0]}
                  className="max-w-sm mx-auto opacity-90 pointer-events-none"
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Weekly Progress Summary</h3>
                <WeeklyShareCard
                  weeklyStats={sampleWeeklyStats}
                  className="max-w-sm mx-auto opacity-90 pointer-events-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                Sign in to create personalized share cards from your actual workout data
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="lg">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Always show main content for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/10">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
            <Share2 className="h-4 w-4 mr-2" />
            Share Your Progress
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Shareable Moments</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your workout achievements into beautiful, shareable content that motivates and inspires your fitness community.
          </p>
        </motion.div>

        {/* Content Selection */}
        <Tabs defaultValue="workout-cards" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="workout-cards">
              <Activity className="h-4 w-4 mr-2" />
              Workout Cards
            </TabsTrigger>
            <TabsTrigger value="weekly-summary">
              <Calendar className="h-4 w-4 mr-2" />
              Weekly Summary
            </TabsTrigger>
          </TabsList>

          {/* Workout Cards Tab */}
          <TabsContent value="workout-cards" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-semibold mb-4">Post-Workout Achievement Cards</h2>
              <p className="text-muted-foreground mb-6">
                Beautiful cards that showcase workout achievements with AI insights and real-world comparisons.
              </p>
              
              {/* Simple Arrow Navigation */}
              {displayWorkouts.length > 1 && (
                <div className="flex items-center justify-center gap-6 mb-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWorkout(prev => prev > 0 ? prev - 1 : displayWorkouts.length - 1)}
                    className="text-muted-foreground hover:text-foreground p-2"
                  >
                    ← Previous
                  </Button>
                  
                  <div className="text-center">
                    <div className="text-sm font-medium capitalize">
                      {displayWorkouts[safeSelectedWorkout]?.type || 'Workout'} • {safeSelectedWorkout + 1} of {displayWorkouts.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {displayWorkouts[safeSelectedWorkout]?.date ? 
                        new Date(displayWorkouts[safeSelectedWorkout].date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 
                        'Recent workout'
                      }
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWorkout(prev => prev < displayWorkouts.length - 1 ? prev + 1 : 0)}
                    className="text-muted-foreground hover:text-foreground p-2"
                  >
                    Next →
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Card with Explanation Layout */}
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                key={safeSelectedWorkout} // Re-animate when workout changes
              >
                <ShareCard
                  workout={displayWorkouts[safeSelectedWorkout]}
                  insight={generateInsight(displayWorkouts[safeSelectedWorkout])}
                  className="max-w-lg mx-auto"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <h4 className="font-medium">AI-Powered Insights</h4>
                        <p className="text-sm text-muted-foreground">
                          Personalized workout analysis with motivational messaging
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Real-World Comparisons</h4>
                        <p className="text-sm text-muted-foreground">
                          Distance comparisons to famous landmarks and volume comparisons to everyday objects
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Social Media Ready</h4>
                        <p className="text-sm text-muted-foreground">
                          One-click sharing to X, or download as high-quality image
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Beautiful Design</h4>
                        <p className="text-sm text-muted-foreground">
                          Clean, minimalist design with your Aivery branding
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
                      <span className="text-sm">Complete a workout</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-600 dark:text-blue-400">2</span>
                      <span className="text-sm">Get AI-powered insights automatically</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-600 dark:text-blue-400">3</span>
                      <span className="text-sm">Share your achievement card</span>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full"
                  size="lg"
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  Try Share Modal
                </Button>
              </motion.div>
            </div>
          </TabsContent>

          {/* Weekly Summary Tab */}
          <TabsContent value="weekly-summary" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-semibold mb-4">Weekly Progress Summary</h2>
              <p className="text-muted-foreground mb-6">
                Showcase your weekly consistency and progress with beautiful summary cards.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <WeeklyShareCard
                  weeklyStats={displayWeeklyStats}
                  className="max-w-lg mx-auto"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Highlights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Consistency Tracking</h4>
                        <p className="text-sm text-muted-foreground">
                          Shows your workout frequency and habit building
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Progress Indicators</h4>
                        <p className="text-sm text-muted-foreground">
                          Week-over-week percentage changes in all metrics
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-violet-500 mt-2" />
                      <div>
                        <h4 className="font-medium">Achievement Badges</h4>
                        <p className="text-sm text-muted-foreground">
                          Automatically awarded based on your performance
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Share Your Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your weekly summary appears automatically in your dashboard when you have workouts to share. Use it to:
                    </p>
                    <ul className="text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Celebrate weekly milestones
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Motivate your fitness community
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Track your consistency journey
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16 p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl"
        >
          <h3 className="text-2xl font-semibold mb-4">Ready to Share Your Fitness Journey?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Transform every workout into a shareable moment that inspires others and celebrates your progress.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/workouts">View Your Workouts</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        workout={displayWorkouts[safeSelectedWorkout]}
        insight={generateInsight(displayWorkouts[safeSelectedWorkout])}
      />
    </div>
  );
} 