"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LucideArrowLeft,
  LucideBrainCircuit,
  LucideCalendarDays,
  LucideChevronDown,
  LucideClock,
  LucideHeartPulse,
  LucidePencil,
  LucideRuler,
  LucideTrash,
  LucideGauge,
  LucideDumbbell,
  LucideActivity,
  LucideBarChart,
  LucideZap,
  LucideTrendingUp,
  LucideTarget,
  LucideAward,
  Flame,
  TrendingUp,
  Calendar,
  Timer,
  Maximize2,
  Share2,
  Eye,
  MoreHorizontal,
  Sparkles,
  Loader2,
  Target,
  BarChart,
  Zap,
  Award,
  Gauge,
  HeartPulse
} from "lucide-react"
import { fetchWorkout, deleteWorkout } from "@/lib/workout-actions"
import { formatDate, formatDuration, formatDistance, formatPace } from "@/lib/utils"
import { WorkoutAnalysis } from "@/components/workout-analysis"
import ReactMarkdown from "react-markdown"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { cn } from "@/lib/utils"
import ShareModal from '@/components/workout/ShareModal'

// Helper function to get icon based on workout type
const getWorkoutIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'strength': return <LucideDumbbell className="h-5 w-5" />;
    case 'running': return <LucideActivity className="h-5 w-5" />;
    case 'cycling': return <LucideActivity className="h-5 w-5" />;
    case 'walking': return <LucideActivity className="h-5 w-5" />;
    case 'cardio': return <LucideHeartPulse className="h-5 w-5" />;
    default: return <LucideActivity className="h-5 w-5" />;
  }
};

// Helper function to get workout type color
const getWorkoutTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'strength': return 'from-orange-500/10 to-red-500/10 border-orange-500/20';
    case 'running': return 'from-blue-500/10 to-cyan-500/10 border-blue-500/20';
    case 'cycling': return 'from-green-500/10 to-emerald-500/10 border-green-500/20';
    case 'cardio': return 'from-purple-500/10 to-pink-500/10 border-purple-500/20';
    default: return 'from-gray-500/10 to-slate-500/10 border-gray-500/20';
  }
};

// Helper function to calculate workout stats
const calculateWorkoutStats = (workout: any) => {
  const stats = {
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    averageWeight: 0,
    maxWeight: 0,
    exerciseCount: 0,
    personalRecords: 0,
    intensityScore: 0
  };

  if (workout.type === 'strength' && workout.workoutExercises) {
    stats.exerciseCount = workout.workoutExercises.length;
    let totalWeightedReps = 0;
    let totalWeight = 0;
    let weightCount = 0;

    workout.workoutExercises.forEach((exercise: any) => {
      if (exercise.sets && exercise.sets.length > 0) {
        exercise.sets.forEach((set: any) => {
          stats.totalSets++;
          const reps = set.reps || 0;
          const weight = set.weight || 0;
          
          stats.totalReps += reps;
          stats.totalVolume += weight * reps;
          
          if (weight > 0) {
            totalWeight += weight;
            weightCount++;
            if (weight > stats.maxWeight) {
              stats.maxWeight = weight;
            }
          }
        });
      }
    });

    if (weightCount > 0) {
      stats.averageWeight = totalWeight / weightCount;
    }

    // Calculate intensity score (0-100)
    if (stats.totalVolume > 0) {
      stats.intensityScore = Math.min(100, Math.round((stats.totalVolume / 100) + (stats.maxWeight / 10)));
    }
  }

  // Check for personal records
  if (workout.records && workout.records.length > 0) {
    stats.personalRecords = workout.records.length;
  }

  return stats;
};

