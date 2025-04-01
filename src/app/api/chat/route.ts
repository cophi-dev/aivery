import Anthropic from "@anthropic-ai/sdk";
import {
  getWorkoutById,
  getPreviousWorkouts,
  getWorkoutsByUserId,
  getMonthlyWorkoutDistanceByType,
  getWorkoutDistanceForDateRange,
  getMonthlyWorkoutDurationByType,
  getWorkoutDurationForDateRange,
  getWorkoutNotesByType,
  getTotalDistanceByType,
  getWorkoutTypeStats,
} from "@/lib/db/repositories/workoutRepository";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db/mongodb";
import { NextResponse } from "next/server";
import User from "@/lib/db/models/user";
import { IUser } from "@/lib/db/models/user";
import { getFreshWorkouts, getFreshFilteredWorkouts } from "./fresh-data";
import { Document } from "mongoose";
import { QueryAnalysis as ImportedQueryAnalysis } from "./workout-analysis";

// Define QueryAnalysis interface for workout data queries
interface QueryAnalysis {
  dataType?: string;
  timeFrame?: string;
  filters?: {
    workoutType?: string;
    format?: string;
    includeDetails?: boolean;
    aggregation?: string;
    metric?: string;
  };
  workoutType?: string;
}

// Force dynamic rendering and prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Function to reset MongoDB connection for fresh data
async function resetAndGetFreshConnection() {
  // Clear the cached connection
  (global as any).mongoose = { conn: null, promise: null };
  // Get a fresh connection
  await dbConnect();
  return getCollection("workouts");
}

// Initialize the Anthropic SDK
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Allow responses up to 30 seconds
export const maxDuration = 30;

// Helper function to calculate total weight lifted for strength workouts
function calculateTotalWeightLifted(workout: any): number {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0;
  }

  return workout.exercises.reduce((total: number, exercise: any) => {
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      return total;
    }

    const exerciseTotal = exercise.sets.reduce((setTotal: number, set: any) => {
      return setTotal + (set.weight || 0) * (set.reps || 0);
    }, 0);

    return total + exerciseTotal;
  }, 0);
}

// Add after imports
interface WorkoutQuery {
  type: "distance" | "pace" | "duration" | "stats" | "progress" | "general";
  timeframe?: "all" | "year" | "month" | "week" | "recent";
  workoutType?: string;
  specific?: string;
}

// Add before POST function
function analyzeWorkoutQuery(message: string): WorkoutQuery {
  const msg = message.toLowerCase();

  // Initialize query object
  const query: WorkoutQuery = {
    type: "general",
  };

  // Detect workout type
  if (msg.includes("run") || msg.includes("running")) {
    query.workoutType = "running";
  } else if (msg.includes("swim") || msg.includes("swimming")) {
    query.workoutType = "swimming";
  } else if (
    msg.includes("cycl") ||
    msg.includes("bike") ||
    msg.includes("biking")
  ) {
    query.workoutType = "cycling";
  } else if (
    msg.includes("strength") ||
    msg.includes("gym") ||
    msg.includes("weight")
  ) {
    query.workoutType = "strength";
  }

  // Detect query type - enhance pace detection
  if (
    msg.includes("pace") ||
    msg.includes("fastest") ||
    msg.includes("speed") ||
    msg.includes("quick")
  ) {
    query.type = "pace";
    if (
      msg.includes("fastest") ||
      msg.includes("best") ||
      msg.includes("quickest")
    ) {
      query.specific = "fastest";
    }
  } else if (
    msg.includes("distance") ||
    msg.includes("far") ||
    msg.includes("km") ||
    msg.includes("kilometers")
  ) {
    query.type = "distance";
  } else if (
    msg.includes("time") ||
    msg.includes("long") ||
    msg.includes("duration")
  ) {
    query.type = "duration";
  } else if (msg.includes("stats") || msg.includes("statistics")) {
    query.type = "stats";
  } else if (
    msg.includes("progress") ||
    msg.includes("improve") ||
    msg.includes("better")
  ) {
    query.type = "progress";
  }

  // Detect timeframe
  if (
    msg.includes("all time") ||
    msg.includes("total") ||
    msg.includes("ever")
  ) {
    query.timeframe = "all";
  } else if (msg.includes("this year") || msg.includes("year")) {
    query.timeframe = "year";
  } else if (msg.includes("this month") || msg.includes("month")) {
    query.timeframe = "month";
  } else if (msg.includes("this week") || msg.includes("week")) {
    query.timeframe = "week";
  } else if (
    msg.includes("recent") ||
    msg.includes("latest") ||
    msg.includes("last")
  ) {
    query.timeframe = "recent";
  }

  // Detect specific queries
  if (msg.includes("longest")) {
    query.specific = "longest";
  } else if (msg.includes("average") || msg.includes("avg")) {
    query.specific = "average";
  }

  return query;
}

