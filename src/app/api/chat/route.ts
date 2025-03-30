import { openai } from "@ai-sdk/openai"
import { OpenAI } from "openai";
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
  getWorkoutTypeStats
} from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"
import { NextResponse } from "next/server"
import User from "@/lib/db/models/user"
import { IUser } from "@/lib/db/models/user"
import { getFreshWorkouts, getFreshFilteredWorkouts } from "./fresh-data"

// Force dynamic rendering and prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// Function to reset MongoDB connection for fresh data
async function resetAndGetFreshConnection() {
  // Clear the cached connection
  (global as any).mongoose = { conn: null, promise: null };
  // Get a fresh connection
  await dbConnect();
  return getCollection('workouts');
}

// Initialize the OpenAI SDK
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Allow responses up to 30 seconds
export const maxDuration = 30

// Helper function to calculate total weight lifted for strength workouts
function calculateTotalWeightLifted(workout: any): number {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0
  }
  
  return workout.exercises.reduce((total: number, exercise: any) => {
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      return total
    }
    
    const exerciseTotal = exercise.sets.reduce((setTotal: number, set: any) => {
      return setTotal + (set.weight || 0) * (set.reps || 0)
    }, 0)
    
    return total + exerciseTotal
  }, 0)
}

// Add after imports
interface WorkoutQuery {
  type: 'distance' | 'pace' | 'duration' | 'stats' | 'progress' | 'general';
  timeframe?: 'all' | 'year' | 'month' | 'week' | 'recent';
  workoutType?: string;
  specific?: string;
}

// Add before POST function
function analyzeWorkoutQuery(message: string): WorkoutQuery {
  const msg = message.toLowerCase();
  
  // Initialize query object
  const query: WorkoutQuery = {
    type: 'general'
  };

  // Detect workout type
  if (msg.includes('run') || msg.includes('running')) {
    query.workoutType = 'running';
  } else if (msg.includes('swim') || msg.includes('swimming')) {
    query.workoutType = 'swimming';
  } else if (msg.includes('cycl') || msg.includes('bike') || msg.includes('biking')) {
    query.workoutType = 'cycling';
  } else if (msg.includes('strength') || msg.includes('gym') || msg.includes('weight')) {
    query.workoutType = 'strength';
  }

  // Detect query type - enhance pace detection
  if (msg.includes('pace') || msg.includes('fastest') || msg.includes('speed') || msg.includes('quick')) {
    query.type = 'pace';
    if (msg.includes('fastest') || msg.includes('best') || msg.includes('quickest')) {
      query.specific = 'fastest';
    }
  } else if (msg.includes('distance') || msg.includes('far') || msg.includes('km') || msg.includes('kilometers')) {
    query.type = 'distance';
  } else if (msg.includes('time') || msg.includes('long') || msg.includes('duration')) {
    query.type = 'duration';
  } else if (msg.includes('stats') || msg.includes('statistics')) {
    query.type = 'stats';
  } else if (msg.includes('progress') || msg.includes('improve') || msg.includes('better')) {
    query.type = 'progress';
  }

  // Detect timeframe
  if (msg.includes('all time') || msg.includes('total') || msg.includes('ever')) {
    query.timeframe = 'all';
  } else if (msg.includes('this year') || msg.includes('year')) {
    query.timeframe = 'year';
  } else if (msg.includes('this month') || msg.includes('month')) {
    query.timeframe = 'month';
  } else if (msg.includes('this week') || msg.includes('week')) {
    query.timeframe = 'week';
  } else if (msg.includes('recent') || msg.includes('latest') || msg.includes('last')) {
    query.timeframe = 'recent';
  }

  // Detect specific queries
  if (msg.includes('longest')) {
    query.specific = 'longest';
  } else if (msg.includes('average') || msg.includes('avg')) {
    query.specific = 'average';
  }

  return query;
}

