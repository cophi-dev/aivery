'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Timer,
  Ruler,
  ArrowLeft,
  Pencil,
  Heart,
  TrendingUp,
  Zap,
  BarChart,
  ExternalLink,
  Dumbbell,
  Trash,
  Copy,
  Trophy,
  Clock,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { WorkoutAnalysis } from "@/components/workout-analysis";
import { DeleteWorkoutButton } from "@/components/delete-workout-button";
import Image from "next/image";
import { formatDate, formatDuration, formatDistance } from "@/lib/utils";
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { WorkoutData } from '@/types/db';
import { useSession } from "next-auth/react";

const formatPace = (pace: number | null): string => {
  if (pace === null || pace <= 0 || !isFinite(pace)) return "N/A";
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
};

const getPaceZone = (pace: number | null): { zone: string; color: string } => {
  if (pace === null || pace <= 0 || !isFinite(pace)) return { zone: "Unknown", color: "" };
  if (pace < 4.5) return { zone: "Fast Zone", color: "text-red-500 border-red-500/50" };
  if (pace < 5.5) return { zone: "Moderate Zone", color: "text-yellow-500 border-yellow-500/50" };
  if (pace < 6.5) return { zone: "Easy Zone", color: "text-green-500 border-green-500/50" };
  return { zone: "Recovery Zone", color: "text-blue-500 border-blue-500/50" };
};

interface CardioDetails {
  distance?: number; pace?: number; heartRate?: { average?: number; max?: number }; elevationGain?: number; power?: { average?: number };
}

function extractStravaLinkFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/\d+/;
  const match = notes.match(stravaLinkRegex);
  if (match && match[0]) return match[0];
  const idNearStravaRegex = /(?:strava|view on strava)[^\d]*(\d{8,})/i;
  const idMatch = notes.match(idNearStravaRegex);
  if (idMatch && idMatch[1]) return `https://www.strava.com/activities/${idMatch[1]}`;
  return undefined;
}

function isValidStravaLink(link?: string): boolean {
  if (!link) return false;
  const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/\d+/;
  return stravaLinkRegex.test(link);
}

function formatStravaLink(link?: string): string | undefined {
  if (!link) return undefined;
  const idMatch = link.match(/\/activities\/(\d+)/);
  if (idMatch && idMatch[1]) return `https://www.strava.com/activities/${idMatch[1]}`;
  if (/^\d+$/.test(link)) return `https://www.strava.com/activities/${link}`;
  return link;
}

function StravaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.089 4.116z" fill="#fff"/><path d="M10.232 13.828l3.065 6.056 3.066-6.056h-6.131z" fill="#fff"/><path d="M15.387 0L7.708 15.435h4.307l3.374-6.647 3.37 6.647h4.307L15.387 0z" fill="#fff"/>
    </svg>
  );
}

function getFixedStravaLink(workout: WorkoutData): string | undefined {
  const workoutDate = new Date(workout.date);
  if (workout.type === 'running' && workoutDate.getMonth() === 2 && workoutDate.getDate() === 24 && workoutDate.getFullYear() === 2025) return 'https://www.strava.com/activities/13979174497';
  if (workout.type === 'swimming' && workoutDate.getMonth() === 2 && workoutDate.getDate() === 22 && workoutDate.getFullYear() === 2025) return 'https://www.strava.com/activities/13957482431';
  return formatStravaLink(workout.stravaLink || extractStravaLinkFromNotes(workout.notes));
}

function estimateBodyweightForExercise(exerciseName: string): number {
  const defaultBodyweight = 70;
  const bodyweightExercises: Record<string, number> = { 
      "push-up": 0.65, "push up": 0.65, "pushup": 0.65,
      "pull-up": 1.0,  "pull up": 1.0, "pullup": 1.0,
      "chin-up": 1.0,  "chin up": 1.0, "chinup": 1.0,
      "dip": 1.0, "bodyweight squat": 1.0, "squat": 1.0,
      "lunge": 0.6
  }; 
  const normalizedName = exerciseName.toLowerCase().trim();
  for (const [exercise, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exercise)) return Math.round(defaultBodyweight * percentage);
  }
  return 0;
}

function calculateExerciseVolume(exercise: { name: string; sets: Array<{ weight?: number | null; reps?: number | null }> }): number {
  if (!exercise.sets?.length) return 0;
  const estimatedWeight = estimateBodyweightForExercise(exercise.name);
  return exercise.sets.reduce((sum, set) => {
    const weight = set.weight ?? 0;
    const reps = set.reps ?? 0;
    if (weight > 0) return sum + weight * reps;
    if (estimatedWeight > 0) return sum + estimatedWeight * reps;
    return sum + reps;
  }, 0);
}

function formatValueForRecord(value: number | string, metric: string): string {
  if (typeof value === 'number') {
    if (metric === 'distance') return formatDistance(value);
    if (metric === 'duration') return formatDuration(value);
    if (metric === 'pace') return formatPace(value);
    return value.toString();
  }
  return value;
}

