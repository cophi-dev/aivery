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
    // Get user information first
    const user = await User.findById(userId).select("nickname name").lean() as UserDocument;
    const userDisplayName = user?.nickname || user?.name;

    // Get current date and time info for context-aware greetings
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isEvening = hour >= 17;
    const isMorning = hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;

    // Get fresh workout data using our helper
    const {
      recentWorkouts,
      totalWorkoutCount,
      thisWeeksWorkouts,
      hasWorkouts,
    } = await getFreshWorkouts(userId);

    if (!hasWorkouts) {
      // No workouts found, send a welcoming first-time message
      console.log(`[CHAT] No workouts found for user ${userId}`);
      return userDisplayName 
        ? `Welcome to your fitness journey, ${userDisplayName}! Ready to log your first workout? Let me know how I can help you get started.`
        : "Welcome to your fitness journey! Ready to log your first workout? Let me know how I can help you get started.";
    }

    // Get workout stats for most frequent type
    const workoutsCollection = await getCollection("workouts");
    const workoutTypes = await workoutsCollection
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Calculate streak and activity patterns
    let lastWorkoutDate = new Date(recentWorkouts[0].date);
    const daysSinceLastWorkout = Math.floor(
      (now.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Check if there's a workout scheduled for today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const todaysWorkouts = await workoutsCollection
      .find({
        userId: new ObjectId(userId),
        date: { $gte: startOfToday, $lte: endOfToday },
      })
      .toArray();

    // Add logic to determine if we need to show total workouts
    const showTotalWorkouts =
      thisWeeksWorkouts.length === 0 && totalWorkoutCount > 0;

    // Build rich context for the greeting
    const context = {
      // User context
      userDisplayName,
      
      // Time context
      isWeekend,
      isMorning,
      isAfternoon,
      isEvening,
      dayOfWeek,
      dayName: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][dayOfWeek],

      // Workout context
      totalWorkouts: totalWorkoutCount,
      workoutsThisWeek: thisWeeksWorkouts.length,
      daysSinceLastWorkout,
      hasWorkoutToday: todaysWorkouts.length > 0,
      scheduledWorkoutToday:
        todaysWorkouts.length > 0 ? todaysWorkouts[0].type : null,

      // Most recent workout
      lastWorkout: {
        type: recentWorkouts[0].type,
        date: new Date(recentWorkouts[0].date).toISOString(),
        distance: recentWorkouts[0].distance,
        duration: recentWorkouts[0].duration,
        intensity: recentWorkouts[0].intensity,
      },

      // Workout patterns
      preferredActivity: workoutTypes.length > 0 ? workoutTypes[0]._id : null,
      isConsistent: daysSinceLastWorkout <= 3, // Consider consistent if workout in last 3 days
      needsMotivation: daysSinceLastWorkout > 5, // Needs motivation if no workout in 5+ days

      // Achievement context (basic)
      isRecentAchievement:
        totalWorkoutCount % 10 === 0 || totalWorkoutCount % 25 === 0,
      recentMilestone:
        totalWorkoutCount % 25 === 0
          ? totalWorkoutCount
          : totalWorkoutCount % 10 === 0
            ? totalWorkoutCount
            : null,

      // Weekly status
      showTotalWorkouts,
      noWorkoutsThisWeek: thisWeeksWorkouts.length === 0,
      weeklyStatus:
        thisWeeksWorkouts.length === 0
          ? "no workouts yet this week"
          : `${thisWeeksWorkouts.length} workout${thisWeeksWorkouts.length === 1 ? "" : "s"} this week`,
    };

    // Safely serialize the context to JSON
    const safeContext = JSON.stringify(context);

    // Use Anthropic Claude to generate a personalized greeting
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      temperature: 0.9,
      system: `Act as a fitness coach creating a personalized greeting.

IMPORTANT: The user's name is "${userDisplayName}". ALWAYS use this exact name when addressing them. NEVER use any other names or generic terms.

REQUIREMENTS:
1. Keep to 1-2 short sentences
2. Mention one specific workout data point
3. Reference time of day/week
4. Use the user's exact name naturally
5. Avoid generic greetings
6. Be motivational but authentic`,
      messages: [
        {
          role: "user",
          content: safeContext,
        },
      ],
    });

    return getTextFromResponse(response.content) || null;
  } catch (error) {
    console.error("Error generating personalized greeting:", error);
    return null; // Fall back to default greeting
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
    // TEMPORARY DEBUG MODE - Add test user ID bypass
    // TO BE REMOVED IN PRODUCTION
    const body = await request.json();
    const testUserId = body.testUserId;
    const isDebugMode = body.debug === true && testUserId;
    let userId;
    let session;
    
    if (isDebugMode) {
      console.log("[CHAT] DEBUG MODE - Using test user ID:", testUserId);
      userId = testUserId;
      // Create a minimal session object for the rest of the code
      session = { 
        user: { 
          id: testUserId,
          name: "Test User",
          nickname: "Tester"
        } 
      };
    } else {
      // Normal authentication flow
      session = await getServerSession(authOptions);
      if (!session || !session.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      userId = session.user.id;
    }
    
    const messages = body.messages;
    const messageContent = messages[messages.length - 1].content;

    // Default system message
    let systemMessage = `Act as Aivery, a fitness assistant that helps track workouts.

1. Use client's exact name 
2. Provide concise responses
3. Reference specific workout data
4. Guide on workout logging when appropriate
5. Be supportive but not overly enthusiastic`;

    // Fetch user's AI preferences
    let aiPreferences = {};

    try {
      if (session?.user?.id) {
        await dbConnect();
        const userId = session.user.id;
        const user = await User.findById(userId)
          .select("aiPreferences nickname name")
          .lean() as UserDocument;

        if (user) {
          aiPreferences = user.aiPreferences || {};

          // Add user's name information to system message if available
          const userNickname = user.nickname;
          const userName = user.name;

          if (userNickname || userName) {
            systemMessage += `\n\nThe user's name is "${userNickname || userName}". Always address them by this exact name when appropriate. NEVER substitute it with any other name like "Alex" or generic terms if you know their actual name.`;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user data for chat:", error);
      // Continue with session data if database fetch fails
    }

    // Check for special command - greeting
    if (body.greeting) {
      const greeting = await generatePersonalizedGreeting(userId);
      if (greeting) {
        return NextResponse.json({ greeting });
      }
    }

    // Validate user session
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be logged in to use the chat" },
        { status: 401 },
      );
    }

    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage =
      userMessages[userMessages.length - 1]?.content || "";

    // Check if this is a request for an initial greeting
    const isGreetingRequest =
      messages.length === 1 &&
      messages[0].role === "user" &&
      messages[0].content === "__GREETING__";

    if (isGreetingRequest && session?.user?.id) {
      try {
        const personalizedGreeting = await generatePersonalizedGreeting(
          session.user.id,
        );

        if (personalizedGreeting) {
          return new Response(personalizedGreeting, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          });
        }
      } catch (error) {
        console.error("Error in greeting generation:", error);
        // Continue with normal processing if greeting fails
      }
    }

    // Ensure session user is properly serialized for sending to the AI
    const safeUser = {
      id:
        typeof session.user.id === "string"
          ? session.user.id
          : String(session.user.id),
      name: typeof session.user.name === "string" ? session.user.name : null,
      email: typeof session.user.email === "string" ? session.user.email : null,
      image: typeof session.user.image === "string" ? session.user.image : null,
      nickname:
        typeof session.user.nickname === "string"
          ? session.user.nickname
          : null,
    };

    // Always get the latest user data from the database to ensure we have the current nickname
    try {
      await dbConnect();
      const userDoc = await User.findById(session.user.id)
        .select("nickname name")
        .lean() as UserDocument;
      if (userDoc) {
        const userName = userDoc.nickname || userDoc.name;

        if (userName) {
          systemMessage += `\n\nThe user's name is "${userName}". Always address them by this exact name when appropriate. NEVER substitute it with any other name like "Alex" or generic terms if you know their actual name.`;
        }

        // Rest of existing code for AI preferences
      }
    } catch (error) {
      console.error("Error fetching user data for chat:", error);
      // Continue with session data if database fetch fails
    }

    // Log the final user data being used
    console.log(
      `[CHAT] Final user data: id=${safeUser.id}, nickname=${safeUser.nickname}, name=${safeUser.name}`,
    );

    // Create a system prompt with properly escaped user information
    const userNickname =
      safeUser.nickname || safeUser.name || "their name hasn't been set yet";
    const nameResponse = `Your name is ${safeUser.nickname || safeUser.name || "not set in your profile yet"}. How can I help with your fitness goals today?`;

    systemMessage += `\n\nUser Personalization Information:
    - The user's name/nickname is "${userNickname}".
    - Always use this name when directly asked about the user's name/nickname.
    - When the user asks "what's my name" or similar questions, directly answer with their name.

YOUR PERSONALITY & STYLE:
- Be warm, approachable and use natural language (not robotic or overly formal)
- Match the user's energy - casual with casual users, more technical with fitness enthusiasts
- Keep responses concise but helpful - don't ramble
- Use emojis sparingly but naturally to add personality 💪 🏃‍♀️
- Address the user directly and conversationally
- Show genuine enthusiasm for the user's fitness journey
- When appropriate, share brief personal anecdotes as if you were a real coach

YOUR CAPABILITIES:
- Provide fitness advice and workout recommendations
- Answer questions about training techniques and nutrition
- Motivate users in their fitness journey
- Suggest improvements to workout routines
- Explain exercise concepts in easy-to-understand terms

IMPORTANT - DATA HANDLING:
- If the user asks about their specific workout data or statistics, DO NOT make up specific numbers
- If a user asks about their workouts, the backend system will analyze their question and provide real data
- Let the system handle questions about when/how far/how many workouts the user has done
- For general fitness questions, provide helpful and accurate information

RESPONSE GUIDELINES:
- For greeting messages like "hi" or "hey", respond casually and use their name when possible
- Be conversational first, informational second
- Use natural language patterns with contractions (I'm, you're, that's)
- Vary your responses - don't be repetitive or formulaic
- Be encouraging without being cheesy

For example:
- User: "How was my run?" → Let the system analyze this query for specific data
- User: "Can you help with my workouts?" → "For sure! What kind of training are you into right now, and what specifically can I help with?"
- User: "What's my name?" → "${nameResponse}"
`;

    // Ensure system message is properly formatted (no backticks)
    if (systemMessage.startsWith("`") || systemMessage.endsWith("`")) {
      systemMessage = systemMessage.replace(/^`|`$/g, "");
    }

    // Add direct handling for "what's my name" type questions before calling Anthropic
    const isNameQuestion =
      latestUserMessage.toLowerCase().includes("what's my name") ||
      latestUserMessage.toLowerCase().includes("whats my name") ||
      latestUserMessage.toLowerCase().includes("what is my name");

    if (isNameQuestion && safeUser.nickname) {
      return new Response(
        `Your name is ${safeUser.nickname}. How can I help with your fitness journey today?`,
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        },
      );
    }

    // Determine if this question is asking about workout data
    console.log("[CHAT] Checking if message is a data query:", latestUserMessage);
    const dataKeywords = [
      "workout",
      "run",
      "exercise",
      "distance",
      "pace",
      "time",
      "how many",
      "how much",
      "how far",
      "how long",
      "stats",
      "summary",
      "progress",
      "tracked",
      "show me",
      "display",
      "list",
      "see my",
      "take a look",
      "this week",
      "last week",
      "recent",
      "mile",
      "kilometers",
      "training",
      "activity",
      "fitness",
      "cardio",
      "strength",
      "gym",
      "session",
      "log",
      "record",
      "history",
    ];

    const isLikelyDataQuery = dataKeywords.some((keyword) =>
      latestUserMessage.toLowerCase().includes(keyword),
    );

    console.log("[CHAT] Is data query?", isLikelyDataQuery, "User ID:", session?.user?.id);

    if (isLikelyDataQuery && session?.user?.id) {
      console.log("[CHAT] Starting data query processing for user:", session.user.id);
      try {
        console.log("[CHAT] Processing likely data query:", latestUserMessage);

        // First, analyze the query to understand what the user is asking for
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
              content: latestUserMessage,
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
          if (latestUserMessage.toLowerCase().includes("last week")) {
            console.log("[CHAT] Detected 'last week' query, setting timeFrame to last-week");
            queryAnalysis.timeFrame = "last-week";
          } else if (latestUserMessage.toLowerCase().includes("last month")) {
            console.log("[CHAT] Detected 'last month' query, setting timeFrame to last-month");
            queryAnalysis.timeFrame = "last-month";
          } else if (latestUserMessage.toLowerCase().includes("last year")) {
            console.log("[CHAT] Detected 'last year' query, setting timeFrame to last-year");
            queryAnalysis.timeFrame = "last-year";
          }
          
          // Detect workout type from query if not provided by analysis
          if (!queryAnalysis.workoutType && !queryAnalysis.filters?.workoutType) {
            if (latestUserMessage.toLowerCase().includes("run")) {
              console.log("[CHAT] Detected running query");
              queryAnalysis.workoutType = "running";
            } else if (latestUserMessage.toLowerCase().includes("swim")) {
              console.log("[CHAT] Detected swimming query");
              queryAnalysis.workoutType = "swimming";
            } else if (latestUserMessage.toLowerCase().includes("bike") || 
                     latestUserMessage.toLowerCase().includes("cycle") || 
                     latestUserMessage.toLowerCase().includes("cycling")) {
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

        // Get fresh workout data based on the analysis
        let workouts = [];
        let count = 0;
        
        // Handle special time cases like "last week"
        if (queryAnalysis.timeFrame === "last-week" || queryAnalysis.timeFrame === "last-month" || queryAnalysis.timeFrame === "last-year") {
          const now = new Date();
          let startDate = new Date();
          let endDate = new Date();
          
          if (queryAnalysis.timeFrame === "last-week") {
            // First get the start of this week (Monday)
            const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
            const daysFromMonday = day === 0 ? 6 : day - 1; // Convert to Monday=0, Sunday=6
            const thisWeekStart = new Date(now);
            thisWeekStart.setDate(now.getDate() - daysFromMonday);
            thisWeekStart.setHours(0, 0, 0, 0);
            
            // Last week is 7 days before the start of this week
            startDate = new Date(thisWeekStart);
            startDate.setDate(thisWeekStart.getDate() - 7);
            
            endDate = new Date(thisWeekStart);
            endDate.setDate(thisWeekStart.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            
            console.log("[CHAT] Looking for workouts from last week (Monday-Sunday):", 
              startDate.toISOString(), "to", endDate.toISOString());
          } else if (queryAnalysis.timeFrame === "last-month") {
            // Calculate last month's start and end dates
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastMonthYear = lastMonth === 11 ? now.getFullYear() - 1 : now.getFullYear();
            
            startDate = new Date(lastMonthYear, lastMonth, 1);
            endDate = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999);
          } else if (queryAnalysis.timeFrame === "last-year") {
            // Calculate last year's start and end dates
            const lastYear = now.getFullYear() - 1;
            startDate = new Date(lastYear, 0, 1);
            endDate = new Date(lastYear, 11, 31, 23, 59, 59, 999);
          }
          
          // Connect to DB and find workouts in the specific date range
          await dbConnect();
          const workoutsCollection = await getCollection("workouts");
          
          // Create filter for specific time period
          const filter: any = { 
            userId: new ObjectId(session.user.id),
            date: { $gte: startDate, $lte: endDate }
          };
          
          // Add workout type filter if specified
          const workoutType = queryAnalysis.workoutType;
          if (workoutType && typeof workoutType === 'string') {
            const typeRegex = new RegExp(workoutType, "i");
            filter.type = { $regex: typeRegex };
          }
          
          // Get workouts for the specific time period
          workouts = await workoutsCollection.find(filter).sort({ date: -1 }).toArray();
          count = workouts.length;
          
          console.log(`[CHAT] Found ${count} workouts in specified time period`);
        } else {
          // Use the normal filtered workout function for other time periods
          const result = await getFreshFilteredWorkouts(
            session.user.id,
            queryAnalysis.timeFrame,
            queryAnalysis.workoutType,
          );
          
          workouts = result.workouts;
          count = result.count;
        }

        // If we have workout data, format it into a response
        if (workouts.length > 0 || count > 0) {
          // Generate workout type summaries for more consistent data presentation
          const workoutSummaries = generateWorkoutTypeSummaries(workouts);

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
            userQuery: latestUserMessage,
            workouts: formatWorkouts(workouts),
            workoutSummaries,
            summariesByType: workoutSummaries.byType,
            formattedSummary: formatWorkoutSummaries(workoutSummaries, queryAnalysis.workoutType || 'running'),
            dateRange: workoutSummaries.dateRange,
            count,
            timeFrame: queryAnalysis.timeFrame || "all",
            workoutType: queryAnalysis.workoutType,
          });

          // Generate a natural language response
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
        } else {
          // No workouts found, create a friendly response
          console.log(
            "[CHAT] No matching workouts found, creating specific response",
          );

          // Create friendly response about no workouts found
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
        }
      } catch (error) {
        console.error("Error processing data query:", error);
        return new Response(
          "I'm having trouble processing your workout data request right now. Please try again in a moment.",
          {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            status: 503,
          },
        );
      }
    }

    // If we've gotten here, it's not a data query or name question - let's handle it as a regular chat message
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0.7,
      system: systemMessage,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const responseText = getTextFromResponse(response.content);

    return new Response(responseText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      "I'm having trouble processing your chat request right now. Please try again in a moment.",
      {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        status: 503,
      },
    );
  }
}