// Add interface definition for UserDocument
interface UserDocument {
  _id: string;
  nickname?: string;
  name?: string;
  aiPreferences?: Record<string, any>;
}

// Add before POST function
async function generatePersonalizedGreeting(
  userId: string,
): Promise<string | null> {
  try {
    const user = await User.findById(userId).select("nickname name").lean() as UserDocument;
    if (!user) return null;
    return `Hello ${user.nickname || user.name || 'there'}`;
  } catch (error) {
    console.error('Error generating greeting:', error);
    return null;
  }
}

// Add interface definition for AIQueryRequest
interface AIQueryRequest {
  query: string;
  userId: string;
  queryType: "workout_data" | "user_info";
}

// Helper function for fetching user workout data
const fetchUserWorkoutData = async (
  userId: string,
  queryType: string,
  timeframe?: string,
) => {
  try {
    // Force database reconnection to prevent cache issues
    await dbConnect();

    // Force fresh connection to workouts collection
    const workoutsCollection = await getCollection("workouts");

    // Add a timestamp to the query to prevent caching
    const cacheKey = Date.now();

    // Base filter: workouts for this user
    const filter: any = {
      userId: new ObjectId(userId),
      _cacheKey: cacheKey, // This doesn't affect the query but ensures uniqueness
    };

    // Add date filtering if timeframe is specified
    if (timeframe) {
      const now = new Date();
      let startDate = new Date();

      if (timeframe.includes("week") || timeframe.includes("this week")) {
        // Start of current week (Sunday)
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
      } else if (
        timeframe.includes("month") ||
        timeframe.includes("this month")
      ) {
        // Start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (
        timeframe.includes("year") ||
        timeframe === "2024" ||
        timeframe.includes("2024")
      ) {
        // Current year or specific year
        if (timeframe === "2024" || timeframe.includes("2024")) {
          filter.date = {
            $gte: new Date("2024-01-01T00:00:00.000Z"),
            $lt: new Date("2025-01-01T00:00:00.000Z"),
          };
        } else if (timeframe.includes("2025")) {
          filter.date = {
            $gte: new Date("2025-01-01T00:00:00.000Z"),
            $lt: new Date("2026-01-01T00:00:00.000Z"),
          };
        } else {
          // Current year
          startDate = new Date(now.getFullYear(), 0, 1);
        }
      }

      // Apply date filter if not already set for specific years
      if (!filter.date) {
        filter.date = { $gte: startDate };
      }
    }

    // Handle specific query types
    if (queryType === "longest_run") {
      // Add type filter for runs
      filter.type = { $regex: /run/i };

      // Find the workout with the longest distance
      const longestRun = await workoutsCollection
        .find(filter)
        .sort({ distance: -1 })
        .limit(1)
        .toArray();

      return longestRun.length > 0 ? longestRun[0] : null;
    } else if (queryType === "recent_workouts") {
      // Get recent workouts (last 5)
      const recentWorkouts = await workoutsCollection
        .find(filter)
        .sort({ date: -1 })
        .limit(5)
        .toArray();

      return recentWorkouts;
    } else if (queryType === "list_workouts") {
      // Get workouts for the period, sorted by date
      const workouts = await workoutsCollection
        .find(filter)
        .sort({ date: -1 })
        .limit(10) // Limit to 10 workouts for readability
        .toArray();

      return workouts;
    } else if (queryType === "workout_count") {
      // Count workouts
      const count = await workoutsCollection.countDocuments(filter);
      return { count };
    } else if (queryType === "workout_summary") {
      // Get count of all workouts
      const total = await workoutsCollection.countDocuments(filter);

      // Get breakdown by workout type
      const workouts = await workoutsCollection.find(filter).toArray();
      const types: Record<string, number> = {};

      workouts.forEach((workout: any) => {
        const type = workout.type || "unknown";
        types[type] = (types[type] || 0) + 1;
      });

      return { total, types };
    } else if (queryType === "last_run") {
      // Get the most recent run
      const runFilter = { ...filter, type: { $regex: /run/i } };
      const lastRun = await workoutsCollection
        .find(runFilter)
        .sort({ date: -1 })
        .limit(1)
        .toArray();

      return lastRun.length > 0 ? lastRun[0] : null;
    } else if (queryType === "total_distance") {
      // Add filter for runs
      filter.type = { $regex: /run/i };

      // Get sum of distances for all runs in the timeframe
      const runs = await workoutsCollection.find(filter).toArray();
      const totalDistance = runs.reduce((sum: number, run: any) => {
        return sum + (parseFloat(run.distance) || 0);
      }, 0);

      return { totalDistance, count: runs.length };
    }

    return null;
  } catch (error) {
    console.error("Error fetching workout data:", error);
    return null;
  }
};

