import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { calculateDateRange } from "./dateUtils"; 
import { ObjectId } from 'mongodb'; 
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import User, { IUser } from '@/lib/db/models/user'; 
import ExercisePRModel, { IExercisePR } from '@/lib/db/models/exercisePR'; 
import { Types } from 'mongoose'; 
import { capitalizeFirstLetter } from "@/lib/utils"; 
import { startOfDay } from "date-fns"; // Import startOfDay
import { format, /* Other date-fns imports if needed */ } from "date-fns"; 
import { getRecentWorkouts } from "@/lib/db/repositories/workoutRepository"; 
import { fetchWorkoutForAI } from "@/lib/workout-actions"; // Re-add this import
import { WorkoutData } from '@/types/db'; // Assuming this is the correct path
import { getRecentRunningWorkouts } from "@/lib/db/repositories/workoutRepository";
import { config as dotenvConfig } from 'dotenv';
import { callLLM, LLMProvider } from '@/lib/services/llm';
dotenvConfig();

// Define the structure for the data expected by the AI coach
interface AICoachWorkoutData extends WorkoutData {
  previousWorkouts?: Array<{
    date: string | Date;
    duration?: number;
    distance?: number;
    calculatedVolume?: number;
    cardioDetails?: { pace?: number };
    // Add any other fields that are expected from previous workouts
  }>;
  progressMetrics?: any; // TODO: Define a more specific type for progressMetrics if possible
}

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

// Explicitly set max duration for Vercel Serverless Function (Pro plan allows >= 60s)
export const maxDuration = 60;

// Define the daily token limit
const DAILY_GROK_TOKEN_LIMIT = 500000;

// Define valid intents
const ValidIntents = z.enum([
  "get_total_metric",
  "get_average_metric",
  "get_record",
  "list_workouts",
  "get_workout_details",
  "compare_metric",
  "generate_plan",
  "unknown",
]);

// Define valid metrics
const ValidMetrics = z.enum([
  "distance",
  "duration",
  "count", // Workout count
  "volume", // Strength volume
  "pace",
  "speed",
  "calories", // Added calories
  "elevation", // Added elevation
]);

// Define valid workout types (expand as needed)
const ValidWorkoutTypes = z.enum([
  "running",
  "cycling",
  "swimming",
  "walking",
  "hiking",
  "strength",
  "hiit",
  "yoga",
  "flexibility",
  "other",
  "any", // For queries applying to all types
]);

// Define valid time periods for the utility function
const ValidPeriods = z.enum([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "last_7_days",
  "last_30_days",
  "overall",
  "next_week", // Added next_week
]);

// Define the schema for the structured AI analysis output
const QueryAnalysisSchema = z.object({
  intent: ValidIntents,
  entities: z.object({
    metric: ValidMetrics.optional(),
    workout_type: ValidWorkoutTypes.optional(),
    period: ValidPeriods.optional(),
    explicit_start_date: z.union([
      z.string().datetime(),
      z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    ]).optional(),
    explicit_end_date: z.union([
      z.string().datetime(),
      z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    ]).optional(),
    comparison_period: ValidPeriods.optional(),
    record_qualifier: z.string().optional(),
    workout_identifier: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }).optional(),
  response_suggestion: z.string().optional(),
});

type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

// Initialize Anthropic client
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// Helper to get the Zod schema as a string for the prompt
function getQueryAnalysisSchemaString(): string {
  // Consider a more robust way to stringify Zod schema if it gets complex
  // For now, manually representing the structure
  return `
{
  intent: "get_total_metric" | "get_average_metric" | "get_record" | "list_workouts" | "get_workout_details" | "compare_metric" | "generate_plan" | "unknown",
  entities: {
    metric?: "distance" | "duration" | "count" | "volume" | "pace" | "speed" | "calories" | "elevation",
    workout_type?: "running" | "cycling" | "swimming" | "walking" | "hiking" | "strength" | "hiit" | "yoga" | "flexibility" | "other" | "any",
    period?: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "last_year" | "last_7_days" | "last_30_days" | "overall" | "next_week",
    explicit_start_date?: string, // ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
    explicit_end_date?: string, // ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
    comparison_period?: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "last_year" | "last_7_days" | "last_30_days" | "overall",
    record_qualifier?: string, // e.g., "5k", "10k", "half_marathon", "marathon", "overall"
    workout_identifier?: string, // e.g., specific date "YYYY-MM-DD", relative date like "tuesday", specific workout ID ( ObjectId like "67f1c2ae0185ca4d411b5031")
    limit?: number, // Positive integer
  },
  response_suggestion?: string // Optional direct text response for simple cases or clarification
}
  `.trim();
}

// Define a type for messages in history (subset of frontend Message type)
interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Token Update Helper Function ---
// REMINDER: Call this after *any* Grok API call successfully returns usage data.
async function updateTokenUsage(userId: string | undefined, grokUsageData: any): Promise<void> {
    if (!userId || !grokUsageData) {
        console.warn("[COACH_RATE_LIMIT] Cannot update usage: Missing userId or usage data.");
        return;
    }

    // Calculate tokens used (adjust if Grok's usage object structure differs)
    const tokensUsed = grokUsageData.total_tokens || (
        (grokUsageData.prompt_tokens || 0) +
        (grokUsageData.completion_tokens || 0)
        // Potentially add other fields like reasoning_tokens if applicable
    );

    if (tokensUsed > 0) {
        console.log(`[COACH_RATE_LIMIT] Updating usage for user ${userId}. Adding ${tokensUsed} tokens.`);
        try {
            // Ensure DB connection (might be redundant if called after other DB ops, but safe)
            await dbConnect();
            await User.updateOne({ _id: userId }, { $inc: { dailyGrokTokenUsage: tokensUsed } });
        } catch (err) {
            console.error(`[COACH_RATE_LIMIT] Failed to update usage count in DB for user ${userId}:`, err);
        }
    } else {
         console.log(`[COACH_RATE_LIMIT] No tokens used or usage data invalid for user ${userId}. Skipping update.`);
    }
}
// --- End Token Update Helper Function ---

/**
 * Generates an initial insightful message for a specific workout.
 */
async function generateInitialWorkoutInsight(workoutId: string, userName: string, userId: string): Promise<string> {
  try {
    // Ensure Grok API key is available
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      console.error("[generateInitialWorkoutInsight] GROK_API_KEY not configured.");
      return `Sorry ${userName}, the AI coach is currently unavailable. Please try again later.`;
    }

    console.log(`[generateInitialWorkoutInsight] Fetching workout details for AI: ${workoutId}`);
    const workoutDataForAI: AICoachWorkoutData | null = await fetchWorkoutForAI(workoutId);

    if (!workoutDataForAI) {
      console.log(`[generateInitialWorkoutInsight] Workout ${workoutId} not found.`);
      return `Sorry, I couldn't find the details for that workout (ID: ${workoutId}). How else can I help?`;
    }

    // Clean up data slightly for the prompt (remove potentially huge fields if necessary)
    const promptData = {
      currentWorkout: {
        name: workoutDataForAI.name,
        type: workoutDataForAI.type,
        date: workoutDataForAI.date,
        duration: workoutDataForAI.duration,
        distance: workoutDataForAI.distance,
        calories: workoutDataForAI.calories,
        intensity: workoutDataForAI.intensity,
        calculatedVolume: workoutDataForAI.calculatedVolume,
        cardioDetails: workoutDataForAI.cardioDetails, // Keep cardio details
        // Omit workoutExercises here to keep prompt concise, unless needed
      },
      previousWorkoutsSummary: workoutDataForAI.previousWorkouts?.map((w: any) => ({ // Use any temporarily
        date: w.date,
        duration: w.duration,
        distance: w.distance,
        calculatedVolume: w.calculatedVolume,
        pace: w.cardioDetails?.pace
      })),
      progressMetrics: workoutDataForAI.progressMetrics,
    };

    const systemPrompt = `\\nYou are Aivery, a friendly and insightful fitness coach. The user, ${userName}, has just clicked on a specific workout in their history and wants to discuss it.\\n\\nWorkout Data Overview:\\n${JSON.stringify(promptData, null, 2)}\\n\\nYour task is to generate a welcoming and insightful opening message (1-2 sentences) based ONLY on the provided Workout Data Overview. Briefly highlight something interesting (e.g., a key stat, a comparison like duration/distance change if progressMetrics exist, a potential PR) and then ask an open-ended question to guide the conversation, like \"What aspect of this workout would you like to focus on?\" or \"How did this workout feel compared to your last session?\". Be encouraging and conversational. Focus on the MOST RECENT workout data provided.`;

    console.log("[generateInitialWorkoutInsight] Sending prompt to Grok for initial insight...");
    const provider = process.env.LLM_PROVIDER_INSIGHT as LLMProvider;
    const model = process.env.LLM_MODEL_INSIGHT;
    if (!provider || !model) throw new Error('LLM provider/model for INSIGHT not set');
    console.log(`[LLM] Using provider: ${provider}, model: ${model}`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Generate the initial insightful message based on the workout data provided in the system prompt." }
      ],
      max_tokens: 150,
      temperature: 0,
      stream: false,
    });
    await updateTokenUsage(userId, data.usage);
    let insightText = "Okay, let's look at that workout. What stands out to you?";
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      insightText = data.choices[0].message.content.trim();
    } else {
      console.warn("[generateInitialWorkoutInsight] Unexpected LLM response structure:", data);
    }
    console.log(`[generateInitialWorkoutInsight] Generated insight: "${insightText}"`);
    return insightText;
  } catch (error) {
    console.error(`[generateInitialWorkoutInsight] Error generating initial insight for workout ${workoutId}:`, error);
    return `Sorry ${userName}, I had trouble loading the full details for that workout right now. What would you like to discuss about it generally?`;
  }
}

/**
 * Analyzes the user's fitness query using Grok API.
 */
async function analyzeUserQuery(query: string, history: HistoryMessage[], userId: string): Promise<QueryAnalysis> { // <-- Added userId
  const schemaString = getQueryAnalysisSchemaString();

  // Format history for the prompt
  const historyString = history
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  // ENHANCED SYSTEM PROMPT: Instruct LLM to extract plan durations from natural language
  const systemPrompt = `\nYou are an expert system trained to analyze the LATEST user query in a conversation about fitness data and extract structured information. Use the conversation HISTORY for context if needed, especially for pronouns or references to previous turns.\n\nCONVERSATION HISTORY:\n${historyString}\n\nLATEST USER QUERY: "${query}"\n\nYour goal is to identify the user's **intent** and extract relevant **entities** from the LATEST QUERY based on the provided query and the target JSON schema. Refer to the history only to resolve ambiguities in the latest query.\n\nAVAILABLE DATA TYPES OVERVIEW:\n- User: name, goals, preferences, location, age, weight, height, ...\n- Workouts: type (run, cycle, strength, ...), date, duration, distance, pace, speed, calories, volume, exercises, sets, notes, heart rate, elevation, power, ...\n- Exercises (Library): name, description, muscles, category, equipment, ...\n\nSCHEMA:\n\u001b[json\n${schemaString}\n\u001b\n\nRULES:\n- Analyze the LATEST USER QUERY: "${query}".\n- Use the CONVERSATION HISTORY to understand context (e.g., what "these" refers to).\n- Identify the primary intent of the LATEST QUERY.\n- If the user requests a plan for a specific duration (e.g., 'four week', '4-week', 'month', '30 days', 'two months', '90 days', etc.), extract this as either:\n  - explicit_start_date and explicit_end_date (if dates are given or can be inferred), OR\n  - a 'limit' field representing the number of weeks (e.g., 'four week' => limit: 4, 'month' => limit: 4, '90 days' => limit: 13).\n- If the user says 'next month', 'next 4 weeks', 'for 30 days', etc., map these to the correct number of weeks in the 'limit' field.\n- If the user says 'half marathon in 6 weeks', infer the plan should be for 6 weeks.\n- If the user says 'plan for September', infer the start and end dates for September.\n- Always extract durations from natural language, not just explicit dates.\n- If no duration is specified, default to 1 week.\n\nEXAMPLES:\n- 'Please create a four week running plan.' => limit: 4\n- 'I want a 12-week marathon plan.' => limit: 12\n- 'Give me a plan for the next month.' => limit: 4\n- 'I have a half marathon in 6 weeks.' => limit: 6\n- 'Plan for September.' => explicit_start_date: '2024-09-01', explicit_end_date: '2024-09-30'\n- 'Plan for 90 days.' => limit: 13\n- 'Plan for 30 days.' => limit: 4\n- 'Plan for 2 months.' => limit: 8\n\nReturn the result as a JSON object matching the schema.\n`;

  const defaultUnknownResponse: QueryAnalysis = {
    intent: "unknown",
    response_suggestion: "Sorry, I couldn't connect to the AI analysis service right now. Please try again later."
  };

  try {
    // Model/provider selection (env-driven)
    const provider = process.env.LLM_PROVIDER_ANALYSIS as LLMProvider;
    const model = process.env.LLM_MODEL_ANALYSIS;
    if (!provider || !model) throw new Error('LLM provider/model for ANALYSIS not set');
    console.log(`[LLM] Using provider: ${provider}, model: ${model}`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `LATEST USER QUERY: "${query}"` }
      ],
      max_tokens: 2048,
      temperature: 0,
      stream: false,
    });
    await updateTokenUsage(userId, data.usage);
    let analysisJsonString = '';
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      analysisJsonString = data.choices[0].message.content.trim();
    } else {
      console.error('LLM response content is empty or not as expected', data);
      return defaultUnknownResponse;
    }
    // Post-processing: Extract JSON from potential markdown code blocks if needed
    const jsonMatch = analysisJsonString.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      analysisJsonString = jsonMatch[1];
    }
    try {
      const parsedAnalysis = JSON.parse(analysisJsonString);
      // Validate the parsed JSON against the schema
      const validationResult = QueryAnalysisSchema.safeParse(parsedAnalysis);
      if (validationResult.success) {
        console.log('Validated LLM Analysis:', validationResult.data);
        return validationResult.data;
      } else {
        console.error('Failed to validate JSON response from LLM:', validationResult.error);
        console.error('Invalid JSON received:', analysisJsonString);
        return { ...defaultUnknownResponse, response_suggestion: 'AI analysis returned an unexpected format. Please try again.' };
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response from LLM:', parseError);
      console.error('Raw response string:', analysisJsonString);
      return { ...defaultUnknownResponse, response_suggestion: 'AI analysis returned invalid data. Please try again.' };
    }
  } catch (error) {
    console.error('Error calling LLM API:', error);
    return defaultUnknownResponse;
  }
}

