'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  RefreshCw,
  Share,
  Bike,
  Waves,
  HeartPulse
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { WorkoutAnalysis } from "@/components/workout-analysis";
import { DeleteWorkoutButton } from "@/components/delete-workout-button";
import Image from "next/image";
import { formatDate, formatDuration, formatDistance } from "@/lib/utils";
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { WorkoutData } from '@/types/db';
import { useSession } from "next-auth/react";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

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
  
  // First, look for complete Strava links with full URL pattern
  const stravaLinkRegex = /https:\/\/(?:www\.)?strava\.com\/activities\/(\d{8,})/;
  const match = notes.match(stravaLinkRegex);
  if (match && match[1]) {
    return `https://www.strava.com/activities/${match[1]}`;
  }
  
  // Look for mentions of Strava ID in the notes
  const idNearStravaRegex = /(?:strava|activity|run)(?:[^\d]*|[^\d]+id[^\d]*|[^\d]+#[^\d]*)(\d{8,})/i;
  const idMatch = notes.match(idNearStravaRegex);
  if (idMatch && idMatch[1]) {
    return `https://www.strava.com/activities/${idMatch[1]}`;
  }
  
  return undefined;
}

function isValidStravaLink(link?: string): boolean {
  if (!link) {
    return false;
  }
  
  // Always return true if there's any link - we'll let Strava handle invalid IDs
  // This ensures the button is always visible so users can edit it if needed
  return true;
}

function formatStravaLink(link?: string): string | undefined {
  if (!link) {
    return undefined;
  }
  
  // If it's already a full Strava link, return it as is
  if (link.includes('strava.com/activities/')) {
    return link;
  }
  
  // Check if it's a full URL and extract the ID
  const urlIdMatch = link.match(/\/activities\/(\d+)/);
  if (urlIdMatch && urlIdMatch[1]) {
    const id = urlIdMatch[1];
    return `https://www.strava.com/activities/${id}`;
  }
  
  // Check if it's a pure numeric ID
  if (/^\d+$/.test(link)) {
    return `https://www.strava.com/activities/${link}`;
  }
  
  return undefined;
}

function StravaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.089 4.116z" fill="#fff"/><path d="M10.232 13.828l3.065 6.056 3.066-6.056h-6.131z" fill="#fff"/><path d="M15.387 0L7.708 15.435h4.307l3.374-6.647 3.37 6.647h4.307L15.387 0z" fill="#fff"/>
    </svg>
  );
}

function getFixedStravaLink(workout: WorkoutData): string | undefined {
  // If the workout has a sourceId and comes from Strava, always use it
  if (workout.source === 'strava' && workout.sourceId) {
    // Ensure sourceId is a valid Strava ID format (numeric and reasonably long)
    if (/^\d{5,}$/.test(workout.sourceId)) {
      return `https://www.strava.com/activities/${workout.sourceId}`;
    }
  }
  
  // If there's a stravaLink property, use it after validation
  if (workout.stravaLink) {
    const formattedLink = formatStravaLink(workout.stravaLink);
    if (formattedLink) {
      // Extract ID from formatted link and validate it
      const idMatch = formattedLink.match(/\/activities\/(\d+)/);
      if (idMatch && idMatch[1] && /^\d{5,}$/.test(idMatch[1])) {
        return formattedLink;
      }
    }
  }
  
  // Extract from notes with a reasonable date check
  if (workout.notes) {
    const workoutDate = new Date(workout.date);
    const cutoffDate = new Date('2013-01-01');
    
    if (workoutDate >= cutoffDate) {
      const extractedLink = extractStravaLinkFromNotes(workout.notes);
      if (extractedLink) {
        // Validate the extracted link
        const idMatch = extractedLink.match(/\/activities\/(\d+)/);
        if (idMatch && idMatch[1] && /^\d{5,}$/.test(idMatch[1])) {
          return extractedLink;
        }
      }
    }
  }
  
  return undefined;
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
  workout: any;
  previousWorkouts: any[];
  isOwner: boolean;
}