// Helper function to generate consistent workout summaries by type
const generateWorkoutTypeSummaries = (workouts: any[]) => {
  // Normalize workout types - map display names to standardized types
  const normalizeWorkoutType = (type: string) => {
    type = type.toLowerCase();
    if (type.includes("run") || type.includes("running")) return "running";
    if (type.includes("swim") || type.includes("swimming")) return "swimming";
    if (type.includes("strength") || type.includes("weight"))
      return "strength training";
    if (type.includes("cycl") || type.includes("bike")) return "cycling";
    if (type.includes("cardio")) return "cardio";
    return type;
  };

  // Group workouts by normalized type
  const workoutsByType: Record<string, any[]> = {};

  workouts.forEach((workout) => {
    const normalizedType = normalizeWorkoutType(workout.type || "other");
    if (!workoutsByType[normalizedType]) {
      workoutsByType[normalizedType] = [];
    }
    workoutsByType[normalizedType].push(workout);
  });

  // Calculate summaries for each type
  const summaries: Record<string, any> = {};

  Object.entries(workoutsByType).forEach(([type, typeWorkouts]) => {
    const totalDuration = typeWorkouts.reduce(
      (sum, w) => sum + (w.duration || 0),
      0,
    );
    const workoutsWithDistance = typeWorkouts.filter(
      (w) => w.distance && w.distance > 0,
    );

    // Ensure consistent distance units (convert to km for swimming if needed)
    const totalDistance = workoutsWithDistance.reduce((sum, w) => {
      let distance = parseFloat(w.distance) || 0;
      // Handle unit conversions if needed
      if (w.distanceUnit === "miles") {
        distance *= 1.60934; // Convert miles to km
      }
      return sum + distance;
    }, 0);

    // Round to 2 decimal places
    const roundedDistance = Math.round(totalDistance * 100) / 100;

    summaries[type] = {
      count: typeWorkouts.length,
      totalDuration,
      averageDuration: totalDuration / typeWorkouts.length,
      totalDistance: roundedDistance,
      hasDistance: workoutsWithDistance.length > 0,
      // Calculate average intensity
      averageIntensity: typeWorkouts.some((w) => w.intensity)
        ? typeWorkouts
            .map((w) => {
              const intensity = (w.intensity || "").toLowerCase();
              if (intensity.includes("high")) return 3;
              if (intensity.includes("medium")) return 2;
              if (intensity.includes("low")) return 1;
              return 0;
            })
            .reduce((sum: number, val: number) => sum + val, 0) /
          typeWorkouts.filter((w) => w.intensity).length
        : null,
      workouts: typeWorkouts,
      // Store dates for easy reference
      dates: typeWorkouts
        .map((w) => new Date(w.date))
        .sort((a, b) => b.getTime() - a.getTime()),
      // If applicable (future metrics)
      totalCalories: typeWorkouts.reduce(
        (sum, w) => sum + (parseInt(w.calories) || 0),
        0,
      ),
    };
  });

  return summaries;
};

