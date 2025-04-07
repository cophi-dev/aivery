'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, Dumbbell, Calendar, BarChart, Zap, MessageSquare, Loader2, RefreshCcw, BookOpen, 
  Bike, Waves, HeartPulse, LucidePlusCircle, Lightbulb
} from "lucide-react";
import type { WorkoutData, ExerciseData } from "@/types/db";
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { fetchWithAuth, getUserData, getQuote } from "@/lib/client-utils";
import { fetchWorkouts } from "@/lib/workout-actions";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Image from 'next/image';
import { capitalizeFirstLetter } from "@/lib/utils";
import { formatDuration, formatDistance as formatDistanceUtil } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Keyword List ---
const fitnessKeywords = [
  "Plyometrics", "Progressive Overload", "Zone 2 Training", "HIIT", "Tabata",
  "Compound Exercises", "Isolation Exercises", "Supersets", "Drop Sets",
  "Periodization", "Active Recovery", "Foam Rolling", "Dynamic Stretching",
  "Static Stretching", "Mind-Muscle Connection", "Time Under Tension",
  "Macronutrients", "Micronutrients", "Caloric Deficit", "Caloric Surplus",
  "Intermittent Fasting", "Nasal Breathing", "VO2 Max", "Lactate Threshold",
  "Heart Rate Variability (HRV)", "DOMS (Delayed Onset Muscle Soreness)",
  "Functional Training", "Circuit Training", "Bodyweight Training", "Kettlebell Swings"
];

// --- Helper Functions ---

// Get an icon based on workout type
const getWorkoutTypeIcon = (type: string | undefined) => {
  const typeLower = type?.toLowerCase() || '';
  if (typeLower.includes('run')) return <Activity className="h-4 w-4" />;
  if (typeLower.includes('strength') || typeLower.includes('weight')) return <Dumbbell className="h-4 w-4" />;
  if (typeLower.includes('cycle') || typeLower.includes('bike')) return <Bike className="h-4 w-4" />;
  if (typeLower.includes('swim')) return <Waves className="h-4 w-4" />;
  if (typeLower.includes('hiit') || typeLower.includes('cardio')) return <HeartPulse className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />; // Default icon
};

// Format duration assuming input is in MINUTES
const formatDurationFromMinutes = (minutes: number | undefined | null): string => {
  if (minutes === undefined || minutes === null || minutes <= 0) return "0 min";
  const totalMinutes = Math.round(minutes);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim(); // Trim trailing space if mins is 0
};

// Format distance (assuming km) using the utility function
const formatDistance = (distance: number | undefined | null): string | null => {
  if (distance === undefined || distance === null || distance <= 0) return null;
  // Use the imported utility function
  return formatDistanceUtil(distance); 
};

// Format volume (assuming kg)
const formatVolume = (volume: number | undefined | null): string | null => {
  if (volume === undefined || volume === null || volume <= 0) return null;
  return `${Math.round(volume)} kg`;
};

