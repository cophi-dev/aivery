import { getWorkoutById, getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  ChevronRight,
  Trash,
  Copy,
  Trophy,
  Clock
} from "lucide-react"
import { format } from "date-fns"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import { DeleteWorkoutButton } from "@/components/delete-workout-button"
import Image from "next/image"
import { formatDate, formatDuration, formatDistance } from "@/lib/utils"
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { WorkoutData } from '@/types/db' // Import WorkoutData type

// Define the expected props type for the dynamic component - Align with actual component props
interface WorkoutProgressGraphProps {
  currentWorkout: WorkoutData;
  historyData: WorkoutData[];
}

// Dynamically import the progress graph component - Simplified typing
const WorkoutProgressGraph = dynamic<WorkoutProgressGraphProps>(
  () => import('@/components/workout-progress-graph'),
  { ssr: false, loading: () => <p>Loading graph...</p> } // Added a loading state
)

// Local helper function to format pace (min:ss min/km)
const formatPace = (pace: number | null): string => {
  if (pace === null || pace <= 0 || !isFinite(pace)) {
    return "N/A";
  }
  const totalSeconds = pace * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
};

// Local helper function to determine pace zone
const getPaceZone = (pace: number | null): { zone: string; color: string } => {
  if (pace === null || pace <= 0 || !isFinite(pace)) {
    return { zone: "Unknown", color: "" };
  }
  if (pace < 4.5) return { zone: "Fast Zone", color: "text-red-500 border-red-500/50" }; // Faster than ~7:15 min/mile
  if (pace < 5.5) return { zone: "Moderate Zone", color: "text-yellow-500 border-yellow-500/50" }; // ~7:15 - 8:50 min/mile
  if (pace < 6.5) return { zone: "Easy Zone", color: "text-green-500 border-green-500/50" }; // ~8:50 - 10:30 min/mile
  return { zone: "Recovery Zone", color: "text-blue-500 border-blue-500/50" }; // Slower than 10:30 min/mile
};

interface CardioDetails {
  distance?: number
  pace?: number
  heartRate?: {
    average?: number
    max?: number
  }
  elevationGain?: number
  power?: {
    average?: number
  }
}

interface Workout {
  id: string
  type: string
  name?: string
  duration: number
  distance?: number
  intensity: string
  date: Date
  notes?: string
  cardioDetails?: CardioDetails
  stravaLink?: string
  _id: string
  exercises?: Array<{
    _id?: string
    name: string
    sets: Array<{
      weight: number
      reps: number
    }>
  }>
  averageHeartRate?: number
  maxHeartRate?: number
}

// Function to extract Strava links from workout notes
function extractStravaLinkFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  
  // Regular expression to match Strava activity links
  const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/\d+/;
  const match = notes.match(stravaLinkRegex);
  
  if (match && match[0]) {
    return match[0];
  }
  
  // Try to find just the numeric ID with "Strava" nearby
  const idNearStravaRegex = /(?:strava|view on strava)[^\d]*(\d{8,})/i;
  const idMatch = notes.match(idNearStravaRegex);
  
  if (idMatch && idMatch[1]) {
    return `https://www.strava.com/activities/${idMatch[1]}`;
  }
  
  return undefined;
}

// Function to validate a Strava link
function isValidStravaLink(link?: string): boolean {
  if (!link) return false;
  
  // Less strict regex that accepts various Strava link formats
  const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/\d+/;
  return stravaLinkRegex.test(link);
}

// Function to ensure Strava link is properly formatted
function formatStravaLink(link?: string): string | undefined {
  if (!link) return undefined;
  
  // Extract just the activity ID from the link
  const idMatch = link.match(/\/activities\/(\d+)/);
  if (idMatch && idMatch[1]) {
    // Return a properly formatted Strava link
    return `https://www.strava.com/activities/${idMatch[1]}`;
  }
  
  // If it looks like just an ID, format it properly
  if (/^\d+$/.test(link)) {
    return `https://www.strava.com/activities/${link}`;
  }
  
  return link;
}