// Process AI data request function
const processAIDataRequest = async (request: AIQueryRequest) => {
  try {
    const { query, userId, queryType } = request;

    // First, use Anthropic Claude to understand what the user is asking for
    const queryAnalysisResponse = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0,
      system: `Act as a fitness data analyst. Extract query details into JSON.

OUTPUT:
{
  "dataType": "runs|workouts|distance|duration|count|lastRun|longestRun|workoutList",
  "timeFrame": "week|month|year|2024|2025|all",
  "filters": {
    "workoutType": "run|strength|cycling", 
    "format": "list|single|summary|detailed"
  }
}

MAPPINGS:
- "see workouts" → dataType="workoutList"
- "this week" → timeFrame="week"
- Return only JSON, no explanations`,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    });

    // Parse the analysis
    const analysisText =
      getTextFromResponse(queryAnalysisResponse.content) || "{}";
    console.log("[CHAT] Analysis text:", analysisText);
    
    let queryAnalysis: QueryAnalysis = {
      dataType: '',
      timeFrame: '',
      filters: {
        workoutType: '',
        format: '',
        includeDetails: false,
        aggregation: '',
        metric: ''
      },
      workoutType: ''
    };
    
    try {
      const parsed = JSON.parse(analysisText);
      queryAnalysis = {
        ...queryAnalysis,
        ...parsed
      };
      
      // Check if this is a query about last week, month, or year
      if (query.toLowerCase().includes("last week") && queryAnalysis.timeFrame === "week") {
        console.log("[CHAT] Detected 'last week' query, adjusting timeFrame");
        queryAnalysis.timeFrame = "last-week";
      } else if (query.toLowerCase().includes("last month") && queryAnalysis.timeFrame === "month") {
        console.log("[CHAT] Detected 'last month' query, adjusting timeFrame");
        queryAnalysis.timeFrame = "last-month";
      } else if (query.toLowerCase().includes("last year") && queryAnalysis.timeFrame === "year") {
        console.log("[CHAT] Detected 'last year' query, adjusting timeFrame");
        queryAnalysis.timeFrame = "last-year";
      }
      
      // Detect workout type from query if not provided by analysis
      if (!queryAnalysis.workoutType && !queryAnalysis.filters?.workoutType) {
        if (query.toLowerCase().includes("run")) {
          console.log("[CHAT] Detected running query");
          queryAnalysis.workoutType = "running";
        } else if (query.toLowerCase().includes("swim")) {
          console.log("[CHAT] Detected swimming query");
          queryAnalysis.workoutType = "swimming";
        } else if (query.toLowerCase().includes("bike") || 
                 query.toLowerCase().includes("cycle") || 
                 query.toLowerCase().includes("cycling")) {
          console.log("[CHAT] Detected cycling query");
          queryAnalysis.workoutType = "cycling";
        }
      }
      
      console.log("[CHAT] Final query analysis:", queryAnalysis);
    } catch (error) {
      console.error("[CHAT] Error parsing query analysis:", error);
      console.error("[CHAT] Raw analysis text:", analysisText);
      // Keep default structure on parse error
    }

    // Connect to the database
    await dbConnect();
    const workoutsCollection = await getCollection("workouts");

    // Build a database query based on the Claude's analysis
    const dbFilter: any = { userId: new ObjectId(userId) };

    // Apply time frame filter
    if (queryAnalysis.timeFrame) {
      const now = new Date();

      if (queryAnalysis.timeFrame === "week") {
        // Check if query is asking about "last week" vs "this week"
        const isLastWeek = query.toLowerCase().includes("last week");
        
        if (isLastWeek) {
          // First get the start of this week (Monday)
          const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
          const daysFromMonday = day === 0 ? 6 : day - 1; // Convert to Monday=0, Sunday=6
          const thisWeekStart = new Date(now);
          thisWeekStart.setDate(now.getDate() - daysFromMonday);
          thisWeekStart.setHours(0, 0, 0, 0);
          
          // Last week is 7 days before the start of this week
          const startDate = new Date(thisWeekStart);
          startDate.setDate(thisWeekStart.getDate() - 7);
          
          const endDate = new Date(thisWeekStart);
          endDate.setDate(thisWeekStart.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          
          console.log("[CHAT] Looking for workouts from last week (Monday-Sunday):", 
            startDate.toISOString(), "to", endDate.toISOString());
          
          dbFilter.date = { 
            $gte: startDate,
            $lte: endDate 
          };
        } else {
          // This week (default)
          const day = now.getDay();
          const startDate = new Date(now);
          startDate.setDate(now.getDate() - day);
          startDate.setHours(0, 0, 0, 0);
          dbFilter.date = { $gte: startDate };
        }
      } else if (queryAnalysis.timeFrame === "month") {
        // Check if query is asking about "last month" vs "this month"
        const isLastMonth = query.toLowerCase().includes("last month");
        
        if (isLastMonth) {
          // Last month
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = lastMonth === 11 ? now.getFullYear() - 1 : now.getFullYear();
          
          const startDate = new Date(lastMonthYear, lastMonth, 1);
          const endDate = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999);
          
          dbFilter.date = { 
            $gte: startDate,
            $lte: endDate 
          };
        } else {
          // This month (default)
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          dbFilter.date = { $gte: startDate };
        }
      } else if (queryAnalysis.timeFrame === "2024") {
        dbFilter.date = {
          $gte: new Date("2024-01-01T00:00:00.000Z"),
          $lt: new Date("2025-01-01T00:00:00.000Z"),
        };
      } else if (queryAnalysis.timeFrame === "2025") {
        dbFilter.date = {
          $gte: new Date("2025-01-01T00:00:00.000Z"),
          $lt: new Date("2026-01-01T00:00:00.000Z"),
        };
      } else if (queryAnalysis.timeFrame === "year") {
        // Check if query is asking about "last year"
        const isLastYear = query.toLowerCase().includes("last year");
        
        if (isLastYear) {
          const lastYear = now.getFullYear() - 1;
          dbFilter.date = {
            $gte: new Date(`${lastYear}-01-01T00:00:00.000Z`),
            $lt: new Date(`${lastYear + 1}-01-01T00:00:00.000Z`),
          };
        } else {
          // This year (default)
          const startDate = new Date(now.getFullYear(), 0, 1);
          dbFilter.date = { $gte: startDate };
        }
      }
    }

    // Apply workout type filter
    if (queryAnalysis.filters?.workoutType) {
      const typeRegex = new RegExp(queryAnalysis.filters.workoutType, "i");
      dbFilter.type = { $regex: typeRegex };
    }

    // Execute different queries based on what the user wants
    let result: any = null;
    const format = queryAnalysis.filters?.format || "single";
    const includeDetails = queryAnalysis.filters?.includeDetails === true;

    if (
      queryAnalysis.dataType === "longestRun" ||
      (queryAnalysis.dataType === "runs" &&
        queryAnalysis.filters?.aggregation === "max" &&
        queryAnalysis.filters?.metric === "distance")
    ) {
      // Get the longest run
      if (!dbFilter.type) dbFilter.type = { $regex: /run/i };

      const longestRun = await workoutsCollection
        .find(dbFilter)
        .sort({ distance: -1 })
        .limit(1)
        .toArray();

      result = longestRun.length > 0 ? longestRun[0] : null;
    } else if (
      queryAnalysis.dataType === "lastRun" ||
      (queryAnalysis.dataType === "runs" &&
        queryAnalysis.filters?.aggregation === "latest")
    ) {
      // Get the most recent run
      if (!dbFilter.type) dbFilter.type = { $regex: /run/i };

      const lastRun = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(1)
        .toArray();

      result = lastRun.length > 0 ? lastRun[0] : null;
    } else if (
      queryAnalysis.dataType === "workoutList" ||
      (queryAnalysis.dataType === "workouts" && format === "detailed")
    ) {
      // Get a detailed list of workouts with full formatting
      const workouts = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(10)
        .toArray();

      // Process workouts to include day names and format dates
      const processedWorkouts = workouts.map((workout: any) => {
        const workoutDate = new Date(workout.date);
        const dayName = workoutDate.toLocaleDateString("en-US", {
          weekday: "long",
        });
        const dateStr = workoutDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        });

        return {
          ...workout,
          dayName,
          formattedDate: `${dayName}, ${dateStr}`,
          // Format duration as hours and minutes if needed
          formattedDuration: workout.duration
            ? workout.duration >= 60
              ? `${Math.floor(workout.duration / 60)}h ${workout.duration % 60}m`
              : `${workout.duration} minutes`
            : null,
          // Format distance with units
          formattedDistance: workout.distance
            ? `${workout.distance} ${workout.distanceUnit || "miles"}`
            : null,
        };
      });

      result = {
        workouts: processedWorkouts,
        count: processedWorkouts.length,
        timeFrame: queryAnalysis.timeFrame || "recent",
        includeDetails,
      };
    } else if (queryAnalysis.dataType === "workouts" && format === "list") {
      // Get a list of workouts
      const workouts = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(10)
        .toArray();

      result = workouts;
    } else if (
      queryAnalysis.dataType === "count" ||
      queryAnalysis.filters?.metric === "count"
    ) {
      // Count workouts
      const count = await workoutsCollection.countDocuments(dbFilter);
      result = { count };
    } else if (
      queryAnalysis.dataType === "distance" &&
      queryAnalysis.filters?.aggregation === "sum"
    ) {
      // Calculate total distance
      if (!dbFilter.type && queryAnalysis.filters?.workoutType === "run") {
        dbFilter.type = { $regex: /run/i };
      }

      const workouts = await workoutsCollection.find(dbFilter).toArray();
      const totalDistance = workouts.reduce((sum: number, workout: any) => {
        return sum + (parseFloat(workout.distance) || 0);
      }, 0);

      result = {
        totalDistance: Math.round(totalDistance * 100) / 100,
        count: workouts.length,
        timeFrame: queryAnalysis.timeFrame || "all time",
        workoutType: queryAnalysis.filters?.workoutType || "all workouts",
      };
    } else if (queryAnalysis.dataType === "summary") {
      // Get workout summary
      const total = await workoutsCollection.countDocuments(dbFilter);
      const workouts = await workoutsCollection.find(dbFilter).toArray();

      const types: Record<string, number> = {};
      workouts.forEach((workout: any) => {
        const type = workout.type || "unknown";
        types[type] = (types[type] || 0) + 1;
      });

      // Also calculate total distance if applicable
      let totalDistance = 0;
      if (queryAnalysis.filters?.metric === "distance") {
        totalDistance = workouts.reduce((sum: number, workout: any) => {
          return sum + (parseFloat(workout.distance) || 0);
        }, 0);
      }

      result = {
        total,
        types,
        totalDistance: Math.round(totalDistance * 100) / 100,
      };
    }

    // Use Anthropic Claude to generate a natural language response
    if (result) {
      // Generate workout type summaries for more consistent data presentation
      const workoutSummaries = generateWorkoutTypeSummaries(result.workouts);

      // Format workouts for better readability
      const formatWorkouts = (workouts: any[]) => {
        return workouts.map(w => ({
          id: w._id.toString(),
          type: w.type,
          date: new Date(w.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          distance: w.distance ? `${parseFloat(w.distance).toFixed(1)} km` : '',
          duration: w.duration ? formatDuration(w.duration) : '',
          notes: w.notes || ''
        }));
      };
      
      // Format duration in hours and minutes
      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        
        if (hours > 0) {
          return `${hours}h ${mins}m`;
        }
        return `${mins} min`;
      };
      
      // Add workout summaries for each type
      const formatWorkoutSummaries = (summaries: any, type: string) => {
        const typeSummary = summaries?.byType?.[type];
        if (!typeSummary || !typeSummary.hasWorkouts) return null;
        
        return {
          count: typeSummary.count,
          totalDistance: typeSummary.hasDistance 
            ? `${parseFloat(typeSummary.totalDistance).toFixed(1)} km` 
            : null,
          totalDuration: formatDuration(typeSummary.totalDuration),
          dateRange: typeSummary.dateRange?.formatted || null
        };
      };
      
      const contextMessage = JSON.stringify({
        userQuery: query,
        workouts: formatWorkouts(result.workouts),
        workoutSummaries,
        summariesByType: workoutSummaries.byType,
        formattedSummary: formatWorkoutSummaries(workoutSummaries, queryAnalysis.workoutType || 'running'),
        dateRange: workoutSummaries.dateRange,
        count: result.count,
        timeFrame: queryAnalysis.timeFrame || "all",
        workoutType: queryAnalysis.workoutType,
      });

      const responseGeneration = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        temperature: 0.7,
        system: `Act as a fitness coach answering workout questions based on real user data.

FORMAT GUIDELINES:
- Use **bold** for important numbers (distance, duration, counts)
- Use *italics* for workout types
- Use bullet points for listing multiple workouts
- Be conversational and encouraging

RESPONSE STRUCTURE:
1. Direct answer to the question first with specific data values
2. Include specific details for individual workouts if relevant
3. Provide context about the time period (clearly specify "last week", "this week", etc.)
4. End with personalized encouragement

ACCURACY REQUIREMENTS:
- Always use the exact data units provided (km, minutes, etc.)
- Only include data from the timeframe that was requested
- Don't invent workouts or details not in the data
- For date ranges, use formatted dates from the data`,
        messages: [
          {
            role: "user",
            content: contextMessage,
          },
        ],
      });

      return new Response(
        getTextFromResponse(responseGeneration.content) ||
          "I couldn't find any workout data that matches your request.",
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        },
      );
    }

    // No workouts found, let Anthropic handle it
    console.log(
      "[CHAT] No matching workouts found, falling back to general response",
    );

    // Create a friendly response about no workouts found
    const timeFrameText = "recently"; // Default to a generic timeframe if no specific analysis available

    const workoutTypeText = "any workouts recently"; // Default to generic workout type

    // Create a more personalized no-workouts response
    const noWorkoutsResponse = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      temperature: 0.8,
      system: `Act as a fitness coach responding to someone with no workouts.

1. One encouraging sentence only
2. Acknowledge missing workouts 
3. Include specific action suggestion
4. Be positive, optional single emoji`,
      messages: [
        {
          role: "user",
          content: `Create a response about not having ${workoutTypeText}.`,
        },
      ],
    });

    return new Response(
      getTextFromResponse(noWorkoutsResponse.content) ||
        `I don't see ${workoutTypeText}. Would you like to log a workout now?`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  } catch (error) {
    console.error("Error processing AI data request:", error);
    return new Response(
      "I'm having trouble processing your workout data request right now. Please try again in a moment.",
      {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        status: 503,
      },
    );
  }
};

