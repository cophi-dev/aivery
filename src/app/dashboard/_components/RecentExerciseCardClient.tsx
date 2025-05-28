"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Dumbbell, 
  Calendar, 
  Clock, 
  Target,
  ChevronRight,
  Trophy,
  Zap,
  BarChart3
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface RecentExerciseData {
  exerciseInfo: {
    _id: string;
    name: string;
    category: string;
    muscleGroups: string[];
  };
  workoutInfo: {
    _id: string;
    name: string;
    date: string;
    type: string;
    duration: number;
  };
  performance: {
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      order?: number;
    }>;
    totalVolume: number;
    totalReps: number;
    maxWeight: number;
    maxReps: number;
    notes?: string;
  };
  insights: {
    summary: string;
    progressIndicator: 'improving' | 'maintaining' | 'declining' | 'first-time';
    comparisonWithPrevious?: {
      weightChange: number;
      repsChange: number;
      volumeChange: number;
    };
    personalRecord?: {
      isNewPR: boolean;
      type: 'weight' | 'reps' | 'volume';
      value: number;
      unit: string;
    };
  };
  navigation: {
    exerciseDetailsUrl: string;
    workoutDetailsUrl: string;
  };
}

function ProgressIndicator({ indicator }: { indicator: RecentExerciseData['insights']['progressIndicator'] }) {
  const config = {
    improving: {
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      label: "Improving"
    },
    maintaining: {
      icon: Minus,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      label: "Maintaining"
    },
    declining: {
      icon: TrendingDown,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      label: "Needs Focus"
    },
    'first-time': {
      icon: Zap,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      label: "First Time"
    }
  };

  const { icon: Icon, color, bgColor, label } = config[indicator];

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium", bgColor)}>
      <Icon className={cn("h-4 w-4", color)} />
      <span className={color}>{label}</span>
    </div>
  );
}

function PerformanceStats({ performance, exerciseInfo }: { 
  performance: RecentExerciseData['performance'];
  exerciseInfo: RecentExerciseData['exerciseInfo'];
}) {
  const isBodyweight = exerciseInfo.category === 'bodyweight' || 
                      !performance.sets.some(set => (set.weight || 0) > 0);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>Best Set</span>
        </div>
        <div className="text-lg font-semibold">
          {isBodyweight ? (
            `${performance.maxReps} reps`
          ) : (
            `${performance.maxWeight}kg × ${performance.maxReps}`
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Total Volume</span>
        </div>
        <div className="text-lg font-semibold">
          {isBodyweight ? (
            `${performance.totalReps} reps`
          ) : (
            `${performance.totalVolume}kg`
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonBadges({ comparison }: { 
  comparison?: RecentExerciseData['insights']['comparisonWithPrevious'] 
}) {
  if (!comparison) return null;

  const badges = [];

  if (comparison.weightChange !== 0) {
    badges.push({
      label: `Weight ${comparison.weightChange > 0 ? '+' : ''}${comparison.weightChange.toFixed(1)}kg`,
      variant: (comparison.weightChange > 0 ? 'default' : 'secondary') as "default" | "secondary"
    });
  }

  if (comparison.repsChange !== 0) {
    badges.push({
      label: `Reps ${comparison.repsChange > 0 ? '+' : ''}${comparison.repsChange}`,
      variant: (comparison.repsChange > 0 ? 'default' : 'secondary') as "default" | "secondary"
    });
  }

  if (comparison.volumeChange !== 0) {
    badges.push({
      label: `Volume ${comparison.volumeChange > 0 ? '+' : ''}${comparison.volumeChange.toFixed(1)}kg`,
      variant: (comparison.volumeChange > 0 ? 'default' : 'secondary') as "default" | "secondary"
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge, index) => (
        <Badge key={index} variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

export function RecentExerciseCardClient() {
  const [data, setData] = useState<RecentExerciseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecentExercise() {
      try {
        const response = await fetch('/api/dashboard/recent-exercise');
        
        if (response.status === 404) {
          setData(null);
          setError(null);
          return;
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch recent exercise data');
        }
        
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error fetching recent exercise:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecentExercise();
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Recent Exercise</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Recent Exercise
          </CardTitle>
          <CardDescription>
            No recent exercises found. Start your first workout to see insights here!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/workouts/new">
            <Button className="w-full">
              Start Your First Workout
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(data.workoutInfo.date), { addSuffix: true });

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Recent Exercise
            </CardTitle>
            <CardDescription>
              Your latest training session performance
            </CardDescription>
          </div>
          <ProgressIndicator indicator={data.insights.progressIndicator} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Exercise Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{data.exerciseInfo.name}</h3>
            {data.insights.personalRecord?.isNewPR && (
              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                <Trophy className="w-3 h-3 mr-1" />
                New PR!
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{timeAgo}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{data.workoutInfo.name}</span>
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <PerformanceStats 
          performance={data.performance} 
          exerciseInfo={data.exerciseInfo}
        />

        {/* Insights */}
        <div className="space-y-3">
          <p className="text-sm text-foreground/80">{data.insights.summary}</p>
          <ComparisonBadges comparison={data.insights.comparisonWithPrevious} />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Link href={data.navigation.exerciseDetailsUrl} className="flex-1">
            <Button variant="outline" className="w-full">
              Exercise Details
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href={data.navigation.workoutDetailsUrl} className="flex-1">
            <Button variant="default" className="w-full">
              View Workout
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
} 