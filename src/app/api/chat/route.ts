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
    await dbConnect();
    
    // Get recent workouts
    const recentWorkouts = await getWorkoutsByUserId(userId, 5);
    
    if (!recentWorkouts || recentWorkouts.length === 0) {
      return null; // No workouts found, will use default greeting
    }
    
    // Get workout stats for most frequent type
    const workoutCollection = await getCollection('workouts');
    
    // Count workouts by type
    const workoutTypes = await workoutCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get total workout count
    const totalWorkoutCount = await workoutCollection.countDocuments({ 
      userId: new ObjectId(userId) 
    });
    
    // Generate context for greeting
    const lastWorkout = recentWorkouts[0];
    const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60 * 24));
    
    // Get most frequent workout type and its stats
    let mostFrequentType = null;
    let workoutTypeData = {};
    
    if (workoutTypes.length > 0) {
      mostFrequentType = workoutTypes[0]._id;
      
      // Get additional stats for the most frequent workout type
      if (mostFrequentType) {
        const typeStats = await getWorkoutTypeStats(userId, mostFrequentType);
        workoutTypeData = {
          totalSessions: typeStats.totalSessions || 0,
          totalDistance: typeStats.totalDistance || 0,
          totalDuration: typeStats.totalDuration || 0,
          averageDistance: typeStats.averageDistance || 0,
          averageDuration: typeStats.averageDuration || 0
        };
      }
    }
    
    // Get all workout types with counts for context
    const workoutTypeCounts = workoutTypes.reduce((obj: Record<string, number>, type: any) => {
      if (type && type._id) {
        obj[String(type._id)] = typeof type.count === 'number' ? type.count : 0;
      }
      return obj;
    }, {});
    
    // Generate a simple context message for the AI - ensure all values are primitive types
    const context = {
      lastWorkoutType: typeof lastWorkout.type === 'string' ? lastWorkout.type : String(lastWorkout.type),
      daysSinceLastWorkout: typeof daysSinceLastWorkout === 'number' ? daysSinceLastWorkout : 0,
      totalWorkouts: typeof totalWorkoutCount === 'number' ? totalWorkoutCount : 0,
      preferredActivity: typeof mostFrequentType === 'string' ? mostFrequentType : 
                          mostFrequentType === null ? null : String(mostFrequentType),
      workoutTypeCounts, 
      lastWorkoutDistance: typeof lastWorkout.distance === 'number' ? lastWorkout.distance : 
                           lastWorkout.distance !== null ? Number(lastWorkout.distance) : null,
      lastWorkoutDuration: typeof lastWorkout.duration === 'number' ? lastWorkout.duration : 
                           lastWorkout.duration !== null ? Number(lastWorkout.duration) : null,
      mostFrequentTypeStats: workoutTypeData
    };
    
    // Safely serialize the context to JSON
    const safeContext = JSON.stringify(context);
    
    // Use OpenAI to generate a personalized greeting
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a friendly fitness coach. Generate a brief, natural-sounding greeting (1-2 sentences max) based on the user's workout data. Make it personal, positive, and engaging. DO NOT explain the data or mention that you're analyzing it. Just create a natural greeting a real coach might say. No introductions like "Hey there!" or "Hi! I'm your fitness coach" - just dive right into the personalized observation. Reference specific data like number of workouts by type or most frequent activity when relevant.`
        },
        {
          role: "user",
          content: safeContext
        }
      ],
      temperature: 0.8,
      max_tokens: 80,
    });
    
    return response.choices[0].message?.content || null;
  } catch (error) {
    console.error("Error generating personalized greeting:", error);
    return null; // Fall back to default greeting
  }
}

// Helper function to fetch user workout data
async function fetchUserWorkoutData(userId: string, queryType: string, timeframe?: string) {
  try {
    await dbConnect();
    const workoutsCollection = await getCollection('workouts');
    
    // Base filter: workouts for this user
    const filter: any = { userId: new ObjectId(userId) };
    
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

// Replace analyzeWorkoutDataQuery with a more flexible approach
interface AIQueryRequest {
  query: string;
  userId: string;
  queryType: 'workout_data' | 'user_info';
}

async function processAIDataRequest(request: AIQueryRequest) {
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
      const contextMessage = JSON.stringify({
        query,
        result,
        analysisType: queryAnalysis.dataType,
        timeFrame: queryAnalysis.timeFrame,
        format: format
      });
      
      const responseGeneration = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a friendly fitness coach. Generate a natural, conversational response based on the user's query and the data provided.
            Create a response that directly answers their question using the specific data.
            Be concise but personable - like a real coach would talk to their client.
            Never mention that you're analyzing data or that data was retrieved from a database.
            Just present the information conversationally as if you already knew it.
            
            FORMATTING INSTRUCTIONS:
            Format your response using Markdown:
            - Use **bold** for emphasis and important metrics
            - Use *italics* for workout types or intensity levels
            - Use # and ## for headings when showing lists or summaries
            - Use proper line breaks with double spaces or blank lines between paragraphs
            - Use bullet points with * or - for lists
            - For workout entries, format them clearly:
              
              ## [Day], [Date]
              **[Workout Type]** - *[Duration]*
              - Distance: **[distance] [units]**
              - Intensity: *[intensity level]*
              - Average Heart Rate: **[bpm]** 
              
            EXAMPLE MARKDOWN OUTPUT:
            
            # Your Workouts This Week
            
            ## Monday, March 27
            **Morning Run** - *40 minutes*
            - Distance: **5.2 miles**
            - Intensity: *Medium*
            - Heart Rate: **142 bpm**
            
            ## Thursday, March 24
            **Evening Run** - *33 minutes*
            - Distance: **5.65 km**
            - Intensity: *High*
            - Heart Rate: **156 bpm**
            `
          },
          {
            role: "user",
            content: contextMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      
      return responseGeneration.choices[0].message?.content || "Sorry, I couldn't process that request.";
    }
    
    return null;
  } catch (error) {
    console.error("Error processing AI data request:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // Parse request body
    let messages;
    let workoutId;
    
    try {
      const body = await request.json();
      messages = body.messages;
      workoutId = body.workoutId;
      
      if (!messages || !Array.isArray(messages)) {
        return NextResponse.json(
          { error: "Invalid messages format" },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
    
    // Validate user session
    const session = await getServerSession(authOptions);
    
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
    
    const systemMessage = {
      role: "system",
      content: `You are an authentic, personable AI fitness coach. While you offer expert guidance, your style is more like a friendly workout buddy than a formal trainer.
      
USER INFO:
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
`
    };
    
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
        // Try to process as a data query
        const response = await processAIDataRequest({
          query: latestUserMessage,
          userId: session.user.id,
          queryType: 'workout_data'
        });
        
        if (response) {
          return new Response(response, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            }
          });
        }
      } catch (error) {
        console.error("Error processing data query:", error);
        // Fall through to normal processing if data query fails
      }
    }
    
    // Use the OpenAI SDK to get a response for non-data queries
    try {
      const result = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [systemMessage, ...messages],
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
          status: 200, 
          headers: { 'Content-Type': 'text/plain' }
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



