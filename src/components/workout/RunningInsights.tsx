'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  Heart,
  Zap,
  Target,
  Timer,
  Route,
  BarChart3,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle,
  Info,
  Gauge,
  Mountain,
  Thermometer
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine } from 'recharts';

interface RunningData {
  _id: string;
  name: string;
  date: string;
  duration?: number;
  distance?: number;
  type: string;
  cardioDetails?: {
    distance?: number;
    pace?: number;
    elevationGain?: number;
    heartRate?: {
      average?: number;
      max?: number;
      zones?: Array<{
        zone: number;
        timeInZone: number;
        percentage: number;
      }>;
    };
    speed?: number;
    maxSpeed?: number;
    calories?: number;
    cadence?: number;
    splits?: Array<{
      distance: number;
      time: number;
      pace: number;
      elevationGain?: number;
    }>;
  };
}

interface RunningInsightsProps {
  workout: RunningData;
  showTitle?: boolean;
}

interface RunningAnalysis {
  paceAnalysis: {
    averagePace: number;
    paceCategory: 'elite' | 'competitive' | 'fitness' | 'recreational' | 'recovery';
    paceConsistency: number;
    splits?: Array<{
      km: number;
      pace: number;
      deviation: number;
    }>;
  };
  heartRateAnalysis?: {
    averageHR: number;
    maxHR: number;
    zones: Array<{
      name: string;
      range: string;
      timeInZone: number;
      percentage: number;
      color: string;
    }>;
    efficiency: number;
  };
  performanceMetrics: {
    speedScore: number;
    enduranceScore: number;
    efficiencyScore: number;
    overallScore: number;
  };
  comparisons: {
    weeklyAverage?: {
      pace: number;
      distance: number;
      improvement: number;
    };
    monthlyTrend?: {
      paceImprovement: number;
      distanceIncrease: number;
      consistencyScore: number;
    };
    personalBests?: {
      fastestPace: boolean;
      longestDistance: boolean;
      bestEfficiency: boolean;
    };
  };
  trainingInsights: {
    intensity: 'low' | 'moderate' | 'high' | 'peak';
    recoveryRecommendation: string;
    nextWorkoutSuggestion: string;
    trainingLoad: number;
  };
}