// Add before POST function
async function generatePersonalizedGreeting(userId: string): Promise<string | null> {
  try {
    // Get current date and time info for context-aware greetings
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
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
      hasWorkouts
    } = await getFreshWorkouts(userId);
    
    if (!hasWorkouts) {
      // No workouts found, send a welcoming first-time message
      console.log(`[CHAT] No workouts found for user ${userId}`);
      return "Welcome to your fitness journey! Ready to log your first workout? Let me know how I can help you get started.";
    }
    
    // Get workout stats for most frequent type
    const workoutsCollection = await getCollection('workouts');
    const workoutTypes = await workoutsCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Calculate streak and activity patterns
    let lastWorkoutDate = new Date(recentWorkouts[0].date);
    const daysSinceLastWorkout = Math.floor((now.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if there's a workout scheduled for today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    
    const todaysWorkouts = await workoutsCollection.find({
      userId: new ObjectId(userId),
      date: { $gte: startOfToday, $lte: endOfToday }
    }).toArray();
    
    // Add logic to determine if we need to show total workouts
    const showTotalWorkouts = thisWeeksWorkouts.length === 0 && totalWorkoutCount > 0;
    
    // Build rich context for the greeting
    const context = {
      // Time context
      isWeekend,
      isMorning,
      isAfternoon,
      isEvening,
      dayOfWeek,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
      
      // Workout context
      totalWorkouts: totalWorkoutCount,
      workoutsThisWeek: thisWeeksWorkouts.length,
      daysSinceLastWorkout,
      hasWorkoutToday: todaysWorkouts.length > 0,
      scheduledWorkoutToday: todaysWorkouts.length > 0 ? todaysWorkouts[0].type : null,
      
      // Most recent workout
      lastWorkout: {
        type: recentWorkouts[0].type,
        date: new Date(recentWorkouts[0].date).toISOString(),
        distance: recentWorkouts[0].distance,
        duration: recentWorkouts[0].duration,
        intensity: recentWorkouts[0].intensity
      },
      
      // Workout patterns
      preferredActivity: workoutTypes.length > 0 ? workoutTypes[0]._id : null,
      isConsistent: daysSinceLastWorkout <= 3, // Consider consistent if workout in last 3 days
      needsMotivation: daysSinceLastWorkout > 5, // Needs motivation if no workout in 5+ days
      
      // Achievement context (basic)
      isRecentAchievement: totalWorkoutCount % 10 === 0 || totalWorkoutCount % 25 === 0,
      recentMilestone: totalWorkoutCount % 25 === 0 ? totalWorkoutCount : 
                      totalWorkoutCount % 10 === 0 ? totalWorkoutCount : null,
      
      // Weekly status
      showTotalWorkouts,
      noWorkoutsThisWeek: thisWeeksWorkouts.length === 0,
      weeklyStatus: thisWeeksWorkouts.length === 0 
        ? "no workouts yet this week"
        : `${thisWeeksWorkouts.length} workout${thisWeeksWorkouts.length === 1 ? '' : 's'} this week`
    };
    
    // Safely serialize the context to JSON  
    const safeContext = JSON.stringify(context);
    
    // Use OpenAI to generate a personalized greeting
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a friendly fitness coach generating a personalized greeting based on the user's workout data and current context. Make your greeting genuinely personalized, timely, and relevant.

GUIDELINES:
- Generate a brief, energetic greeting (1-2 sentences)
- DON'T use generic phrases like "Welcome back!" or "How can I help you today?"
- DO reference specific context like day of week, time of day, or recent workout patterns
- If the user hasn't worked out in 5+ days, offer gentle encouragement, not criticism
- If they've been consistent, acknowledge and praise that consistency
- If it's a weekend, weekend-specific greetings are great
- Mention specific workout types they prefer when relevant
- If they hit a round-number milestone (10, 25, 50, etc workouts), celebrate that
- Make it sound natural and conversational - how a real coach would text their client
- Use markdown formatting for emphasis of METRICS (not names): **10 workouts**, **5.2 miles**
- AVOID putting the user's name in bold formatting to prevent visibility issues
- Use emojis naturally (but sparingly) to add personality: 💪 🏃‍♀️ 🏋️‍♂️ 🎯 🔥

IMPORTANT GUIDELINES:
- When the user has no workouts logged this week but has a workout history, mention their TOTAL workout count
- When showing total workouts and it's been a while since their last workout, always add an encouraging workout suggestion
- NEVER use the same greeting pattern more than once - vary your style significantly
- DO NOT start with "Happy [day]!" or similar standard greetings every time
- Add freshness and variety to each greeting
- USE DIFFERENT EMOJI combinations each time

CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}
`
        },
        {
          role: "user",
          content: safeContext
        }
      ],
      temperature: 0.9,
      max_tokens: 300,
    });
    
    return response.choices[0].message?.content || null;
  } catch (error) {
    console.error("Error generating personalized greeting:", error);
    return null; // Fall back to default greeting
  }
}

// Add interface definition for AIQueryRequest
interface AIQueryRequest {
  query: string;
  userId: string;
  queryType: 'workout_data' | 'user_info';
}

// Helper function for fetching user workout data
const fetchUserWorkoutData = async (userId: string, queryType: string, timeframe?: string) => {
  try {
    // Force database reconnection to prevent cache issues
    await dbConnect();
    
    // Force fresh connection to workouts collection
    const workoutsCollection = await getCollection('workouts');
    
    // Add a timestamp to the query to prevent caching
    const cacheKey = Date.now();
    
    // Base filter: workouts for this user
    const filter: any = { 
      userId: new ObjectId(userId),
      _cacheKey: cacheKey // This doesn't affect the query but ensures uniqueness
    };
    
    // Add date filtering if timeframe is specified
    if (timeframe) {
      const now = new Date();
      let startDate = new Date();
      
      if (timeframe.includes('week') || timeframe.includes('this week')) {
        // Start of current week (Sunday)
        const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
      } 
      else if (timeframe.includes('month') || timeframe.includes('this month')) {
        // Start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      else if (timeframe.includes('year') || timeframe === '2024' || timeframe.includes('2024')) {
        // Current year or specific year
        if (timeframe === '2024' || timeframe.includes('2024')) {
          filter.date = {
            $gte: new Date('2024-01-01T00:00:00.000Z'),
            $lt: new Date('2025-01-01T00:00:00.000Z')
          };
        } 
        else if (timeframe.includes('2025')) {
          filter.date = {
            $gte: new Date('2025-01-01T00:00:00.000Z'),
            $lt: new Date('2026-01-01T00:00:00.000Z')
          };
        } 
        else {
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
    if (queryType === 'longest_run') {
      // Add type filter for runs
      filter.type = { $regex: /run/i };
      
      // Find the workout with the longest distance
      const longestRun = await workoutsCollection
        .find(filter)
        .sort({ distance: -1 })
        .limit(1)
        .toArray();
        
      return longestRun.length > 0 ? longestRun[0] : null;
    }
    else if (queryType === 'recent_workouts') {
      // Get recent workouts (last 5)
      const recentWorkouts = await workoutsCollection
        .find(filter)
        .sort({ date: -1 })
        .limit(5)
        .toArray();
        
      return recentWorkouts;
    }
    else if (queryType === 'list_workouts') {
      // Get workouts for the period, sorted by date
      const workouts = await workoutsCollection
        .find(filter)
        .sort({ date: -1 })
        .limit(10) // Limit to 10 workouts for readability
        .toArray();
        
      return workouts;
    }
    else if (queryType === 'workout_count') {
      // Count workouts
      const count = await workoutsCollection.countDocuments(filter);
      return { count };
    }
    else if (queryType === 'workout_summary') {
      // Get count of all workouts
      const total = await workoutsCollection.countDocuments(filter);
      
      // Get breakdown by workout type
      const workouts = await workoutsCollection.find(filter).toArray();
      const types: Record<string, number> = {};
      
      workouts.forEach((workout: any) => {
        const type = workout.type || 'unknown';
        types[type] = (types[type] || 0) + 1;
      });
      
      return { total, types };
    }
    else if (queryType === 'last_run') {
      // Get the most recent run
      const runFilter = { ...filter, type: { $regex: /run/i } };
      const lastRun = await workoutsCollection
        .find(runFilter)
        .sort({ date: -1 })
        .limit(1)
        .toArray();
        
      return lastRun.length > 0 ? lastRun[0] : null;
    }
    else if (queryType === 'total_distance') {
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
}

// Helper function to generate consistent workout summaries by type
const generateWorkoutTypeSummaries = (workouts: any[]) => {
  // Normalize workout types - map display names to standardized types
  const normalizeWorkoutType = (type: string) => {
    type = type.toLowerCase();
    if (type.includes('run') || type.includes('running')) return 'running';
    if (type.includes('swim') || type.includes('swimming')) return 'swimming';
    if (type.includes('strength') || type.includes('weight')) return 'strength training';
    if (type.includes('cycl') || type.includes('bike')) return 'cycling';
    if (type.includes('cardio')) return 'cardio';
    return type;
  };

  // Group workouts by normalized type
  const workoutsByType: Record<string, any[]> = {};
  
  workouts.forEach(workout => {
    const normalizedType = normalizeWorkoutType(workout.type || 'other');
    if (!workoutsByType[normalizedType]) {
      workoutsByType[normalizedType] = [];
    }
    workoutsByType[normalizedType].push(workout);
  });

  // Calculate summaries for each type
  const summaries: Record<string, any> = {};
  
  Object.entries(workoutsByType).forEach(([type, typeWorkouts]) => {
    const totalDuration = typeWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const workoutsWithDistance = typeWorkouts.filter(w => w.distance && w.distance > 0);
    
    // Ensure consistent distance units (convert to km for swimming if needed)
    const totalDistance = workoutsWithDistance.reduce((sum, w) => {
      let distance = parseFloat(w.distance) || 0;
      // Handle unit conversions if needed
      if (w.distanceUnit === 'miles') {
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
      averageIntensity: typeWorkouts.some(w => w.intensity) 
        ? typeWorkouts.map(w => {
            const intensity = (w.intensity || '').toLowerCase();
            if (intensity.includes('high')) return 3;
            if (intensity.includes('medium')) return 2;
            if (intensity.includes('low')) return 1;
            return 0;
          }).reduce((sum: number, val: number) => sum + val, 0) / typeWorkouts.filter(w => w.intensity).length
        : null,
      workouts: typeWorkouts,
      // Store dates for easy reference
      dates: typeWorkouts.map(w => new Date(w.date)).sort((a, b) => b.getTime() - a.getTime()),
      // If applicable (future metrics)
      totalCalories: typeWorkouts.reduce((sum, w) => sum + (parseInt(w.calories) || 0), 0)
    };
  });

  return summaries;
};

// Process AI data request function
const processAIDataRequest = async (request: AIQueryRequest) => {
  try {
    const { query, userId, queryType } = request;

    // First, use OpenAI to understand what the user is asking for
    const queryAnalysisResponse = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a data analyst for a fitness app. Analyze the user's query and extract:
          1. The type of data they're asking for (e.g., runs, workouts, distances)
          2. The time period they're interested in (e.g., this week, 2024, all time)
          3. Any specific filters or conditions
          
          Return a JSON object with these fields:
          {
            "dataType": "runs|workouts|distance|duration|count|lastRun|longestRun|workoutList|etc",
            "timeFrame": "week|month|year|2024|2025|all",
            "filters": {
              "workoutType": "run|strength|cycling|etc", // if applicable
              "aggregation": "sum|max|min|avg|latest", // if applicable
              "metric": "distance|duration|pace|count", // if applicable
              "format": "list|single|summary|detailed", // how to present data
              "includeDetails": true|false // whether to include full workout details
            }
          }
          
          IMPORTANT GUIDELINES:
          - If the user asks to see, show, display or list workouts for a period, use dataType "workoutList" 
            and set format to "detailed" in filters
          - When a user asks about "this week's workouts" or similar, set timeFrame to "week" and format to "detailed"
          - If a user specifically requests to "see" or "take a look" at workouts, set includeDetails to true
          - When formatting is important (like showing a list), specify format as "detailed"
          
          Be precise and only return this JSON object.`
        },
        {
          role: "user", 
          content: query
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    // Parse the AI's analysis of the user query
    const analysisText = queryAnalysisResponse.choices[0].message?.content || '{}';
    const queryAnalysis = JSON.parse(analysisText);
    
    console.log("Query analysis:", queryAnalysis);
    
    // Connect to the database
    await dbConnect();
    const workoutsCollection = await getCollection('workouts');
    
    // Build a database query based on the AI's analysis
    const dbFilter: any = { userId: new ObjectId(userId) };
    
    // Apply time frame filter
    if (queryAnalysis.timeFrame) {
      const now = new Date();
      
      if (queryAnalysis.timeFrame === 'week') {
        const day = now.getDay();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        dbFilter.date = { $gte: startDate };
      } 
      else if (queryAnalysis.timeFrame === 'month') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        dbFilter.date = { $gte: startDate };
      }
      else if (queryAnalysis.timeFrame === '2024') {
        dbFilter.date = {
          $gte: new Date('2024-01-01T00:00:00.000Z'),
          $lt: new Date('2025-01-01T00:00:00.000Z')
        };
      }
      else if (queryAnalysis.timeFrame === '2025') {
        dbFilter.date = {
          $gte: new Date('2025-01-01T00:00:00.000Z'),
          $lt: new Date('2026-01-01T00:00:00.000Z')
        };
      }
      else if (queryAnalysis.timeFrame === 'year') {
        const startDate = new Date(now.getFullYear(), 0, 1);
        dbFilter.date = { $gte: startDate };
      }
    }
    
    // Apply workout type filter
    if (queryAnalysis.filters?.workoutType) {
      const typeRegex = new RegExp(queryAnalysis.filters.workoutType, 'i');
      dbFilter.type = { $regex: typeRegex };
    }
    
    // Execute different queries based on what the user wants
    let result: any = null;
    const format = queryAnalysis.filters?.format || 'single';
    const includeDetails = queryAnalysis.filters?.includeDetails === true;
    
    if (queryAnalysis.dataType === 'longestRun' || 
        (queryAnalysis.dataType === 'runs' && queryAnalysis.filters?.aggregation === 'max' && queryAnalysis.filters?.metric === 'distance')) {
      // Get the longest run
      if (!dbFilter.type) dbFilter.type = { $regex: /run/i };
      
      const longestRun = await workoutsCollection
        .find(dbFilter)
        .sort({ distance: -1 })
        .limit(1)
        .toArray();
        
      result = longestRun.length > 0 ? longestRun[0] : null;
    }
    else if (queryAnalysis.dataType === 'lastRun' || 
            (queryAnalysis.dataType === 'runs' && queryAnalysis.filters?.aggregation === 'latest')) {
      // Get the most recent run
      if (!dbFilter.type) dbFilter.type = { $regex: /run/i };
      
      const lastRun = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(1)
        .toArray();
        
      result = lastRun.length > 0 ? lastRun[0] : null;
    }
    else if (queryAnalysis.dataType === 'workoutList' || 
            (queryAnalysis.dataType === 'workouts' && format === 'detailed')) {
      // Get a detailed list of workouts with full formatting
      const workouts = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(10)
        .toArray();
        
      // Process workouts to include day names and format dates
      const processedWorkouts = workouts.map((workout: any) => {
        const workoutDate = new Date(workout.date);
        const dayName = workoutDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = workoutDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        
        return {
          ...workout,
          dayName,
          formattedDate: `${dayName}, ${dateStr}`,
          // Format duration as hours and minutes if needed
          formattedDuration: workout.duration ? 
            (workout.duration >= 60 ? 
              `${Math.floor(workout.duration / 60)}h ${workout.duration % 60}m` : 
              `${workout.duration} minutes`) : 
            null,
          // Format distance with units
          formattedDistance: workout.distance ? 
            `${workout.distance} ${workout.distanceUnit || 'miles'}` : 
            null
        };
      });
      
      result = {
        workouts: processedWorkouts,
        count: processedWorkouts.length,
        timeFrame: queryAnalysis.timeFrame || 'recent',
        includeDetails
      };
    }
    else if (queryAnalysis.dataType === 'workouts' && format === 'list') {
      // Get a list of workouts
      const workouts = await workoutsCollection
        .find(dbFilter)
        .sort({ date: -1 })
        .limit(10)
        .toArray();
      
      result = workouts;
    }
    else if (queryAnalysis.dataType === 'count' || queryAnalysis.filters?.metric === 'count') {
      // Count workouts
      const count = await workoutsCollection.countDocuments(dbFilter);
      result = { count };
    }
    else if (queryAnalysis.dataType === 'distance' && queryAnalysis.filters?.aggregation === 'sum') {
      // Calculate total distance
      if (!dbFilter.type && queryAnalysis.filters?.workoutType === 'run') {
        dbFilter.type = { $regex: /run/i };
      }
      
      const workouts = await workoutsCollection.find(dbFilter).toArray();
      const totalDistance = workouts.reduce((sum: number, workout: any) => {
        return sum + (parseFloat(workout.distance) || 0);
      }, 0);
      
      result = { 
        totalDistance: Math.round(totalDistance * 100) / 100,
        count: workouts.length,
        timeFrame: queryAnalysis.timeFrame || 'all time',
        workoutType: queryAnalysis.filters?.workoutType || 'all workouts'
      };
    }
    else if (queryAnalysis.dataType === 'summary') {
      // Get workout summary
      const total = await workoutsCollection.countDocuments(dbFilter);
      const workouts = await workoutsCollection.find(dbFilter).toArray();
      
      const types: Record<string, number> = {};
      workouts.forEach((workout: any) => {
        const type = workout.type || 'unknown';
        types[type] = (types[type] || 0) + 1;
      });
      
      // Also calculate total distance if applicable
      let totalDistance = 0;
      if (queryAnalysis.filters?.metric === 'distance') {
        totalDistance = workouts.reduce((sum: number, workout: any) => {
          return sum + (parseFloat(workout.distance) || 0);
        }, 0);
      }
      
      result = { 
        total, 
        types,
        totalDistance: Math.round(totalDistance * 100) / 100
      };
    }
    
    // Use OpenAI to generate a natural language response
    if (result) {
      // Generate workout type summaries for more consistent data presentation
      const workoutSummaries = generateWorkoutTypeSummaries(result.workouts);
      
      const contextMessage = JSON.stringify({
        userQuery: query,
        workouts: result.workouts || [],
        workoutSummaries,
        summariesByType: workoutSummaries.byType,
        dateRange: workoutSummaries.dateRange,
        count: result.count,
        timeFrame: queryAnalysis.timeFrame || 'all',
        workoutType: queryAnalysis.workoutType
      });
      
      const responseGeneration = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a friendly fitness coach. Generate a natural, conversational response based on the user's query and the workout data provided.
            Create a response that directly answers their question using the specific data.
            Be concise but personable - like a real coach would talk to their client.
            Never mention that you're analyzing data or that data was retrieved from a database.
            Just present the information conversationally as if you already knew it.
            
            IMPORTANT DATA CONSISTENCY GUIDELINES:
            - For swimming workouts, always display distance in kilometers (km) or meters (m)
            - For running or cycling, use the units provided (miles or km)
            - When summarizing workout types, normalize the names (e.g., "Evening Swimming" → "Swimming")
            - Ensure swimming distances are consistent across all mentions
            - When calculating totals, make sure units are consistent
            - Use the pre-calculated summaries object for accurate aggregated data
            - Only include workouts from the timeframe the user asked about, do not mention workouts outside that timeframe
            - Be precise about dates - if the user asks about "this week", only include workouts from Monday to today
            - IMPORTANT: DO NOT include workouts from a different timeframe than what was requested
            - The "dateRange" in the provided data shows the exact range of workouts that are relevant to the query
            - Focus strictly on workouts within the date range specified
            - Do NOT list workout types with zero workouts in the requested timeframe
            - If the user asks about activities other than their main workout type and there are none, simply state they didn't do other activities in that timeframe
            
            FORMATTING INSTRUCTIONS:
            - Use **bold** for numbers and metrics, NOT for names or workout types
            - Use *italics* for workout types or intensity levels
            - Use # and ## for headings when showing lists or summaries
            - Use proper line breaks with double spaces or blank lines between paragraphs
            - Use bullet points with * or - for lists
            - For workout entries, format them clearly
            
            EXAMPLE FOR SWIMMING SUMMARY:
            
            Swimming
            - Workout Count: **2**
            - Total Distance: **1.6 km**
            - Total Duration: **85 minutes**
            - Average Intensity: *Medium*
            `
          },
          {
            role: "user",
            content: contextMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });
      
      return new Response(responseGeneration.choices[0].message?.content || "I couldn't find any workout data that matches your request.", {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    }
    
    // No workouts found, let OpenAI handle it
    console.log("[CHAT] No matching workouts found, falling back to general response");
    
    // Create a friendly response about no workouts found
    const timeFrameText = queryAnalysis.timeFrame === 'week' ? 'this week' : 
                        queryAnalysis.timeFrame === 'month' ? 'this month' :
                        queryAnalysis.timeFrame === 'year' ? 'this year' : 'for that time period';
    
    const workoutTypeText = queryAnalysis.workoutType ? 
                          `any ${queryAnalysis.workoutType} workouts ${timeFrameText}` : 
                          `any workouts ${timeFrameText}`;
                          
    // Create a more personalized no-workouts response
    const noWorkoutsResponse = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a friendly, supportive fitness coach. The user has asked about their workouts ${timeFrameText}, but they don't have any logged. 
          Generate a brief, encouraging response that:
          1. Acknowledges they haven't logged any workouts ${timeFrameText}
          2. Remains positive and supportive
          3. Encourages them to get moving with a specific suggestion
          4. Uses a casual, conversational tone
          5. Includes at most one emoji
          Keep it short (1-2 sentences max) and make it sound natural and varied.`
        },
        {
          role: "user",
          content: `Create a response about not having ${workoutTypeText}.`
        }
      ],
      temperature: 0.8,
      max_tokens: 100,
    });
    
    return new Response(noWorkoutsResponse.choices[0].message?.content || `I don't see ${workoutTypeText}. Would you like to log a workout now?`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      }
    });
  } catch (error) {
    console.error("Error processing AI data request:", error);
    return new Response(
      "I'm having trouble processing your workout data request right now. Please try again in a moment.",
      { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 503
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Validate that the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const messages = body.messages;
    const messageContent = messages[messages.length - 1].content;
    
    // Default system message
    let systemMessage = `You are Aivery, a knowledgeable fitness AI assistant that helps users track their workouts and reach their fitness goals. 
    Keep responses concise, supportive and practical. You can analyze workout data, suggest improvements, and motivate users.`;

    // Fetch user's AI preferences
    await dbConnect();
    const userDoc = await User.findById(userId).select('aiPreferences').lean() as any;
    
    // If user has AI preferences, include them in the system message
    if (userDoc && userDoc.aiPreferences) {
      const prefs = userDoc.aiPreferences;
      let prefsContext = "";
      
      if (prefs.location) {
        prefsContext += `\nThe user is located in ${prefs.location}.`;
      }
      
      if (prefs.units) {
        prefsContext += `\nThe user prefers ${prefs.units === 'metric' ? 'metric units (kg, km)' : 'imperial units (lb, miles)'}.`;
      }
      
      if (prefs.trainingPreferences) {
        prefsContext += `\nThe user's training preferences: ${prefs.trainingPreferences}`;
      }
      
      if (prefs.fitnessGoals) {
        prefsContext += `\nThe user's fitness goals: ${prefs.fitnessGoals}`;
      }
      
      if (prefs.dietaryPreferences) {
        prefsContext += `\nThe user's dietary preferences: ${prefs.dietaryPreferences}`;
      }
      
      if (prefsContext) {
        systemMessage += `\n\nUser Personalization Information:${prefsContext}\n\nIncorporate this personalization context when relevant, but there's no need to explicitly mention you have this information unless directly asked.`;
      }
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
        { status: 401 }
      );
    }
    
    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || "";
    
    // Check if this is a request for an initial greeting
    const isGreetingRequest = messages.length === 1 && 
                              messages[0].role === "user" && 
                              messages[0].content === "__GREETING__";
    
    if (isGreetingRequest && session?.user?.id) {
      try {
        const personalizedGreeting = await generatePersonalizedGreeting(session.user.id);
        
        if (personalizedGreeting) {
          return new Response(personalizedGreeting, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            }
          });
        }
      } catch (error) {
        console.error("Error in greeting generation:", error);
        // Continue with normal processing if greeting fails
      }
    }
    
    // Ensure session user is properly serialized for sending to the AI
    const safeUser = {
      id: typeof session.user.id === 'string' ? session.user.id : String(session.user.id),
      name: typeof session.user.name === 'string' ? session.user.name : null,
      email: typeof session.user.email === 'string' ? session.user.email : null,
      image: typeof session.user.image === 'string' ? session.user.image : null,
      nickname: typeof session.user.nickname === 'string' ? session.user.nickname : null
    };
    
    // Always get the latest user data from the database to ensure we have the current nickname
    try {
      await dbConnect();
      const userDoc = await User.findById(session.user.id).select('nickname name').lean();
      if (userDoc) {
        // Use nickname from the database as first priority
        safeUser.nickname = (userDoc as any).nickname || safeUser.nickname || safeUser.name;
        
        if (safeUser.nickname) {
          console.log(`[CHAT] Using nickname from database: ${safeUser.nickname}`);
        }
      }
    } catch (error) {
      console.error("Error fetching user data for chat:", error);
      // Continue with session data if database fetch fails
    }
    
    // Log the final user data being used
    console.log(`[CHAT] Final user data: id=${safeUser.id}, nickname=${safeUser.nickname}, name=${safeUser.name}`);
    
    // Create a system prompt with properly escaped user information
    const userNickname = safeUser.nickname || safeUser.name || 'their name hasn\'t been set yet';
    const nameResponse = `Your name is ${safeUser.nickname || safeUser.name || 'not set in your profile yet'}. How can I help with your fitness goals today?`;
    
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
    if (systemMessage.startsWith('`') || systemMessage.endsWith('`')) {
      systemMessage = systemMessage.replace(/^`|`$/g, '');
    }
    
    // Add direct handling for "what's my name" type questions before calling OpenAI
    const isNameQuestion = latestUserMessage.toLowerCase().includes("what's my name") || 
                           latestUserMessage.toLowerCase().includes("whats my name") ||
                           latestUserMessage.toLowerCase().includes("what is my name");
    
    if (isNameQuestion && safeUser.nickname) {
      return new Response(`Your name is ${safeUser.nickname}. How can I help with your fitness journey today?`, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    }
    
    // Determine if this question is asking about workout data
    const dataKeywords = ['workout', 'run', 'exercise', 'distance', 'pace', 'time', 
                         'how many', 'how much', 'how far', 'how long',
                         'stats', 'summary', 'progress', 'tracked',
                         'show me', 'display', 'list', 'see my', 'take a look',
                         'this week', 'last week', 'recent', 'mile', 'kilometers',
                         'training', 'activity', 'fitness', 'cardio', 'strength',
                         'gym', 'session', 'log', 'record', 'history'];
    
    const isLikelyDataQuery = dataKeywords.some(keyword => 
      latestUserMessage.toLowerCase().includes(keyword)
    );
    
    if (isLikelyDataQuery && session?.user?.id) {
      try {
        console.log("[CHAT] Processing likely data query:", latestUserMessage);
        
        // First, analyze the query to understand what the user is asking for
        const queryAnalysisResponse = await client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a data analyst for a fitness app. Analyze the user's query and extract:
              1. The type of data they're asking for (e.g., runs, workouts, distances)
              2. The time period they're interested in (e.g., this week, 2024, all time)
              3. Any specific filters or conditions
              
              Return a JSON object with these fields:
              {
                "dataType": "runs|workouts|distance|duration|count|lastRun|longestRun|workoutList|etc",
                "timeFrame": "week|month|year|all",
                "workoutType": "run|strength|cycling|etc" // if applicable
              }
              
              Keep it simple and direct. Only include fields if they're clearly specified in the query.`
            },
            {
              role: "user", 
              content: latestUserMessage
            }
          ],
          temperature: 0,
          response_format: { type: "json_object" }
        });

        // Parse the analysis
        const analysisText = queryAnalysisResponse.choices[0].message?.content || '{}';
        const queryAnalysis = JSON.parse(analysisText);
        
        console.log("[CHAT] Query analysis:", queryAnalysis);
        
        // Get fresh workout data based on the analysis
        const { workouts, count } = await getFreshFilteredWorkouts(
          session.user.id, 
          queryAnalysis.timeFrame, 
          queryAnalysis.workoutType
        );
        
        // If we have workout data, format it into a response
        if (workouts.length > 0 || count > 0) {
          // Generate workout type summaries for more consistent data presentation
          const workoutSummaries = generateWorkoutTypeSummaries(workouts);
          
          const contextMessage = JSON.stringify({
            userQuery: latestUserMessage,
            workouts,
            workoutSummaries,
            summariesByType: workoutSummaries.byType,
            dateRange: workoutSummaries.dateRange,
            count,
            timeFrame: queryAnalysis.timeFrame || 'all',
            workoutType: queryAnalysis.workoutType
          });
          
          // Generate a natural language response
          const responseGeneration = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `You are a friendly fitness coach. Generate a natural, conversational response based on the user's query and the workout data provided.
                Create a response that directly answers their question using the specific data.
                Be concise but personable - like a real coach would talk to their client.
                Never mention that you're analyzing data or that data was retrieved from a database.
                Just present the information conversationally as if you already knew it.
                
                IMPORTANT DATA CONSISTENCY GUIDELINES:
                - For swimming workouts, always display distance in kilometers (km) or meters (m)
                - For running or cycling, use the units provided (miles or km)
                - When summarizing workout types, normalize the names (e.g., "Evening Swimming" → "Swimming")
                - Ensure swimming distances are consistent across all mentions
                - When calculating totals, make sure units are consistent
                - Use the pre-calculated summaries object for accurate aggregated data
                - Only include workouts from the timeframe the user asked about, do not mention workouts outside that timeframe
                - Be precise about dates - if the user asks about "this week", only include workouts from Monday to today
                - IMPORTANT: DO NOT include workouts from a different timeframe than what was requested
                - The "dateRange" in the provided data shows the exact range of workouts that are relevant to the query
                - Focus strictly on workouts within the date range specified
                - Do NOT list workout types with zero workouts in the requested timeframe
                - If the user asks about activities other than their main workout type and there are none, simply state they didn't do other activities in that timeframe
                
                FORMATTING INSTRUCTIONS:
                - Use **bold** for numbers and metrics, NOT for names or workout types
                - Use *italics* for workout types or intensity levels
                - Use # and ## for headings when showing lists or summaries
                - Use proper line breaks with double spaces or blank lines between paragraphs
                - Use bullet points with * or - for lists
                - For workout entries, format them clearly
                
                EXAMPLE FOR SWIMMING SUMMARY:
                
                Swimming
                - Workout Count: **2**
                - Total Distance: **1.6 km**
                - Total Duration: **85 minutes**
                - Average Intensity: *Medium*
                `
              },
              {
                role: "user",
                content: contextMessage
              }
            ],
            temperature: 0.7,
            max_tokens: 500,
          });
          
          return new Response(responseGeneration.choices[0].message?.content || "I couldn't find any workout data that matches your request.", {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            }
          });
        } else {
          // No workouts found, create a friendly response
          console.log("[CHAT] No matching workouts found, creating specific response");
          
          // Create friendly response about no workouts found
          const timeFrameText = queryAnalysis.timeFrame === 'week' ? 'this week' : 
                              queryAnalysis.timeFrame === 'month' ? 'this month' :
                              queryAnalysis.timeFrame === 'year' ? 'this year' : 'for that time period';
          
          const workoutTypeText = queryAnalysis.workoutType ? 
                                `any ${queryAnalysis.workoutType} workouts ${timeFrameText}` : 
                                `any workouts ${timeFrameText}`;
                                
          // Create a more personalized no-workouts response
          const noWorkoutsResponse = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `You are a friendly, supportive fitness coach. The user has asked about their workouts ${timeFrameText}, but they don't have any logged. 
                Generate a brief, encouraging response that:
                1. Acknowledges they haven't logged any workouts ${timeFrameText}
                2. Remains positive and supportive
                3. Encourages them to get moving with a specific suggestion
                4. Uses a casual, conversational tone
                5. Includes at most one emoji
                Keep it short (1-2 sentences max) and make it sound natural and varied.`
              },
              {
                role: "user",
                content: `Create a response about not having ${workoutTypeText}.`
              }
            ],
            temperature: 0.8,
            max_tokens: 100,
          });
          
          return new Response(noWorkoutsResponse.choices[0].message?.content || `I don't see ${workoutTypeText}. Would you like to log a workout now?`, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            }
          });
        }
      } catch (error) {
        console.error("Error processing data query:", error);
        // Fall through to normal processing if data query fails
        return new Response(
          "I'm having trouble retrieving your workout data right now. Let's try a different approach - what would you like to know?",
          { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          }
        );
      }
    }
    
    // Use the OpenAI SDK to get a response for non-data queries
    try {
      // Ensure system message is properly formatted as an object
      const messagesForAPI = [
        { role: "system", content: systemMessage },
        ...messages.map((m: any) => {
          // Ensure each message is a properly structured object
          if (typeof m === 'string') {
            return { role: 'user', content: m };
          }
          // Make sure content is a string
          if (m.content && typeof m.content !== 'string') {
            return { ...m, content: String(m.content) };
          }
          return m;
        })
      ];
      
      // Log what we're sending to ensure it's correct
      console.log("[CHAT] Sending messages to OpenAI:", 
        JSON.stringify(messagesForAPI.map(m => ({ role: m.role, content_length: m.content?.length || 0 })))
      );
      
      const result = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messagesForAPI,
        temperature: 0.8,
        max_tokens: 800,
      });
      
      // Safely extract the response text
      const responseContent = result.choices[0].message?.content || 
                             "Sorry, I couldn't generate a response. Please try again.";
      
      // Return as a basic text response
      return new Response(responseContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      // Send a fallback response if OpenAI call fails
      return new Response(
        "I'm having trouble connecting right now. Please try again in a moment.",
        { 
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 503 
        }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "There was an error processing your request" },
      { status: 500 }
    );
  }
}