function capitalizeFirstLetter(string: string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const getWorkoutTypeIcon = (type: string | undefined) => {
  const typeLower = type?.toLowerCase() || '';
  if (typeLower.includes('run')) return <Activity className="h-4 w-4" />;
  if (typeLower.includes('strength') || typeLower.includes('weight')) return <Dumbbell className="h-4 w-4" />;
  if (typeLower.includes('cycle') || typeLower.includes('bike')) return <Bike className="h-4 w-4" />;
  if (typeLower.includes('swim')) return <Waves className="h-4 w-4" />;
  if (typeLower.includes('hiit') || typeLower.includes('cardio')) return <HeartPulse className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

export default function WorkoutDetailsClient({ workout, previousWorkouts, isOwner }: WorkoutDetailsClientProps) {
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState<boolean>(true);
  const [scrollOpacity, setScrollOpacity] = useState<number>(1);
  const params = useParams();
  const workoutId = params?.id as string;
  const { data: session } = useSession();
  const detailsRef = useRef<HTMLDivElement>(null);
  const [showNotes, setShowNotes] = useState(false);
  const router = useRouter();
  const [fixingLinks, setFixingLinks] = useState(false);

  // Add automatic Strava link fixing on page load
  useEffect(() => {
    if (isOwner && workout.source === 'strava') {
      const fixAllStravaLinks = async () => {
        try {
          setFixingLinks(true);
          const response = await fetch('/api/workouts/fix-strava-links');
          if (response.ok) {
            const data = await response.json();
            console.log('Strava links fixed automatically:', data.message);
            // Don't reload the page as we're not showing Strava links anymore
          }
        } catch (err) {
          console.error('Error fixing Strava links:', err);
        } finally {
          setFixingLinks(false);
        }
      };
      
      fixAllStravaLinks();
    }
  }, [isOwner, workout.source]);

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
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

  const totalVolume = useMemo(() => {
    if (!workout?.workoutExercises || workout.type !== 'strength') return null;
    return workout.workoutExercises.reduce((sum: number, ex: any) => {
        const estimatedWeight = estimateBodyweightForExercise(ex.exerciseId?.name || '');
        if (!ex.sets?.length) return sum;
        return sum + ex.sets.reduce((setSum: number, set: any) => {
            const weight = set.weight ?? 0;
            const reps = set.reps ?? 0;
            if (weight > 0) return setSum + weight * reps;
            if (estimatedWeight > 0) return setSum + estimatedWeight * reps;
            return setSum + reps; // Count reps if no weight/estimated weight
        }, 0);
    }, 0);
  }, [workout]);
  
  const overallTotalReps = useMemo(() => {
      if (!workout?.workoutExercises) return 0;
      return workout.workoutExercises.reduce((exSum: number, ex: any) => 
          exSum + (ex.sets?.reduce((setSum: number, set: any) => setSum + (set.reps ?? 0), 0) || 0)
      , 0);
  }, [workout.workoutExercises]);

  const fixedStravaLink = getFixedStravaLink(workout as WorkoutData);
  const workoutTypeIcon = getWorkoutTypeIcon(workout.type);
  const cardioDetails: CardioDetails = {};
  if (workout.distance) cardioDetails.distance = workout.distance;
  if (workout.cardioDetails?.pace) cardioDetails.pace = workout.cardioDetails.pace;
  if (workout.cardioDetails?.heartRate?.average) cardioDetails.heartRate = { average: workout.cardioDetails.heartRate.average };
  if (workout.cardioDetails?.heartRate?.max && cardioDetails.heartRate) cardioDetails.heartRate.max = workout.cardioDetails.heartRate.max;
  if (workout.cardioDetails?.elevationGain) cardioDetails.elevationGain = workout.cardioDetails.elevationGain;
  if (workout.cardioDetails?.power?.average) cardioDetails.power = { average: workout.cardioDetails.power.average };
  const paceInfo = getPaceZone(cardioDetails.pace ?? null);
  const workoutIdString = workout._id.toString();

  if (!workout) {
    return <div>Workout data is missing.</div>;
  }
  
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

      <div ref={detailsRef} className="container mx-auto px-4 py-12 space-y-8 scroll-mt-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm"><Share className="w-4 h-4 mr-1" /> Share</Button>
            <Link href={`/workouts/new?duplicate=${workoutIdString}`}><Button variant="outline" size="sm"><Copy className="w-4 h-4 mr-1" /> Duplicate</Button></Link>
            <Link href={`/workouts/new?edit=${workoutIdString}`}><Button variant="outline" size="sm"><Pencil className="w-4 h-4 mr-1" /> Edit</Button></Link>
            <DeleteWorkoutButton workoutId={workoutIdString} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-4 border-b">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              {workoutTypeIcon} {workout.name || capitalizeFirstLetter(workout.type || 'Workout')}
            </h2>
            <p className="text-muted-foreground text-sm">{format(workout.date as any, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            {workout.duration && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Timer className="w-5 h-5 mr-3 text-blue-500" /><div><p className="text-xs text-muted-foreground">Duration</p><p className="text-md font-medium">{formatDuration(workout.duration)}</p></div></div>)}
            {cardioDetails.distance && cardioDetails.distance > 0 && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Ruler className="w-5 h-5 mr-3 text-green-500" /><div><p className="text-xs text-muted-foreground">Distance</p><p className="text-md font-medium">{formatDistance(cardioDetails.distance)}</p></div></div>)}
            {cardioDetails.pace && cardioDetails.pace > 0 && (<div className={`flex items-center p-3 bg-muted/50 rounded-lg border ${paceInfo.color}`}><Clock className="w-5 h-5 mr-3" /><div><p className="text-xs text-muted-foreground">Avg Pace ({paceInfo.zone})</p><p className="text-md font-medium">{formatPace(cardioDetails.pace)}</p></div></div>)}
            {workout.calories && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Zap className="w-5 h-5 mr-3 text-orange-500" /><div><p className="text-xs text-muted-foreground">Calories</p><p className="text-md font-medium">~{workout.calories.toLocaleString()} kcal</p></div></div>)}
            {totalVolume !== null && totalVolume > 0 && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><BarChart className="w-5 h-5 mr-3 text-purple-500" /><div><p className="text-xs text-muted-foreground">Volume</p><p className="text-md font-medium">{totalVolume.toLocaleString()} kg</p></div></div>)}
            {cardioDetails.heartRate?.average && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Heart className="w-5 h-5 mr-3 text-red-500" /><div><p className="text-xs text-muted-foreground">Avg HR</p><p className="text-md font-medium">{Math.round(cardioDetails.heartRate.average)} bpm</p></div></div>)}
            {cardioDetails.heartRate?.max && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><TrendingUp className="w-5 h-5 mr-3 text-red-600" /><div><p className="text-xs text-muted-foreground">Max HR</p><p className="text-md font-medium">{Math.round(cardioDetails.heartRate.max)} bpm</p></div></div>)}
            {cardioDetails.elevationGain && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><TrendingUp className="w-5 h-5 mr-3 text-teal-500" /><div><p className="text-xs text-muted-foreground">Elevation Gain</p><p className="text-md font-medium">{Math.round(cardioDetails.elevationGain)} m</p></div></div>)}
            {cardioDetails.power?.average && (<div className="flex items-center p-3 bg-muted/50 rounded-lg border"><Zap className="w-5 h-5 mr-3 text-yellow-600" /><div><p className="text-xs text-muted-foreground">Avg Power</p><p className="text-md font-medium">{Math.round(cardioDetails.power.average)} W</p></div></div>)}
            <Badge variant="outline" className="capitalize">{workout.type}</Badge>
          </div>
        </div>

        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Dumbbell className="h-5 w-5 mr-2 text-primary" />
                        Exercises Performed
                    </div>
                    {totalVolume !== null && totalVolume > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">Vol: {totalVolume.toLocaleString()} kg / {overallTotalReps} reps</span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                    <ul className="space-y-4"> 
                        {workout.workoutExercises.map((exerciseDetail: any, index: number) => (
                            <li key={exerciseDetail._id || index} className="border-b pb-4 last:border-b-0">
                                <h3 className="text-lg font-medium mb-2 flex justify-between items-center">
                                    <span>{index + 1}. {exerciseDetail.exerciseId?.name || 'Unknown Exercise'}</span>
                                    {exerciseDetail.exerciseId?.category && <Badge variant="secondary" className="ml-2 text-xs font-normal">{capitalizeFirstLetter(exerciseDetail.exerciseId.category)}</Badge>}
                                </h3>
                                <div className="space-y-3 pl-2 sm:pl-4">
                                    {exerciseDetail.sets && exerciseDetail.sets.length > 0 && (
                                        <div className="text-sm">
                                            <h4 className="font-semibold mb-1 text-muted-foreground">Sets:</h4>
                                            <ul className="space-y-1 pl-4">
                                                {exerciseDetail.sets.map((set: any, setIndex: number) => (
                                                    <li key={`${exerciseDetail._id}-set-${set.order ?? setIndex}`}>
                                                        <span className="font-medium">Set {set.order !== undefined ? set.order + 1 : setIndex + 1}:</span> 
                                                        {set.weight !== undefined && set.weight > 0 ? <span className="ml-2">{set.weight}kg</span> : ''}
                                                        {set.reps !== undefined ? <span className="ml-1">x {set.reps} reps</span> : ''}
                                                        {set.duration !== undefined ? <span className="ml-2">for {set.duration}s</span> : ''}
                                                        {set.distance !== undefined ? <span className="ml-2">for {set.distance}m</span> : ''}
                                                        {set.notes ? <span className="text-xs text-muted-foreground italic ml-2">({set.notes})</span> : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {exerciseDetail.duration !== undefined && exerciseDetail.duration > 0 && (!exerciseDetail.sets || exerciseDetail.sets.length === 0) && (
                                        <div className="text-sm">
                                            <h4 className="font-semibold mb-1 text-muted-foreground">Duration:</h4>
                                            <p className="pl-4">{formatDuration(exerciseDetail.duration)}</p>
                                        </div>
                                    )}
                                    {exerciseDetail.notes && (
                                        <div className="text-sm mt-2">
                                            <h4 className="font-semibold mb-1 text-muted-foreground">Notes:</h4>
                                            <p className="pl-4">{exerciseDetail.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground">No specific exercises were recorded for this workout.</p>
                )}
            </CardContent>
        </Card>
        
        {previousWorkouts.length > 0 && (
          <div className="mb-6">
             <h3 className="text-lg font-semibold mb-3">Progress Analysis</h3>
             <WorkoutAnalysis workout={workout} />
          </div>
        )}
        {previousWorkouts.length > 1 && workout.type !== 'other' && (
          <div className="mt-6"><h3 className="text-lg font-semibold mb-3">Progress Over Time</h3><Card className="bg-muted/30 border"><CardContent className="p-4 h-[300px]">
            <WorkoutProgressGraph currentWorkout={workout} historyData={previousWorkouts} />
          </CardContent></Card></div>
        )}
      </div>
    </div>
  );
}