interface WorkoutProgressGraphProps { currentWorkout: WorkoutData; historyData: WorkoutData[]; }

const WorkoutProgressGraph = dynamic<WorkoutProgressGraphProps>(
  () => import('@/components/workout-progress-graph'), 
  { ssr: false, loading: () => <p>Loading graph...</p> }
);

interface WorkoutDetailsClientProps {
  workout: WorkoutData;
  previousWorkouts: WorkoutData[];
}

export default function WorkoutDetailsClient({ workout, previousWorkouts }: WorkoutDetailsClientProps) {
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState<boolean>(true);
  const [scrollOpacity, setScrollOpacity] = useState<number>(1);
  const params = useParams();
  const workoutId = params?.id as string;
  const { data: session } = useSession();
  const detailsRef = useRef<HTMLDivElement>(null);

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll event to fade out the indicator
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      // Start fading at 50px, completely fade out by 200px
      const newOpacity = Math.max(0, 1 - (scrollPosition / 200));
      setScrollOpacity(newOpacity);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const fetchInsight = useCallback(async () => {
    const userName = session?.user?.nickname || session?.user?.name || "Fitness Pro";

    if (!workoutId || typeof workoutId !== 'string') {
      setIsLoadingInsight(false);
      setInsight('Could not load workout highlight.');
      return;
    }
    setIsLoadingInsight(true);
    try {
      const response = await fetch(`/api/ai/workout-highlight?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: userName,
          workout: workout
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setInsight(data.insight || 'Highlight unavailable.');
    } catch (error) {
      console.error("Error fetching workout insight:", error);
      setInsight('Oops! Could not generate a highlight.');
    } finally {
      setIsLoadingInsight(false);
    }
  }, [workoutId, workout, session]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const totalVolume = workout.type === 'strength' && workout.exercises ? workout.exercises.reduce((sum, ex) => sum + calculateExerciseVolume(ex), 0) : null;
  const stravaLink = getFixedStravaLink(workout);
  const cardioDetails: CardioDetails = {};
  if (workout.distance) cardioDetails.distance = workout.distance;
  if (workout.cardioDetails?.pace) cardioDetails.pace = workout.cardioDetails.pace;
  if (workout.cardioDetails?.heartRate?.average) cardioDetails.heartRate = { average: workout.cardioDetails.heartRate.average };
  if (workout.cardioDetails?.heartRate?.max && cardioDetails.heartRate) cardioDetails.heartRate.max = workout.cardioDetails.heartRate.max;
  if (workout.cardioDetails?.elevationGain) cardioDetails.elevationGain = workout.cardioDetails.elevationGain;
  if (workout.cardioDetails?.power?.average) cardioDetails.power = { average: workout.cardioDetails.power.average };
  const paceInfo = getPaceZone(cardioDetails.pace ?? null);
  const workoutIdString = workout._id.toString();

  return (
    <div className="bg-background text-foreground">
      <div className="h-screen flex flex-col items-center bg-gradient-to-br from-primary/10 to-secondary/10 relative p-6">
        <div className="w-full max-w-4xl flex flex-col justify-center items-center h-full mt-[-5vh]">
          <div className="text-center">
            {isLoadingInsight ? (
              <p className="text-2xl sm:text-3xl font-semibold animate-pulse text-center">Aivery is checking out your workout now...</p>
            ) : (
               <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center leading-tight text-primary">
                 {insight}
               </h1>
             )}
          </div>
        </div>
      </div>

      {!isLoadingInsight && (
         <div 
           className="text-center animate-bounce fixed bottom-8 left-0 right-0 cursor-pointer z-50 transition-opacity duration-200"
           style={{ opacity: scrollOpacity }}
           onClick={scrollToDetails}
           role="button"
           aria-label="Scroll to details"
         >
           <span className="text-xs text-muted-foreground block">Scroll for details</span>
           <svg className="w-6 h-6 text-muted-foreground mx-auto mt-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
         </div>
       )}

      <div ref={detailsRef} className="container mx-auto p-4 md:p-6 lg:p-8 relative z-10">
        <Card className="overflow-hidden shadow-lg bg-card">
          <CardHeader className="flex flex-row items-center justify-between p-4 bg-card-foreground/5 border-b">
            <Link href="/dashboard" className="text-primary hover:underline inline-flex items-center text-sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
            </Link>
            <div className="flex items-center space-x-2">
              <Link href={`/workout/edit/${workoutIdString}`} passHref><Button variant="outline" size="sm"><Pencil className="w-4 h-4 mr-1" /> Edit</Button></Link>
              <Link href={`/workout/new?duplicate=${workoutIdString}`} passHref><Button variant="outline" size="sm"><Copy className="w-4 h-4 mr-1" /> Duplicate</Button></Link>
              <DeleteWorkoutButton workoutId={workoutIdString} />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-card-foreground flex items-center"><Activity className="w-6 h-6 mr-3 text-primary" /> {workout.name || `${workout.type} Workout`}</h2>
                <p className="text-muted-foreground text-sm md:text-base mt-1">{formatDate(workout.date)}</p>
              </div>
              <Badge variant="secondary" className="mt-2 md:mt-0 text-sm px-3 py-1 self-start md:self-center">{workout.type}</Badge>
            </div>
            {stravaLink && isValidStravaLink(stravaLink) && (
              <a href={stravaLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 mb-4 text-sm font-medium text-white bg-[#FC4C02] rounded-md hover:bg-[#e04402] shadow">
                <StravaLogo /> View on Strava <ExternalLink className="w-3 h-3 ml-1.5" />
              </a>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
              {workout.duration && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Timer className="w-5 h-5 mr-3 text-blue-500" /><div><p className="text-xs text-muted-foreground">Duration</p><p className="text-md font-medium">{formatDuration(workout.duration)}</p></div></div>)}
              {cardioDetails.distance && cardioDetails.distance > 0 && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Ruler className="w-5 h-5 mr-3 text-green-500" /><div><p className="text-xs text-muted-foreground">Distance</p><p className="text-md font-medium">{formatDistance(cardioDetails.distance)}</p></div></div>)}
              {cardioDetails.pace && cardioDetails.pace > 0 && (<div className={`flex items-center p-3 bg-muted/50 rounded-lg border ${paceInfo.color}`}><Clock className="w-5 h-5 mr-3" /><div><p className="text-xs text-muted-foreground">Avg Pace ({paceInfo.zone})</p><p className="text-md font-medium">{formatPace(cardioDetails.pace)}</p></div></div>)}
              {workout.calories && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Zap className="w-5 h-5 mr-3 text-orange-500" /><div><p className="text-xs text-muted-foreground">Calories</p><p className="text-md font-medium">~{workout.calories.toLocaleString()} kcal</p></div></div>)}
              {totalVolume !== null && totalVolume > 0 && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><BarChart className="w-5 h-5 mr-3 text-purple-500" /><div><p className="text-xs text-muted-foreground">Volume</p><p className="text-md font-medium">{totalVolume.toLocaleString()} kg</p></div></div>)}
              {cardioDetails.heartRate?.average && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Heart className="w-5 h-5 mr-3 text-red-500" /><div><p className="text-xs text-muted-foreground">Avg HR</p><p className="text-md font-medium">{Math.round(cardioDetails.heartRate.average)} bpm</p></div></div>)}
              {cardioDetails.heartRate?.max && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><TrendingUp className="w-5 h-5 mr-3 text-red-600" /><div><p className="text-xs text-muted-foreground">Max HR</p><p className="text-md font-medium">{Math.round(cardioDetails.heartRate.max)} bpm</p></div></div>)}
              {cardioDetails.elevationGain && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><TrendingUp className="w-5 h-5 mr-3 text-teal-500" /><div><p className="text-xs text-muted-foreground">Elevation Gain</p><p className="text-md font-medium">{Math.round(cardioDetails.elevationGain)} m</p></div></div>)}
              {cardioDetails.power?.average && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Zap className="w-5 h-5 mr-3 text-yellow-600" /><div><p className="text-xs text-muted-foreground">Avg Power</p><p className="text-md font-medium">{Math.round(cardioDetails.power.average)} W</p></div></div>)}
            </div>
            {workout.type === 'strength' && workout.exercises && workout.exercises.length > 0 && (
              <div className="mb-6"><h3 className="text-lg font-semibold mb-3 flex items-center"><Dumbbell className="w-5 h-5 mr-2 text-indigo-500" />Exercises</h3><div className="space-y-4">
                {workout.exercises.map((exercise, index) => (
                  <Card key={index} className="bg-muted/30 border"><CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-md font-medium">{exercise.name || `Exercise ${index + 1}`}</CardTitle>{exercise.notes && <p className="text-xs text-muted-foreground pt-1">{exercise.notes}</p>}</CardHeader><CardContent className="px-4 pb-3"><ul className="list-none space-y-1 text-sm">
                    {exercise.sets?.map((set, setIndex) => (<li key={setIndex} className="flex justify-between items-center text-muted-foreground"><span>Set {setIndex + 1}: {set.reps ?? '?'} reps</span>{set.weight != null && set.weight > 0 && <span className="font-medium">{set.weight} kg</span>}</li>))}
                  </ul></CardContent></Card>
                ))}
              </div></div>
            )}
            {workout.notes && (<div className="mb-6"><h3 className="text-lg font-semibold mb-2">Notes</h3><p className="text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md border text-sm">{workout.notes}</p></div>)}
            {previousWorkouts.length > 0 && (<WorkoutAnalysis workout={workout} />)}
            {previousWorkouts.length > 1 && workout.type !== 'other' && (
              <div className="mt-6"><h3 className="text-lg font-semibold mb-3">Progress Over Time</h3><Card className="bg-muted/30 border"><CardContent className="p-4 h-[300px]">
                <WorkoutProgressGraph currentWorkout={workout} historyData={previousWorkouts} />
              </CardContent></Card></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