// --- Helper Function for DB Filters ---
function buildWorkoutFilters(
  userId: string,
  workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): any { // Return Mongoose filter type
  const filters: any = { userId: new ObjectId(userId) }; // Use ObjectId
  if (workoutType && workoutType !== 'any') {
    filters.type = workoutType;
  }
  const dateFilter: any = {}; // Mongoose date filter
  if (startDate) {
    // Only create Date object if startDate is defined
    dateFilter.$gte = new Date(startDate);
  }
  if (endDate) {
    // Only create Date object if endDate is defined
    // Use $lte (less than or equal to) the provided end date
    // endOfWeek already provides the very end of the day (23:59:59.999)
    dateFilter.$lte = new Date(endDate); 
  }
  // Only add the date filter if it has keys
  if (Object.keys(dateFilter).length > 0) {
    filters.date = dateFilter;
  }
  return filters;
}

// --- Database Fetching Functions ---

/**
 * Placeholder for fetching total metrics from the database.
 * Fetches total metrics (sum or count) from the database.
 * Returns value in base units (meters, seconds, kcal) or count.
 */
async function fetchTotalMetricForPeriod(
  userId: string,
  metric: z.infer<typeof ValidMetrics>,
  workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): Promise<number | null> {
  console.log("Placeholder: Fetching total", { userId, metric, workoutType, startDate, endDate });
  const filters = buildWorkoutFilters(userId, workoutType, startDate, endDate);

  try {
    if (metric === 'count') {
      await dbConnect();
      const count = await WorkoutModel.countDocuments(filters);
      return count;
    }

    if (metric === 'distance' || metric === 'duration' || metric === 'calories') {
      // Determine the correct field to sum based on the metric
      let fieldToSum = '';
      if (metric === 'distance') {
        fieldToSum = 'cardioDetails.distance'; // Use nested distance for cardio
      } else if (metric === 'duration') {
        fieldToSum = 'duration';
      } else if (metric === 'calories') {
        fieldToSum = 'calories';
      } else {
        // Handle other metrics or throw an error
        console.error(`[DB Fetch Total] Unsupported metric for sum: ${metric}`);
        return null;
      }

      await dbConnect(); // Connect Mongoose
      console.log(`[DB Fetch Total] Filters for ${metric}:`, JSON.stringify(filters)); // Log filters

      // Build aggregation pipeline
      const pipeline: any[] = [
        { $match: filters } // Initial match based on user, type, date
      ];

      // Add specific match stage for the field being summed to ensure it exists and is valid
      if (metric === 'distance') {
        pipeline.push({ 
          $match: { 
            'cardioDetails.distance': { $exists: true, $ne: null, $type: "number" } 
          } 
        });
      } else if (metric === 'duration') {
        pipeline.push({ 
          $match: { 
            'duration': { $exists: true, $ne: null, $type: "number" } 
          } 
        });
      } else if (metric === 'calories') {
         pipeline.push({ 
          $match: { 
            'calories': { $exists: true, $ne: null, $type: "number" } 
          } 
        });       
      }

      // Add the grouping stage
      pipeline.push({ $group: { _id: null, total: { $sum: `$${fieldToSum}` } } });

      console.log(`[DB Fetch Total] Aggregation pipeline for ${metric}:`, JSON.stringify(pipeline)); // Log pipeline
      
      const result = await WorkoutModel.aggregate(pipeline);
      console.log(`[DB Fetch Total] Raw aggregation result for ${metric}:`, JSON.stringify(result)); // Log raw result
      const sum = result[0]?.total ?? 0; // Extract sum from Mongoose aggregation result
      console.log(`[DB Fetch Total] Calculated sum for ${metric}: ${sum}`); // Log final sum
      return sum;
    }

    // Handle other metrics like volume later if needed
    console.warn(`fetchTotalMetricForPeriod: Metric '${metric}' not implemented yet.`);
    return null;

  } catch (error) {
    console.error("Error fetching total metric:", error);
    return null;
  }
}

/**
 * Placeholder for fetching average metrics from the database.
 * Fetches average metrics from the database.
 * Returns value in base units (meters/sec, sec/meter, meters, seconds, kcal).
 */
async function fetchAverageMetricForPeriod(
  userId: string,
  metric: z.infer<typeof ValidMetrics>,
  workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): Promise<number | null> {
    console.log("Fetching average via Mongoose", { userId, metric, workoutType, startDate, endDate });
    const filters = buildWorkoutFilters(userId, workoutType, startDate, endDate);

    try {
        await dbConnect(); // Connect Mongoose

        // Handle simple averages directly
        if (metric === 'distance' || metric === 'duration' || metric === 'calories') {
            const fieldMap = {
                distance: 'distance',
                duration: 'duration',
                calories: 'calories',
            };
            const fieldToAvg = fieldMap[metric as keyof typeof fieldMap];

           if (!fieldToAvg) {
              console.warn(`Unsupported metric for average: ${metric}`);
              return null;
           }

            const result = await WorkoutModel.aggregate([
              { $match: filters },
              { $group: { _id: null, average: { $avg: `$${fieldToAvg}` } } }
            ]);
            const avg = result[0]?.average ?? null;
            return avg;
        }
 
        // Handle Pace (s/m) and Speed (m/s) - Requires total distance and duration
        if (metric === 'pace' || metric === 'speed') {
            const filtersWithDistanceDuration: any = {
                 ...filters,
                 distance: { $gt: 0 }, // Mongoose syntax
                 duration: { $gt: 0 }, // Mongoose syntax
             };

            const aggregateResult = await WorkoutModel.aggregate([
              { $match: filtersWithDistanceDuration },
              { $group: {
                  _id: null,
                  totalDistance: { $sum: "$distance" }, // Sum distance (KM)
                  totalDuration: { $sum: "$duration" }, // Sum duration (Seconds)
                  count: { $sum: 1 }
              } }
            ]);

             // Extract results from Mongoose aggregation
             const results = aggregateResult[0];
             const totalDistanceKm = results?.totalDistance ?? 0;
             const totalDurationSec = results?.totalDuration ?? 0;
             const count = results?.count ?? 0;

             if (count === 0 || totalDistanceKm === 0 || totalDurationSec === 0) {
                 return null; // Cannot calculate if no relevant workouts or zero values
             }

            if (metric === 'pace') {
                // Pace = Total Duration (s) / Total Distance (m)
                return totalDurationSec / (totalDistanceKm * 1000); // seconds per meter
            } else { // metric === 'speed'
                // Speed = Total Distance (m) / Total Duration (s)
                // Speed = (Total Distance KM * 1000) / Total Duration (s)
                return (totalDistanceKm * 1000) / totalDurationSec; // meters per second
            }
        }

        console.warn(`fetchAverageMetricForPeriod: Metric '${metric}' not implemented yet.`);
        return null;

    } catch (error) {
        console.error("Error fetching average metric:", error);
        return null;
    }
}


/**
 * Placeholder for fetching record metrics.
 * Fetches record metrics (e.g., longest distance, fastest pace for a qualifier).
 * Returns the record value and the date it occurred.
 */
async function fetchRecordMetric(
    userId: string,
    metric: z.infer<typeof ValidMetrics>,
    workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
    qualifier: string | undefined 
): Promise<{ value: number; date: string } | null> {
    // Using 'any' for lean results due to persistent typing issues
    // Runtime checks are used for safety
    
    // Removed local interfaces

    console.log("Fetching record using Mongoose", { userId, metric, workoutType, qualifier });
    const baseFilters: any = { userId }; 
    if (workoutType && workoutType !== 'any') {
        baseFilters.type = workoutType;
    }

    try {
        await dbConnect();

        if (metric === 'distance' && qualifier === 'overall') {
            const record: any | null = await WorkoutModel.findOne(
                { ...baseFilters, distance: { $gt: 0 } }
            )
            .sort({ distance: -1 })
            .select({ distance: 1, date: 1 })
            .lean();
            
            // Runtime check is important here
            return record?.distance ? { value: record.distance, date: new Date(record.date).toISOString() } : null;
        }

        if (metric === 'duration' && qualifier === 'overall') {
            const record: any | null = await WorkoutModel.findOne(
                { ...baseFilters, duration: { $gt: 0 } }
            )
            .sort({ duration: -1 })
            .select({ duration: 1, date: 1 })
            .lean();

            // Runtime check is important here
            return record?.duration ? { value: record.duration, date: new Date(record.date).toISOString() } : null;
        }

        if (metric === 'pace' && workoutType === 'running' && qualifier) {
            let minDistanceKm = 0;
             if (qualifier === '5k') minDistanceKm = 5;
            else if (qualifier === '10k') minDistanceKm = 10;
            else if (qualifier === 'half_marathon') minDistanceKm = 21.0975;
            else if (qualifier === 'marathon') minDistanceKm = 42.195;
            else {
                console.warn(`Unsupported pace qualifier: ${qualifier}`);
                return null; 
            }

            const runs: any[] = await WorkoutModel.find({
                ...baseFilters,
                type: 'running',
                distance: { $gte: minDistanceKm },
                duration: { $gt: 0 } 
            })
            .select({ distance: 1, duration: 1, date: 1 })
            .lean();

            if (!runs || runs.length === 0) return null;

            let bestPace = Infinity;
            let recordDate = '';
            let recordValue = 0;

            runs.forEach(run => {
                // Runtime checks are important here
                if (run.distance && run.duration && run.distance > 0 && run.duration > 0) { 
                    const pace = run.duration / (run.distance * 1000);
                    if (pace < bestPace) {
                        bestPace = pace;
                        recordDate = new Date(run.date).toISOString(); 
                        recordValue = pace;
                    }
                }
            });

            return bestPace === Infinity ? null : { value: recordValue, date: recordDate };
        }

        console.warn(`fetchRecordMetric: Combination not implemented yet - Metric: ${metric}, Qualifier: ${qualifier}`);
        return null;

    } catch (error) {
        console.error("Error fetching record metric:", error);
        return null;
    }
}


// Define a Mongoose-compatible list item type
interface WorkoutListItem {
    id: string;
    name: string | null;
    date: string; // ISO string format
    type: string;
    duration: number | null;
    distance: number | null;
    calories: number | null;
    notes: string | null;
}

/**
 * Lists workouts based on filters using Mongoose.
 */
async function listWorkouts(
    userId: string,
    workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    limit?: number
): Promise<WorkoutListItem[]> { // Use the new interface
    console.log("Fetching workouts via Mongoose", { userId, workoutType, startDate, endDate, limit });
    const filters = buildWorkoutFilters(userId, workoutType, startDate, endDate);

    try {
        await dbConnect(); // Connect Mongoose
        const workoutDocs = await WorkoutModel.find(filters) // Use WorkoutModel
            .sort({ date: -1 })
            .limit(limit || 50)
            .lean(); // .lean() executes and returns plain objects
            // .exec() is not needed after .lean()

        // Map Mongoose documents to the WorkoutListItem interface
        const workouts: WorkoutListItem[] = workoutDocs.map((doc: any) => ({
            id: doc._id.toString(),
            name: doc.name ?? null,
            date: new Date(doc.date).toISOString(),
            type: doc.type,
            duration: doc.duration ?? null,
            // Prioritize cardioDetails.distance if it exists, fallback to top-level distance
            distance: doc.cardioDetails?.distance ?? doc.distance ?? null, 
            calories: doc.calories ?? null, // Assuming calories might be top-level for simplicity here
            notes: doc.notes ?? null,
        }));
        return workouts; // No assertion needed
    } catch (error) {
        console.error("Error listing workouts:", error);
        return [];
    }
}

