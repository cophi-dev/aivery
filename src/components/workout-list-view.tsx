"use client"

import React, { useState, useEffect, ErrorInfo } from "react"
import Link from "next/link"
import { format, parseISO, isAfter, isBefore, isEqual } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Info
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { WorkoutData } from "@/types/db"

// Define types for sorting
type SortField = "date" | "name" | "type" | "intensity" | "duration" | "volume";
type SortDirection = "asc" | "desc";

// Explicitly define WorkoutStats interface
interface WorkoutStats {
  totalWorkouts: number;
  totalMinutes: number;
  totalDistance: number;
  totalVolume: number;
  favoriteType: string;
}

interface WorkoutListViewProps {
  initialWorkouts: WorkoutData[]
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

export default function WorkoutListView({ initialWorkouts }: WorkoutListViewProps) {
  // Initialize all state hooks at the top level
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showStatsView, setShowStatsView] = useState<boolean>(true);
  
  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [intensityFilter, setIntensityFilter] = useState<string>("all")
  const [startDateString, setStartDateString] = useState<string>("")
  const [endDateString, setEndDateString] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  
  // Initialize data safely
  useEffect(() => {
    try {
      // Make sure we have valid workouts data
      const validWorkouts = Array.isArray(initialWorkouts) ? initialWorkouts : [];
      
      // Sanitize the workout data by removing problematic fields or converting as needed
      const sanitizedWorkouts = validWorkouts.map(workout => {
        try {
          // Create a clean copy to work with
          const cleanWorkout = { ...workout };
          
          // Clean the _id field
          if (cleanWorkout._id && typeof cleanWorkout._id === 'object') {
            cleanWorkout._id = String(cleanWorkout._id);
          }
          
          // Clean userId field
          if (cleanWorkout.userId && typeof cleanWorkout.userId === 'object') {
            cleanWorkout.userId = String(cleanWorkout.userId);
          }
          
          // Ensure date is properly formatted
          if (cleanWorkout.date && !(cleanWorkout.date instanceof Date)) {
            try {
              cleanWorkout.date = new Date(cleanWorkout.date);
            } catch (e) {
              cleanWorkout.date = new Date();
            }
          }
          
          // Clean cardioDetails - this is where buffer objects are often found
          if (cleanWorkout.cardioDetails && typeof cleanWorkout.cardioDetails === 'object') {
            try {
              // Detect and remove _id fields with buffer objects
              const cardioDetails = { ...cleanWorkout.cardioDetails };
              
              // Remove _id from cardioDetails - use type assertion
              const cardioDetailsAny = cardioDetails as any;
              if (cardioDetailsAny._id) {
                delete cardioDetailsAny._id;
              }
              
              // Clean the heart rate data
              if (cardioDetails.heartRate && typeof cardioDetails.heartRate === 'object') {
                const heartRate = { ...cardioDetails.heartRate };
                
                // Remove _id from heart rate - use type assertion
                const heartRateAny = heartRate as any;
                if (heartRateAny._id) {
                  delete heartRateAny._id;
                }
                
                // Clean heart rate zones
                if (heartRate.zones && typeof heartRate.zones === 'object') {
                  const zones = { ...heartRate.zones };
                  // Use type assertion to handle _id field
                  const zonesAny = zones as any;
                  if (zonesAny._id) {
                    delete zonesAny._id;
                  }
                  heartRate.zones = zones;
                }
                
                cardioDetails.heartRate = heartRate;
              }
              
              // Clean the laps data
              if (Array.isArray(cardioDetails.laps)) {
                cardioDetails.laps = cardioDetails.laps.map((lap: any) => {
                  if (lap && typeof lap === 'object') {
                    const cleanLap = { ...lap };
                    delete cleanLap._id;
                    return cleanLap;
                  }
                  return lap;
                });
              }
              
              cleanWorkout.cardioDetails = cardioDetails;
            } catch (e) {
              console.error("Error cleaning cardioDetails:", e);
              // If there was an error, remove the entire cardioDetails object
              cleanWorkout.cardioDetails = { 
                distance: cleanWorkout.cardioDetails.distance,
                duration: cleanWorkout.cardioDetails.duration
              };
            }
          }
          
          // Return the clean workout
          return cleanWorkout as WorkoutData;
        } catch (err) {
          console.error("Error sanitizing workout:", err);
          // Return a minimal workout object if there's an error
          return {
            _id: workout._id?.toString() || String(Date.now()),
            name: workout.name || "Workout",
            type: workout.type || "unknown",
            date: new Date(),
            duration: workout.duration || 0,
            intensity: workout.intensity || "Unknown",
            userId: workout.userId?.toString() || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as WorkoutData;
        }
      });
      
      setWorkouts(sanitizedWorkouts);
      setFilteredWorkouts(sanitizedWorkouts);
    } catch (err) {
      console.error("Error initializing workout data:", err);
      setError("Failed to load workout data. Please try refreshing the page.");
      // Don't return early - still need to let the component render
    }
  }, [initialWorkouts]);
  
  // Get unique workout types for filter options safely
  const workoutTypes = Array.from(new Set(workouts.filter(w => w?.type).map(w => w.type)))
  
  // Parse date strings to Date objects
  const startDate = startDateString ? new Date(startDateString) : undefined
  const endDate = endDateString ? new Date(endDateString) : undefined
  
  // Apply filters
  useEffect(() => {
    try {
      let result = [...workouts]
      
      // Filter by type
      if (typeFilter !== "all") {
        result = result.filter(workout => workout.type === typeFilter)
      }
      
      // Filter by intensity
      if (intensityFilter !== "all") {
        result = result.filter(workout => workout.intensity === intensityFilter)
      }
      
      // Filter by date range
      if (startDate) {
        result = result.filter(workout => {
          try {
            const workoutDate = new Date(workout.date)
            return isAfter(workoutDate, startDate) || isEqual(workoutDate, startDate)
          } catch (e) {
            return true; // Include if date parsing fails
          }
        })
      }
      
      if (endDate) {
        result = result.filter(workout => {
          try {
            const workoutDate = new Date(workout.date)
            return isBefore(workoutDate, endDate) || isEqual(workoutDate, endDate)
          } catch (e) {
            return true; // Include if date parsing fails
          }
        })
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        result = result.filter(workout => 
          (workout.name && workout.name.toLowerCase().includes(query)) ||
          (workout.type && workout.type.toLowerCase().includes(query)) ||
          (workout.notes && workout.notes.toLowerCase().includes(query))
        )
      }
      
      // Apply sorting
      result.sort((a, b) => {
        try {
          if (sortField === "date") {
            return sortDirection === "asc" 
              ? new Date(a.date).getTime() - new Date(b.date).getTime()
              : new Date(b.date).getTime() - new Date(a.date).getTime()
          }
          
          if (sortField === "duration") {
            return sortDirection === "asc" 
              ? (a.duration || 0) - (b.duration || 0)
              : (b.duration || 0) - (a.duration || 0)
          }
          
          if (sortField === "volume") {
            const volA = getWorkoutVolume(a).value;
            const volB = getWorkoutVolume(b).value;
            return sortDirection === "asc" 
              ? volA - volB
              : volB - volA;
          }
          
          // String-based sorting (name, type, intensity)
          const aValue = String(a[sortField] || "").toLowerCase()
          const bValue = String(b[sortField] || "").toLowerCase()
          
          return sortDirection === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        } catch (e) {
          return 0; // Return 0 if comparison fails
        }
      })
      
      setFilteredWorkouts(result)
    } catch (err) {
      console.error("Error filtering workouts:", err);
      // Don't return early or set filtered workouts to empty here
      // This could cause hook order issues if we conditionally return early
      setError("Failed to filter workout data. Please try refreshing the page.");
    }
  }, [workouts, typeFilter, intensityFilter, startDate, endDate, searchQuery, sortField, sortDirection]);
  
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
  const formatDate = (date: Date) => {
    try {
      return format(new Date(date), "MMM d, yyyy")
    } catch (e) {
      return "Unknown date"
    }
  }
  
  // Get badge color based on intensity
  const getIntensityColor = (intensity: string | undefined) => {
    switch (intensity) {
      case "High":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      case "Medium":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
      case "Low":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
    }
  }
  
  // Get icon based on workout type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "running":
        return <Activity className="h-4 w-4" />
      case "cycling":
        return <Activity className="h-4 w-4" />
      case "swimming":
        return <Activity className="h-4 w-4" />
      case "strength":
        return <Dumbbell className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }
  
