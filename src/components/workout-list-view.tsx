"use client"

import React, { useState, useEffect, ErrorInfo, useMemo, useCallback } from "react"
import Link from "next/link"
import { format, parseISO, isAfter, isBefore, isEqual } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Activity, 
  Clock, 
  Dumbbell, 
  Filter, 
  Ruler, 
  CalendarIcon, 
  X,
  ArrowUpDown,
  Search,
  AlertCircle,
  ChevronRight,
  Info,
  TrendingUp,
  Trophy,
  History
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { WorkoutData } from "@/types/db"
import { formatDistance, formatDuration, formatDate as formatDateUtil } from "@/lib/utils"
import { fetchDashboardExercisePRs, type DashboardPREntry } from "@/lib/workout-actions"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

// Define types for sorting
type SortField = "date" | "name" | "type" | "intensity" | "duration" | "volume";
type SortDirection = "asc" | "desc";

// Explicitly define WorkoutStats interface
interface WorkoutStats {
  totalWorkouts: number;
  totalSeconds: number;
  totalDistance: number;
  totalVolume: number;
  favoriteType: string;
}

// Define props interface
interface WorkoutListViewProps {
  initialWorkouts: WorkoutData[];
}

// Simple error boundary class component
class WorkoutListErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WorkoutList error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error displaying workout data</AlertTitle>
          <AlertDescription>
            There was a problem rendering the workout data. Please try refreshing the page.
            <Button 
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              variant="outline"
              className="ml-2"
            >
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Helper to get color based on workout type
const getWorkoutTypeStyle = (type: string): { icon: React.ReactNode; colorClasses: string } => {
  const lowerType = type?.toLowerCase() || 'other';
  switch (lowerType) {
    case 'running':
    case 'run':
      return { icon: <Ruler className="h-3 w-3" />, colorClasses: "border-orange-400/50 bg-orange-500/10 text-orange-600 dark:text-orange-400" };
    case 'cycling':
    case 'bike':
    case 'ride':
       return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-blue-400/50 bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    case 'swimming':
    case 'swim':
       return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-cyan-400/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
    case 'strength':
    case 'workout':
      return { icon: <Dumbbell className="h-3 w-3" />, colorClasses: "border-green-400/50 bg-green-500/10 text-green-600 dark:text-green-400" };
    case 'hiit':
       return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-400" };
    case 'flexibility':
    case 'stretch':
    case 'yoga':
       return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-purple-400/50 bg-purple-500/10 text-purple-600 dark:text-purple-400" };
    default:
      return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-gray-400/50 bg-gray-500/10 text-gray-600 dark:text-gray-400" };
  }
}