// Redefined PopulatedWorkoutDoc based on IWorkout
interface PopulatedWorkoutDoc {
  _id: ObjectId;
  userId: ObjectId;
  date: Date;
  name: string;
  duration: number;
  intensity?: IWorkout['intensity'];
  type: IWorkout['type'];
  volume?: number;
  distance?: number;
  calories?: number;
  exercises?: Array<{ name: string; sets: Array<{ weight: number; reps: number }> }>;
  cardioDetails?: IWorkout['cardioDetails']; // Use indexed access type
  notes?: string;
  completed?: boolean;
  completedAt?: Date;
  source?: IWorkout['source'];
  sourceId?: string;
  importedFrom?: string;
  importId?: string;
  stravaLink?: string;
  records?: IWorkout['records'];
  createdAt?: Date;
  updatedAt?: Date;
}

// Define Mongoose-compatible detail item type
// Update to use the direct type rather than referencing IWorkout['exercises']
type NestedExerciseType = {
  name: string;
  sets: Array<{ weight: number; reps: number }>;
};

interface ExerciseDetail {
    sets: NestedExerciseType['sets']; // Infer sets type
    notes: string | null; // Assuming notes are added separately or manually managed
    exercise: {
        name: string;
        muscleGroups: string[]; // Placeholder
        category: string; // Placeholder
        equipment?: string | null; // Placeholder
    };
}

interface WorkoutDetailItem {
    id: string;
    name: string | null;
    date: Date;
    type: IWorkout['type'];
    duration: number | null;
    intensity: IWorkout['intensity'] | null;
    distance: number | null;
    calories: number | null;
    notes: string | null;
    cardioDetails?: IWorkout['cardioDetails'] | null; // Use indexed access type
    exercises: ExerciseDetail[];
}

/**
 * Fetches details for a specific workout using Mongoose.
 */
async function fetchWorkoutDetails(
  userId: string,
  identifier: string, // Assume this is the workout ID
  workoutType?: z.infer<typeof ValidWorkoutTypes> // Optional type filter
): Promise<WorkoutDetailItem | null> { // Use new interface

    if (!/^[0-9a-fA-F]{24}$/.test(identifier)) {
        console.warn(`fetchWorkoutDetails: Identifier '${identifier}' is not a valid ObjectId.`);
        return null;
    }

    // Build Mongoose filter
    const filter: any = { _id: identifier, userId }; // Mongoose uses _id
    if (workoutType && workoutType !== 'any') {
        filter.type = workoutType;
    }

    try {
        await dbConnect();
        
        // Get the main workout document with proper typing
        const workoutDoc: any = await WorkoutModel.findOne(filter).lean();

        if (!workoutDoc) return null;
        
        // Get associated workout exercises
        const WorkoutExerciseModel = (await import("@/lib/db/models/workoutExercise")).default;
        const workoutExercises: any[] = await WorkoutExerciseModel.find({ 
            workoutId: workoutDoc._id 
        })
        .populate('exerciseId') // Populate the canonical exercise reference
        .lean();
        
        console.log(`Found ${workoutExercises.length} workout exercises for workout ${identifier}`);

        // Map Mongoose doc to WorkoutDetailItem
        const workout: WorkoutDetailItem = {
            id: workoutDoc._id.toString(),
            name: workoutDoc.name ?? null,
            date: workoutDoc.date,
            type: workoutDoc.type,
            duration: workoutDoc.duration ?? null,
            intensity: workoutDoc.intensity ?? null,
            distance: workoutDoc.distance ?? null,
            calories: workoutDoc.calories ?? null,
            notes: workoutDoc.notes ?? null,
            cardioDetails: workoutDoc.cardioDetails ?? null,
            // Map exercises from the separate collection
            exercises: workoutExercises.map(ex => ({
                sets: ex.sets || [],
                notes: ex.notes || null,
                exercise: {
                    name: ex.exerciseId?.name || 'Unknown Exercise', // Name from the populated Exercise document
                    muscleGroups: [], // Placeholder
                    category: ex.exerciseId?.category || 'unknown',
                    equipment: null // Placeholder
                }
            }))
        };
        return workout;

    } catch (error) {
        console.error("Error fetching workout details:", error);
        return null;
    }
}


/**
 * Compares a metric between two different periods.
 */
async function compareMetricBetweenPeriods(
    userId: string,
    metric: z.infer<typeof ValidMetrics>,
    workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
    period1: { start_date?: string; end_date?: string },
    period2: { start_date?: string; end_date?: string }
): Promise<{ value1: number | null, value2: number | null }> {

    // For comparison, we likely want the *total* metric in each period
    // We can reuse fetchTotalMetricForPeriod
    // Note: This assumes 'total' is the desired comparison method. Avg comparison might be needed too.

    // TODO: Add support for comparing averages if needed based on intent analysis
    const value1 = await fetchTotalMetricForPeriod(userId, metric, workoutType, period1.start_date, period1.end_date);
    const value2 = await fetchTotalMetricForPeriod(userId, metric, workoutType, period2.start_date, period2.end_date);

    return { value1, value2 };
}

// --- Helper Function to Get Direct AI Text Response --- V4 (Concise Slideshow Content)
async function getDirectTextResponse(query: string, userId: string, userName: string, userContext: { preferences?: IUser['aiPreferences'] | null, exercisePRs?: IExercisePR[] | null }): Promise<string | null> { 
    const provider = (process.env.LLM_PROVIDER_DIRECT as LLMProvider) || 'grok';
    const model = process.env.LLM_MODEL_DIRECT || 'gpt-4.1-mini';
    if (!process.env.GROK_API_KEY && provider === 'grok') {
        console.error("[getDirectTextResponse] GROK_API_KEY not configured.");
        return "Sorry, the AI is unavailable right now.";
    }

    // Prepare context strings (remains the same)
    const userGoals = userContext.preferences?.fitnessGoals || "Not specified";
    const userPrefs = userContext.preferences?.trainingPreferences || "Not specified";
    let prSummary = "No recent PRs available.";
    if (userContext.exercisePRs && userContext.exercisePRs.length > 0) {
        prSummary = "Recent Exercise PRs:\n" + userContext.exercisePRs.slice(0, 3).map(pr => `- ${pr.exerciseName}: ${pr.value} ${pr.unit}`).join('\n'); 
    }

    // Updated system prompt for CONCISE SLIDESHOW CONTENT
    const systemPrompt = `You are Aivery, an expert, knowledgeable, and supportive AI fitness coach creating content for a concept explanation slideshow for the user named ${userName}.

**User Context:**
- **Name:** ${userName}
- **Stated Fitness Goals:** ${userGoals} 
- **Stated Training Preferences:** ${userPrefs}
- **Recent PR Summary:** ${prSummary}

**Your Task:** Generate concise, informative content for a slideshow explaining the fitness concept mentioned in the user query below. **Personalize the content based on the User Context.** Use clear, professional language and apply markdown formatting as specified.

**Structure and Formatting Guidelines (for Parsing into Slides):**
- **Title Slide:** Start with the concept name as a Level 3 Markdown header (### Concept Name). This will be the first slide.
- **Definition Slide:** Provide a clear, concise definition in a short paragraph immediately following the title. **Bold** key terms.
- **Subheading Slides:** Use Level 4 Markdown headers (#### Importance & Benefits, #### Application Strategies, #### Key Considerations) to introduce subsequent slides. 
- **Content per Slide:** Under each subheading, provide **concise explanations (1-2 short paragraphs MAXIMUM)**. Use **bold text** for emphasis. Tailor content to the user context where appropriate (goals, preferences).
- **Application Slide (#### Application Strategies):** Keep examples brief. Use bullet points (-) for specific steps/examples if needed, but keep the list short and focused.
- **Considerations Slide (#### Key Considerations):** Briefly mention key points.
- **Final Question Slide:** Conclude the *entire output* with a single, insightful, open-ended question (in *italics*) that relates to the user's context. This will be the final slide.

**Key Change: Brevity is essential.** Each section (Definition, Importance, Application, Considerations, Question) should correspond to a single, easily digestible slide.

**Tone:** Professional, knowledgeable, informative, and supportive. Avoid overly casual slang or excessive hype.
Do NOT write long, continuous text. Structure the output clearly with the specified headers for parsing into individual slides.

**User Query containing the concept:**`; // Query will be appended in the user message

    // Add AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    try {
        console.log(`[getDirectTextResponse] Using provider: ${provider}, model: ${model}`);
        const data = await callLLM({
          provider,
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query } // The user query contains the specific concept to explain
          ],
          max_tokens: 2048, // Increased max_tokens again for even longer explanations
          temperature: 0.6, // Slightly adjusted temperature for informative but engaging tone
          stream: false,
        });

        clearTimeout(timeoutId); // Clear the timeout if fetch completes

        await updateTokenUsage(userId, data.usage);

        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content.trim();
        } else {
            console.error("Direct LLM response content is empty or not as expected", data);
            return null;
        }

    } catch (error) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on error too
        if (error instanceof Error && error.name === 'AbortError') {
             console.error("[getDirectTextResponse] LLM API call timed out after 45 seconds.");
             return "Sorry, the request to the AI timed out. It might be taking longer than usual to respond. Please try again shortly.";
        }
        console.error("Error calling LLM for direct response:", error);
        return null; // Return null on timeout or other fetch errors
    }
}

/**
 * Calls the AI model to generate a detailed workout analysis based on a system prompt and user query.
 */
async function generateWorkoutAnalysisResponse(systemPrompt: string, userQuery: string, userName: string, userId: string): Promise<string> { // <-- Added userId
  const provider = process.env.LLM_PROVIDER_ANALYSIS as LLMProvider;
  const model = process.env.LLM_MODEL_ANALYSIS;
  if (!provider || !model) throw new Error('LLM provider/model for ANALYSIS not set');
  console.log(`[LLM] Using provider: ${provider}, model: ${model}`);
  try {
    console.log(`[generateWorkoutAnalysisResponse] Using provider: ${provider}, model: ${model}`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery } // Send the original user analysis request
      ],
      max_tokens: 1024, // Allow for a longer, detailed response
      temperature: 0.7, // Allow some creativity for analysis
      stream: false,
    });
    await updateTokenUsage(userId, data.usage);
    let analysisText = `Sorry ${userName}, I couldn't generate the analysis properly.`; // Fallback
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      analysisText = data.choices[0].message.content.trim();
    } else {
      console.warn("[generateWorkoutAnalysisResponse] Unexpected LLM response structure:", data);
    }
    console.log(`[generateWorkoutAnalysisResponse] Generated analysis length: ${analysisText.length} chars`);
    return analysisText;
  } catch (error) {
    console.error(`[generateWorkoutAnalysisResponse] Error generating analysis:`, error);
    return `Sorry ${userName}, I encountered an error while trying to analyze your workout. Please try again later.`;
  }
}

