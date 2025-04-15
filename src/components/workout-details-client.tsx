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
  HeartPulse,
  MessageSquare
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

  // --- Styling Adjustments for Landing Page Theme ---
  // Define base card class - remove explicit bg-card, rely on theme
  const cardBaseClass = "border shadow-sm"; 
  // Define primary text color class (assuming theme provides this)
  const primaryTextColor = "text-primary"; 
  // Define accent color for specific highlights if needed (example)
  // const accentTextColor = "text-orange-500"; 

  // --- Stat Card Component (Minor Style Update) ---
  const StatCard = ({ icon: Icon, label, value, unit, colorClass = primaryTextColor }: { icon: React.ElementType, label: string, value: string | number | null | undefined, unit?: string, colorClass?: string }) => {
    const displayValue = value !== null && value !== undefined && value !== '' ? `${value}${unit ? ` ${unit}` : ''}` : "N/A";
    return (
      <div className="flex flex-col items-center text-center p-2 bg-muted/50 rounded-lg">
        <Icon className={`h-6 w-6 mb-1 ${colorClass}`} />
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold mt-0.5">{displayValue}</p>
      </div>
    );
  };

  // --- Main Return Statement --- 
  return (
    // Use default background, remove specific bg colors if present
    <div className="container mx-auto px-2 sm:px-4 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Main Content Card - Apply base class */}
      <Card className={`${cardBaseClass} mb-6 overflow-hidden`}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div>
            <CardTitle className={`text-2xl font-bold ${primaryTextColor}`}>{workout.name || "Workout Details"}</CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                {getWorkoutTypeIcon(workout.type)}
                {capitalizeFirstLetter(workout.type || "Workout")}
              </span>
              <span>&bull;</span>
              <span>{formatDate(workout.date)}</span>
            </div>
          </div>
          {/* Edit/Delete Buttons - Style appropriately */} 
          {isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/workout/edit/${workoutId}`}>
                <Button variant="outline" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <DeleteWorkoutButton workoutId={workoutId} />
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Overall Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={Timer} label="Duration" value={formatDuration(workout.duration)} unit="" colorClass={primaryTextColor} />
            {workout.type !== 'Strength' && workout.distance !== null && workout.distance !== undefined && workout.distance > 0 && (
              <StatCard icon={Ruler} label="Distance" value={formatDistance(workout.distance)} unit="" colorClass={primaryTextColor}/>
            )}
            {workout.type !== 'Strength' && workout.pace !== null && workout.pace !== undefined && workout.pace > 0 && (
              <StatCard icon={Activity} label="Avg Pace" value={formatPace(workout.pace)} unit="/km" colorClass={primaryTextColor}/>
            )}
            {workout.calories !== null && workout.calories !== undefined && workout.calories > 0 && (
              <StatCard icon={Zap} label="Calories" value={Math.round(workout.calories)} unit=" kcal" colorClass="text-orange-500"/> // Example Accent
            )}
             {workout.heartRate?.average && (
               <StatCard icon={Heart} label="Avg HR" value={Math.round(workout.heartRate.average)} unit=" bpm" colorClass="text-red-500"/> // Example Specific Color
             )}
            {workout.volume !== null && workout.volume !== undefined && workout.volume > 0 && (
              <StatCard icon={Dumbbell} label="Volume" value={Math.round(workout.volume)} unit=" kg" colorClass={primaryTextColor} />
            )}
            {/* Add more stats as needed */}
          </div>

          {/* Notes Section */}
           {workout.notes && (
            <Card className={`${cardBaseClass} bg-background/50`}>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">
                {workout.notes}
              </CardContent>
            </Card>
           )}

          {/* Exercise Details Table/Cards */}
          {workout.exercises && workout.exercises.length > 0 && (
            <Card className={`${cardBaseClass}`}>
               <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-base font-medium">Exercises</CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="divide-y divide-border">
                     {workout.exercises.map((exercise: any, index: number) => (
                       <div key={index} className="p-4 hover:bg-muted/30">
                         <p className={`font-semibold mb-2 ${primaryTextColor}`}>{exercise.name}</p>
                         <div className="space-y-1 text-sm">
                           {exercise.sets.map((set: any, setIndex: number) => (
                             <div key={setIndex} className="flex justify-between items-center text-muted-foreground">
                               <span>Set {setIndex + 1}</span>
                               <span className="font-medium text-foreground">
                                 {set.weight ? `${set.weight} kg x ` : ''}
                                 {set.reps ? `${set.reps} reps` : 'Bodyweight'}
                                 {/* Add distance/duration for cardio sets if applicable */}
                               </span>
                             </div>
                           ))}
                         </div>
                       </div>
                     ))}
                  </div>
               </CardContent>
             </Card>
          )}

          {/* Strava Link Button (Style adjustment) */}
          {fixedStravaLink && (
            <div className="mt-4">
              <Button variant="outline" asChild className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white">
                 <a href={fixedStravaLink} target="_blank" rel="noopener noreferrer">
                  <StravaLogo /> View on Strava
                 </a>
              </Button>
            </div>
          )}

          {/* AI Analysis Section */}
          {isOwner && (
            <Card className={`${cardBaseClass} bg-gradient-to-r from-blue-50 to-cyan-50`}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <MessageSquare className={`h-5 w-5 ${primaryTextColor}`} /> AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                  <WorkoutAnalysis workout={workout} />
              </CardContent>
            </Card>
          )}

        </CardContent>
      </Card>
      {/* Other sections like Progress Graph */}
    </div>
  );
}