// Sophisticated Hero Section Component
const WorkoutHero = ({ workout, aiHighlight, isLoadingHighlight }: any) => (
  <motion.section 
    className="relative min-h-[60vh] flex items-center justify-center overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.8 }}
  >
    {/* Sophisticated gradient background */}
    <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-muted/30" />
    
    {/* Subtle pattern overlay */}
    <div className="absolute inset-0 opacity-[0.02]" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    }} />

    <div className="relative z-10 container mx-auto px-6 text-center max-w-4xl">
      {/* Workout type badge with sophisticated styling */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <Badge 
          variant="outline" 
          className={cn(
            "px-4 py-2 text-sm font-medium bg-gradient-to-r border-0 shadow-lg",
            getWorkoutTypeColor(workout.type)
          )}
        >
          <span className="flex items-center gap-2">
            {getWorkoutIcon(workout.type)}
            {workout.type?.charAt(0).toUpperCase() + workout.type?.slice(1)} Workout
          </span>
        </Badge>
      </motion.div>

      {/* AI Highlight with sophisticated typography */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        {isLoadingHighlight ? (
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 mr-3 animate-spin" />
            <span className="text-lg">Generating your workout insight...</span>
          </div>
        ) : aiHighlight ? (
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <div className="text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-foreground/90 font-serif italic">
              <ReactMarkdown>{aiHighlight}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-foreground/60 font-serif italic">
            Your workout speaks volumes
          </div>
        )}
      </motion.div>

      {/* Workout title and date */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-4"
      >
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
          {workout.name || "Workout Session"}
        </h1>
        <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
          <Calendar className="h-5 w-5" />
          {formatDate(workout.date)}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-background/80">
          <LucideChevronDown className="h-6 w-6 animate-bounce" />
        </Button>
      </motion.div>
    </div>
  </motion.section>
);

// Sophisticated Stats Grid Component
const StatsGrid = ({ workout, workoutStats, formattedDistance, formattedDuration, formattedPace }: any) => {
  const workoutCategory = workout.type === 'strength' ? 'strength' : 'cardio';
  
  const stats = workoutCategory === 'strength' ? [
    { icon: Target, label: "Exercises", value: workoutStats.exerciseCount },
    { icon: BarChart, label: "Total Sets", value: workoutStats.totalSets },
    { icon: TrendingUp, label: "Total Reps", value: workoutStats.totalReps },
    { icon: Zap, label: "Volume", value: `${workoutStats.totalVolume.toLocaleString()} kg` },
    { icon: Timer, label: "Duration", value: formattedDuration },
    ...(workoutStats.personalRecords > 0 ? [{ icon: Award, label: "New PRs", value: workoutStats.personalRecords, highlight: true }] : [])
  ] : [
    { icon: Maximize2, label: "Distance", value: formattedDistance || 'N/A' },
    { icon: Timer, label: "Duration", value: formattedDuration },
    ...(formattedPace ? [{ icon: Gauge, label: "Pace", value: formattedPace }] : []),
    ...(workout.averageHeartRate ? [{ icon: HeartPulse, label: "Avg HR", value: `${workout.averageHeartRate} bpm` }] : [])
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * index }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-6 text-center group cursor-default",
            stat.highlight 
              ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
              : "bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm border border-border/60 hover:border-border/80"
          )}
        >
          <div className="relative z-10">
            <stat.icon className={cn(
              "h-8 w-8 mx-auto mb-3",
              stat.highlight ? "text-yellow-600" : "text-primary"
            )} />
            <div className={cn(
              "text-2xl font-bold mb-1",
              stat.highlight ? "text-yellow-600" : "text-foreground"
            )}>
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {stat.label}
            </div>
          </div>
          
          {/* Subtle hover effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </motion.div>
      ))}
    </motion.div>
  );
};

// Enhanced Exercise Card Component
const ExerciseCard = ({ exercise, index }: any) => {
  const exerciseSets = exercise.sets || [];
  const exerciseVolume = exerciseSets.reduce((total: number, set: any) => 
    total + ((set.weight || 0) * (set.reps || 0)), 0);
  const exerciseReps = exerciseSets.reduce((total: number, set: any) => 
    total + (set.reps || 0), 0);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-semibold mb-1">
                {exercise.exerciseId?.name || 'Unknown Exercise'}
              </CardTitle>
              <CardDescription className="text-sm">
                {exerciseSets.length} sets • {exerciseReps} reps • {exerciseVolume.toLocaleString()} kg
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0">
              {exercise.exerciseId?.category || 'Exercise'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exerciseSets.map((set: any, setIndex: number) => (
              <div 
                key={set._id || setIndex} 
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Set {setIndex + 1}
                </span>
                <span className="font-semibold">
                  {set.weight || 0}kg × {set.reps || 0}
                </span>
              </div>
            ))}
          </div>
          
          {exercise.notes && (
            <div className="mt-4 p-3 rounded-xl bg-muted/20 border border-border/50">
              <p className="text-sm text-muted-foreground italic">
                <span className="font-medium">Notes:</span> {exercise.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function WorkoutDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workout, setWorkout] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiHighlight, setAiHighlight] = useState<string | null>(null)
  const [isLoadingHighlight, setIsLoadingHighlight] = useState(false)
  const [workoutInsight, setWorkoutInsight] = useState<string | null>(null)
  const [isLoadingInsight, setIsLoadingInsight] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  
  const { id } = params

  // Load workout data and insights
  useEffect(() => {
    let isMounted = true
    
    const loadData = async () => {
      if (!id) {
        setIsLoading(false)
        setError("No workout ID provided")
        return
      }

      setIsLoading(true)
      try {
        const workoutData = await fetchWorkout(id)
        if (!isMounted) return

        if (workoutData) {
          setWorkout(workoutData)
          setError(null)

          // Fetch AI Highlight
          setIsLoadingHighlight(true)
          try {
            const highlightRes = await fetch(`/api/ai/workout-highlight?workoutId=${id}`)
            if (!isMounted) return

            if (highlightRes.ok) {
              const highlightData = await highlightRes.json()
              setAiHighlight(highlightData.highlight || null)
            }
          } catch (error) {
            console.error('Error fetching AI highlight:', error)
          } finally {
             if (isMounted) setIsLoadingHighlight(false)
          }
          
          // Fetch Workout Insight
          setIsLoadingInsight(true)
          try {
            const insightRes = await fetch(`/api/workout-insight/${id}`)
            if (!isMounted) return

            if (insightRes.ok) {
              const insightData = await insightRes.json()
              setWorkoutInsight(insightData.insight || null)
            }
          } catch (error) {
            console.error('Error fetching workout insight:', error)
          } finally {
             if (isMounted) setIsLoadingInsight(false)
          }
        } else {
          setWorkout(null)
          setError("Workout not found. It may have been deleted or you don't have permission to view it.")
        }
      } catch (error) {
        if (!isMounted) return
        console.error("Error fetching workout:", error)
        setWorkout(null)
        setError(error instanceof Error ? error.message : "Failed to load workout data")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (id) { 
        loadData()
    } else {
      setIsLoading(false)
        setError("No workout ID provided")
    }

    return () => {
      isMounted = false
    }
  }, [id])

  // Handle delete
  const handleDelete = async () => {
    if (!workout) return

    if (!confirm("Are you sure you want to delete this workout?")) return

    try {
      setIsDeleting(true)
      await deleteWorkout(workout._id)
      router.push("/workouts")
    } catch (error) {
      console.error("Failed to delete workout:", error)
      setIsDeleting(false)
      alert("Failed to delete workout. Please try again.")
    }
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator />
      </div>
    )
  }

  // Error State
  if (!workout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto px-6"
        >
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <LucideActivity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Workout Not Found</h1>
            <p className="text-muted-foreground">
              {error || "The requested workout could not be loaded."}
            </p>
          </div>
          <Button asChild>
            <Link href="/workouts">
              <LucideArrowLeft className="h-4 w-4 mr-2" />
              Back to Workouts
            </Link>
          </Button>
        </motion.div>
      </div>
    )
  }

  // Calculate workout stats and format data
  const workoutStats = calculateWorkoutStats(workout)
  const formattedDuration = formatDuration(workout.duration)
  
  // Handle distance formatting
  let distanceKm: number | null = null
  if (workout.type !== 'strength') {
    if (workout.cardioDetails?.distance != null && typeof workout.cardioDetails.distance === 'number') {
      distanceKm = workout.cardioDetails.distance
    } else if (workout.workoutExercises && workout.workoutExercises[0]?.distance != null && typeof workout.workoutExercises[0].distance === 'number') {
      distanceKm = workout.workoutExercises[0].distance
    } else if (workout.distance != null && typeof workout.distance === 'number') {
      distanceKm = workout.distance
    }
  }

  const formattedDistance = distanceKm != null && distanceKm >= 0 ? formatDistance(distanceKm) : null
  
  // Calculate pace
  let formattedPace: string | null = null
  if (distanceKm != null && distanceKm > 0 && workout.duration != null && workout.duration > 0) {
    const paceMinPerKm = (workout.duration / 60) / distanceKm
    formattedPace = formatPace(paceMinPerKm)
  } else if (workout.cardioDetails?.pace != null) {
    formattedPace = formatPace(workout.cardioDetails.pace)
  }

  const workoutCategory = workout.type === 'strength' ? 'strength' : 'cardio'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/10">
      {/* Hero Section */}
      <WorkoutHero 
        workout={workout} 
        aiHighlight={aiHighlight} 
        isLoadingHighlight={isLoadingHighlight} 
      />

      {/* Main Content */}
      <div className="relative">
        {/* Floating Action Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-4 z-20 mx-auto max-w-fit"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-xl p-2 mx-4">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.back()}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <LucideArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <div className="h-6 w-px bg-border/60" />
              
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="hover:bg-muted/50"
              >
                  <Link href={`/workouts/${id}/edit`}>
                  <LucidePencil className="h-4 w-4 mr-2" />
                  Edit
                  </Link>
                </Button>
              
                <Button
                variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                className="hover:bg-destructive/10 hover:text-destructive"
                >
                <LucideTrash className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
                </Button>

                <Button
                  onClick={() => setIsShareModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Achievement
                </Button>
              </div>
            </div>
        </motion.div>

        {/* Content Container */}
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          {/* Stats Overview */}
          <div className="mb-12">
            <StatsGrid 
              workout={workout}
              workoutStats={workoutStats}
              formattedDistance={formattedDistance}
              formattedDuration={formattedDuration}
              formattedPace={formattedPace}
            />
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="overview" className="data-[state=active]:bg-background">
                <Eye className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="exercises" className="data-[state=active]:bg-background">
                <LucideDumbbell className="h-4 w-4 mr-2" />
                {workoutCategory === 'strength' ? 'Exercises' : 'Details'}
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-background">
                <Sparkles className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-8 md:grid-cols-2"
              >
                {/* Workout Summary */}
                <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        {getWorkoutIcon(workout.type)}
                        Workout Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {workout.notes || "No notes provided for this workout."}
                    </p>
                  </CardContent>
                </Card>

                {/* Personal Records */}
                {workout.records && workout.records.length > 0 && (
                  <Card className="border-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-sm shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-yellow-700 dark:text-yellow-400">
                        <LucideAward className="h-5 w-5" />
                        Personal Records 🎉
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workout.records.map((record: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">
                              {record.exerciseName || record.type || 'Personal Record'}
                            </span>
                          </div>
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                            {record.value} {record.unit || ''}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* Exercises Tab */}
            <TabsContent value="exercises" className="space-y-6">
              {workoutCategory === 'strength' && workout.workoutExercises && workout.workoutExercises.length > 0 ? (
                <div className="grid gap-6">
                          {workout.workoutExercises.map((exercise: any, index: number) => (
                    <ExerciseCard key={exercise._id || index} exercise={exercise} index={index} />
                          ))}
                      </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <LucideDumbbell className="h-8 w-8 text-muted-foreground" />
                      </div>
                  <h3 className="text-lg font-medium mb-2">No exercise details available</h3>
                  <p className="text-muted-foreground">
                    This workout doesn't have detailed exercise information.
                  </p>
                </motion.div>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-8">
              {/* AI Insights */}
              {(workoutInsight || isLoadingInsight) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <LucideBrainCircuit className="h-5 w-5 text-primary" />
                        AI Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingInsight ? (
                        <div className="flex items-center text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                          Generating insights...
                        </div>
                      ) : (
                        <p className="text-foreground leading-relaxed">
                          {workoutInsight}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Workout Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <LucideBarChart className="h-5 w-5" />
                      Performance Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkoutAnalysis workout={workout} />
                  </CardContent>
               </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        workout={{
          id: workout._id,
          type: workout.type,
          date: new Date(workout.date),
          duration: workout.duration,
          distance: workout.cardioDetails?.distance,
          calculatedVolume: workout.calculatedVolume,
          name: workout.name
        }}
        insight={aiHighlight || undefined}
        realLifeComparison={undefined} // This could be fetched separately if needed
      />
    </div>
  )
}