// Renaming for clarity, but same function as generateWorkoutAnalysisResponse
async function generateResponseFromSystemPrompt(systemPrompt: string, userQuery: string, userName: string, userId: string, modelOverride?: string): Promise<string> { // <-- Added userId
  const provider = (process.env.LLM_PROVIDER_PLAN as LLMProvider) || 'grok';
  const model = modelOverride || process.env.LLM_MODEL_PLAN || 'gpt-4.1-mini';
  if (!process.env.GROK_API_KEY && provider === 'grok') {
    console.error("[generateResponseFromSystemPrompt] GROK_API_KEY not configured.");
    return `Sorry ${userName}, the AI coach is currently unavailable for this request due to configuration issues.`;
  }
  try {
    console.log(`[generateResponseFromSystemPrompt] Using provider: ${provider}, model: ${model}`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ],
      max_tokens: 2048, 
      temperature: 0.7, 
      stream: false,
    });
    await updateTokenUsage(userId, data.usage);
    let generatedText = `Sorry ${userName}, I couldn't generate the response properly.`; 
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      generatedText = data.choices[0].message.content.trim();
    } else {
      console.warn("[generateResponseFromSystemPrompt] Unexpected LLM response structure:", data);
    }
    console.log(`[generateResponseFromSystemPrompt] Generated response length: ${generatedText.length} chars`);
    return generatedText;
  } catch (error) {
    console.error(`[generateResponseFromSystemPrompt] Error generating response:`, error);
    return `Sorry ${userName}, I encountered an error while processing your request. Please try again later.`;
  }
}
// End of Selection

    // --- MAIN POST HANDLER ---
    export async function POST(req: NextRequest) {
      console.log("--- [AI Coach Request Received] ---");
      const startTime = Date.now();
      let session;
      let user: IUser | null = null; // Define user variable
      let userId: string | undefined;
      let userName = "User"; // Default username
      let userPreferences: IUser['aiPreferences'] | null = null;

      try {
        // 1. Authentication and User Data
        console.log("[POST] Authenticating user...");
        session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          console.warn("[POST] User not authenticated.");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;
        // Add null/undefined check for userId to satisfy TypeScript
        if (!userId) {
          console.error("[POST] userId is unexpectedly undefined after session check.");
          return NextResponse.json({ error: "Internal Server Error: User ID missing" }, { status: 500 });
        }
        console.log(`[POST] User authenticated: ${userId}`);

        // Ensure DB connection
        await dbConnect();

        // Fetch user details including preferences
        user = await User.findById(userId).select('name aiPreferences').lean<IUser>();
        if (user) {
          userName = user.name || userName;
          userPreferences = user.aiPreferences || null;
          console.log(`[POST] Fetched user details for: ${userName}`);
        } else {
          console.warn(`[POST] Could not fetch user details for ID: ${userId}`);
        }

        // --- Fetch Exercise PRs --- START
        let exercisePRs: IExercisePR[] = [];
        try {
          console.log(`[POST] Fetching exercise PRs for user: ${userId}...`);
          exercisePRs = await ExercisePRModel.find({ userId: new Types.ObjectId(userId) })
            .sort({ date: -1 }) // Sort by date PR was achieved (most recent first)
            .limit(15) // Limit to the top 15 most recent PRs
            .lean<IExercisePR[]>();
          console.log(`[POST] Found ${exercisePRs.length} exercise PRs.`);
        } catch (prError) {
          console.error(`[POST] Error fetching exercise PRs for user ${userId}:`, prError);
          // Continue without PRs if fetching fails
        }
        // --- Fetch Exercise PRs --- END

        // 2. Request Body Parsing and Variable Initialization
        console.log("[POST] Parsing request body...");
        const body = await req.json();
        let { query, history = [], context } = body;
        console.log(`[POST] Parsed - Query: "${query}" | History Len: ${history.length} | Context:`, context);

        // --- Summarize history if long ---
        if (history.length >= SUMMARIZE_HISTORY_MIN_LENGTH && userId) {
          history = await summarizeHistory(history, userId);
        }

        // Validate query
        if (!query || typeof query !== 'string') {
          return NextResponse.json({ error: "Invalid query provided" }, { status: 400 });
        }

        // Initialize other needed variables
        const userDisplayName = userName; // Use the fetched userName 
        let dataContext = ""; // Initialize as empty string
        let dateRangeString = ""; // Initialize as empty string

        // **** ADDED: Explicit check for "What is [keyword]?" BEFORE general analysis ****
        const keywordMatch = query.match(/^What is (.*)\?$/i); 
        if (keywordMatch && keywordMatch[1]) {
            const keyword = keywordMatch[1].trim().replace(/\?$/, '').trim();
            if (keyword) {
                console.log(`[POST] Detected direct keyword explanation request for: "${keyword}"`);
                // Construct the original query for getDirectTextResponse
                const explanationQuery = `What is ${keyword}?`; // Pass the simple question
                
                // Call getDirectTextResponse with the simple query and user context
                const explanation = await getDirectTextResponse(explanationQuery, userId, userName, { preferences: userPreferences, exercisePRs: exercisePRs });
                if (explanation) {
                    const endTime = Date.now();
                    console.log(`--- [AI Coach Request Completed - Keyword Explanation] Latency: ${endTime - startTime}ms ---`);
                    return NextResponse.json({ response: explanation, data: null });
                } else {
                    // Handle failure
                    console.warn(`[POST] Failed to get direct explanation for keyword: ${keyword}`);
                    const endTime = Date.now();
                    console.log(`--- [AI Coach Request FAILED - Keyword Explanation] Latency: ${endTime - startTime}ms ---`);
                    return NextResponse.json({ response: `Sorry ${userName}, I had trouble explaining "${keyword}" right now. Please try again later or ask about your workouts.`, data: null });
                }
            } else {
                 console.warn("[POST] Keyword explanation requested but keyword was empty after processing.");
                 // Fall through to normal analysis if keyword is empty
            }
        }
        // **** END ADDED BLOCK ****

        // Check for initial workout context
        if (context && context.type === 'initial_workout' && context.workoutId) {
          // ... logic for initial workout insight ...
          // Make sure to pass userId if generateInitialWorkoutInsight is called here
        }
        
        // 3. AI Query Analysis
        // ... rest of POST function uses query, history, userName, exercisePRs etc.

        // 3. Connect to Database
        await dbConnect(); // Ensure DB connection

        // **** SPECIAL HANDLING FOR PLAN GENERATION REQUEST **** 
        // Now also triggers if NLP/LLM analysis returns intent === 'generate_plan'
        const hasHistory = history && Array.isArray(history) && history.length > 0;
        let lastPlan = null;
        if (hasHistory) {
          // Find the last assistant message that looks like a plan
          // More robust: match 'monday', 'tuesday', ..., 'sunday', 'day 1', 'week', or 'plan' (case-insensitive)
          const planRegex = /monday|tuesday|wednesday|thursday|friday|saturday|sunday|day \d+|week|plan/i;
          lastPlan = [...history].reverse().find(msg => msg.role === 'assistant' && planRegex.test(msg.content));
        }

        // Analyze the query early if not already done (for intent detection)
        let analysis: QueryAnalysis | undefined = undefined;
        if (!context?.requestType && !lastPlan) {
          analysis = await analyzeUserQuery(query, history, userId);
        }

        // --- DEBUG LOGGING FOR PLAN PATCH ---
        console.log('[DEBUG] lastPlan:', lastPlan);
        // --- Extract follow-up instructions from history since last plan ---
        let followUpInstructions = '';
        if (history && Array.isArray(history) && history.length > 0) {
          // Find the last assistant message that looks like a plan
          const planRegex = /monday|tuesday|wednesday|thursday|friday|saturday|sunday|day \d+|week|plan/i;
          const lastPlanIdx = [...history].reverse().findIndex(msg => msg.role === 'assistant' && planRegex.test(msg.content));
          let sinceIdx = lastPlanIdx === -1 ? 0 : history.length - lastPlanIdx;
          // Get all user messages since then
          const followUps = history.slice(sinceIdx).filter(m => m.role === 'user').map(m => m.content.trim()).filter(Boolean);
          if (followUps.length > 0) {
            followUpInstructions = followUps.join(' ');
            console.log('[PLAN] Extracted follow-up instructions:', followUpInstructions);
          }
        }
        console.log('[DEBUG] followUpInstructions:', followUpInstructions);
        console.log('[DEBUG] history:', history);

        // --- NEW: Detect if follow-up is a question or conversation vs plan modification ---
        let isConversationalFollowUp = false;
        if (followUpInstructions) {
          // Check if the follow-up appears to be a question or conversation rather than a plan modification
          const conversationalPatterns = /^(?:can you|what|why|how|could you|would you|when|where|explain|tell me|show me|is this|do you)/i;
          isConversationalFollowUp = conversationalPatterns.test(followUpInstructions);
          console.log('[PLAN] Is conversational follow-up:', isConversationalFollowUp);
        }

        if ((context?.requestType === 'generate_plan') || lastPlan || (analysis && analysis.intent === 'generate_plan')) { 
            console.log(`[API /coach] Detected plan generation or modification request.`);
            try {
                // 1. Fetch user goals AND summaries AND FORMAT PRs
                console.log(`[API /coach] Fetching user data (goals, summaries) for user: ${userId}`);
                const user = await User.findById(userId)
                    .select('aiPreferences.fitnessGoals performanceSummary personalRecords') // Select summaries
                    .lean<Pick<IUser, 'aiPreferences' | 'performanceSummary' | 'personalRecords'> | null>();

                if (!user) {
                    throw new Error('User data not found for plan generation.');
                }

                const goals = user.aiPreferences?.fitnessGoals || "No specific goals provided.";

                // --- Format Exercise PRs for Prompt (Limit to 5) --- 
                let exercisePRsString = "No specific exercise PRs recorded recently.";
                if (exercisePRs && exercisePRs.length > 0) {
                    exercisePRsString = "Recent Exercise Personal Records (Max 5 Shown):\n";
                    exercisePRsString += exercisePRs.slice(0, 5).map(pr => 
                        `- ${pr.exerciseName}: ${pr.value} ${pr.unit} (on ${format(new Date(pr.date), 'yyyy-MM-dd')})`
                    ).join('\n');
                }
                // --- Format Exercise PRs for Prompt --- END

                // Fetch recent workout history (Limit to 5)
                console.log(`[API /coach] Fetching recent workout history (limit 5) for user: ${userId}`);
                const recentWorkouts = await getRecentWorkouts(userId, 5);
                let historyString = "No recent workout history available.";
                if (recentWorkouts && recentWorkouts.length > 0) {
                    historyString = "Recent Workout History (Last 5):\n";
                    historyString += recentWorkouts.map(w => 
                        `- ${format(new Date(w.date), 'yyyy-MM-dd')}: ${w.name || w.type} (${formatDuration(w.duration || 0)}${w.distance ? ', ' + formatDistance(w.distance) : ''}${w.calories ? ', ~' + w.calories + 'kcal' : ''})`
                    ).join('\n');
                }

                // --- Detect progression/multi-aspect requests ---
                const lowerQuery = query.toLowerCase();
                const progressionKeywords = ["increase", "progress", "more", "improve", "build up"];
                const aspectKeywords = ["cardio", "distance", "run", "bike", "cycling", "weight", "strength", "volume", "lift"];
                const isProgressionRequest = progressionKeywords.some(k => lowerQuery.includes(k));
                // Count how many aspects are mentioned
                const aspectsMentioned = aspectKeywords.filter(k => lowerQuery.includes(k));
                const isMultiAspect = aspectsMentioned.length >= 2;

                // --- Model selection ---
                const planModel = process.env.GROK_MODEL_PLAN || 'gpt-4.1-mini';

                // Fetch last 20 running workouts
                const runningWorkouts = await getRecentRunningWorkouts(userId, 20);
                const now = new Date();
                const weekMs = 7 * 24 * 60 * 60 * 1000;
                const weekBuckets: number[] = [0, 0, 0, 0];
                let longestRun = 0;
                let fastestPace = Infinity;
                let fastestPaceStr = 'N/A';
                runningWorkouts.forEach(w => {
                  const daysAgo = (now.getTime() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
                  const weekIndex = Math.floor(daysAgo / 7);
                  if (weekIndex < 4) {
                    weekBuckets[weekIndex] += w.distance || 0;
                    if (w.distance > longestRun) longestRun = w.distance;
                    if (w.distance > 0 && w.duration > 0) {
                      const pace = w.duration / (w.distance * 1000); // sec/m
                      if (pace < fastestPace) fastestPace = pace;
                    }
                  }
                });
                const weeksWithData = weekBuckets.filter(d => d > 0).length || 1;
                const avgWeeklyDistance = weekBuckets.reduce((a, b) => a + b, 0) / weeksWithData;
                if (fastestPace !== Infinity) {
                  const paceMinPerKm = (fastestPace * 1000) / 60;
                  const min = Math.floor(paceMinPerKm);
                  const sec = Math.round((paceMinPerKm - min) * 60);
                  fastestPaceStr = `${min}:${sec.toString().padStart(2, '0')} /km`;
                }
                const runningSummary = `User averages ${avgWeeklyDistance.toFixed(2)} km/week running over the last 4 weeks. Longest run: ${longestRun.toFixed(2)} km. Fastest pace: ${fastestPaceStr}.`;
                const last5Runs = runningWorkouts.slice(0, 5).map(w => `- ${format(new Date(w.date), 'yyyy-MM-dd')}: ${w.distance.toFixed(2)} km, ${formatDuration(w.duration)}`).join('\n');

                // --- Detect requested plan duration (weeks) ---
                let planWeeks = 1;
                if (analysis && analysis.entities) {
                  if (typeof analysis.entities.limit === 'number' && analysis.entities.limit > 1 && analysis.entities.limit <= 52) {
                    planWeeks = analysis.entities.limit;
                  } else if (analysis.entities.explicit_start_date && analysis.entities.explicit_end_date) {
                    const start = new Date(analysis.entities.explicit_start_date);
                    const end = new Date(analysis.entities.explicit_end_date);
                    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
                    const weeks = Math.round((end.getTime() - start.getTime()) / msPerWeek);
                    if (weeks > 1 && weeks <= 52) planWeeks = weeks;
                  }
                }

                // 2. Construct the system prompt
                let systemPrompt = `IMPORTANT: If you mention only the most recent run, your answer will be rejected. You MUST use ALL of the following: (1) average weekly distance (last 4 weeks), (2) longest run (last 4 weeks), (3) fastest pace (last 4 weeks), and (4) the last 5 running workouts.\n\nRUNNING HISTORY SUMMARY:\n- Average weekly distance (last 4 weeks): ${avgWeeklyDistance.toFixed(2)} km\n- Longest run (last 4 weeks): ${longestRun.toFixed(2)} km\n- Fastest pace (last 4 weeks): ${fastestPaceStr}\n\nRecent Running Workouts (Last 5):\n${last5Runs}\n\nUser Goal:\n${goals}\n\n${exercisePRsString}\n\nBased ONLY on the information above (goal, exercise PRs, running history), generate a concise, actionable ${planWeeks}-week running plan. Avoid questions; generate the best plan possible. Focus on the PLAN.\n\nChecklist: Did you use (1) average weekly distance (last 4 weeks), (2) longest run (last 4 weeks), (3) fastest pace (last 4 weeks), and (4) last 5 runs? If not, revise your answer.`;
                // --- PATCH: Handle different types of follow-ups differently ---
                if (lastPlan && followUpInstructions) {
                  if (isConversationalFollowUp) {
                    // Handle as conversational follow-up about the plan
                    systemPrompt = `You are Aivery, a friendly and insightful AI fitness coach talking with ${userName}.

Here is the current running plan that was previously generated:
${lastPlan.content}

The user has asked a follow-up question: "${followUpInstructions}"

Please respond conversationally to this question. DO NOT generate a new plan or modify the existing plan. Answer their question directly and naturally as part of an ongoing conversation.

USER CONTEXT:
- Average weekly distance (last 4 weeks): ${avgWeeklyDistance.toFixed(2)} km
- Longest run (last 4 weeks): ${longestRun.toFixed(2)} km
- Fastest pace (last 4 weeks): ${fastestPaceStr}`;
                  } else {
                    // Handle as plan modification request (existing behavior)
                    systemPrompt = `Here is the current ${planWeeks}-week running plan:\n${lastPlan.content}\n\nThe user asked: \"${followUpInstructions}\"\n\nUpdate the plan above to include the user's request, keeping all previous running sessions. Only modify what's needed. Output the full updated plan.\n\n` + systemPrompt;
                  }
                } else if (followUpInstructions) {
                  systemPrompt += `\n\nUSER FOLLOW-UP INSTRUCTIONS:\n${followUpInstructions}`;
                }

                // DEBUG LOGS
                console.log('[PLAN DEBUG] System prompt for LLM:', systemPrompt);
                console.log('[PLAN DEBUG] runningWorkouts:', JSON.stringify(runningWorkouts, null, 2));

                // --- LLM Provider Switch for Plan Generation ---
                let planResponse: string;
                const llmProvider = process.env.LLM_PROVIDER || 'grok';
                if (llmProvider === 'openai') {
                  // Use OpenAI GPT-4.1-mini for plan generation
                  const openaiApiKey = process.env.OPENAI_API_KEY;
                  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set');
                  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${openaiApiKey}`
                    },
                    body: JSON.stringify({
                      model: 'gpt-4o',
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                      ],
                      max_tokens: 2048,
                      temperature: 0.7
                    })
                  });
                  if (!openaiRes.ok) {
                    const err = await openaiRes.text();
                    throw new Error(`OpenAI API error: ${openaiRes.status} ${err}`);
                  }
                  const openaiData = await openaiRes.json();
                  planResponse = openaiData.choices?.[0]?.message?.content?.trim() || 'Sorry, no plan generated.';
                } else {
                  // Default: use Grok as before
                  planResponse = await generateResponseFromSystemPrompt(systemPrompt, query, userName, userId, planModel);
                }

                // --- Fallback/Retry Logic ---
                if (isProgressionRequest && isMultiAspect) {
                  // Check if the response is only for a single day or does not mention all aspects
                  const isSingleDay = /for today|^day 1:|monday:/i.test(planResponse) && !/day 2:|tuesday:|wednesday:|thursday:|friday:|saturday:|sunday:/i.test(planResponse);
                  const missingAspects = aspectsMentioned.filter(a => !planResponse.toLowerCase().includes(a));
                  if (isSingleDay || missingAspects.length > 0) {
                    // Retry with a more forceful prompt
                    systemPrompt += `\n\nRETRY: Your previous response was not sufficient. You MUST provide a detailed, progressive 1-week plan that increases ALL of these aspects: ${aspectsMentioned.join(", ")}. Do NOT give a single-day suggestion. Each day must be specific and show progression for all requested aspects.`;
                    planResponse = await generateResponseFromSystemPrompt(systemPrompt, query, userName, userId, planModel);
                  }
                }
                // --- End Fallback/Retry Logic ---

                // 4. Return the generated plan
                console.log("[API /coach] Plan generation successful.");
                const endTime = Date.now();
                console.log(`--- [AI Coach Request Completed - Plan] Latency: ${endTime - startTime}ms ---`);
                return NextResponse.json({ response: planResponse });
            } catch (planError: any) {
              // ... error handling ...
            }
        } 
        // **** END SPECIAL HANDLING FOR PLAN GENERATION ****

        // **** SPECIAL HANDLING FOR WEEKLY REVIEW REQUEST ****
        if (context?.requestType === 'generate_weekly_review') {
           console.log(`[API /coach] Detected weekly review request.`);
           // Determine the review period from context, default to 'last_week'
           const reviewPeriod: 'this_week' | 'last_week' = context?.reviewPeriod === 'this_week' ? 'this_week' : 'last_week';
           console.log(`[API /coach] Review period determined as: ${reviewPeriod}`);

           try {
               // 1. Fetch workout data for the determined period
               console.log(`[API /coach] Fetching ${reviewPeriod}'s workouts for user: ${userId}`);
               // Use the dynamic reviewPeriod here
               const dateRange = calculateDateRange(reviewPeriod);
               // <<< ADD LOGGING HERE >>>
               console.log(`[API /coach] Calculated Date Range for ${reviewPeriod}: Start = ${dateRange.start_date}, End = ${dateRange.end_date}`);
               // <<< END LOGGING >>>
               const workouts = await listWorkouts(
                   userId,
                   'any', // Get all workout types
                   dateRange.start_date,
                   dateRange.end_date,
                   100 // Limit to 100 workouts for the week, adjust if needed
               );
               // <<< ADD LOGGING HERE >>>
               console.log(`[API /coach] Found ${workouts.length} workouts for the calculated range (${reviewPeriod}).`);
               // Optional: Log first workout date if workouts exist
               if (workouts.length > 0) {
                 console.log(`[API /coach] First workout date in results: ${workouts[0].date}`);
               }
               // <<< END LOGGING >>>

               // Adjust strings based on the period
               const periodDescription = reviewPeriod === 'this_week' ? "this week" : "last week";
               const periodTitle = reviewPeriod === 'this_week' ? "This Week's" : "Last Week's";

               let workoutDataString = `No workouts logged ${periodDescription}.`;
               if (workouts.length > 0) {
                   // Summarize workouts for the prompt
                   workoutDataString = `${periodTitle} Workouts Summary:\\n`;
                   workoutDataString += workouts.map(w => 
                       `- ${format(new Date(w.date), 'EEE, MMM d')}: ${w.name || w.type} (${formatDuration(w.duration || 0)}${w.distance ? ', ' + formatDistance(w.distance) : ''}${w.calories ? ', ~' + w.calories + 'kcal' : ''})`
                   ).join('\\n');
               }

               // 2. Construct the system prompt for weekly review, adjusting for the period
               const systemPrompt = `\\\\nYou are Aivery, an expert fitness coach providing a weekly performance review for ${userName}.\\\\n\\\\n${periodTitle.toUpperCase()} WORKOUT DATA:\\\\n${workoutDataString}\\\\n\\\\nRESPONSE GUIDELINES:\\\\n1.  **Tone:** Friendly, encouraging, and insightful.\\\\n2.  **Analyze ${periodDescription}:** Based *only* on the provided data, summarize the user's activity from ${periodDescription} (Monday-Sunday). Calculate and mention key totals (e.g., total workouts, total duration, total distance if applicable, total strength volume if calculable).\\\\n3.  **Identify Trends/Highlights:** Point out any noticeable patterns, achievements, or areas for focus (e.g., consistency, high intensity days, longest run, PRs if inferable from data). \\\\n4.  **Provide Insights:** Offer 1-2 brief, actionable insights based on the week's activity (e.g., "Great job getting 4 sessions in!", "Mixing strength and cardio seems to be working well.", "Consider adding a rest day if intensity was high.").\\\\n5.  **Keep it Concise:** Aim for a helpful summary, not an exhaustive analysis.\\\\n6.  **No Questions (Mostly):** Generate the review directly. End with a brief encouraging closing statement or a very gentle open question like \\\"How did the week feel overall?\\\"\\\\n7.  **Handle No Data:** If 'No workouts logged ${periodDescription}', acknowledge this and offer encouragement to log workouts.\\\\n\\\\nGenerate the weekly review for ${userName} based *only* on the provided workout data for ${periodDescription}.`;

               console.log(`[API /coach] Sending ${reviewPeriod} review prompt to Grok...`);
               // 3. Call the AI model
               const reviewResponse = await generateResponseFromSystemPrompt(systemPrompt, query, userName, userId);

               // 4. Return the generated review
               console.log("[API /coach] Weekly review generation successful.");
               const endTime = Date.now();
               console.log(`--- [AI Coach Request Completed - Review] Latency: ${endTime - startTime}ms ---`);
               return NextResponse.json({ response: reviewResponse });

           } catch (reviewError: any) {
               console.error("[API /coach] Error generating weekly review:", reviewError);
               const endTime = Date.now();
               console.log(`--- [AI Coach Request FAILED - Review] Latency: ${endTime - startTime}ms ---`);
               return NextResponse.json({ error: `Failed to generate weekly review: ${reviewError.message}` }, { status: 500 });
           }
        }
        // **** END SPECIAL HANDLING FOR WEEKLY REVIEW REQUEST ****

        // --- Default query processing if not handled by special request types ---
        console.log("[API /coach] Proceeding with normal query analysis..."); 

        // Fetch recent workouts for fallback context
        const recentWorkouts = await getRecentWorkouts(userId, 5);

        // Analyze the query if it wasn't a plan or review request
        if (!analysis) {
          analysis = await analyzeUserQuery(query, history, userId);
        }
        console.log("Query Analysis Result:", analysis);

        // Validate analysis result
        const validation = QueryAnalysisSchema.safeParse(analysis);
        if (!validation.success) {
            console.error("Invalid analysis structure:", validation.error);
            return NextResponse.json({ error: "Internal error during query analysis." }, { status: 500 });
        }

        // Allow 'unknown' as a valid intent type for fallback
        const { intent, entities, response_suggestion } = validation.data as { intent: string, entities: any, response_suggestion: string };

        // Use suggestion if provided and intent is simple or unknown
        if (intent === 'unknown') {
          // Check for user context: recent workouts, PRs, or goals
          const hasContext = (recentWorkouts && recentWorkouts.length > 0) || (exercisePRs && exercisePRs.length > 0) || (userPreferences && (userPreferences.fitnessGoals || userPreferences.trainingPreferences));
          if (hasContext) {
            // Proactive suggestion using user context
            const last3WorkoutsString = recentWorkouts && recentWorkouts.length > 0
              ? recentWorkouts.slice(0, 3).map(w => `- ${w.date ? new Date(w.date).toLocaleDateString() : 'Unknown date'}: ${w.name || w.type} (${w.duration ? Math.round(w.duration/60) + ' min' : ''}${w.distance ? ', ' + w.distance + ' km' : ''})`).join('\n')
              : 'No recent workouts found.';
            const prString = (exercisePRs && exercisePRs.length > 0)
              ? exercisePRs.slice(0, 3).map(pr => `- ${pr.exerciseName || pr.exerciseId || 'Exercise'}: ${pr.value} ${pr.unit || ''} (${pr.date ? new Date(pr.date).toLocaleDateString() : ''})`).join('\n')
              : 'No recent PRs found.';
            const goalsString = (userPreferences && userPreferences.fitnessGoals)
              ? userPreferences.fitnessGoals
              : 'No goals specified.';
            // --- STRICT CONTEXT-ONLY SUGGESTION PROMPT ---
            let proactivePrompt = `You are Aivery, a friendly and insightful AI fitness coach.\n\nUSER CONTEXT:\n- Name: ${userDisplayName}\n- Last 3 Workouts:\n${last3WorkoutsString}\n- Recent PRs:\n${prString}\n- Current Goals/Targets:\n${goalsString}\n\nThe user asked: \"${query}\"\n\nIMPORTANT RULES:\n- You MUST ONLY reference exercises, PRs, and activities that are actually present in the USER CONTEXT above.\n- Do NOT invent or mention any exercise, PR, or activity that is not listed in the context.\n- If suggesting a PR-based progression, use only the PRs listed above, by name and value.\n- If the context does not include a certain exercise or PR, do not mention it.\n- Be concise, positive, and tailor the suggestion to their context.\n- Do not ask for clarification.\n- DO NOT say 'Here\'s a suggestion...' or 'Based on your recent activity...'. Instead, give a concrete, actionable workout or activity, e.g.: 'A 20–30 minute tempo run today would be a great fit.'`;
            const grokApiKey = process.env.GROK_API_KEY;
            if (!grokApiKey) {
              return NextResponse.json({ error: "AI service is unavailable due to configuration issues." }, { status: 503 });
            }
            let aiResponse: string = '';
            let attempt = 0;
            let lastPrompt = proactivePrompt;
            while (attempt < 2) {
              const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${grokApiKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-4.1-mini',
                  messages: [
                      { role: 'system', content: lastPrompt },
                      { role: 'user', content: query }
                  ],
                  max_tokens: 2048,
                  temperature: 0.7,
                  stream: false,
                })
              });
              if (!fetchResponse.ok) {
                const errorBody = await fetchResponse.text();
                return NextResponse.json({ error: "Sorry, there was an error communicating with the AI." }, { status: 502 });
              }
              const data = await fetchResponse.json();
              if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                aiResponse = data.choices[0].message.content.trim();
                // If too generic, retry with a more forceful prompt
                if ((/here\'?s a suggestion|based on your recent activity/i.test(aiResponse) || aiResponse.length < 40) && attempt === 0) {
                  lastPrompt += "\n\nYou must provide a concrete, actionable workout or activity. Do NOT repeat generic phrases. Give a specific session or activity.";
                  attempt++;
                  continue;
                }
              }
              break;
            }
            return NextResponse.json({ response: aiResponse || "Here's a suggestion based on your recent activity and goals." });
          }
          // If no context, fallback to existing suggestion or clarification
          if (response_suggestion) {
            return NextResponse.json({ response: response_suggestion });
          }
          return NextResponse.json({ response: "Could you clarify your question or tell me more about your fitness goals?" });
        }

        // Initialize variables for the response generation
        let responseData: any = null;
        let responseText = "";

        // Calculate date range if a period is specified in the analysis
        let dateRangeResult: { start_date?: string; end_date?: string; period_description: string } | null = null;
        const period = entities?.period; 
        if (period) {
          dateRangeResult = calculateDateRange(period); 
        }

        // Prioritize explicit dates from AI analysis if available
        const startDate = entities?.explicit_start_date ?? dateRangeResult?.start_date;
        const endDate = entities?.explicit_end_date ?? dateRangeResult?.end_date;

        const qualifier = entities?.record_qualifier;
        const identifier = entities?.workout_identifier;
        const limit = entities?.limit;

        // Re-assert userDisplayName for clarity within the switch scope if needed
        const currentUserName = userDisplayName; 

        // Check for simple keyword explanation request (can potentially be handled by analysis too, but keep explicit check for now)
        // This block is effectively disabled by renaming variables due to earlier check.
        const unusedKeywordMatch = query.match(/^What is (.*)\?$/i); 
        if (unusedKeywordMatch && unusedKeywordMatch[1]) {
            // Remove trailing question mark from the captured keyword
            const unusedKeyword = unusedKeywordMatch[1].trim().replace(/\?$/, '').trim(); 
            
            // Check if keyword is empty after trimming/removing '?'
            if (!unusedKeyword) {
                 console.warn("[POST] Keyword explanation requested but keyword was empty. (Second check - should be disabled)");
                 // Fall through to normal analysis if keyword is empty
            } else {
                 // This part should not be reached if the earlier check works
                 console.warn(`[POST] Reached second keyword check for: ${unusedKeyword}. This indicates an issue.`);
                 const explanationQuery = `Explain the fitness concept "${unusedKeyword}" briefly.`; // Simplified fallback

                 // Directly call Grok or another LLM for explanation
                 const explanation = await getDirectTextResponse(explanationQuery, userId, userName, { preferences: userPreferences, exercisePRs: exercisePRs });
                 if (explanation) {
                     return NextResponse.json({ response: explanation, data: null });
                 } else {
                     // Handle failure
                     console.warn(`[POST] Failed to get direct explanation for keyword (second check): ${unusedKeyword}`);
                     return NextResponse.json({ response: `Sorry ${userName}, I had trouble explaining "${unusedKeyword}" right now. Please try again later.`, data: null });
                 }
            }
        }

        // 2. Backend Logic Routing based on Intent
        switch (intent) {
          case "get_total_metric":
            if (!entities?.metric) { responseText = "Please specify which metric you want the total for (e.g., distance, duration)."; break; }
            const total = await fetchTotalMetricForPeriod(
              userId,
              entities.metric,
              entities.workout_type ?? "any",
              startDate,
              endDate
            );
            responseData = { total };
            responseText = generateTotalResponse(
              total,
              entities.metric,
              entities.workout_type ?? "any",
              entities.period, 
              startDate, 
              endDate,  
              currentUserName // Use the re-asserted variable
            );
            break;

          case "get_average_metric":
            if (!entities?.metric) { responseText = "Please specify which metric you want the average for (e.g., pace, duration)."; break; }
            const average = await fetchAverageMetricForPeriod(
              userId,
              entities.metric,
              entities.workout_type ?? "any",
              startDate,
              endDate
            );
            responseData = { average, metric: entities.metric, unit: getUnitForMetric(entities.metric, true), period: entities.period, workoutType: entities.workout_type };
            if (average !== null) {
               responseText = generateAverageResponse(
                 average,
                 entities.metric,
                 entities.workout_type ?? "any",
                 entities.period, 
                 startDate, 
                 endDate,  
                 currentUserName // Use the re-asserted variable
               );
             } else {
                // Handle null average case with personality
                const typeDesc = describeWorkoutType(entities.workout_type ?? "any");
                const periodDesc = describePeriod(entities.period, startDate, endDate);
                responseText = `Hmm ${currentUserName}, I couldn't calculate the average ${entities.metric} for your ${typeDesc}workouts ${periodDesc}. Maybe there wasn't enough data?`;
             }
            break;

          case "get_record":
             if (!entities?.metric || !entities?.workout_type) { responseText = "Please specify a metric and a workout type to find a record."; break; }
             const record = await fetchRecordMetric(
                 userId,
                 entities.metric,
                 entities.workout_type,
                 entities.record_qualifier
             );
             responseData = { record };
             if (record) {
                responseText = generateRecordResponse(
                    record.value,
                    record.date,
                    entities.metric,
                    entities.workout_type,
                    entities.record_qualifier,
                    currentUserName // Use the re-asserted variable
                );
             } else {
                responseText = `Couldn't find that specific record for ${entities.metric} (${entities.workout_type}), ${currentUserName}. Keep pushing for those PBs! 🚀`;
             }
             break;

           case "list_workouts":
             if (!startDate && !endDate && !entities?.period) { 
                 responseText = "Please specify a time period (like last week or July 2024) to list workouts."; 
                 // Set data to empty array for consistency if parameters are missing
                 responseData = { workouts: [] }; 
                 break; 
             }
             const workouts = await listWorkouts(
                 userId,
                 entities?.workout_type ?? "any",
                 startDate,
                 endDate,
                 entities?.limit
             );
             responseData = { workouts }; // Send the raw workout array
             if (workouts.length > 0) {
                // Generate a simple text message, frontend will handle display
                 const typeDesc = describeWorkoutType(entities?.workout_type);
                 const periodDesc = describePeriod(entities?.period, startDate, endDate);
                 responseText = `Okay ${currentUserName}, here are the ${typeDesc}workouts I found ${periodDesc}.`;
             } else {
                 // Use the potentially more specific describePeriod
                 const periodDesc = describePeriod(entities?.period, startDate, endDate);
                 responseText = `I couldn't find any workouts ${entities?.workout_type && entities.workout_type !== 'any' ? `for ${entities.workout_type}` : ''} ${periodDesc}.`;
             }
             break;

          case "get_workout_details":
             if (!entities?.workout_identifier) { responseText = "I need something to identify the workout you're asking about, like a date (e.g., 'my run last Tuesday')."; break; }
             const details = await fetchWorkoutDetails(userId, entities.workout_identifier, entities?.workout_type);
             responseData = { details };
             if (details) {
                responseText = generateDetailsResponse(details, currentUserName); // Use the re-asserted variable
             } else {
                responseText = `Sorry ${currentUserName}, I couldn't find the details for the workout identified by '${entities.workout_identifier}'${entities?.workout_type ? ` of type ${entities.workout_type}` : ''}. Maybe try describing it differently?`;
             }
             break;

          case "compare_metric":
              // Check if we have enough info for EITHER period-based comparison OR workout-vs-previous comparison
              const isPeriodComparison = entities?.metric && entities?.period && (entities?.comparison_period || (entities?.explicit_start_date && entities?.explicit_end_date));
              // We need workout_identifier, limit, and a *specific* workout_type for workout-vs-previous
              const isWorkoutVsPreviousComparison = entities?.workout_identifier && entities?.limit && entities?.workout_type && entities.workout_type !== 'any';
 
              if (!isPeriodComparison && !isWorkoutVsPreviousComparison) {
                   // Updated fallback message if neither comparison type is possible
                   responseText = `To compare workouts, ${currentUserName}, please tell me what you want to compare. For example:\n*   'Compare my distance this week vs last week.'\n*   'How did my run today compare to my last 5 runs?'`;
                   break;
              }
 
              if (isPeriodComparison) {
                  // --- Existing Period-Based Comparison Logic --- 
                  if (!entities?.metric) { responseText = `Which metric (like distance or duration) should I compare, ${currentUserName}?`; break; }
                  if (!entities?.period) { responseText = `What's the first time period (like 'this week'), ${currentUserName}?`; break; }
                  if (!entities?.comparison_period && !(entities?.explicit_start_date && entities?.explicit_end_date)) { responseText = `What's the second time period (like 'last month' or 'August 2024'), ${currentUserName}?`; break; }
                  
                  // Calculate range for the first period (always uses 'period')
                  const period1Range = calculateDateRange(entities.period);
    
                  // Determine range for the second period: prioritize explicit dates over comparison_period
                  let period2StartDate = entities.explicit_start_date;
                  let period2EndDate = entities.explicit_end_date;
                  let period2Label = entities.comparison_period;
                  let period2Description = '';

                  if (!period2StartDate || !period2EndDate) {
                      // If no explicit dates, use comparison_period
                      if (entities.comparison_period) {
                        const period2RangeCalc = calculateDateRange(entities.comparison_period);
                        period2StartDate = period2RangeCalc.start_date;
                        period2EndDate = period2RangeCalc.end_date;
                        // Keep period2Label as the enum value
                      } else {
                        // Should not happen due to initial check, but safeguard
                        responseText = `Something went wrong determining the second period for comparison, ${currentUserName}.`;
                        break;
                      }
                  } else {
                     // Explicit dates provided, override period2Label for description purposes
                     period2Label = undefined; // Indicate explicit dates were used
                     period2Description = describePeriod(undefined, period2StartDate, period2EndDate); // Generate desc from dates
                  }

                  const comparison = await compareMetricBetweenPeriods(
                      userId,
                      entities.metric,
                      entities.workout_type ?? "any",
                      { start_date: period1Range.start_date, end_date: period1Range.end_date },
                      // Use the determined start/end dates for period 2
                      { start_date: period2StartDate, end_date: period2EndDate } 
                  );
                  // Use a distinct variable name for period comparison results
                  const periodComparison = comparison; // Fix: Use the existing 'comparison' result here
                  responseData = { comparison: periodComparison }; // Keep structure consistent if needed
                  responseText = generateCompareResponse(
                      periodComparison.value1,
                      periodComparison.value2,
                      entities.metric,
                      entities.workout_type ?? "any",
                      entities.period, // Label for period 1
                      period2Label, // Label for period 2 (if used)
                      period2Description, // Description if explicit dates used
                      currentUserName 
                  );
                  break;
              } else if (isWorkoutVsPreviousComparison) {
                 // --- New Workout-vs-Previous Comparison Logic --- 
                 // We know entities.workout_identifier, entities.limit, and entities.workout_type are defined and valid here
                 console.log(`[Compare Metric] Workout vs Previous N comparison detected for workout ${entities.workout_identifier}, type ${entities.workout_type}, limit ${entities.limit}`);
                 
                 // 1. Fetch the target workout details (Identifier is guaranteed to be string here)
                 const targetWorkout = await fetchWorkoutDetails(userId, entities.workout_identifier as string);
                 if (!targetWorkout) {
                    responseText = `Sorry ${currentUserName}, I couldn't find the specific workout (ID: ${entities.workout_identifier}) you want to compare.`;
                    break;
                 }
                 // Check if the fetched workout's type matches the intent's type (consistency check)
                 if (targetWorkout.type !== entities.workout_type) {
                    console.warn(`[Compare Metric] Mismatch: Intent type was ${entities.workout_type}, but fetched workout ${targetWorkout.id} is type ${targetWorkout.type}. Proceeding with fetched type.`);
                    // Potentially update entities.workout_type = targetWorkout.type; if needed downstream
                 }
                 
                 // 2. Fetch the previous N workouts of the same type
                 //    Requires listWorkouts to handle sorting and date filtering correctly.
                 const previousWorkouts = await listWorkouts(
                     userId,
                     entities.workout_type, // Use the validated type from the intent entities
                     undefined, // No specific start date for previous
                     targetWorkout.date.toISOString(), // Fetch workouts *before* this one
                     entities.limit! + 1 // Fetch one extra (limit is defined here)
                 );
                 // TODO: Filter out the targetWorkout itself if it's included and sort by date descending
                 const filteredPreviousWorkouts = previousWorkouts.filter(w => w.id !== targetWorkout.id).slice(0, entities.limit!); // limit is defined here
 
                 console.log(`[Compare Metric] Found ${filteredPreviousWorkouts.length} previous ${targetWorkout.type} workouts for comparison.`);
 
                 // 3. Calculate relevant metrics for target and previous (e.g., average)
                 const metricsToCompare = getDefaultMetricsForType(targetWorkout.type);
                 const targetMetrics = calculateMetricsForWorkout(targetWorkout, metricsToCompare);
                 const previousAvgMetrics = calculateAverageMetrics(filteredPreviousWorkouts, metricsToCompare);
                 
                 const workoutComparisonData = { 
                    targetWorkoutId: targetWorkout.id,
                    targetDate: targetWorkout.date.toISOString(),
                    targetMetrics: targetMetrics, // Metrics object for the target workout
                    previousCount: filteredPreviousWorkouts.length,
                    previousAvgMetrics: previousAvgMetrics, // Avg metrics object for the previous N workouts
                    limitRequested: entities.limit!, // limit is defined here
                    workoutType: targetWorkout.type
                 };
                 responseData = { comparison: workoutComparisonData }; // Use a suitable structure
 
                 // 4. Generate the response string (Needs a new helper function)
                 responseText = generateWorkoutComparisonResponse(workoutComparisonData, currentUserName);
                 
                 break; // End of workout-vs-previous logic
              }
 
              // Fallback if logic somehow misses a case (shouldn't happen with the initial checks)
              break;
          case "unknown":
          default:
             responseText = response_suggestion || `Sorry ${currentUserName}, I couldn't quite understand that request. Could you try phrasing it differently?`;
            break;
        }

        // Prepend AI suggestion if available and intent wasn't 'unknown'
        if (response_suggestion && intent !== "unknown") {
          // Add a separator or just concatenate based on desired flow
          responseText = `${response_suggestion.trim()} ... ${responseText}`;
          // Alternative: responseText = response_suggestion + "\n\n" + responseText;
        }

        console.log("Final Generated Response:", responseText);
        // 3. Return Response
        return NextResponse.json({
          response: responseText,
          data: responseData,
          analysis: validation.data
        });

      } catch (error: any) {
        console.error("[API /coach] Internal Server Error:", error);
        // Provide a user-friendly error message
        return NextResponse.json(
          {
            response: "Sorry, the AI coach encountered an unexpected issue. Please try again later.",
            data: null,
            // Optionally include error details in development only
            // error: process.env.NODE_ENV === 'development' ? error.message : undefined,
          },
          { status: 500 }
        );
      }
    }


    // --- Response Generation Helper Functions ---
    // These functions format the data into user-friendly strings.
    // They also handle unit conversions for display (e.g., seconds -> min, meters -> km).

    function formatDuration(seconds: number): string {
        const totalSecondsRounded = Math.round(seconds); // Round the total seconds first
        if (totalSecondsRounded < 60) return `${totalSecondsRounded} sec`; // Use rounded seconds
        const minutes = Math.floor(totalSecondsRounded / 60);
        const remainingSeconds = totalSecondsRounded % 60;
        if (remainingSeconds === 0) return `${minutes} min`;
        return `${minutes}m ${remainingSeconds}s`; // Use rounded remaining seconds
    }

    function formatDistance(kilometers: number): string {
        if (kilometers < 1) return `${(kilometers * 1000).toFixed(0)} m`; // Display as meters if less than 1 km
        return `${kilometers.toFixed(2)} km`; // Display as km >= 1
    }

    function formatPace(paceSecondsPerMeter: number): string {
        if (paceSecondsPerMeter <= 0) return "N/A";
        const paceMinutesPerKm = (paceSecondsPerMeter * 1000) / 60;
        const minutes = Math.floor(paceMinutesPerKm);
        const seconds = Math.round((paceMinutesPerKm - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    }

    function formatSpeed(speedMetersPerSecond: number): string {
         if (speedMetersPerSecond <= 0) return "N/A";
         const speedKmPerHour = speedMetersPerSecond * 3.6;
         return `${speedKmPerHour.toFixed(1)} km/h`;
    }

    function getUnitForMetric(metric: z.infer<typeof ValidMetrics>, isAverage: boolean = false): string {
        switch(metric) {
            case 'distance': return 'km';
            case 'duration': return 'min'; // Usually display duration total/avg in minutes
            case 'pace': return '/km'; // Display pace as min/km
            case 'speed': return 'km/h';
            case 'calories': return 'kcal';
            case 'count': return 'workouts';
            case 'elevation': return 'm';
            default: return '';
        }
    }

    function formatValue(value: number | null, metric: z.infer<typeof ValidMetrics>): string {
         if (value === null || value === undefined) return "N/A";
         switch(metric) {
             case 'distance': return formatDistance(value);
             case 'duration': return formatDuration(value);
             case 'pace': return formatPace(value);
             case 'speed': return formatSpeed(value);
             case 'calories': return `${Math.round(value)} kcal`;
             case 'count': return `${value}`; // Just the number for count
             case 'elevation': return `${Math.round(value)} m`;
             default: return value.toFixed(1); // Default formatting
         }
    }

    // Define the extended period type explicitly for clarity in function signatures
    type ExtendedPeriodType = z.infer<typeof ValidPeriods>; // This now includes 'next_week'

    function describePeriod(period?: ExtendedPeriodType, startDate?: string, endDate?: string): string { // Use the imported type
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const startDateString = `${start.getUTCMonth() + 1}/${start.getUTCDate()}/${start.getUTCFullYear()}`;
            const endDateString = `${end.getUTCMonth() + 1}/${end.getUTCDate()}/${end.getUTCFullYear()}`; 
            return `between ${startDateString} and ${endDateString}`;
        }
        if (period === 'next_week') return "next week"; 
        if (period) return period.replace(/_/g, ' ');
        return "overall";
    }

    function describeWorkoutType(workoutType?: z.infer<typeof ValidWorkoutTypes>): string {
        return workoutType && workoutType !== 'any' ? `${workoutType} ` : '';
    }


    function generateTotalResponse(
        totalValue: number | null,
        metric: z.infer<typeof ValidMetrics>,
        workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
        period: ExtendedPeriodType | undefined, // Use the imported type
        startDate: string | undefined,
        endDate: string | undefined,
        userName: string // Add userName parameter
    ): string {
        const typeDesc = describeWorkoutType(workoutType);
        const periodDesc = describePeriod(period, startDate, endDate); // describePeriod now accepts the type

        if (totalValue === null || totalValue === 0) {
            return `Hey ${userName}, I checked for ${typeDesc}workouts ${periodDesc}, but it seems there wasn't any ${metric} logged for that time. Keep logging those sessions! 👍`;
        }

        const formattedValue = formatValue(totalValue, metric);
        // Add more specific encouragement based on metric
        let encouragement = "Keep up the great work! 💪";
        if (metric === 'distance') encouragement = "That's some serious mileage! Awesome job! 🏃‍♀️💨";
        if (metric === 'duration') encouragement = "Great consistency! Keep putting in the time! ⏰";
        if (metric === 'count') encouragement = `That's ${formattedValue} sessions logged! Fantastic dedication! ✨`;

        return `Alright ${userName}, digging into your ${typeDesc}workouts ${periodDesc}, your total ${metric} was ${formattedValue}! ${encouragement}`;
    }

    function generateAverageResponse(
        average: number | null,
        metric: z.infer<typeof ValidMetrics>,
        workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
        period: ExtendedPeriodType | undefined, // Use the imported type
        startDate: string | undefined,
        endDate: string | undefined,
        userName: string // Add userName
    ): string {
        const formattedValue = formatValue(average, metric);
        const typeDesc = describeWorkoutType(workoutType);
        const periodDesc = describePeriod(period, startDate, endDate); // describePeriod now accepts the type

        if (average === null) {
            // Handle null average case with personality
            return `Hmm ${userName}, I couldn't calculate the average ${metric} for your ${typeDesc}workouts ${periodDesc}. Maybe there wasn't enough data for that period?`;
        }

        // Add personality
        if (metric === 'pace') {
            return `Nice one, ${userName}! Your average ${typeDesc}pace ${periodDesc} was ${formattedValue}. Looking steady! 👀`;
        } else if (metric === 'speed') {
            return `Zoom! 🚀 Your average ${typeDesc}speed ${periodDesc} was ${formattedValue}, ${userName}. Keep flying!`;
        } else {
            return `Okay ${userName}, looking at the numbers, your average ${typeDesc}${metric} ${periodDesc} came out to ${formattedValue}. Solid work!`;
        }
    }

    function generateRecordResponse(
        value: number | null,
        date: string | null,
        metric: z.infer<typeof ValidMetrics>,
        workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
        qualifier: string | undefined,
        userName: string // Add userName
    ): string {
        if (value === null) {
            return `Couldn't find that specific record for ${metric} (${workoutType || 'any workout'}), ${userName}. Keep pushing for those PBs! 🚀`;
        }
        const formattedValue = formatValue(value, metric);
        const typeDesc = describeWorkoutType(workoutType);
        const dateStr = date ? new Date(date).toLocaleDateString() : "an unknown date";

        let recordDesc = '';
        let intro = `New record alert, ${userName}! 🔔`;
        let emoji = '🏆';

        if (metric === 'distance') { recordDesc = 'longest'; intro = `Wow ${userName}, serious distance!`; emoji = '🏃‍♂️💨'; }
        else if (metric === 'duration') { recordDesc = 'longest'; intro = `Epic session, ${userName}!`; emoji = '⏱️'; }
        else if (metric === 'pace') { recordDesc = `fastest ${qualifier ? qualifier + ' ' : ''}`; intro = `Blazing fast, ${userName}!`; emoji = '⚡'; }
        else { recordDesc = `highest ${metric}`; } // Default assumption

        return `${intro} Your ${recordDesc} ${typeDesc}${metric === 'pace' ? 'pace ' : ''}was ${formattedValue}, achieved on ${dateStr}. That's a personal best! ${emoji}`; 
    }

    function generateListResponse(
        workouts: WorkoutListItem[],
        workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
        period: ExtendedPeriodType | undefined, // Use the imported type
        startDate: string | undefined,
        endDate: string | undefined,
        limit?: number,
        userName?: string // Add userName parameter
    ): string {
        const typeDesc = describeWorkoutType(workoutType);
        const periodDesc = describePeriod(period, startDate, endDate); // describePeriod now accepts the type
        const name = userName || 'there'; // Default if needed

        if (workouts.length === 0) {
            return `Hmm ${name}, I couldn't find any ${typeDesc}workouts logged ${periodDesc}. Let's get some in soon!`;
        }

        const count = workouts.length;
        const limitReached = limit && count >= limit;

        let response = `Okay ${name}, you asked about ${typeDesc}workouts ${periodDesc}. Here ${limitReached ? `are the latest ${count}` : count === 1 ? 'is the one I found' : `are the ${count} I found`}:\n\n`;

        response += workouts.map(w => {
            const dateStr = new Date(w.date).toLocaleDateString();
            // Use helper functions for formatting and handle nulls
            const formattedDistance = w.distance ? formatDistance(w.distance) : 'N/A';
            const formattedDuration = w.duration ? formatDuration(w.duration) : 'N/A';
            const formattedCalories = w.calories ? `${Math.round(w.calories)} kcal` : 'N/A'; 

            // Create a more structured markdown string
            let workoutString = `*   **${dateStr}: ${w.name || w.type}**\n`;
            workoutString += `    *   Duration: ${formattedDuration}\n`;
            workoutString += `    *   Distance: ${formattedDistance}\n`;
            workoutString += `    *   Calories: ${formattedCalories}`;
            // Removed the less structured single line return
            return workoutString;
        }).join('\n\n'); // Add extra newline between workout entries

        return response;
    }


    function generateDetailsResponse(details: WorkoutDetailItem, userName: string): string { // Add userName
        const dateStr = new Date(details.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        const name = userName || 'there'; // Default if needed
        
        // Start with a more conversational tone
        let response = `Alright ${name}, let's break down your ${details.type} workout from ${dateStr}:
    `;
        response += `*   **Workout Name:** ${details.name || `(${capitalizeFirstLetter(details.type)} Workout)`}
    `; // Use markdown for structure, provide default if unnamed

        const mainMetrics = [];
        if (details.duration) response += `*   **Duration:** ${formatDuration(details.duration)}
    `;
        if (details.distance) response += `*   **Distance:** ${formatDistance(details.distance)}
    `;
        if (details.calories) response += `*   **Calories Burned:** ≈${details.calories} kcal
    `;
        if (details.intensity) response += `*   **Intensity:** ${details.intensity}\n    `;

        // Add exercise details if available (assuming strength)
        if (details.exercises && details.exercises.length > 0) {
            response += `\n*   **Exercises:**\n`;
            details.exercises.forEach(ex => {
                response += `    *   **${ex.exercise?.name ?? 'Unknown Exercise'}:** `; // Bold exercise name (Corrected access)
                if (ex.sets && ex.sets.length > 0) {
                    const setStrings = ex.sets.map(set => {
                        let setStr = ``;
                        if (set.reps) setStr += `${set.reps} reps`;
                        if (set.weight) setStr += ` x ${set.weight} kg`;
                        // Remove unsupported fields from set string
                        // if (set.duration) setStr += ` for ${formatDuration(set.duration)}`;
                        // if (set.distance) setStr += ` at ${formatDistance(set.distance)}`;
                        return setStr.trim();
                    }).filter(Boolean);
                    response += setStrings.join(', ');
                } else {
                    response += `(No sets logged)`;
                }
                response += `\n`;
            });
        } else {
            // Add this block if no exercises are found
            response += `\n*   **Exercises:** (No specific exercises were logged for this workout.)\n`;
        }

        // Add notes if available
        if (details.notes) {
            response += `\n*   **Notes:** ${details.notes}\n`;
        }

        response += `\nHow did this session feel, ${name}? Anything specific you'd like to discuss about it?`; // Add follow-up

        return response;
    }


    function generateCompareResponse(
        value1: number | null,
        value2: number | null,
        metric: z.infer<typeof ValidMetrics>,
        workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
        period1Label: z.infer<typeof ValidPeriods>, // Label for period 1
        period2Label: z.infer<typeof ValidPeriods> | undefined, // Label for period 2 (if period enum used)
        period2DescriptionFromDates: string | undefined, // Description if explicit dates used
        userName: string 
    ): string {
        const formattedValue1 = formatValue(value1, metric);
        const formattedValue2 = formatValue(value2, metric);
        const typeDesc = describeWorkoutType(workoutType);
        // Describe periods based on provided labels or generated description
        const period1Desc = period1Label.replace(/_/g, ' ');
        const period2Desc = period2DescriptionFromDates ? period2DescriptionFromDates.replace(/^in |^during /i, '') // Use generated desc if available
                           : period2Label ? period2Label.replace(/_/g, ' ') // Otherwise use label
                           : 'the second period'; // Fallback
        const name = userName || 'there';

        if (value1 === null || value2 === null) {
            let missingPeriods = [];
            if (value1 === null) missingPeriods.push(period1Desc);
            if (value2 === null) missingPeriods.push(period2Desc);
            return `Hmm ${name}, I seem to be missing the data for ${typeDesc}${metric} in ${missingPeriods.join(' or ')} to make that comparison. Maybe log some more workouts?`;
        }

        const change = value1 - value2;
        const percentageChange = value2 !== 0 ? (change / value2) * 100 : 0;

        let comparisonText = `Okay ${name}, let's compare your ${typeDesc}${metric} for ${period1Desc} versus ${period2Desc}:\n`;
        comparisonText += `*   **${period1Desc}:** ${formattedValue1}\n`;
        comparisonText += `*   **${period2Desc}:** ${formattedValue2}\n\n`;

        if (change === 0) {
            comparisonText += `Looks like your ${metric} stayed exactly the same between these periods! Consistent work! 👍`;
        } else {
            const direction = change > 0 ? "an increase" : "a decrease";
            const emoji = change > 0 ? "📈" : "📉";
            comparisonText += `That's ${direction} of ${formatValue(Math.abs(change), metric)} (${percentageChange.toFixed(1)}%) ${emoji}.`;
        }

        return comparisonText;
    }

    function createHighlightPrompt(userName: string, workout: Partial<IWorkout>) {
        // Convert workout data to a string format, handling potential undefined fields
        let workoutDetails = `Workout Type: ${workout.type || 'N/A'}`;
        if (workout.duration) workoutDetails += `\nDuration: ${(workout.duration / 60).toFixed(1)} minutes`;
        if (workout.distance) workoutDetails += `\nDistance: ${workout.distance.toFixed(2)} km`;
        if (workout.calculatedVolume) workoutDetails += `\nTotal Volume: ${workout.calculatedVolume.toFixed(0)} kg`; // Use calculatedVolume
        if (workout.notes) workoutDetails += `\nNotes: ${workout.notes}`; 

        // Construct the system prompt
        return `You are Aivery, a fitness coach AI. Your task is to generate a **single, concise, positive, and encouraging highlight statement** (max 20 words) for the user based on their completed workout. 

DATABASE SCHEMA OVERVIEW (Key Fields for Context):
- UserData: _id, email, name, image, aiPreferences { location, fitnessGoals, trainingPreferences, ... }, height, weight, age, gender, ...
- WorkoutData: _id, userId, type (strength, run, cycle, swim, ...), name, date, duration, distance, calories, notes, intensity, workoutExercises[], cardioDetails { pace, speed, heartRate, laps, ... }, source, records[] { timestamp, heart_rate, speed, ... }, calculatedVolume, ...
- ExerciseData: _id, name, description, muscleGroups, category (strength, cardio, flexibility), equipment, instructions
- WorkoutExerciseData: _id, workoutId, exerciseId { _id, name, category }, sets[], notes, order, duration, distance
- Set: _id, weight, reps, duration, distance, notes

USER NAME: ${userName}

WORKOUT DATA:
${workoutDetails}

INSTRUCTIONS:
1. Address the user by name (e.g., "Great job, ${userName}!").
2. Focus on ONE key positive aspect (e.g., consistency, distance, strength, trying something new).
3. Keep it short and punchy (max 20 words).
4. Be encouraging and positive in tone.
5. Do NOT include specific numbers unless it's a notable achievement (like a PR, which you won't know, so avoid specifics).
6. Do NOT ask questions.
7. Only output the highlight statement itself, no extra text.`;
    } 

    // --- PLACEHOLDER HELPER FUNCTIONS for Workout Comparison ---

    function getDefaultMetricsForType(workoutType: string): Array<z.infer<typeof ValidMetrics>> {
        console.log(`[Helper] TODO: Define default metrics for ${workoutType}`);
        if (workoutType === 'running' || workoutType === 'cycling') {
             return ['duration', 'distance', 'pace', 'speed', 'calories'];
         } else if (workoutType === 'strength') {
             return ['duration', 'volume', 'calories']; // Example
         } else {
             return ['duration', 'calories']; // Fallback
         }
    }

    function calculateMetricsForWorkout(workout: WorkoutDetailItem, metrics: Array<z.infer<typeof ValidMetrics>>): Record<string, number | null> {
        console.log(`[Helper] TODO: Calculate metrics for single workout ${workout.id}`);
        const calculatedMetrics: Record<string, number | null> = {};
        metrics.forEach(metric => {
           // Placeholder: just grab value if exists, else null
           calculatedMetrics[metric] = workout[metric as keyof WorkoutDetailItem] as number | null ?? null; 
        });
        // TODO: Calculate pace/speed if not directly stored
        return calculatedMetrics;
    }

    function calculateAverageMetrics(workouts: WorkoutListItem[], metrics: Array<z.infer<typeof ValidMetrics>>): Record<string, number | null> {
        console.log(`[Helper] TODO: Calculate average metrics for ${workouts.length} workouts`);
        const avgMetrics: Record<string, number | null> = {};
        const count = workouts.length;
        if (count === 0) return metrics.reduce((acc, m) => ({ ...acc, [m]: null }), {});

        metrics.forEach(metric => {
             const sum = workouts.reduce((total, workout) => {
                 const value = workout[metric as keyof WorkoutListItem] as number | null;
                 return total + (value ?? 0);
             }, 0);
             avgMetrics[metric] = sum / count;
        });
        // TODO: Calculate average pace/speed correctly
        return avgMetrics;
    }

    interface WorkoutComparisonData {
        targetWorkoutId: string;
        targetDate: string;
        targetMetrics: Record<string, number | null>;
        previousCount: number;
        previousAvgMetrics: Record<string, number | null>;
        limitRequested: number;
        workoutType: string;
    }

    function generateWorkoutComparisonResponse(data: WorkoutComparisonData, userName: string): string {
        console.log(`[Helper] TODO: Generate comparison response string`);
        let response = `Okay ${userName}, let's compare your ${data.workoutType} workout from ${new Date(data.targetDate).toLocaleDateString()} to the average of your previous ${data.previousCount} ${data.workoutType} sessions (out of ${data.limitRequested} requested):
\n`;
        
        if (data.previousCount === 0) {
            response += "I couldn't find any previous workouts of this type to compare against.\n";
        } else {
            response += "| Metric     | This Workout | Previous Avg | Change    |\n";
            response += "| :--------- | :----------- | :----------- | :-------- |\n";
            for (const metric in data.targetMetrics) {
                const targetVal = data.targetMetrics[metric];
                const avgVal = data.previousAvgMetrics[metric];
                const formattedTarget = formatValue(targetVal, metric as z.infer<typeof ValidMetrics>);
                const formattedAvg = formatValue(avgVal, metric as z.infer<typeof ValidMetrics>);
                let changeStr = "N/A";
                if (targetVal !== null && avgVal !== null && avgVal !== 0) {
                    const change = targetVal - avgVal;
                    const percentChange = (change / avgVal) * 100;
                    const sign = change > 0 ? '+' : '';
                    changeStr = `${sign}${percentChange.toFixed(0)}%`;
                }
                response += `| ${capitalizeFirstLetter(metric)} | ${formattedTarget} | ${formattedAvg} | ${changeStr} |\n`;
            }
        }
        response += "\n(Note: This comparison logic is still under development and might need refinement, especially for pace/speed averages.)";
        return response;
    }

    // --- Summarize Chat History Helper ---
    /**
     * Summarizes earlier chat history using the LLM, keeping only the last N messages verbatim.
     * Uses the model specified by env (Grok/Gemini) and wraps for easy model switching.
     * Returns a new history array: [summary system message, ...last N messages]
     */
    const SUMMARIZE_HISTORY_KEEP_LAST = 3;
    const SUMMARIZE_HISTORY_MIN_LENGTH = 8;

    async function summarizeHistory(history: HistoryMessage[], userId: string): Promise<HistoryMessage[]> {
      if (!history || history.length < SUMMARIZE_HISTORY_MIN_LENGTH) return history;
      const earlier = history.slice(0, -SUMMARIZE_HISTORY_KEEP_LAST);
      const recent = history.slice(-SUMMARIZE_HISTORY_KEEP_LAST);
      const summaryPrompt = `Summarize the following fitness chat history in 5-7 bullet points, preserving all key user requests, AI suggestions, and any plan details. Be concise but specific.\n\nCHAT HISTORY TO SUMMARIZE:\n${earlier.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}`;

      // Model/provider selection (env-driven)
      const provider = (process.env.LLM_PROVIDER_SUMMARY as LLMProvider) || 'grok';
      const model = process.env.LLM_MODEL_SUMMARY || 'grok-3-mini-latest';
      try {
        const data = await callLLM({
          provider,
          model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes fitness chat history for another AI.' },
            { role: 'user', content: summaryPrompt }
          ],
          max_tokens: 256,
          temperature: 0.2,
          stream: false,
        });
        let summary = '';
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          summary = data.choices[0].message.content.trim();
        } else {
          summary = '[Summary unavailable]';
        }
        // Prepend as a system message
        return [
          { role: 'assistant', content: `Summary of earlier chat:\n${summary}` },
          ...recent
        ];
      } catch (err) {
        console.error('[summarizeHistory] Error summarizing history:', err);
        return recent;
      }
      // Defensive: fallback return
      return history;
    }