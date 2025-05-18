'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, ArrowLeft, BarChart3, CheckCircle, Dumbbell, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MuscleGroupInsights from "@/components/exercises/muscle-group-insights";

type MuscleGroupStat = {
  group: string;
  frequency: number;
  neglected: boolean;
};

type WorkoutAnalysis = {
  timeframe: {
    days: number;
    startDate: string;
    endDate: string;
    totalWorkouts: number;
  };
  muscleGroups: MuscleGroupStat[];
  neglectedMuscleGroups: string[];
  mostWorked: string[];
  exercises: {
    name: string;
    frequency: number;
    lastWorked: string | null;
    prs: any[];
  }[];
  error?: string;
};

export default function ExerciseAnalysisPage() {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<number>(30);
  const router = useRouter();

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/workout-analysis?days=${timeframe}`);
        
        if (!res.ok) {
          throw new Error(`Error fetching workout analysis: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          return;
        }
        
        setAnalysis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error('Error fetching muscle group analysis:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysis();
  }, [timeframe]);

  // Function to capitalize first letter of each word
  const capitalize = (str: string) => {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/exercises">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Exercise Analysis</h1>
          </div>
          <p className="text-muted-foreground">Analyze your workout patterns and identify training gaps</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs 
            defaultValue="30" 
            onValueChange={(value) => setTimeframe(parseInt(value))}
            className="w-[400px]"
          >
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="30">Last 30 Days</TabsTrigger>
              <TabsTrigger value="90">Last 90 Days</TabsTrigger>
              <TabsTrigger value="180">Last 6 Months</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-md">
              <CardHeader>
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error || analysis?.error ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Analysis Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error || analysis?.error || 'An error occurred while analyzing your workouts.'}
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => router.refresh()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : !analysis ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="w-5 h-5 mr-2" />
              No Data Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              We couldn't find any workout data to analyze.
            </p>
            <Link href="/workout/new" className="block mt-4">
              <Button>Log a Workout</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="bg-muted/50 border rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                Analysis based on {analysis.timeframe.totalWorkouts} workouts from {new Date(analysis.timeframe.startDate).toLocaleDateString()} to {new Date(analysis.timeframe.endDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Muscle Group Overview Card */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                  Muscle Group Coverage
                </CardTitle>
                <CardDescription>
                  How balanced is your training?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MuscleGroupInsights 
                  muscleGroups={analysis.muscleGroups} 
                  compact={true} 
                />
              </CardContent>
            </Card>

            {/* Most Worked Muscle Groups Card */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  Most Worked Muscle Groups
                </CardTitle>
                <CardDescription>
                  Muscle groups you've trained the most
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.mostWorked.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {analysis.mostWorked.map(group => (
                        <Badge 
                          key={group} 
                          variant="secondary" 
                          className="text-sm py-1.5 px-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        >
                          {capitalize(group)}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      These muscle groups are getting consistent attention in your training program.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No consistently trained muscle groups found in this time period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Neglected Muscle Groups Card */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                  Potentially Neglected Muscle Groups
                </CardTitle>
                <CardDescription>
                  Areas that may need more attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.neglectedMuscleGroups.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {analysis.neglectedMuscleGroups.map(group => (
                        <Badge 
                          key={group} 
                          variant="outline" 
                          className="text-sm py-1.5 px-3 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                        >
                          {capitalize(group)}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      These muscle groups have been worked less than twice in your recent workouts.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-medium text-green-600 dark:text-green-400">
                    Great job! You have a well-balanced training program with no neglected muscle groups.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis */}
          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <Dumbbell className="w-5 h-5 mr-2 text-primary" />
                  Exercise Frequency Analysis
                </CardTitle>
                <CardDescription>
                  Breakdown of all exercises performed during the time period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-3 font-medium">Exercise</th>
                        <th className="py-2 px-3 font-medium text-center">Frequency</th>
                        <th className="py-2 px-3 font-medium">Last Performed</th>
                        <th className="py-2 px-3 font-medium">Personal Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.exercises.length > 0 ? (
                        analysis.exercises
                          .sort((a, b) => b.frequency - a.frequency)
                          .map(exercise => (
                            <tr key={exercise.name} className="border-b border-muted hover:bg-muted/50">
                              <td className="py-2 px-3 font-medium">
                                <Link href={`/exercises?name=${encodeURIComponent(exercise.name)}`} className="text-primary hover:underline">
                                  {exercise.name}
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-center">{exercise.frequency}x</td>
                              <td className="py-2 px-3">
                                {exercise.lastWorked ? (
                                  new Date(exercise.lastWorked).toLocaleDateString()
                                ) : (
                                  <span className="text-muted-foreground">Unknown</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {exercise.prs && exercise.prs.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {exercise.prs.slice(0, 2).map((pr, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {pr.value} {pr.unit}
                                      </Badge>
                                    ))}
                                    {exercise.prs.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{exercise.prs.length - 2} more
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">No PRs</span>
                                )}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-muted-foreground">
                            No exercise data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Muscle Group Analysis */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  Detailed Muscle Group Analysis
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis of all muscle groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MuscleGroupInsights 
                  muscleGroups={analysis.muscleGroups} 
                  compact={false} 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
} 