// --- Bodyweight Estimation (copied from new-alt page) ---
const estimateBodyweightForExercise = (exerciseName: string): number => {
  const defaultBodyweight = 75;
  const bodyweightExercises: Record<string, number> = { /* ... as before ... */ };
  const normalizedName = exerciseName.toLowerCase().trim();
  for (const [exerciseKey, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exerciseKey)) { 
      return Math.round(defaultBodyweight * percentage);
    }
  }
  return 0;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [quote, setQuote] = useState("Your fitness journey begins with a single step.");
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);
  const [spotlightKeyword, setSpotlightKeyword] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchQuoteData(forceFresh = false) {
      try {
        console.log(`[PAGE] Fetching fresh quote at ${new Date().toISOString()}`);
        const quoteText = await getQuote(
          location?.lat, 
          location?.lon, 
          true
        );
        
        if (isMounted) {
          setQuote(quoteText);
          console.log(`[PAGE] Quote updated: ${quoteText.substring(0, 20)}...`);
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
      }
    }
    
    fetchQuoteData(true);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        console.log('[PAGE] Tab visible again, refreshing quote');
        fetchQuoteData(true);
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const quoteInterval = setInterval(() => {
      console.log('[PAGE] Quote refresh interval triggered');
      fetchQuoteData(true);
    }, 2 * 60 * 1000);
    
    let lastRefresh = Date.now();
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastRefresh > 30 * 1000) {
        lastRefresh = now;
        fetchQuoteData(true);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      isMounted = false;
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [location]);

  // Effect to set the spotlight keyword
  useEffect(() => {
    if (fitnessKeywords.length > 0) {
      const randomIndex = Math.floor(Math.random() * fitnessKeywords.length);
      setSpotlightKeyword(fitnessKeywords[randomIndex]);
    }
  }, []); // Run only once on mount

  const fetchUserData = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) {
      console.log("[PAGE] fetchUserData called but session not ready. Status:", status);
      setLoading(false);
      return;
    }
      
    setLoading(true);
    setError(null);
      
    try {
      console.log("[PAGE] Fetching user data and workouts...");
      const [userDataResponse, workoutsData] = await Promise.all([
        getUserData(),
        fetchWorkouts()
      ]);

      if (userDataResponse?.user) {
        setUser(userDataResponse.user);
        console.log("[PAGE] User data set:", userDataResponse.user.name);
      } else {
        console.warn("[PAGE] No user data received from getUserData.");
      }

      setWorkouts(workoutsData || []);
      console.log(`[PAGE] ${workoutsData?.length || 0} workouts set.`);

    } catch (err: any) {
      console.error("[PAGE] Error loading dashboard data:", err);
      setError(err.message || "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUserData();
    } else if (status === "loading") {
      setLoading(true);
      setError(null);
    } else {
      setLoading(false);
    }
  }, [status, retryCount, fetchUserData]);

  const handleRetry = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
  };

  const refreshQuote = useCallback(async () => {
    try {
      console.log('[PAGE] Manual quote refresh requested');
      const newQuote = await getQuote(
        location?.lat,
        location?.lon,
        true
      );
      setQuote(newQuote);
      console.log(`[PAGE] Quote manually refreshed: ${newQuote.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error refreshing quote:', error);
    }
  }, [location]);

  const mostRecentWorkout = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;
    // Assuming workouts are sorted descending by date from fetch
    const sorted = [...workouts].sort((a, b) => parseISO(b.date as any).getTime() - parseISO(a.date as any).getTime());
    return sorted[0];
  }, [workouts]);
  const recentWorkoutList = useMemo(() => { 
      return workouts.slice(0, 5); 
  }, [workouts]); 
  const strengthVolumeLast7Days = useMemo(() => {
    if (!workouts) return 0;
    const oneWeekAgo = subWeeks(new Date(), 1);
    let totalVolume = 0;

    workouts.forEach(workout => {
      try {
        const workoutDate = parseISO(workout.date as any);
        if (workoutDate >= oneWeekAgo && workout.type === 'strength' && workout.exercises) {
          workout.exercises.forEach(exercise => {
            if (exercise.sets && exercise.sets.length > 0) {
              const exerciseVolume = exercise.sets.reduce((sum, set) => {
                const weight = set.weight ?? 0;
                const reps = set.reps ?? 0;
                const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(exercise.name);
                return sum + (estimatedWeight * reps);
              }, 0);
              totalVolume += exerciseVolume;
            }
          });
        }
      } catch (e) { console.warn("Error processing workout for volume:", e); }
    });
    return Math.round(totalVolume);
  }, [workouts]);

  const runningDistanceLast7Days = useMemo(() => {
    if (!workouts) return 0;
    const oneWeekAgo = subWeeks(new Date(), 1);
    let totalDistance = 0;

    workouts.forEach(workout => {
      try {
        const workoutDate = parseISO(workout.date as any);
        if (workoutDate >= oneWeekAgo && workout.type === 'run' && workout.distance) {
          totalDistance += workout.distance;
        }
      } catch (e) { console.warn("Error processing workout for distance:", e); }
    });
    return totalDistance;
  }, [workouts]);

  const personalRecords = useMemo(() => {
    if (!workouts) return {};
    // Find max weight for ANY exercise
    const records: Record<string, { weight: number; date: Date }> = {};

    workouts.forEach(workout => {
      if (workout.type === 'strength' && workout.exercises) {
        try {
           const workoutDate = parseISO(workout.date as any);
           workout.exercises.forEach(exercise => {
             if (exercise.sets) {
               exercise.sets.forEach(set => {
                 const weight = set.weight ?? 0;
                 // Check if this set is a new PR for this exercise
                 if (weight > (records[exercise.name]?.weight || 0)) {
                   records[exercise.name] = { weight, date: workoutDate };
                 }
               });
             }
           });
         } catch (e) { console.warn("Error processing workout for PR:", e); }
      }
    });
    return records;
  }, [workouts]);

  // Get top 4 PRs for display, sorted alphabetically for consistency
  const topPRs = useMemo(() => {
    return Object.entries(personalRecords)
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
      .slice(0, 4); // Take top 4 alphabetically
      // Alternative: sort by weight: .sort(([,a], [,b]) => b.weight - a.weight)
  }, [personalRecords]);

  const workoutsLast7DaysCount = useMemo(() => {
    if (!workouts) return 0;
    const oneWeekAgo = subWeeks(new Date(), 1);
    return workouts.filter(workout => {
      try {
        const workoutDate = parseISO(workout.date as any);
        return workoutDate >= oneWeekAgo;
      } catch (e) { return false; }
    }).length;
  }, [workouts]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-40">
        <Image 
          src="/icons/aivery-cropped.svg"
          alt="Loading Aivery Dashboard..." 
          width={100} 
          height={100} 
          priority
          className="animate-pulse"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 bg-destructive/10 text-destructive p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="mb-4">{error}</p>
          <Button onClick={handleRetry} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-8 bg-destructive/10 text-destructive p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
            <p className="mb-4">{error}</p>
            <Button 
              onClick={handleRetry}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        )}

        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to Aivery</h1>
          <p className="text-muted-foreground max-w-2xl mb-8">
            Your AI-powered fitness companion to track, plan and analyze your fitness journey
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Button size="lg" asChild>
              <Link href="/login">
                <MessageSquare className="mr-2 h-5 w-5" />
                Login
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/register">
                <Calendar className="mr-2 h-5 w-5" />
                Register
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Weekly Workouts</CardTitle>
              <CardDescription>Your workout consistency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">4/5</div>
              <p className="text-muted-foreground">Goal: 5 workouts per week</p>
              <div className="w-full bg-secondary h-2 rounded-full mt-4">
                <div className="bg-primary h-2 rounded-full w-4/5"></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Total Volume</CardTitle>
              <CardDescription>Weight lifted this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">12,450 kg</div>
              <p className="text-muted-foreground">+8% from last week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Personal Records</CardTitle>
              <CardDescription>New PRs this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">3</div>
              <p className="text-muted-foreground">Bench Press, Squat, Deadlift</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const workoutCount = workouts.length;
  const hasWorkouts = workoutCount > 0;
  const displayName = user?.nickname || user?.name || "User";

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-8">
      
      {/* Header Section (No Log Button) */}
      <section className="p-4 md:p-6 bg-card rounded-xl shadow-sm w-full max-w-3xl">
         <div className="flex items-center gap-3 md:gap-4"> 
          <UserAvatar 
            name={displayName} 
            imageUrl={user?.image || null}
            size="lg"
          />
           <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Hey {displayName}!</h1>
            <p className="text-sm text-muted-foreground mt-1">{quote}</p>
          </div>
        </div>
      </section>

      {/* Main Content Area (Single Column Flow) */}
      <div className="flex flex-col gap-6 w-full max-w-3xl"> 

         {/* Item 1: Log Workout Button (Moved to Top & Prominent) */} 
         <Button size="lg" variant="default" asChild className="w-full">
             <Link href="/workouts/new" className="flex items-center justify-center w-full h-full">
               <LucidePlusCircle className="mr-2 h-5 w-5" /> Log New Workout
            </Link>
         </Button>
        
         {/* Item 2 & 3: Progress Cards (Side-by-side on larger screens) */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
           {/* Strength Progress */} 
           <Card>
             <CardHeader className="text-center">
               <CardTitle className="text-lg flex items-center justify-center">
                 <Dumbbell className="mr-2 h-5 w-5" /> Strength Progress
               </CardTitle>
                <CardDescription>Total Volume (Last 7 Days)</CardDescription>
             </CardHeader>
             <CardContent className="text-center">
               <p className="text-3xl font-bold">{formatVolume(strengthVolumeLast7Days) || "0 kg"}</p>
               {/* Add comparison to previous week later? */} 
             </CardContent>
           </Card>

           {/* Cardio Progress */} 
           <Card>
             <CardHeader className="text-center">
               <CardTitle className="text-lg flex items-center justify-center">
                  <HeartPulse className="mr-2 h-5 w-5" /> Cardio Progress
            </CardTitle>
               <CardDescription>Running Distance (Last 7 Days)</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
               <p className="text-3xl font-bold">{formatDistance(runningDistanceLast7Days) || "0 km"}</p>
               {/* Add comparison to previous week later? */} 
          </CardContent>
           </Card>
         </div>

         {/* Item 4: Concept Spotlight Card */}
         {spotlightKeyword && (
           <Card className="hover:bg-muted/50 transition-colors">
             <Link 
               href={`/chat?keyword=${encodeURIComponent(spotlightKeyword)}`} 
               className="block p-4" // Make the link cover the card padding area
               title={`Ask about ${spotlightKeyword}`}
             >
               <div className="flex items-center gap-3">
                 <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
                 <div className="flex-1">
                   <p className="text-sm font-medium">Concept Spotlight</p>
                   <p className="text-base font-semibold text-primary">
                     What is {spotlightKeyword}?
                   </p>
                 </div>
               </div>
             </Link>
           </Card>
         )}

         {/* Item 5: Personal Records (Moved Here) */} 
         <Card>
           <CardHeader className="text-center">
             <CardTitle className="text-lg flex items-center justify-center">
               <Zap className="mr-2 h-5 w-5" /> Personal Records
          </CardTitle>
             <CardDescription>Your best lifts across all exercises</CardDescription>
        </CardHeader>
           <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-center">
             {topPRs.length > 0 ? (
               topPRs.map(([exercise, record]) => (
                 <div key={exercise} className="text-sm border-b border-border/50 pb-2 last:border-b-0 sm:last:border-b-0">
                   <p className="font-medium truncate">{exercise}</p>
                   <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{record.weight} kg</span>
                      <span className="text-xs"> on {format(record.date, 'MMM d, yyyy')}</span>
                   </p>
                 </div>
               ))
             ) : (
               <p className="text-sm text-muted-foreground sm:col-span-2">No PRs recorded yet.</p>
          )}
        </CardContent>
      </Card>

      </div>

    </div>
  );
}