const RunningInsights: React.FC<RunningInsightsProps> = ({ workout, showTitle = true }) => {
  const [analysis, setAnalysis] = useState<RunningAnalysis | null>(null);
  const [historicalData, setHistoricalData] = useState<RunningData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const analyzeRun = async () => {
      try {
        setIsLoading(true);
        
        // Fetch historical running data for comparison
        const response = await fetch(`/api/workouts/similar?type=running&limit=20`);
        const data = response.ok ? await response.json() : { workouts: [] };
        setHistoricalData(data.workouts || []);
        
        // Generate comprehensive analysis
        const runAnalysis = generateRunningAnalysis(workout, data.workouts || []);
        setAnalysis(runAnalysis);
      } catch (error) {
        console.error('Failed to analyze run:', error);
        // Generate basic analysis without historical data
        const basicAnalysis = generateRunningAnalysis(workout, []);
        setAnalysis(basicAnalysis);
      } finally {
        setIsLoading(false);
      }
    };

    if (workout.type === 'running' || workout.cardioDetails?.distance) {
      analyzeRun();
    }
  }, [workout]);

  const generateRunningAnalysis = (current: RunningData, history: RunningData[]): RunningAnalysis => {
    const distance = current.cardioDetails?.distance || current.distance || 0;
    const duration = current.duration || 0;
    const avgPace = duration > 0 && distance > 0 ? (duration / 60) / distance : 0;
    const avgHR = current.cardioDetails?.heartRate?.average;
    const maxHR = current.cardioDetails?.heartRate?.max;

    // Pace Analysis
    const paceAnalysis = analyzePace(avgPace, distance, current.cardioDetails?.splits);
    
    // Heart Rate Analysis
    const heartRateAnalysis = avgHR ? analyzeHeartRate(avgHR, maxHR, duration) : undefined;
    
    // Performance Metrics
    const performanceMetrics = calculatePerformanceMetrics(current, history);
    
    // Comparisons with historical data
    const comparisons = generateComparisons(current, history);
    
    // Training insights
    const trainingInsights = generateTrainingInsights(current, history, paceAnalysis.paceCategory);

    return {
      paceAnalysis,
      heartRateAnalysis,
      performanceMetrics,
      comparisons,
      trainingInsights
    };
  };

  const analyzePace = (avgPace: number, distance: number, splits?: any[]): RunningAnalysis['paceAnalysis'] => {
    let paceCategory: 'elite' | 'competitive' | 'fitness' | 'recreational' | 'recovery' = 'recreational';
    
    if (avgPace < 3.5) paceCategory = 'elite';
    else if (avgPace < 4.5) paceCategory = 'competitive';
    else if (avgPace < 5.5) paceCategory = 'fitness';
    else if (avgPace < 7) paceCategory = 'recreational';
    else paceCategory = 'recovery';

    // Calculate pace consistency from splits
    let paceConsistency = 100;
    let splitAnalysis;
    
    if (splits && splits.length > 1) {
      const paces = splits.map(s => s.pace);
      const avgSplitPace = paces.reduce((a, b) => a + b, 0) / paces.length;
      const variance = paces.reduce((sum, pace) => sum + Math.pow(pace - avgSplitPace, 2), 0) / paces.length;
      const stdDev = Math.sqrt(variance);
      paceConsistency = Math.max(0, 100 - (stdDev / avgSplitPace * 100));
      
      splitAnalysis = splits.map((split, index) => ({
        km: index + 1,
        pace: split.pace,
        deviation: ((split.pace - avgSplitPace) / avgSplitPace) * 100
      }));
    }

    return {
      averagePace: avgPace,
      paceCategory,
      paceConsistency,
      splits: splitAnalysis
    };
  };

  const analyzeHeartRate = (avgHR: number, maxHR?: number, duration?: number): RunningAnalysis['heartRateAnalysis'] => {
    // Estimate max HR if not provided (220 - age approximation, using 30 as default)
    const estimatedMaxHR = maxHR || Math.max(avgHR * 1.1, 190);
    
    // Calculate HR zones
    const zones = [
      { name: 'Recovery', range: '50-60%', min: 0.5, max: 0.6, color: '#22c55e' },
      { name: 'Aerobic', range: '60-70%', min: 0.6, max: 0.7, color: '#3b82f6' },
      { name: 'Tempo', range: '70-80%', min: 0.7, max: 0.8, color: '#f59e0b' },
      { name: 'Lactate', range: '80-90%', min: 0.8, max: 0.9, color: '#ef4444' },
      { name: 'VO2 Max', range: '90-100%', min: 0.9, max: 1.0, color: '#8b5cf6' }
    ];

    const hrPercentage = avgHR / estimatedMaxHR;
    const currentZone = zones.find(zone => hrPercentage >= zone.min && hrPercentage < zone.max) || zones[0];
    
    // Simulate zone distribution (would come from actual HR data in real implementation)
    const zoneDistribution = zones.map(zone => ({
      ...zone,
      timeInZone: zone === currentZone ? duration || 0 : 0,
      percentage: zone === currentZone ? 100 : 0
    }));

    // Calculate efficiency (lower HR for same pace is better)
    const efficiency = Math.max(0, 100 - (hrPercentage * 100 - 60));

    return {
      averageHR: avgHR,
      maxHR: maxHR || estimatedMaxHR,
      zones: zoneDistribution,
      efficiency
    };
  };

  const calculatePerformanceMetrics = (current: RunningData, history: RunningData[]): RunningAnalysis['performanceMetrics'] => {
    const distance = current.cardioDetails?.distance || current.distance || 0;
    const duration = current.duration || 0;
    const avgPace = duration > 0 && distance > 0 ? (duration / 60) / distance : 0;

    // Speed score (based on pace)
    const speedScore = Math.max(0, Math.min(100, 100 - (avgPace - 3) * 10));
    
    // Endurance score (based on distance)
    const enduranceScore = Math.min(100, (distance / 10) * 100);
    
    // Efficiency score (combination of pace and heart rate if available)
    const avgHR = current.cardioDetails?.heartRate?.average;
    const efficiencyScore = avgHR ? 
      Math.max(0, 100 - (avgHR / avgPace - 30)) : 
      speedScore * 0.8;
    
    // Overall score
    const overallScore = (speedScore + enduranceScore + efficiencyScore) / 3;

    return {
      speedScore: Math.round(speedScore),
      enduranceScore: Math.round(enduranceScore),
      efficiencyScore: Math.round(efficiencyScore),
      overallScore: Math.round(overallScore)
    };
  };

  const generateComparisons = (current: RunningData, history: RunningData[]): RunningAnalysis['comparisons'] => {
    if (history.length === 0) return {};

    const currentDistance = current.cardioDetails?.distance || current.distance || 0;
    const currentDuration = current.duration || 0;
    const currentPace = currentDuration > 0 && currentDistance > 0 ? (currentDuration / 60) / currentDistance : 0;
    
    // Weekly comparison
    const weekStart = startOfWeek(new Date(current.date));
    const weekEnd = endOfWeek(new Date(current.date));
    const weeklyRuns = history.filter(run => {
      const runDate = new Date(run.date);
      return runDate >= weekStart && runDate <= weekEnd;
    });

    let weeklyAverage;
    if (weeklyRuns.length > 0) {
      const avgWeeklyPace = weeklyRuns.reduce((sum, run) => {
        const dist = run.cardioDetails?.distance || run.distance || 0;
        const dur = run.duration || 0;
        const pace = dur > 0 && dist > 0 ? (dur / 60) / dist : 0;
        return sum + pace;
      }, 0) / weeklyRuns.length;
      
      const avgWeeklyDistance = weeklyRuns.reduce((sum, run) => 
        sum + (run.cardioDetails?.distance || run.distance || 0), 0) / weeklyRuns.length;
      
      const improvement = avgWeeklyPace > 0 ? ((avgWeeklyPace - currentPace) / avgWeeklyPace) * 100 : 0;
      
      weeklyAverage = {
        pace: avgWeeklyPace,
        distance: avgWeeklyDistance,
        improvement
      };
    }

    // Monthly trend
    const monthStart = startOfMonth(new Date(current.date));
    const monthEnd = endOfMonth(new Date(current.date));
    const monthlyRuns = history.filter(run => {
      const runDate = new Date(run.date);
      return runDate >= monthStart && runDate <= monthEnd;
    });

    let monthlyTrend;
    if (monthlyRuns.length >= 3) {
      const sortedRuns = monthlyRuns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstHalf = sortedRuns.slice(0, Math.floor(sortedRuns.length / 2));
      const secondHalf = sortedRuns.slice(Math.floor(sortedRuns.length / 2));
      
      const firstHalfAvgPace = firstHalf.reduce((sum, run) => {
        const dist = run.cardioDetails?.distance || run.distance || 0;
        const dur = run.duration || 0;
        return sum + (dur > 0 && dist > 0 ? (dur / 60) / dist : 0);
      }, 0) / firstHalf.length;
      
      const secondHalfAvgPace = secondHalf.reduce((sum, run) => {
        const dist = run.cardioDetails?.distance || run.distance || 0;
        const dur = run.duration || 0;
        return sum + (dur > 0 && dist > 0 ? (dur / 60) / dist : 0);
      }, 0) / secondHalf.length;
      
      const paceImprovement = firstHalfAvgPace > 0 ? ((firstHalfAvgPace - secondHalfAvgPace) / firstHalfAvgPace) * 100 : 0;
      
      const avgDistance = monthlyRuns.reduce((sum, run) => sum + (run.cardioDetails?.distance || run.distance || 0), 0) / monthlyRuns.length;
      const distanceIncrease = (currentDistance - avgDistance) / avgDistance * 100;
      
      monthlyTrend = {
        paceImprovement,
        distanceIncrease,
        consistencyScore: monthlyRuns.length * 10 // Simple consistency score
      };
    }

    // Personal bests
    const fastestPace = currentPace < Math.min(...history.map(run => {
      const dist = run.cardioDetails?.distance || run.distance || 0;
      const dur = run.duration || 0;
      return dur > 0 && dist > 0 ? (dur / 60) / dist : Infinity;
    }));
    
    const longestDistance = currentDistance > Math.max(...history.map(run => 
      run.cardioDetails?.distance || run.distance || 0));

    return {
      weeklyAverage,
      monthlyTrend,
      personalBests: {
        fastestPace,
        longestDistance,
        bestEfficiency: false // Would need more complex calculation
      }
    };
  };

  const generateTrainingInsights = (current: RunningData, history: RunningData[], paceCategory: string): RunningAnalysis['trainingInsights'] => {
    const distance = current.cardioDetails?.distance || current.distance || 0;
    const duration = current.duration || 0;
    
    // Determine intensity
    let intensity: 'low' | 'moderate' | 'high' | 'peak' = 'moderate';
    if (paceCategory === 'elite' || paceCategory === 'competitive') intensity = 'peak';
    else if (paceCategory === 'fitness') intensity = 'high';
    else if (paceCategory === 'recovery') intensity = 'low';

    // Recovery recommendation
    let recoveryRecommendation = 'Light stretching and hydration';
    if (intensity === 'peak') recoveryRecommendation = '24-48 hours rest with active recovery';
    else if (intensity === 'high') recoveryRecommendation = '12-24 hours rest with light activity';

    // Next workout suggestion
    let nextWorkoutSuggestion = 'Continue with similar intensity';
    if (intensity === 'peak') nextWorkoutSuggestion = 'Easy run or rest day';
    else if (intensity === 'low') nextWorkoutSuggestion = 'Ready for tempo or interval training';

    // Training load (simplified calculation)
    const trainingLoad = Math.round((distance * 10) + (duration / 60 * 5) + (intensity === 'peak' ? 20 : intensity === 'high' ? 15 : intensity === 'moderate' ? 10 : 5));

    return {
      intensity,
      recoveryRecommendation,
      nextWorkoutSuggestion,
      trainingLoad
    };
  };

  const formatPace = (paceMinPerKm: number) => {
    if (paceMinPerKm === 0) return '--:--';
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Analyzing Your Run...</h3>
            <p className="text-muted-foreground">Crunching pace, heart rate, and performance data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const distance = workout.cardioDetails?.distance || workout.distance || 0;
  const duration = workout.duration || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      {showTitle && (
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Activity className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Running Analysis</h2>
            <p className="text-muted-foreground">Deep insights into your performance</p>
          </div>
        </div>
      )}

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pace</p>
                <p className="text-lg font-bold">{formatPace(analysis.paceAnalysis.averagePace)} /km</p>
                <Badge 
                  variant="secondary" 
                  className={`text-xs mt-1 ${
                    analysis.paceAnalysis.paceCategory === 'elite' ? 'bg-purple-100 text-purple-700' :
                    analysis.paceAnalysis.paceCategory === 'competitive' ? 'bg-blue-100 text-blue-700' :
                    analysis.paceAnalysis.paceCategory === 'fitness' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}
                >
                  {analysis.paceAnalysis.paceCategory}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Route className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="text-lg font-bold">{distance.toFixed(1)} km</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDuration(duration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {analysis.heartRateAnalysis && (
          <Card className="border-0 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Heart Rate</p>
                  <p className="text-lg font-bold">{analysis.heartRateAnalysis.averageHR} bpm</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: {analysis.heartRateAnalysis.maxHR} bpm</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className="text-lg font-bold">{analysis.performanceMetrics.overallScore}/100</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div 
                    className="bg-purple-600 h-1.5 rounded-full" 
                    style={{ width: `${analysis.performanceMetrics.overallScore}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown */}
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5" />
            Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Speed</span>
                <span className="text-sm text-muted-foreground">{analysis.performanceMetrics.speedScore}/100</span>
              </div>
              <Progress value={analysis.performanceMetrics.speedScore} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Endurance</span>
                <span className="text-sm text-muted-foreground">{analysis.performanceMetrics.enduranceScore}/100</span>
              </div>
              <Progress value={analysis.performanceMetrics.enduranceScore} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Efficiency</span>
                <span className="text-sm text-muted-foreground">{analysis.performanceMetrics.efficiencyScore}/100</span>
              </div>
              <Progress value={analysis.performanceMetrics.efficiencyScore} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heart Rate Analysis */}
      {analysis.heartRateAnalysis && (
        <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-red-500" />
              Heart Rate Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Training Zones</h4>
                <div className="space-y-3">
                  {analysis.heartRateAnalysis.zones.map((zone, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: zone.color }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{zone.name}</span>
                          <span className="text-xs text-muted-foreground">{zone.range}</span>
                        </div>
                        <Progress 
                          value={zone.percentage} 
                          className="h-1.5 mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">HR Efficiency</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">{Math.round(analysis.heartRateAnalysis.efficiency)}%</div>
                  <p className="text-sm text-muted-foreground">
                    {analysis.heartRateAnalysis.efficiency >= 80 ? 'Excellent efficiency!' :
                     analysis.heartRateAnalysis.efficiency >= 60 ? 'Good efficiency' :
                     'Room for improvement'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pace Consistency */}
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Gauge className="h-5 w-5" />
            Pace Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Pace Consistency</h4>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">{Math.round(analysis.paceAnalysis.paceConsistency)}%</div>
                <p className="text-sm text-muted-foreground">
                  {analysis.paceAnalysis.paceConsistency >= 90 ? 'Extremely consistent!' :
                   analysis.paceAnalysis.paceConsistency >= 75 ? 'Very consistent' :
                   analysis.paceAnalysis.paceConsistency >= 60 ? 'Moderately consistent' :
                   'Work on pacing'}
                </p>
              </div>
            </div>
            {analysis.paceAnalysis.splits && (
              <div>
                <h4 className="font-semibold mb-3">Split Analysis</h4>
                <div className="space-y-2">
                  {analysis.paceAnalysis.splits.slice(0, 5).map((split, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">KM {split.km}</span>
                      <span className="text-sm font-medium">{formatPace(split.pace)}</span>
                      <span className={`text-xs ${split.deviation > 5 ? 'text-red-500' : split.deviation < -5 ? 'text-green-500' : 'text-gray-500'}`}>
                        {split.deviation > 0 ? '+' : ''}{split.deviation.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparisons and Trends */}
      {(analysis.comparisons.weeklyAverage || analysis.comparisons.monthlyTrend) && (
        <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5" />
              Progress & Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analysis.comparisons.weeklyAverage && (
                <div>
                  <h4 className="font-semibold mb-3">This Week</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Avg Pace</span>
                      <span className="text-sm font-medium">{formatPace(analysis.comparisons.weeklyAverage.pace)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Avg Distance</span>
                      <span className="text-sm font-medium">{analysis.comparisons.weeklyAverage.distance.toFixed(1)} km</span>
                    </div>
                    {analysis.comparisons.weeklyAverage.improvement !== 0 && (
                      <div className="flex items-center gap-2">
                        {analysis.comparisons.weeklyAverage.improvement > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ${analysis.comparisons.weeklyAverage.improvement > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {Math.abs(analysis.comparisons.weeklyAverage.improvement).toFixed(1)}% pace change
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {analysis.comparisons.monthlyTrend && (
                <div>
                  <h4 className="font-semibold mb-3">Monthly Trend</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {analysis.comparisons.monthlyTrend.paceImprovement > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">Pace: {Math.abs(analysis.comparisons.monthlyTrend.paceImprovement).toFixed(1)}% improvement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Consistency: {analysis.comparisons.monthlyTrend.consistencyScore}/100</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Records */}
      {analysis.comparisons.personalBests && (
        <Card className="border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Award className="h-5 w-5 text-amber-600" />
              Personal Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.comparisons.personalBests.fastestPace && (
                <div className="flex items-center gap-3 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">Fastest Pace!</span>
                </div>
              )}
              {analysis.comparisons.personalBests.longestDistance && (
                <div className="flex items-center gap-3 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">Longest Distance!</span>
                </div>
              )}
              {analysis.comparisons.personalBests.bestEfficiency && (
                <div className="flex items-center gap-3 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">Best Efficiency!</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Insights */}
      <Card className="border-0 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5" />
            Training Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Session Analysis</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Gauge className="h-4 w-4" />
                  <span className="text-sm">Intensity: </span>
                  <Badge variant={
                    analysis.trainingInsights.intensity === 'peak' ? 'destructive' :
                    analysis.trainingInsights.intensity === 'high' ? 'default' :
                    analysis.trainingInsights.intensity === 'moderate' ? 'secondary' : 'outline'
                  }>
                    {analysis.trainingInsights.intensity}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm">Training Load: {analysis.trainingInsights.trainingLoad}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Heart className="h-4 w-4 mt-0.5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Recovery</p>
                    <p className="text-xs text-muted-foreground">{analysis.trainingInsights.recoveryRecommendation}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Next Workout</p>
                    <p className="text-xs text-muted-foreground">{analysis.trainingInsights.nextWorkoutSuggestion}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RunningInsights; 