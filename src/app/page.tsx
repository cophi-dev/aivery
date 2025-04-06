'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, Dumbbell, Calendar, BarChart, Zap, MessageSquare, Loader2, RefreshCcw, BookOpen, 
  Bike, Waves, HeartPulse, LucidePlusCircle
} from "lucide-react";
import type { WorkoutData } from "@/types/db";
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { fetchWithAuth, getUserData, getQuote } from "@/lib/client-utils";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Image from 'next/image';
import { capitalizeFirstLetter } from "@/lib/utils";
import { formatDuration, formatDistance as formatDistanceUtil } from "@/lib/utils";

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

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [quote, setQuote] = useState("Your fitness journey begins with a single step.");
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);

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

  const fetchUserData = useCallback(async () => {
    try {
      if (!session?.user?.id) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const userData = await getUserData();
        if (userData?.user) {
          setUser(userData.user);
          
          if (userData.user._id) {
            const workoutsResponse = await fetchWithAuth(`/api/workouts/${userData.user._id}`);
            if (!workoutsResponse.ok) {
              throw new Error(`Failed to fetch workouts: ${workoutsResponse.statusText}`);
            }
            const workoutsData = await workoutsResponse.json();
            
            if (!workoutsData.workouts) {
              setWorkouts([]);
              setRecentWorkouts([]);
            } else {
              setWorkouts(workoutsData.workouts);
              
              const sortedWorkouts = [...workoutsData.workouts].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
              ).slice(0, 5);
              
              setRecentWorkouts(sortedWorkouts);
            }
          }
        }
      } catch (userErr) {
        console.error("Error fetching user data:", userErr);
        setError("Failed to load user data. Please try again.");
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchUserData();
    } else if (status === "loading") {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [status, session, retryCount, fetchUserData]);

  const handleRetry = () => {
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

  const weeklyWorkoutData = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];

    const numberOfWeeks = 4;
    const today = new Date();
    const weeklyData: { name: string; workouts: number }[] = [];

    for (let i = 0; i < numberOfWeeks; i++) {
      const weekEndDate = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const weekStartDate = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });

      const workoutsInWeek = workouts.filter(w => {
        try {
           const workoutDate = w.date instanceof Date ? w.date : parseISO(w.date as any);
           return isWithinInterval(workoutDate, { start: weekStartDate, end: weekEndDate });
        } catch (e) {
          console.warn("Error parsing workout date for chart:", w.date, e);
          return false;
        }
      });

      weeklyData.push({
        name: `Wk ${format(weekStartDate, 'MMM d')}`,
        workouts: workoutsInWeek.length,
      });
    }

    return weeklyData.reverse();
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
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-10">
      <section className="p-4 md:p-6 bg-card rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
          <UserAvatar 
            name={displayName} 
            imageUrl={user?.image || null}
            size="lg"
          />
          <div className="flex-1 mt-2 sm:mt-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Hey {displayName}!</h1>
            <p className="text-muted-foreground text-sm md:text-base mb-2">
              Your AI-powered fitness companion to track, plan and analyze your fitness journey.
            </p>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground italic text-xs sm:text-sm">
                {quote}
              </p>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full hover:bg-muted/50 flex-shrink-0"
                onClick={refreshQuote}
                title="Refresh quote"
              >
                <RefreshCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
          <Button asChild size="lg" className="w-full">
            <Link href="/chat">
              <MessageSquare className="mr-2 h-5 w-5" /> Chat with AI Coach
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/workouts/new">
              <LucidePlusCircle className="mr-2 h-5 w-5" /> Log Workout
            </Link>
          </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="lg:col-span-1">
           <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <Dumbbell className="mr-2 h-4 w-4" /> Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold">{workoutCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total logged</p>
          </CardContent>
          <CardFooter className="pt-3">
            <Button asChild className="w-full">
              <Link href="/workouts">
                {workoutCount > 0 ? "View Workouts" : "Log First Workout"}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <Activity className="mr-2 h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto pr-1 space-y-1">
            {hasWorkouts ? (
              <>
                {recentWorkouts.map((workout) => {
                  const icon = getWorkoutTypeIcon(workout.type);
                  const date = format(new Date(workout.date), 'MMM d');
                  const typeLower = workout.type?.toLowerCase() || '';
                  const typeDisplay = capitalizeFirstLetter(workout.type || 'Activity');
                  let metric: string | null = null;
                  
                  // Log duration to check its value/unit
                  console.log(`[Recent Activity] Workout ${workout._id} (${typeDisplay}) duration (seconds?): ${workout.duration}, volume: ${workout.volume}, calcVolume: ${workout.calculatedVolume}, distance: ${workout.distance}`);
                  
                  // Determine metric based on type
                  if (typeLower.includes('run') || typeLower.includes('cycle') || typeLower.includes('swim')) {
                     metric = formatDistance(workout.distance);
                  } else if (typeLower.includes('strength') || typeLower.includes('weight')) {
                     // Prioritize explicit volume, fallback to calculatedVolume
                     const volume = workout.volume ?? workout.calculatedVolume;
                     metric = formatVolume(volume);
                  }
                  
                  // Fallback to duration (using seconds formatter) if no specific metric found
                  if (!metric && workout.duration !== undefined && workout.duration !== null) {
                     metric = formatDuration(workout.duration);
                  }

                  return (
                    <Link href={`/workout/${workout._id}`} key={workout._id} className="block group">
                      <div className="flex items-center justify-between gap-3 sm:gap-4 px-2 py-2.5 rounded-md group-hover:bg-muted/60 transition-colors border-b border-transparent group-last:border-0">
                        <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                          {icon}
                          <span className="text-xs font-normal w-12 sm:w-14 text-right tabular-nums">{date}</span>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm truncate group-hover:text-foreground transition-colors">{typeDisplay}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {metric && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-xs font-normal tabular-nums">
                              {metric}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">No workouts logged yet.</p>
            )}
          </CardContent>
          {hasWorkouts && (
            <CardFooter className="pt-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/workouts">View All Activity</Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="lg:col-span-1">
           <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <MessageSquare className="mr-2 h-4 w-4" /> AI Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-base text-muted-foreground">Ask questions, get suggestions, and more.</p>
          </CardContent>
           <CardFooter className="pt-3">
             <Button asChild variant="outline" className="w-full">
               <Link href="/chat">Chat Now</Link>
             </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-1">
           <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <BookOpen className="mr-2 h-4 w-4" /> My Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-base text-muted-foreground">Let Aivery create a personalized story.</p>
          </CardContent>
           <CardFooter className="pt-3">
            <Button asChild variant="outline" className="w-full">
              <Link href="/my-story">Read My Story</Link>
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <BarChart className="mr-2 h-4 w-4" /> Weekly Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[150px] pl-0 pr-2 pb-0">
            {hasWorkouts && weeklyWorkoutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart 
                  data={weeklyWorkoutData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} dy={5}/>
                  <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={25}/>
                  <Tooltip 
                     cursor={{ fill: 'hsl(var(--muted))' }} 
                     contentStyle={{ 
                       backgroundColor: 'hsl(var(--background))', 
                       borderColor: 'hsl(var(--border))', 
                       borderRadius: 'var(--radius)',
                       fontSize: '12px',
                       padding: '4px 8px' 
                     }}
                     labelStyle={{ marginBottom: '2px' }}
                  />
                  <Bar dataKey="workouts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center flex flex-col items-center justify-center h-full">
                <p className="text-sm text-muted-foreground mb-2">Log workouts to see progress</p>
                <Button asChild size="sm">
                    <Link href="/workouts/new">Log Workout</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
           <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <Zap className="mr-2 h-4 w-4" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/workouts/new">Log Workout</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/chat?q=suggest+workout">Get Suggestion</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/plan/new">Create Plan</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/exercises">Exercises</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/my-story">My Story</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="justify-start h-8 px-2">
                 <Link href="/settings">Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


