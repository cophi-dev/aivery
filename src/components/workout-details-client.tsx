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
import { format } from "date-fns";
import { WorkoutAnalysis } from "@/components/workout-analysis";
import { DeleteWorkoutButton } from "@/components/delete-workout-button";
import Image from "next/image";
import { 
  formatDate, 
  formatDuration, 
  formatDistance as formatDistanceUtil, 
  formatPace as formatPaceUtil,
  estimateBodyweightForExercise, 
  capitalizeFirstLetter 
} from "@/lib/utils";
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { WorkoutData } from '@/types/db';
import { useSession } from "next-auth/react";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { debounce } from 'lodash';

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

const getWorkoutTypeIcon = (type: string | undefined) => {
  const typeLower = type?.toLowerCase() || '';
  if (typeLower.includes('run')) return <Activity className="h-4 w-4" />;
  if (typeLower.includes('strength') || typeLower.includes('weight')) return <Dumbbell className="h-4 w-4" />;
  if (typeLower.includes('cycle') || typeLower.includes('bike')) return <Bike className="h-4 w-4" />;
  if (typeLower.includes('swim')) return <Waves className="h-4 w-4" />;
  if (typeLower.includes('hiit') || typeLower.includes('cardio')) return <HeartPulse className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

// Format distance for display
const formatDistance = (km: number) => {
  if (!km || km <= 0) return "N/A";
  return `${km.toFixed(2)} km`;
};

// Format pace for display
const formatPace = (pace: number | null) => {
  if (!pace || pace <= 0 || !isFinite(pace)) return "N/A";
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  if (seconds === 60) {
     return `${minutes + 1}:00 min/km`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
};

export default function WorkoutDetailsClient({ workout, previousWorkouts, isOwner }: WorkoutDetailsClientProps) {
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState<boolean>(false);
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

  // Memoize expensive calculations
  const totalVolume = useMemo(() => {
    if (!workout?.workoutExercises || workout.type !== 'strength') return null;
    return workout.workoutExercises.reduce((sum: number, ex: any) => {
      if (!ex.sets?.length) return sum;
      const estimatedWeight = estimateBodyweightForExercise(ex.exerciseId?.name || '');
      return sum + ex.sets.reduce((setSum: number, set: any) => {
        const weight = set.weight ?? 0;
        const reps = set.reps ?? 0;
        const effectiveWeight = weight > 0 ? weight : (estimatedWeight > 0 ? estimatedWeight : 0);
        return setSum + effectiveWeight * reps;
      }, 0);
    }, 0);
  }, [workout?.workoutExercises, workout?.type]);

  // Memoize cardio details calculation
  const cardioDetails = useMemo(() => ({
    distance: workout.distance ?? workout.cardioDetails?.distance ?? 0,
    pace: workout.cardioDetails?.pace ?? null,
    heartRate: workout.cardioDetails?.heartRate ?? null,
    elevationGain: workout.cardioDetails?.elevationGain ?? null,
    power: workout.cardioDetails?.power ?? null,
  }), [workout]);

  // Memoize pace info
  const paceInfo = useMemo(() => getPaceZone(cardioDetails.pace ?? null), [cardioDetails.pace]);

  // Fetch insight with debounce
  const debouncedFetchInsight = useCallback(
    debounce(async () => {
      if (!workoutId || typeof workoutId !== 'string' || isLoadingInsight) return;
      
      const userName = session?.user?.nickname || session?.user?.name || "Fitness Pro";
      
      setIsLoadingInsight(true);
      try {
        const response = await fetch(`/api/ai/workout-highlight?t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName, workout }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setInsight(data.insight || 'Highlight unavailable.');
      } catch (error) {
        console.error("Error fetching workout insight:", error);
        setInsight('Oops! Could not generate a highlight.');
      } finally {
        setIsLoadingInsight(false);
      }
    }, 1000),
    [workoutId, workout, session, isLoadingInsight]
  );

  useEffect(() => {
    debouncedFetchInsight();
    return () => {
      debouncedFetchInsight.cancel();
    };
  }, [debouncedFetchInsight]);

  const overallTotalReps = useMemo(() => {
      if (!workout?.workoutExercises) return 0;
      return workout.workoutExercises.reduce((exSum: number, ex: any) =>
          exSum + (ex.sets?.reduce((setSum: number, set: any) => setSum + (set.reps ?? 0), 0) || 0)
      , 0);
  }, [workout?.workoutExercises]);

  const fixedStravaLink = getFixedStravaLink(workout as WorkoutData);
  const workoutTypeIcon = getWorkoutTypeIcon(workout.type);

  // Calculate aggregated distance from exercises if needed
  const aggregatedDistanceKm = useMemo(() => {
    if (!workout.workoutExercises || workout.workoutExercises.length === 0) return 0;
    const totalMeters = workout.workoutExercises.reduce((sum: number, ex: any) => {
      // Check if distance exists and is a valid number
      const dist = typeof ex.distance === 'number' && isFinite(ex.distance) ? ex.distance : 0;
      return sum + dist;
    }, 0);
    return totalMeters / 1000; // Convert meters to km
  }, [workout.workoutExercises]);

  // Calculate pace from total duration and aggregated distance if needed
  const calculatedPace = useMemo(() => {
    const totalDurationSeconds = workout.duration; // Assuming workout.duration is total seconds
    const totalDistanceKm = aggregatedDistanceKm > 0 ? aggregatedDistanceKm : (workout.distance ?? 0);
    
    if (!totalDurationSeconds || totalDurationSeconds <= 0 || !totalDistanceKm || totalDistanceKm <= 0) {
      return null; // Cannot calculate pace
    }
    
    const totalDurationMinutes = totalDurationSeconds / 60;
    return totalDurationMinutes / totalDistanceKm; // minutes per km
  }, [workout.duration, aggregatedDistanceKm, workout.distance]);

  const workoutIdString = workout._id.toString();

  // Define a helper component for Stat Cards
  const StatCard = ({ icon: Icon, label, value, unit, colorClass }: { icon: React.ElementType, label: string, value: string | number | null | undefined, unit?: string, colorClass?: string }) => {
    const isValueMissing = value === null || value === undefined || value === 'N/A' || (typeof value === 'number' && !isFinite(value)) || (typeof value === 'string' && value.trim() === '');
    if (isValueMissing) return null;
    let displayValue = value;
    if (typeof value === 'number') {
        displayValue = Number.isInteger(value) ? value : value.toFixed(1);
    }
    return (
      <div className={`flex items-center p-3 bg-muted/50 rounded-lg border ${colorClass || 'border-border'}`}>
        <Icon className={`w-5 h-5 mr-3 ${colorClass || 'text-muted-foreground'}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-md font-medium">{displayValue}{unit || ''}</p>
        </div>
      </div>
    );
  };

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
            <Link href="/workouts"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Workouts</Link>
          </Button>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="icon" title="Share" className="hover:bg-accent hover:text-accent-foreground"><Share className="w-4 h-4" /></Button>
            <Link href={`/workouts/new?duplicate=${workoutIdString}`} title="Duplicate"><Button variant="outline" size="icon" className="hover:bg-accent hover:text-accent-foreground"><Copy className="w-4 h-4" /></Button></Link>
            {isOwner && <Link href={`/workouts/new?edit=${workoutIdString}`} title="Edit"><Button variant="outline" size="icon" className="hover:bg-accent hover:text-accent-foreground"><Pencil className="w-4 h-4" /></Button></Link>}
            {isOwner && <DeleteWorkoutButton workoutId={workoutIdString} asIcon={true} />}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-4 border-b">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              {workoutTypeIcon} {workout.name || capitalizeFirstLetter(workout.type || 'Workout')}
            </h2>
            <p className="text-muted-foreground text-sm">{formatDate(workout.date as any)}</p>
          </div>
        </div>

        {/* --- Key Stats Grid --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Timer} label="Duration" value={formatDuration(workout.duration)} colorClass="text-blue-500" />
          {workout.type === 'strength' ? (
             <StatCard icon={BarChart} label="Volume" value={totalVolume?.toLocaleString()} unit=" kg" colorClass="text-purple-500" />
           ) : (
             <StatCard icon={Ruler} label="Distance" value={formatDistance(workout.cardioDetails?.distance ?? workout.distance ?? 0)} colorClass="text-green-500" />
           )}
          <StatCard icon={Clock} label={`Avg Pace (${paceInfo.zone})`} value={formatPace(cardioDetails.pace ?? null)} colorClass={paceInfo.color} />
          <StatCard icon={Zap} label="Calories" value={workout.calories?.toLocaleString()} unit=" kcal" colorClass="text-orange-500" />
          <StatCard icon={Heart} label="Avg HR" value={cardioDetails.heartRate?.average ? Math.round(cardioDetails.heartRate.average) : null} unit=" bpm" colorClass="text-red-500" />
          <StatCard icon={TrendingUp} label="Max HR" value={cardioDetails.heartRate?.max ? Math.round(cardioDetails.heartRate.max) : null} unit=" bpm" colorClass="text-red-600" />
          <StatCard icon={TrendingUp} label="Elevation Gain" value={cardioDetails.elevationGain ? Math.round(cardioDetails.elevationGain) : null} unit=" m" colorClass="text-teal-500" />
          <StatCard icon={Zap} label="Avg Power" value={cardioDetails.power?.average ? Math.round(cardioDetails.power.average) : null} unit=" W" colorClass="text-yellow-600" />
        </div>

        {/* --- Exercises Performed Section --- */}
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Dumbbell className="h-5 w-5 mr-2 text-primary" />
                        Exercises Performed
                    </div>
                    {workout.type === 'strength' && totalVolume !== null && totalVolume > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">Vol: {totalVolume.toLocaleString()} kg / {overallTotalReps} reps</span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                    <div className="space-y-6">
                        {workout.workoutExercises.map((exerciseDetail: any, index: number) => (
                            <div key={exerciseDetail._id || index} className="border-b pb-6 last:border-b-0">
                                <h3 className="text-lg font-medium mb-3 flex justify-between items-center">
                                    {exerciseDetail.exerciseId?._id ? (
                                        <Link href={`/exercises/${exerciseDetail.exerciseId._id}`} className="hover:underline cursor-pointer">
                                            {index + 1}. {exerciseDetail.exerciseId.name}
                                        </Link>
                                    ) : (
                                        <span>{index + 1}. {exerciseDetail.exerciseId?.name || 'Unknown Exercise'}</span>
                                    )}
                                </h3>
                                <div className="space-y-4 pl-2 sm:pl-4">
                                    {/* Strength Exercise List (Reverted from Table) */}
                                    {exerciseDetail.sets && exerciseDetail.sets.length > 0 && workout.type === 'strength' && (
                                        <div className="text-sm">
                                            <h4 className="font-semibold mb-1 text-muted-foreground">Sets:</h4>
                                            <ul className="space-y-1 pl-4 list-disc list-inside">
                                                {exerciseDetail.sets.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).map((set: any, setIndex: number) => (
                                                    <li key={`${exerciseDetail._id}-set-${set.id || setIndex}`}>
                                                        <span className="font-medium">Set {set.order !== undefined && set.order !== null ? set.order + 1 : setIndex + 1}:</span>
                                                        {set.weight !== undefined && set.weight !== null && set.weight > 0 ? <span className="ml-2">{set.weight} kg</span> : <span className="ml-2">Bodyweight</span>}
                                                        {set.reps !== undefined && set.reps !== null ? <span className="ml-1">x {set.reps} reps</span> : ''}
                                                        {set.notes && <span className="ml-2 text-xs italic">({set.notes})</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {/* Cardio/Other Exercise Details Grid - This part might need adjustment based on how non-strength exercise data is stored */}
                                    {(!exerciseDetail.sets || exerciseDetail.sets.length === 0) && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                                            {exerciseDetail.duration !== undefined && exerciseDetail.duration > 0 && (
                                                <div>
                                                    <p className="font-semibold text-muted-foreground">Duration:</p>
                                                    <p>{formatDuration(exerciseDetail.duration)}</p>
                                                </div>
                                            )}
                                            {exerciseDetail.distance !== undefined && exerciseDetail.distance > 0 && (
                                                <div>
                                                    <p className="font-semibold text-muted-foreground">Distance:</p>
                                                    <p>{formatDistance(exerciseDetail.distance / 1000)}</p>
                                                </div>
                                            )}
                                            {exerciseDetail.pace !== undefined && exerciseDetail.pace > 0 && (
                                                <div>
                                                    <p className="font-semibold text-muted-foreground">Pace:</p>
                                                    <p>{formatPace(exerciseDetail.pace)}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Display Notes */}
                                    {exerciseDetail.notes && (
                                        <div className="text-sm mt-3 pt-3 border-t border-dashed">
                                            <h4 className="font-semibold mb-1 text-muted-foreground">Notes:</h4>
                                            <p className="pl-0 whitespace-pre-wrap text-muted-foreground">{exerciseDetail.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No specific exercises were recorded for this workout.</p>
                )}
            </CardContent>
        </Card>

        {/* --- Strava Link Button --- */}
        {fixedStravaLink && (
             <Button asChild variant="outline" className="w-full sm:w-auto bg-[#FC4C02] hover:bg-[#E34000] text-white">
               <a href={fixedStravaLink} target="_blank" rel="noopener noreferrer">
                 <StravaLogo /> View on Strava <ExternalLink className="h-4 w-4 ml-2" />
               </a>
             </Button>
        )}

        {/* --- Progress Analysis & Graph --- */}
        {/* ... progress sections ... */}
      </div>
    </div>
  );
}