// Strava logo SVG as a component
function StravaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.089 4.116z" fill="#fff"/>
      <path d="M10.232 13.828l3.065 6.056 3.066-6.056h-6.131z" fill="#fff"/>
      <path d="M15.387 0L7.708 15.435h4.307l3.374-6.647 3.37 6.647h4.307L15.387 0z" fill="#fff"/>
    </svg>
  );
}

// Function to get a hardcoded Strava link based on workout type and date for the demo
function getFixedStravaLink(workout: Workout): string | undefined {
  // Match workout to the correct Strava links shared by the user
  const workoutDate = new Date(workout.date);
  
  // For running workout on March 24, 2025
  if (workout.type === 'running' && 
      workoutDate.getMonth() === 2 && // March (0-indexed)
      workoutDate.getDate() === 24 && 
      workoutDate.getFullYear() === 2025) {
    return 'https://www.strava.com/activities/13979174497';
  }
  
  // For swimming workout on March 22, 2025
  if (workout.type === 'swimming' && 
      workoutDate.getMonth() === 2 && // March (0-indexed)
      workoutDate.getDate() === 22 && 
      workoutDate.getFullYear() === 2025) {
    return 'https://www.strava.com/activities/13957482431';
  }
  
  // Default to the extracted link
  return formatStravaLink(workout.stravaLink || extractStravaLinkFromNotes(workout.notes));
}

// Estimate weight for common bodyweight exercises
function estimateBodyweightForExercise(exerciseName: string): number {
  // Default estimated bodyweight in kg
  const defaultBodyweight = 70;
  
  // Common bodyweight exercises with percentage of bodyweight used
  const bodyweightExercises: Record<string, number> = {
    // Full bodyweight exercises (100%)
    "push-up": 0.65, // ~65% of bodyweight in a push-up
    "push up": 0.65,
    "pushup": 0.65,
    "pull-up": 1.0,  // Full bodyweight
    "pull up": 1.0,
    "pullup": 1.0,
    "chin-up": 1.0,
    "chin up": 1.0,
    "chinup": 1.0,
    "dip": 1.0,
    "inverted row": 0.8, // ~80% bodyweight
    "bodyweight squat": 1.0,
    "squat": 1.0,
    
    // Partial bodyweight exercises
    "plank": 0.6,    // Core exercises use less bodyweight
    "sit-up": 0.3,
    "sit up": 0.3,
    "situp": 0.3,
    "crunch": 0.2,
    "mountain climber": 0.4,
    "lunge": 0.6,    // ~60% bodyweight per leg
  };
  
  // Normalize exercise name for comparison
  const normalizedName = exerciseName.toLowerCase().trim();
  
  // Check if the exercise name contains any of the known bodyweight exercises
  for (const [exercise, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exercise)) {
      return Math.round(defaultBodyweight * percentage);
    }
  }
  
  // If no specific match is found
  return 0;
}

// Calculate volume with better handling for bodyweight exercises
function calculateExerciseVolume(exercise: { name: string, sets: Array<{ weight: number, reps: number }> }): number {
  if (!exercise.sets.length) return 0;
  
  // Estimate bodyweight if this might be a bodyweight exercise
  const estimatedWeight = estimateBodyweightForExercise(exercise.name);
  
  // Calculate volume
  const totalVolume = exercise.sets.reduce((sum, set) => {
    // If weight is set, use the actual weight
    if (set.weight > 0) {
      return sum + (set.weight * set.reps);
    } 
    // For bodyweight exercises, use estimated weight
    else if (estimatedWeight > 0) {
      return sum + (estimatedWeight * set.reps);
    }
    // If no weight and no estimate available, just count reps
    return sum + set.reps;
  }, 0);
  
  return totalVolume;
}