  // Get workout distance safely
  const getWorkoutDistance = (workout: WorkoutData): number => {
    try {
      if (typeof workout.distance === 'number') {
        return workout.distance;
      }
      if (workout.cardioDetails?.distance !== undefined) {
        return workout.cardioDetails.distance;
      }
    } catch (e) {
      console.error("Error getting workout distance:", e);
    }
    return 0;
  }

  // Get workout volume based on type
  const getWorkoutVolume = (workout: WorkoutData): { value: number, unit: string } => {
    try {
      if (workout.type.toLowerCase() === "running" || workout.type.toLowerCase() === "run") {
        // For runs, return distance in km
        return { 
          value: getWorkoutDistance(workout), 
          unit: "km" 
        };
      } else if (workout.type.toLowerCase() === "strength") {
        // For strength, return total volume (weight * reps across all exercises)
        if (workout.volume !== undefined) {
          return { value: workout.volume, unit: "kg" };
        }
        
        // Calculate volume if not stored directly
        let totalVolume = 0;
        if (workout.exercises && workout.exercises.length > 0) {
          workout.exercises.forEach(exercise => {
            exercise.sets.forEach(set => {
              totalVolume += set.weight * set.reps;
            });
          });
        }
        return { value: totalVolume, unit: "kg" };
      }
      
      // Default return for other workout types
      return { value: 0, unit: "" };
    } catch (e) {
      console.error("Error calculating workout volume:", e);
      return { value: 0, unit: "" };
    }
  };

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
    if (workout.type.toLowerCase() === "strength" && workout.exercises && workout.exercises.length > 0) {
      const exercisesList = workout.exercises.map(ex => {
        const setsInfo = ex.sets.map(set => `${set.weight}kg x ${set.reps}`).join(", ");
        return `${ex.name}: ${setsInfo}`;
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
  const workoutStats = React.useMemo(() => {
    // Ensure we always return a valid stats object
    const emptyStats: WorkoutStats = {
      totalWorkouts: 0,
      totalMinutes: 0,
      totalDistance: 0,
      totalVolume: 0,
      favoriteType: 'None'
    };
    
    // Skip calculations if we don't have workouts
    if (!workouts || workouts.length === 0) {
      return emptyStats;
    }

    try {
      // Calculate total workout time
      const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
      
      // Calculate total distance for cardio workouts
      const totalDistance = workouts.reduce((sum, w) => {
        if (w.type && (w.type.toLowerCase() === "running" || w.type.toLowerCase() === "cycling")) {
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
        totalMinutes,
        totalDistance,
        totalVolume,
        favoriteType: favoriteType.charAt(0).toUpperCase() + favoriteType.slice(1)
      };
    } catch (err) {
      console.error("Error calculating workout stats:", err);
      return emptyStats;
    }
  }, [workouts]);
  
  // Always render the full component structure, conditionally show error content if needed
  return (
    <WorkoutListErrorBoundary>
      <div>
        {error && errorContent}
        
        {/* Workout Stats - Enhanced for better visibility */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 w-full border-b pb-4">
          <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center justify-center shadow-sm border border-muted">
            <span className="text-sm text-muted-foreground">Total Workouts</span>
            <span className="text-3xl font-bold">{workoutStats.totalWorkouts}</span>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center justify-center shadow-sm border border-muted">
            <span className="text-sm text-muted-foreground">Total Time</span>
            <span className="text-3xl font-bold">{workoutStats.totalMinutes} <span className="text-sm">min</span></span>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center justify-center shadow-sm border border-muted">
            <span className="text-sm text-muted-foreground">Total Distance</span>
            <span className="text-3xl font-bold">{workoutStats.totalDistance.toFixed(1)} <span className="text-sm">km</span></span>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center justify-center shadow-sm border border-muted">
            <span className="text-sm text-muted-foreground">Favorite Type</span>
            <span className="text-3xl font-bold">{workoutStats.favoriteType}</span>
          </div>
        </div>
        
        {/* Results info and compact filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {filteredWorkouts.length} of {workouts.length} workouts
            {filtersActive && " (filtered)"}
          </span>
          
          <div className="flex flex-wrap gap-2 items-center">
            {/* Type Quick Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="type-filter-compact" className="h-8 text-xs w-[130px]">
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
            <div className="relative w-[180px]">
              <Search className="absolute left-2 top-1.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-query-compact"
                placeholder="Search..."
                className="pl-8 h-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Reset filters */}
            {filtersActive && (
              <Button 
                variant="ghost" 
                onClick={resetFilters}
                className="h-8 px-2 text-xs"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        
        {/* Workouts Table */}
        <div className="rounded-md border overflow-hidden">
          <div className="bg-muted">
            <div className="grid grid-cols-9 gap-2 p-4 text-xs font-medium text-muted-foreground">
              <div 
                className="col-span-3 flex items-center cursor-pointer"
                onClick={() => handleSort("date")}
              >
                Date
                <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "date" ? "opacity-100" : "opacity-50"}`} />
              </div>
              <div 
                className="col-span-3 flex items-center cursor-pointer"
                onClick={() => handleSort("type")}
              >
                Type
                <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "type" ? "opacity-100" : "opacity-50"}`} />
              </div>
              <div 
                className="col-span-2 flex items-center cursor-pointer"
                onClick={() => handleSort("volume")}
              >
                Volume
                <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === "volume" ? "opacity-100" : "opacity-50"}`} />
              </div>
              <div className="col-span-1"></div>
            </div>
          </div>
          
          <div className="divide-y">
            {filteredWorkouts.length > 0 ? (
              filteredWorkouts.map((workout) => {
                const volume = getWorkoutVolume(workout);
                return (
                <Link 
                  href={`/workout/${workout._id}`}
                  key={typeof workout._id === 'string' ? workout._id : String(workout._id)} 
                  className="grid grid-cols-9 gap-2 p-4 items-center hover:bg-muted/50 transition-colors duration-150 cursor-pointer group shadow-sm hover:shadow-md"
                >
                  <div className="col-span-3 flex flex-col">
                    <div className="font-medium">{formatDate(new Date(workout.date))}</div>
                  </div>
                  <div className="col-span-3">
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {getTypeIcon(workout.type)}
                      {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    {volume.value > 0 && (
                      <div className="text-sm">
                        {volume.value.toFixed(1)} {volume.unit}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )})
            ) : (
              <div className="py-8 text-center">
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
      </div>
    </WorkoutListErrorBoundary>
  )
} 