// Helper function to safely extract text from Claude response content
function getTextFromResponse(content: any): string | undefined {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }

  const firstBlock = content[0];

  // Handle different content block types safely
  if (firstBlock && typeof firstBlock === "object") {
    if ("text" in firstBlock) {
      return firstBlock.text as string;
    }
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { messages } = await request.json();
    const userMessage = messages[messages.length - 1].content;

    // If it's a workout-related query, use the workout analysis endpoint
    if (isWorkoutQuery(userMessage)) {
      try {
        const response = await fetch(new URL('/api/chat/workout-analysis', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage, userId: session.user.id }),
        });
        
        if (!response.ok) {
          throw new Error(`Workout analysis failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return NextResponse.json({ response: data.message });
      } catch (error) {
        console.error('Workout analysis error:', error);
        return NextResponse.json({ 
          response: "I'm having trouble analyzing your workout data right now. Please try again in a moment." 
        });
      }
    }

    // For non-workout queries, proceed with regular chat
    const greeting = await generatePersonalizedGreeting(session.user.id);
    
    const response = await client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are an AI fitness coach. ${greeting ? `The user's name is ${greeting}.` : ''} 
          Keep responses concise and focused on fitness, health, and wellness topics.
          If asked about specific workout data or statistics, inform the user you'll need to analyze their workout history first.`
        },
        ...messages
      ],
    });

    // Handle the response content safely
    const responseText = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : "I'm having trouble processing your request right now.";

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

function isWorkoutQuery(message: string): boolean {
  const workoutKeywords = [
    'workout', 'exercise', 'run', 'running', 'swim', 'swimming',
    'bike', 'cycling', 'strength', 'gym', 'weight', 'training',
    'distance', 'time', 'duration', 'pace', 'stats', 'progress'
  ];
  
  return workoutKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}