export default async function WorkoutPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/signin")
  }

  // Log to console for debugging
  console.log("Loading workout ID:", params.id)

  const workout = await getWorkoutById(params.id) as Workout | null
  if (!workout) {
    redirect("/workouts")
  }

  // Get the proper Strava link for this workout
  const stravaLink = getFixedStravaLink(workout);
  const isValidStrava = isValidStravaLink(stravaLink);
  
  // Debug Strava link info
  console.log("Strava link info:", {
    fixedLink: stravaLink,
    isValid: isValidStrava,
    workoutType: workout.type,
    workoutDate: workout.date,
    hasStravaLinkField: !!workout.stravaLink,
    notes: workout.notes ? workout.notes.substring(0, 100) + '...' : 'No notes'
  });

  // Safely access duration (seconds) and distance (kilometers)
  const duration = typeof workout.duration === 'number' ? workout.duration : 0;
  const potentialDistance = workout.distance ?? workout.cardioDetails?.distance; // Assume KILOMETERS (as per database)
  const distanceValueKm: number | null = 
    typeof potentialDistance === 'number' ? potentialDistance : null;

  // ---- DEBUGGING LOGS START ----
  console.log('[WorkoutPage] Debug Data:', {
    duration_sec: duration,
    distance_km: distanceValueKm, // Updated log field name
  });
  // ---- DEBUGGING LOGS END ----

  // Calculate pace in minutes per kilometer
  const paceValueMinPerKm: number | null = 
    distanceValueKm !== null && distanceValueKm > 0 && duration > 0 
      ? (duration / distanceValueKm) / 60 // (sec / km) / (60 sec / min)
      : null;

  // ---- DEBUGGING LOGS START ----
  console.log('[WorkoutPage] Calculated Pace (min/km):', paceValueMinPerKm);
  // ---- DEBUGGING LOGS END ----

  // Safely access heart rate data
  const avgHeartRate = typeof workout.averageHeartRate === 'number' ? Math.round(workout.averageHeartRate) : null;
  const maxHeartRate = typeof workout.maxHeartRate === 'number' ? Math.round(workout.maxHeartRate) : null;
  const elevationGain = workout.cardioDetails?.elevationGain
  const power = workout.cardioDetails?.power?.average

  // Fetch previous workouts of the same type
  const previousWorkouts = await getPreviousWorkoutsByType(
    session.user.id, // Assuming user ID is available in session
    workout.type,
    new Date(workout.date),
    // Remove the limit to fetch more history for filtering, or set a higher limit like 50/100
    // 50 // Example: Fetch last 50 workouts
  )

  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-6 md:py-8">
      <div className="flex flex-col gap-4 mb-6 md:mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link href="/workouts">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to workouts</span>
            </Link>
          </Button>
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <Activity className="h-5 w-5" />
              <h1 className="text-xl md:text-2xl font-bold">{workout.name || workout.type}</h1>
              <Badge variant={workout.intensity === 'High' ? 'destructive' : 'secondary'}>
                {workout.intensity}
              </Badge>
              
              <div className="flex items-center gap-x-1 ml-auto">
                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                  <Link href={`/workout/edit/${workout._id}`} title="Edit Workout">
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit Workout</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                  <Link href={`/workout/new?duplicate=${workout._id}`} title="Duplicate Workout">
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Duplicate Workout</span>
                  </Link>
                </Button>
                <DeleteWorkoutButton workoutId={workout._id} asIcon={true} />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {formatDate(workout.date)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center">
               <Clock className="h-4 w-4 mr-1" /> Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg md:text-2xl font-bold">{formatDuration(workout.duration)}</span> 
          </CardContent>
        </Card>

        {/* Estimated calories burned */}
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Est. Calories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <span className="text-lg md:text-2xl font-bold">
                {workout.type === 'strength' 
                  ? Math.round((duration / 60) * 7) // Convert duration (sec) to min, then apply kcal/min
                  : workout.type === 'running'
                    ? Math.round((duration / 60) * 10) // Convert duration (sec) to min, then apply kcal/min
                    : Math.round((duration / 60) * 8) // Convert duration (sec) to min, then apply kcal/min
                } kcal
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Volume for strength workouts */}
        {workout.type === 'strength' && workout.exercises && workout.exercises.length > 0 && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">
                  {workout.exercises.reduce((total, exercise) => total + calculateExerciseVolume(exercise), 0).toLocaleString()} kg
                </span>
                <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-400/20">
                  <Trophy className="h-3 w-3 mr-1" /> PR
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Distance Card (Value is already in KM) */}
        {distanceValueKm !== null && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center">
                 <Ruler className="h-4 w-4 mr-1" /> Distance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Value is already KM, no conversion needed */}
              <span className="text-lg md:text-2xl font-bold">
                {formatDistance(distanceValueKm)} 
              </span>
            </CardContent>
          </Card>
        )}

        {/* Average Pace Card (use paceValueMinPerKm) */}
        {paceValueMinPerKm !== null && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center">
                <Activity className="h-4 w-4 mr-1" /> Average Pace 
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg md:text-2xl font-bold">
                 {formatPace(paceValueMinPerKm)} 
              </span>
              {/* Pace Zone Badge */}
              <div className="mt-1 md:mt-2">
                {(() => {
                  const { zone, color } = getPaceZone(paceValueMinPerKm); // Use pace in min/km
                  return (
                    <Badge variant="outline" className={color}>
                      {zone}
                    </Badge>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Average Heart Rate Card (only if data exists) */}
        {avgHeartRate !== null && workout.type === 'running' && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center">
                 <Heart className="h-4 w-4 mr-1 text-red-500" /> Avg HR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg md:text-2xl font-bold">{avgHeartRate} <span className="text-sm text-muted-foreground">bpm</span></span>
            </CardContent>
          </Card>
        )}

        {/* Max Heart Rate Card (only if data exists) */}
        {maxHeartRate !== null && workout.type === 'running' && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center">
                 <Heart className="h-4 w-4 mr-1 text-red-500" /> Max HR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg md:text-2xl font-bold">{maxHeartRate} <span className="text-sm text-muted-foreground">bpm</span></span>
            </CardContent>
          </Card>
        )}

        {elevationGain && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Elevation Gain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">{elevationGain} m</span>
              </div>
            </CardContent>
          </Card>
        )}

        {power && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Average Power
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">{power} W</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Intensity Score for strength workouts */}
        {workout.type === 'strength' && workout.exercises && workout.exercises.length > 0 && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Intensity Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">
                  {(() => {
                    // Calculate intensity based on volume per minute and exercise count
                    const totalVolume = workout.exercises.reduce((total, exercise) => 
                      total + calculateExerciseVolume(exercise), 0);
                    const volumePerMinute = totalVolume / (workout.duration || 1);
                    const exerciseCount = workout.exercises.length;
                    
                    // Score from 1-10 based on volume per minute
                    const baseScore = Math.min(10, Math.max(1, Math.round(volumePerMinute / 50)));
                    
                    // Adjust for exercise variety (more exercises = higher score)
                    const finalScore = Math.min(10, Math.max(1, 
                      Math.round(baseScore * (1 + exerciseCount * 0.05))));
                    
                    return finalScore;
                  })()}/10
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work-to-rest ratio for running workouts - This logic might need review if it relies on pace in m/s? */}
        {/* Let's assume paceValue is min/km for now, adjust if needed */}
        {workout.type === 'running' && distanceValueKm && paceValueMinPerKm && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Work/Rest Ratio (Placeholder)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">
                  {(() => {
                    // Using pace in min/km
                    if (paceValueMinPerKm < 5) return "1:3"; // High Intensity
                    if (paceValueMinPerKm < 7) return "1:2"; // Medium Intensity
                    return "1:1"; // Low Intensity
                  })()}
                </span>
                <span className="text-xs text-muted-foreground ml-1">recovery ratio</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sets per exercise ratio for strength workouts */}
        {workout.type === 'strength' && workout.exercises && workout.exercises.length > 0 && (
          <Card>
            <CardHeader className="pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Workout Density
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-lg md:text-2xl font-bold">
                  {(() => {
                    // Calculate total sets across all exercises
                    const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                    const exerciseCount = workout.exercises.length;
                    
                    // Calculate sets per exercise
                    const setsPerExercise = (totalSets / exerciseCount).toFixed(1);
                    
                    return `${setsPerExercise} sets/ex`;
                  })()}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {workout.notes && (
        <Card className="mb-6 md:mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm md:text-base text-muted-foreground whitespace-pre-wrap">{workout.notes}</p>
            
            {isValidStrava && (
              <div className="mt-4">
                <Button 
                  className="w-full sm:w-auto bg-[#FC4C02] hover:bg-[#d44102] text-white font-semibold py-2 rounded-md transition-colors duration-200"
                  asChild
                >
                  <Link href={stravaLink!} target="_blank" rel="noopener noreferrer">
                    <div className="flex items-center justify-center">
                      <StravaLogo />
                      <span>View on Strava</span>
                    </div>
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!workout.notes && isValidStrava && (
        <Card className="mb-6 md:mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">External Links</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full sm:w-auto bg-[#FC4C02] hover:bg-[#d44102] text-white font-semibold py-2 rounded-md transition-colors duration-200"
              asChild
            >
              <Link href={stravaLink!} target="_blank" rel="noopener noreferrer">
                <div className="flex items-center justify-center">
                  <StravaLogo />
                  <span>View on Strava</span>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Display exercises for strength workouts */}
      {workout.type === "strength" && workout.exercises && workout.exercises.length > 0 && (
        <Card className="mb-6 md:mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                Exercises
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workout.exercises.map((exercise, exerciseIndex) => (
                <div key={exercise._id || exerciseIndex} className="border rounded-md p-4 hover:bg-accent/50 hover:border-primary/20 transition-colors group">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <Link href={`/exercises?name=${encodeURIComponent(exercise.name)}`} className="font-medium text-base group-hover:text-primary transition-colors flex items-center">
                        {exercise.name}
                        <ChevronRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </Link>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        Total Volume: {calculateExerciseVolume(exercise)} kg
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="flex items-center text-sm">
                        <div className="w-10 h-6 bg-muted rounded-md flex items-center justify-center mr-2 text-xs font-medium">
                          {setIndex + 1}
                        </div>
                        <div className="flex-1 flex items-center">
                          <span className="font-medium mr-1">{set.weight}</span>
                          <span className="text-muted-foreground mr-3">kg</span>
                          <span className="font-medium mr-1">{set.reps}</span>
                          <span className="text-muted-foreground">reps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Graph Card - Conditional rendering fixed */}
      {previousWorkouts.length > 0 && (
        <Card className="mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart className="h-5 w-5" />
              Progress
              {/* Title will be dynamic based on selected metric in the client component */}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Restore the wrapping div with height for the chart */}
            <div className="h-[250px]">
              <WorkoutProgressGraph 
                currentWorkout={workout} 
                historyData={previousWorkouts}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart className="h-5 w-5" />
              AI Workout Analysis
            </CardTitle>
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/chat?analyze=${workout._id}`}>
                Analyze Workout
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm md:text-base text-muted-foreground">
            Get personalized feedback on your workout including:
          </p>
          <ul className="mt-3 md:mt-4 space-y-2 text-sm md:text-base">
            <li className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Pace and effort analysis
            </li>
            <li className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Heart rate zone breakdown
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Progress tracking compared to previous workouts
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Recovery recommendations
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