// Local Pace Formatter for PR display
const formatPaceDisplay = (pace: number | undefined | null): string => {
  if (pace === undefined || pace === null || isNaN(pace) || pace <= 0) {
    return "N/A";
  }
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function WorkoutListView({ initialWorkouts }: WorkoutListViewProps) {
  // Remove initialWorkouts console log
  // console.log(`[WorkoutListView] Received initialWorkouts prop with ${initialWorkouts?.length ?? 0} items. Newest ID: ${initialWorkouts?.[0]?._id}`);

  // State Initialization - Use initialWorkouts for initial state
  const [workouts, setWorkouts] = useState<WorkoutData[]>(initialWorkouts || []);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutData[]>(initialWorkouts || []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialWorkouts); // Set loading based on prop presence
  const [error, setError] = useState<string | null>(null);
  const [showStatsView, setShowStatsView] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [intensityFilter, setIntensityFilter] = useState<string>("all")
  const [startDateString, setStartDateString] = useState<string>("")
  const [endDateString, setEndDateString] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [dashboardPRs, setDashboardPRs] = useState<DashboardPREntry[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(true);
  
  // --- Add useEffect to update state if initialWorkouts prop changes ---
  useEffect(() => {
    if (initialWorkouts) {
      console.log(`[WorkoutListView] Prop update: Received ${initialWorkouts.length} workouts.`);
      setWorkouts(initialWorkouts);
      setFilteredWorkouts(initialWorkouts);
      setIsLoading(false); // Data received, no longer loading
      setError(null); // Clear any previous errors
    }
  }, [initialWorkouts]);
  // --- End useEffect ---

  // Memoized values and callbacks
  const workoutTypes = useMemo(() => 
      Array.from(new Set(workouts.map(w => w.type).filter(Boolean))) // Use workouts state
      .sort(), 
  [workouts]); // Depend on workouts state
  
  const getWorkoutDistance = useCallback((workout: WorkoutData): number => {
    try {
      if (workout.cardioDetails?.distance !== undefined && typeof workout.cardioDetails.distance === 'number') {
        return workout.cardioDetails.distance;
      }
      if (typeof workout.distance === 'number') {
        console.warn(`Workout ${workout._id}: Using top-level distance ${workout.distance}. Is this expected?`);
        return workout.distance;
      }
    } catch (e) {
      console.error("Error getting workout distance:", e);
    }
    return 0; 
  }, []);

  const getWorkoutVolume = useCallback((workout: WorkoutData): { value: number, unit: string } => {
    try {
      const typeLower = workout.type?.toLowerCase();
      if (typeLower === "running" || typeLower === "run" || typeLower === "cycling" || typeLower === "swim") {
        return { 
          value: getWorkoutDistance(workout),
          unit: "km" 
        };
      } else if (typeLower === "strength") {
        if (typeof workout.calculatedVolume === 'number' && workout.calculatedVolume > 0) {
          return { value: workout.calculatedVolume, unit: "kg" };
        }
        let totalVolume = 0;
        if (workout.workoutExercises && Array.isArray(workout.workoutExercises)) {
          workout.workoutExercises.forEach((exercise) => {
            if (exercise && Array.isArray(exercise.sets)) {
               exercise.sets.forEach((set) => {
                 // Ensure weight and reps are numbers, default to 0 if not
                 const weight = typeof set.weight === 'number' ? set.weight : 0;
                 const reps = typeof set.reps === 'number' ? set.reps : 0;
                 totalVolume += weight * reps;
               });
            }
          });
        }
        return { value: totalVolume, unit: "kg" };
      }
    } catch (e) {
      console.error("Error getting workout volume:", e);
    }
    return { value: 0, unit: "units" }; 
  }, [getWorkoutDistance]);
  
  const applyFiltersAndSort = useCallback(() => {
    let processedWorkouts = [...workouts]; // Use main `workouts` state
    // Apply Type Filter
    if (typeFilter !== "all") {
      processedWorkouts = processedWorkouts.filter(w => w.type === typeFilter);
    }
    // Apply Search Query Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      processedWorkouts = processedWorkouts.filter(w =>
        (w.name && w.name.toLowerCase().includes(lowerQuery)) ||
        (w.notes && w.notes.toLowerCase().includes(lowerQuery))
      );
    }
    // Apply Sorting
    processedWorkouts.sort((a, b) => { 
      let valA: any, valB: any;
      if (sortField === 'date') {
         try {
           valA = new Date(a.date).getTime();
           valB = new Date(b.date).getTime();
           if (isNaN(valA)) valA = 0;
           if (isNaN(valB)) valB = 0;
         } catch { valA = 0; valB = 0; }
      } else if (sortField === 'volume') {
        valA = getWorkoutVolume(a).value;
        valB = getWorkoutVolume(b).value;
      } else {
        valA = a[sortField as keyof WorkoutData];
        valB = b[sortField as keyof WorkoutData];
      }
      if (valA === undefined || valA === null) return sortDirection === 'asc' ? -1 : 1;
      if (valB === undefined || valB === null) return sortDirection === 'asc' ? 1 : -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valB < valA ? -1 : 1);
      }
    });
    setFilteredWorkouts(processedWorkouts);
  }, [workouts, typeFilter, searchQuery, sortField, sortDirection, getWorkoutVolume]);

  // Effects
  // Remove the PR fetching if it's not needed here or fetch it alongside workouts
  /*
  useEffect(() => {
    // Fetch PRs once on mount
    // ... (existing PR fetching logic) ...
  }, []);
  */

  useEffect(() => {
    // Apply filters/sort whenever relevant state changes
    applyFiltersAndSort();
  }, [applyFiltersAndSort]); // Depend only on the stable callback
  
  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default to descending for date, ascending for others
      setSortField(field)
      setSortDirection(field === "date" ? "desc" : "asc")
    }
  }
  
  // Reset all filters
  const resetFilters = () => {
    setTypeFilter("all")
    setIntensityFilter("all")
    setStartDateString("")
    setEndDateString("")
    setSearchQuery("")
  }
  
  // Determine if filters are active
  const filtersActive = 
    typeFilter !== "all" || 
    intensityFilter !== "all" || 
    startDateString !== "" || 
    endDateString !== "" || 
    searchQuery !== ""

  // Format date in a readable way
  const formatDate = (date: Date | string | undefined | null): string => {
    if (!date) return "N/A";
    try { return formatDateUtil(new Date(date)); } catch (e) { return "Unknown date"; }
  }
  
  // Format workout details for hover
  const formatWorkoutDetails = (workout: WorkoutData): string => {
    let details = [];
    
    if (workout.name) {
      details.push(`Name: ${workout.name}`);
    }
    
    if (workout.duration) {
      details.push(`Duration: ${workout.duration} min`);
    }
    
    if (workout.intensity) {
      details.push(`Intensity: ${workout.intensity}`);
    }
    
    if (workout.notes) {
      details.push(`Notes: ${workout.notes}`);
    }
    
    // Add exercise details for strength workouts
    if (workout.type.toLowerCase() === "strength" && workout.workoutExercises && workout.workoutExercises.length > 0) {
      const exercisesList = workout.workoutExercises.map(ex => {
        const setsInfo = (ex.sets || []).map((set: any) => `${set.weight || 0}kg x ${set.reps || 0}`).join(", ");
        return `${ex.exerciseId?.name || 'Unknown Exercise'}: ${setsInfo}`;
      }).join("; ");
      details.push(`Exercises: ${exercisesList}`);
    }
    
    // Add cardio details
    if ((workout.type.toLowerCase() === "running" || workout.type.toLowerCase() === "run") && workout.cardioDetails) {
      if (workout.cardioDetails.pace) {
        details.push(`Pace: ${workout.cardioDetails.pace.toFixed(2)} min/km`);
      }
      if (workout.cardioDetails.heartRate?.average) {
        details.push(`Avg HR: ${workout.cardioDetails.heartRate.average} bpm`);
      }
    }
    
    return details.join("\n");
  };

  // Prepare the ErrorContent separately to avoid conditional hooks
  const errorContent = (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error}
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
          className="ml-2"
        >
          Refresh
        </Button>
      </AlertDescription>
    </Alert>
  );
  
  // Calculate workout stats
  const workoutStats = useMemo(() => {
    // Ensure we always return a valid stats object
    const emptyStats: WorkoutStats = {
      totalWorkouts: 0,
      totalSeconds: 0,
      totalDistance: 0,
      totalVolume: 0,
      favoriteType: 'None'
    };
    
    // Skip calculations if we don't have workouts
    if (!workouts || workouts.length === 0) {
      return emptyStats;
    }

    try {
      // Calculate total workout time in SECONDS
      const totalSeconds = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
      
      // Calculate total distance for cardio workouts using the helper
      const totalDistance = workouts.reduce((sum, w) => {
        const typeLower = w.type?.toLowerCase();
        if (typeLower === "running" || typeLower === "run" || typeLower === "cycling" || typeLower === "bike") {
          // CORRECTED: Call getWorkoutDistance
          return sum + getWorkoutDistance(w); 
        }
        return sum;
      }, 0);
      
      // Calculate total volume for strength workouts
      const totalVolume = workouts.reduce((sum, w) => {
        if (w.type && w.type.toLowerCase() === "strength") {
          return sum + getWorkoutVolume(w).value;
        }
        return sum;
      }, 0);
      
      // Find favorite workout type
      const typeCounts = workouts.reduce((counts, w) => {
        const type = w.type ? w.type.toLowerCase() : 'unknown';
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      const entries = Object.entries(typeCounts);
      const favoriteType = entries.length > 0 
        ? entries.sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'
        : 'None';
      
      return {
        totalWorkouts: workouts.length,
        totalSeconds: parseFloat(totalSeconds.toFixed(2)),
        totalDistance,
        totalVolume,
        favoriteType: favoriteType.charAt(0).toUpperCase() + favoriteType.slice(1)
      };
    } catch (err) {
      console.error("Error calculating workout stats:", err);
      return emptyStats;
    }
  }, [workouts]);
  
  // --- Update Loading State Handling ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <LoadingIndicator />
        <span className="ml-2 text-muted-foreground">Loading workouts...</span>
      </div>
    );
  }
  // --- End Loading State --- 

  // Main return
  return (
    <WorkoutListErrorBoundary>
      <div>
        {error && errorContent}
        
        {/* Workout Stats - Enhanced for better visibility */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Total Workouts */} 
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Workouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workoutStats.totalWorkouts}</div>
            </CardContent>
          </Card>
          {/* Total Time */} 
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Time</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Calculate total hours and display in the new format */}
              <div className="text-2xl font-bold">
                {`over ${Math.floor(workoutStats.totalSeconds / 3600)} hours`}
              </div>
            </CardContent>
          </Card>
          {/* Total Distance (Running/Cycling) */} 
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Distance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(workoutStats.totalDistance)} km</div>
              <p className="text-xs text-muted-foreground">(Running/Cycling)</p>
            </CardContent>
          </Card>
          {/* Favorite Type */} 
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Favorite Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workoutStats.favoriteType}</div>
            </CardContent>
          </Card>
          
          {/* --- NEW Exercise PR Cards --- START */} 
          {loadingPRs ? (
            <Card className="border-border/50"><CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center">Loading PRs...</p></CardContent></Card>
          ) : dashboardPRs.length > 0 ? (
            dashboardPRs.map((pr) => (
              <Card key={pr._id} className="border-border/50 hover:border-primary/40 transition-colors duration-150">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={pr.exerciseName}>{pr.exerciseName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {pr.workoutId ? (
                    <Link href={`/workouts/${pr.workoutId}`} className="block group">
                      <div className="text-xl sm:text-2xl font-bold group-hover:text-primary transition-colors">
                        {pr.value} <span className="text-lg">{pr.unit}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        on {formatDate(pr.date)}
                        <ChevronRight className="inline-block h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </p>
                    </Link>
                  ) : (
                    // Render without link if no workoutId
                    <>
                      <div className="text-xl sm:text-2xl font-bold">
                        {pr.value} <span className="text-lg">{pr.unit}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        on {formatDate(pr.date)}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/50"><CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center">No PRs found</p></CardContent></Card>
          )}
          {/* --- NEW Exercise PR Cards --- END */} 

        </div>
        
        {/* Results info and compact filters */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">
            Showing {filteredWorkouts.length} of {workouts.length} workouts
          </span>
          
          <div className="flex gap-2 items-center">
            {/* Type Quick Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {workoutTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name/notes..."
                className="pl-9 h-9 w-[150px] sm:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Reset filters */}
            {filtersActive && (
              <Button variant="ghost" onClick={resetFilters} size="icon" className="h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Workouts Table */}
        <div className="grid grid-cols-1 gap-4">
          {filteredWorkouts.length > 0 ? (
            filteredWorkouts.map((workout) => {
              const typeStyle = getWorkoutTypeStyle(workout.type);
              const volume = getWorkoutVolume(workout);
              return (
                <Link href={`/workouts/${workout._id}`} key={workout._id} className="block group">
                  <Card className="hover:border-primary/40 transition-colors duration-150 border-border/50">
                    <CardContent className="p-4 flex justify-between items-center">
                      {/* Left Side: Date & Type */} 
                      <div className="flex items-center gap-3">
                         <Badge variant="outline" className={`flex items-center gap-1.5 px-2 py-1 text-xs h-7 ${typeStyle.colorClasses}`}>
                           {typeStyle.icon}
                           <span className="font-medium">
                             {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                           </span>
                         </Badge>
                         <div>
                           <div className="font-medium text-sm group-hover:text-primary transition-colors">
                             {workout.name || `${workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} Workout`}
                           </div>
                           <div className="text-xs text-muted-foreground">
                             {formatDate(new Date(workout.date))}
                           </div>
                         </div>
                      </div>
                      
                      {/* Right Side: Metrics & Arrow */}
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col items-end text-xs">
                           <div className="flex items-center gap-1">
                             <Clock className="h-3 w-3 text-muted-foreground" /> 
                             {formatDuration(workout.duration)}
                           </div>
                           {volume.value > 0 && (
                             <div className="flex items-center gap-1 mt-0.5">
                               {volume.unit === 'km' ? <Ruler className="h-3 w-3 text-muted-foreground"/> : <Dumbbell className="h-3 w-3 text-muted-foreground" />}
                               {volume.value.toFixed(volume.unit === 'km' ? 1 : 0)} {volume.unit}
                             </div>
                           )}
                         </div>
                         <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No workouts found matching your criteria.</p>
              {filtersActive && (
                <Button variant="link" onClick={resetFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </WorkoutListErrorBoundary>
  )
} 