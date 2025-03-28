'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Dumbbell, Calendar, BarChart, Zap, MessageSquare } from "lucide-react";
import type { WorkoutData } from "@/types/db";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";

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

  // Check user authentication status
  useEffect(() => {
    if (status === "loading") {
      return; // Still checking auth status
    }
    
    // If user is not logged in, show the public landing page
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    
    // User is authenticated, fetch their data
    fetchUserData();
  }, [status, retryCount]);

  // Function to fetch user data
  const fetchUserData = async () => {
    try {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      // Fetch user data
      const userResponse = await fetch('/api/user');
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
      }
      const userData = await userResponse.json();
      
      if (!userData.user) {
        throw new Error("User data not found");
      }
      
      setUser(userData.user);

      // Fetch user's workouts
      if (userData.user._id) {
        const workoutsResponse = await fetch(`/api/workouts/${userData.user._id}`);
        if (!workoutsResponse.ok) {
          throw new Error(`Failed to fetch workouts: ${workoutsResponse.statusText}`);
        }
        const workoutsData = await workoutsResponse.json();
        
        if (!workoutsData.workouts) {
          // If no workouts array, create an empty one
          setWorkouts([]);
          setRecentWorkouts([]);
        } else {
          setWorkouts(workoutsData.workouts);
          
          // Sort workouts by date (newest first) and take the 5 most recent
          const sortedWorkouts = [...workoutsData.workouts].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ).slice(0, 5);
          
          setRecentWorkouts(sortedWorkouts);
        }
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Retry mechanism
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Fetch a quote when the component mounts
  useEffect(() => {
    // Get user location for context-aware quotes
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }

    async function fetchQuote() {
      try {
        // Add location data if available
        const params = new URLSearchParams();
        
        // Add timestamp to prevent caching
        params.append('t', Date.now().toString());
        params.append('random', Math.random().toString());
        
        if (location) {
          params.append('lat', location.lat.toString());
          params.append('lon', location.lon.toString());
        }
        
        const queryString = params.toString();
        const url = `/api/quotes${queryString ? `?${queryString}` : ''}`;
        
        console.log('Fetching quote from:', url);
        
        const response = await fetch(url, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          next: { revalidate: 0 }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.quote) {
            console.log('New quote received:', data.quote);
            setQuote(data.quote);
          }
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
      }
    }
    
    // Fetch immediately on mount
    fetchQuote();
    
    // Set up interval to refresh quotes (every hour instead of 12)
    const quoteInterval = setInterval(fetchQuote, 60 * 60 * 1000);
    
    // Also add event listener for visibility change to fetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQuote();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location]);

  // If loading, show a loading state
  if (loading && status === "authenticated") {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // If error, show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="mb-4">{error}</p>
          <Button 
            onClick={handleRetry}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Public landing page for unauthenticated users
  if (status !== "authenticated" || !user) {
  return (
    <div className="container mx-auto px-4 py-8">
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

  // Dashboard for authenticated users with data
  // Get some user-specific data
  const workoutCount = workouts.length;
  const hasWorkouts = workoutCount > 0;
  const hasPlans = user.plans?.length > 0;
  const planCount = hasPlans ? user.plans.length : 0;
  
  // Use nickname if available, otherwise fall back to name
  const displayName = user.nickname || user.name;
  
  // Add debugging info in development
  const debug = process.env.NODE_ENV === 'development' ? (
    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-md mb-4 text-xs">
      <h3 className="font-bold">Debug Info:</h3>
      <pre className="overflow-auto max-h-40">
        {JSON.stringify({
          nickname: user.nickname,
          name: user.name,
          displayName,
          quoteLength: quote?.length,
          hasQuote: !!quote,
          quote: quote?.substring(0, 50) + (quote?.length > 50 ? '...' : '')
        }, null, 2)}
      </pre>
    </div>
  ) : null;
  
  return (
    <div className="container mx-auto px-4 py-6">
      {debug}
      <section className="mb-8 p-6 bg-card rounded-xl">
        <div className="flex items-center gap-4">
          <UserAvatar 
            name={displayName} 
            imageUrl={user.image}
            size="lg"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Hey {displayName}!</h2>
            <p className="text-muted-foreground italic">{quote}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* First row - Key statistics and quick access */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Dumbbell className="mr-2 h-5 w-5" />
              Workouts
            </CardTitle>
            <CardDescription>View and track your workouts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workoutCount}</div>
            <p className="text-muted-foreground">Total workouts logged</p>
          </CardContent>
          <CardFooter>
            <Link href="/workouts" className="w-full">
              <Button className="w-full">
                {workoutCount > 0 ? "View Workouts" : "Start First Workout"}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Training Plans
            </CardTitle>
            <CardDescription>Manage your training plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{planCount}</div>
            <p className="text-muted-foreground">Active training plans</p>
          </CardContent>
          <CardFooter>
            <Link href="/plan" className="w-full">
              <Button className="w-full" variant="outline">
                {planCount > 0 ? "View Plans" : "Create a Plan"}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              AI Coach
            </CardTitle>
            <CardDescription>Get personalized guidance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Ask questions, get workout suggestions, and more</p>
          </CardContent>
          <CardFooter>
            <Link href="/chat" className="w-full">
              <Button className="w-full" variant="outline">Talk to AI Coach</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/workout/new">
                <Button variant="secondary" className="w-full" size="sm">
                  Log Workout
                </Button>
              </Link>
              <Link href="/chat?q=suggest+workout">
                <Button variant="secondary" className="w-full" size="sm">
                  Get Suggestion
                </Button>
              </Link>
              <Link href="/plan/new">
                <Button variant="secondary" className="w-full" size="sm">
                  Create Plan
                </Button>
              </Link>
              <Link href="/exercises">
                <Button variant="secondary" className="w-full" size="sm">
                  Exercises
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="secondary" className="w-full" size="sm">
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest workouts</CardDescription>
          </CardHeader>
          <CardContent>
            {hasWorkouts ? (
              <div className="space-y-3">
                {recentWorkouts.map((workout) => (
                  <div key={workout._id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <h3 className="font-medium">{workout.name || `${workout.type} workout`}</h3>
                      <p className="text-sm text-muted-foreground">{format(new Date(workout.date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{workout.duration} min</Badge>
                      <Link href={`/workout/${workout._id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No workouts logged yet</p>
            )}
          </CardContent>
          {hasWorkouts && (
            <CardFooter>
              <Link href="/workouts" className="w-full">
                <Button className="w-full" variant="outline">
                  View All Activity
                </Button>
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Progress Analytics */}
      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <BarChart className="mr-2 h-5 w-5" />
              Progress
            </CardTitle>
            <CardDescription>Track your fitness progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center">
              {hasWorkouts ? (
                <div className="w-full text-center">
                  <p className="text-muted-foreground">Progress tracking visualizations coming soon</p>
                </div>
              ) : (
                <div className="w-full text-center">
                  <p className="text-muted-foreground">Log workouts to see your progress</p>
                  <Link href="/workout/new" className="mt-4 inline-block">
                    <Button>Log Your First Workout</Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

