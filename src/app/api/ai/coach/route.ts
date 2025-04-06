import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
// Use relative path for dateUtils import as alias is failing in build
import { calculateDateRange } from "../../../../lib/utils/dateUtils";
// import { db } from "@/lib/db"; // Placeholder for actual db import
import Anthropic from "@anthropic-ai/sdk"; // Import Anthropic SDK
import { ObjectId } from 'mongodb'; // Import ObjectId
// Mongoose imports
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
// import { Prisma } from "@prisma/client"; // Remove unused Prisma types import

// Define valid intents
const ValidIntents = z.enum([
  "get_total_metric",
  "get_average_metric",
  "get_record",
  "list_workouts",
  "get_workout_details",
  "compare_metric",
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
]);

// Define the schema for the structured AI analysis output
const QueryAnalysisSchema = z.object({
  intent: ValidIntents,
  entities: z.object({
    metric: ValidMetrics.optional(), // e.g., "distance", "duration"
    workout_type: ValidWorkoutTypes.optional(), // e.g., "running", "any"
    period: ValidPeriods.optional(), // e.g., "last_month"
    explicit_start_date: z.string().datetime().optional(), // ISO string
    explicit_end_date: z.string().datetime().optional(), // ISO string
    comparison_period: ValidPeriods.optional(), // For comparison intent
    record_qualifier: z.string().optional(), // e.g., "5k" for fastest pace, "ever" for longest run
    workout_identifier: z.string().optional(), // e.g., date "tuesday", specific id
    limit: z.number().int().positive().optional(), // For listing workouts
  }).optional(), // Entities might not be relevant for all intents or if analysis fails
  response_suggestion: z.string().optional(), // Optional direct response if analysis is simple/confident
});

type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to get the Zod schema as a string for the prompt
function getQueryAnalysisSchemaString(): string {
  // Consider a more robust way to stringify Zod schema if it gets complex
  // For now, manually representing the structure
  return `
{
  intent: "get_total_metric" | "get_average_metric" | "get_record" | "list_workouts" | "get_workout_details" | "compare_metric" | "unknown",
  entities: {
    metric?: "distance" | "duration" | "count" | "volume" | "pace" | "speed" | "calories" | "elevation",
    workout_type?: "running" | "cycling" | "swimming" | "walking" | "hiking" | "strength" | "hiit" | "yoga" | "flexibility" | "other" | "any",
    period?: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "last_year" | "last_7_days" | "last_30_days" | "overall",
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

/**
 * Analyzes the user's fitness query using Anthropic Claude API.
 */
async function analyzeUserQuery(query: string): Promise<QueryAnalysis> {
  const schemaString = getQueryAnalysisSchemaString();
  const systemPrompt = `
You are an AI assistant for a fitness tracking application. Your task is to analyze the user's natural language query about their workout history and extract relevant information into a structured JSON object. The JSON object MUST strictly conform to the following TypeScript type definition (based on a Zod schema):

\`\`\`typescript
${schemaString}
\`\`\`

Key considerations:
- Determine the primary 'intent' of the user's query.
- Extract relevant 'entities' like metric, workout_type, period, dates, qualifiers, identifiers, or limits.
- If the query mentions a specific date or date range (e.g., "July 2024", "last Tuesday", "2024-07-18"), try to capture it in 'workout_identifier' or 'explicit_start_date'/'explicit_end_date'. For relative periods like "last month", use the 'period' field.
- If providing 'explicit_start_date' or 'explicit_end_date', ensure they are full ISO 8601 datetime strings (e.g., "2024-07-01T00:00:00Z", "2024-07-31T23:59:59.999Z"). If the user provides only a date (like "July 1st, 2024"), assume the full day (start: T00:00:00Z, end: T23:59:59.999Z). If they provide a month (like "July 2024"), use the start of the first day and the end of the last day of that month.
- For records (intent: "get_record"), infer the 'metric' (e.g., distance, duration, pace) and 'record_qualifier' (e.g., "5k", "overall").
- If the query is vague or cannot be mapped to a known intent, set intent to "unknown".
- If the query is very simple or ambiguous, you can optionally provide a 'response_suggestion' for the backend to use directly or as a clarification question.
- Only output the raw JSON object. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\`.
- Ensure all string values in the JSON strictly match the allowed enum values where applicable (e.g., for intent, metric, workout_type, period).
- If a field is optional and not present in the query, omit it from the JSON.
- Today's date is ${new Date().toISOString().split('T')[0]}. Use this for resolving relative periods if necessary (although the backend primarily handles period->date calculation).
`;

  const defaultUnknownResponse: QueryAnalysis = {
    intent: "unknown",
    response_suggestion: "Sorry, I couldn't connect to the AI analysis service right now. Please try again later."
  };

  try {
    console.log(`Sending query to Anthropic: "${query}"`);
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", // Use Claude 3.5 Sonnet
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: "user", content: query },
      ],
    });

    console.log("Anthropic Raw Response:", msg);

    // Extract the text content safely
    let jsonString = "";
    const firstBlock = msg.content?.[0];

    if (firstBlock && firstBlock.type === "text") {
        jsonString = firstBlock.text.trim();
    }

    if (!jsonString) {
      console.error("Anthropic response content is empty or not text", msg.content);
      return { // Return default error object
          intent: "unknown",
          response_suggestion: "Received empty or non-text response from AI."
      };
    }

    // Attempt to parse the JSON string
    try {
      const parsedJson = JSON.parse(jsonString);
      console.log("Parsed AI Analysis:", parsedJson);

      // Validate the parsed JSON against our Zod schema
      const validation = QueryAnalysisSchema.safeParse(parsedJson);
      if (!validation.success) {
        console.error("AI Analysis Zod Validation Error:", validation.error?.errors);
        // Return a usable 'unknown' intent even if validation fails
        return { // Return default error object
          intent: "unknown",
          response_suggestion: `Sorry, I had trouble understanding the structure of the analysis for your query. (${validation.error?.issues.map(i => i.message).join(', ') ?? 'Validation failed'})`
        };
      }
      // Return the successfully validated analysis
      return validation.data;

    } catch (parseError) {
      console.error("Failed to parse JSON response from Anthropic:", parseError);
      console.error("Invalid JSON string received:", jsonString);
      return { // Return default error object
        intent: "unknown",
        response_suggestion: "Sorry, I received an unexpected response format from the AI analysis service."
      };
    }

  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    // Return a generic unknown intent with an error suggestion
    return { // Return default error object
      intent: "unknown",
      response_suggestion: "Sorry, I couldn't connect to the AI analysis service right now. Please try again later.",
    };
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
    dateFilter.$gte = new Date(startDate);
  }
  if (endDate) {
    // Add 1 day to endDate to make it inclusive of the end day
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    dateFilter.$lt = end; // Use less than the start of the next day
  }
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
      // Map metric enum to schema field names
      const fieldMap = {
        distance: 'distance',
        duration: 'duration',
        calories: 'calories',
      };
      const fieldToSum = fieldMap[metric as keyof typeof fieldMap]; // Type assertion

      if (!fieldToSum) {
         console.warn(`Unsupported metric for sum: ${metric}`);
         return null;
      }

      await dbConnect(); // Connect Mongoose
      const result = await WorkoutModel.aggregate([
        { $match: filters },
        { $group: { _id: null, total: { $sum: `$${fieldToSum}` } } }
      ]);
      const sum = result[0]?.total ?? 0; // Extract sum from Mongoose aggregation result
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
            distance: doc.distance ?? null,
            calories: doc.calories ?? null,
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
  exercises?: IWorkout['exercises']; // Use indexed access type
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
// Infer Exercise type from IWorkout
type NestedExerciseType = NonNullable<IWorkout['exercises']>[number];

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
        // Use WorkoutModel.findOne with the filter, lean() for plain object
        // Add populate('exercises.exercise') if Exercise refs need population
        const workoutDoc: PopulatedWorkoutDoc | null = await WorkoutModel.findOne(filter)
            // .populate({ // Example population - uncomment/adjust if needed
            //     path: 'exercises.exercise',
            //     model: 'Exercise' // Assuming 'Exercise' is the model name
            // })
            .lean<PopulatedWorkoutDoc>(); // Add type hint to lean()

        if (!workoutDoc) return null;

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
            // Map exercises using inferred type
            exercises: workoutDoc.exercises?.map((ex: NestedExerciseType): ExerciseDetail => ({
                sets: ex.sets,
                notes: null, // Explicitly null - notes aren't on IWorkout['exercises']
                exercise: {
                    name: ex.name || 'Unknown Exercise', // Use name from NestedExerciseType
                    muscleGroups: [], // Placeholder
                    category: 'unknown', // Placeholder
                    equipment: null // Placeholder
                }
            })) || []
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

// --- Main POST Handler ---

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    
    const body = await req.json();
    const { query, userName } = body; // Extract userName
    const currentUserName = userName || "Friend"; // Default name

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log(`Received query from user ${userId}: \"${query}\"`);

    // 1. Analyze Query
    const analysisResult = await analyzeUserQuery(query);
    console.log("Query Analysis Result:", analysisResult);

    // Validate analysis result
    const validation = QueryAnalysisSchema.safeParse(analysisResult);
    if (!validation.success) {
        console.error("Invalid analysis structure:", validation.error);
        return NextResponse.json({ error: "Internal error during query analysis." }, { status: 500 });
    }

    const { intent, entities, response_suggestion } = validation.data;

    // Use suggestion if provided and intent is simple or unknown
    if (response_suggestion && (intent === 'unknown' /*|| intent === 'simple_greeting' etc.*/ )) {
        return NextResponse.json({ response: response_suggestion });
    }

    // 2. Backend Logic Routing based on Intent
    let responseData: any = null;
    let responseText = "";

    // Calculate date range if a period is specified
    let dateRange: { start_date?: string; end_date?: string; period_description: string } | null = null;
    if (entities?.period) {
      dateRange = calculateDateRange(entities.period);
    }

    // Prioritize explicit dates from AI if available
    const startDate = entities?.explicit_start_date ?? dateRange?.start_date;
    const endDate = entities?.explicit_end_date ?? dateRange?.end_date;

    const qualifier = entities?.record_qualifier;
    const identifier = entities?.workout_identifier;
    const limit = entities?.limit;

    // Switch based on intent... (rest of the switch statement remains the same)
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
          currentUserName // Pass userName
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
             currentUserName // Pass userName
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
                currentUserName // Pass userName
            );
         } else {
            responseText = `Couldn't find that specific record for ${entities.metric} (${entities.workout_type}), ${currentUserName}. Keep pushing for those PBs! 🚀`;
         }
         break;

       case "list_workouts":
         if (!startDate && !endDate && !entities?.period) { responseText = "Please specify a time period (like last week or July 2024) to list workouts."; break; }
         const workouts = await listWorkouts(
             userId,
             entities?.workout_type ?? "any",
             startDate,
             endDate,
             entities?.limit
         );
         responseData = { workouts };
         if (workouts.length > 0) {
             responseText = generateListResponse(
                 workouts,
                 entities?.workout_type,
                 entities?.period,
                 startDate,
                 endDate,
                 entities?.limit,
                 currentUserName // Pass userName
             );
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
            responseText = generateDetailsResponse(details, currentUserName); // Pass userName
         } else {
            responseText = `Sorry ${currentUserName}, I couldn't find the details for the workout identified by '${entities.workout_identifier}'${entities?.workout_type ? ` of type ${entities.workout_type}` : ''}. Maybe try describing it differently?`;
         }
         break;

      case "compare_metric":
          if (!entities?.metric || !entities?.period || (!entities?.comparison_period && !(entities?.explicit_start_date && entities?.explicit_end_date))) {
               responseText = `To compare, ${currentUserName}, I need a metric (like distance) and two time periods (like 'this week' and 'last month' or a specific range like 'August 2024').`; 
               break; 
          }
          
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
          responseData = { comparison };
          responseText = generateCompareResponse(
              comparison.value1,
              comparison.value2,
              entities.metric,
              entities.workout_type ?? "any",
              entities.period, // Label for period 1
              period2Label, // Label for period 2 (if used)
              period2Description, // Description if explicit dates used
              currentUserName 
          );
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

  } catch (error) {
    console.error("API Coach Error:", error);
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    );
  }
}


// --- Response Generation Helper Functions ---
// These functions format the data into user-friendly strings.
// They also handle unit conversions for display (e.g., seconds -> min, meters -> km).

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}m ${remainingSeconds}s`;
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

function describePeriod(period?: z.infer<typeof ValidPeriods>, startDate?: string, endDate?: string): string {
    if (startDate && endDate) {
        // Use UTC methods to avoid timezone-dependent rollover for end date
        const start = new Date(startDate);
        const end = new Date(endDate);
        const startDateString = `${start.getUTCMonth() + 1}/${start.getUTCDate()}/${start.getUTCFullYear()}`;
        const endDateString = `${end.getUTCMonth() + 1}/${end.getUTCDate()}/${end.getUTCFullYear()}`; // Format end date using UTC
        return `between ${startDateString} and ${endDateString}`;
    }
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
    period: z.infer<typeof ValidPeriods> | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    userName: string // Add userName parameter
): string {
    const typeDesc = describeWorkoutType(workoutType);
    const periodDesc = describePeriod(period, startDate, endDate);

    if (totalValue === null || totalValue === 0) {
        return `Looks like you didn't log any ${metric} for ${typeDesc}workouts ${periodDesc}, ${userName}. No worries, keep logging!`;
    }

    const formattedValue = formatValue(totalValue, metric);
    return `Alright ${userName}, your total ${typeDesc}${metric} ${periodDesc} was ${formattedValue}! Keep up the great work! 💪`;
}

function generateAverageResponse(
    average: number | null,
    metric: z.infer<typeof ValidMetrics>,
    workoutType: z.infer<typeof ValidWorkoutTypes> | undefined,
    period: z.infer<typeof ValidPeriods> | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    userName: string // Add userName
): string {
    const formattedValue = formatValue(average, metric);
    const typeDesc = describeWorkoutType(workoutType);
    const periodDesc = describePeriod(period, startDate, endDate);

    // Add personality
    if (metric === 'pace') {
      return `Nice one, ${userName}! Your average ${typeDesc}pace ${periodDesc} was ${formattedValue}. Steady going!`;
    } else if (metric === 'speed') {
      return `Picking up speed, ${userName}! Your average ${typeDesc}speed ${periodDesc} was ${formattedValue}.`;
    } else {
      return `Okay ${userName}, your average ${typeDesc}${metric} ${periodDesc} was ${formattedValue}.`;
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
    const formattedValue = formatValue(value, metric);
    const typeDesc = describeWorkoutType(workoutType);
    const dateStr = date ? new Date(date).toLocaleDateString() : "an unknown date";

    let recordDesc = '';
    let intro = `Check this out, ${userName}!`;
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
    period: z.infer<typeof ValidPeriods> | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    limit?: number,
    userName?: string // Add userName parameter
): string {
    const typeDesc = describeWorkoutType(workoutType);
    const periodDesc = describePeriod(period, startDate, endDate);
    const name = userName || 'there'; // Default if needed

    if (workouts.length === 0) {
        return `Hmm ${name}, I couldn't find any ${typeDesc}workouts logged ${periodDesc}. Let's get some in soon!`;
    }

    const count = workouts.length;
    const limitReached = limit && count >= limit;

    let response = `Okay ${name}, here ${limitReached ? `are your latest ${count}` : count === 1 ? 'is your' : `are your ${count}`} ${typeDesc}workout${count === 1 ? '' : 's'} ${periodDesc}:\n`;

    response += workouts.map(w => {
        const dateStr = new Date(w.date).toLocaleDateString();
        const details = [
            w.distance ? formatDistance(w.distance) : null,
            w.duration ? formatDuration(w.duration) : null,
            w.calories ? `${w.calories} kcal` : null
        ].filter(Boolean).join(', '); // Filter out null/undefined details
        return `- ${dateStr}: ${w.name || w.type} (${details || 'No details'})`; // Handle missing name
    }).join('\n');

    return response;
}


function generateDetailsResponse(details: WorkoutDetailItem, userName: string): string { // Add userName
    const dateStr = new Date(details.date).toLocaleDateString();
    const name = userName || 'there'; // Default if needed
    
    // Start with a more conversational tone
    let response = `Alright ${name}, let's break down your ${details.type} workout from ${dateStr}:
`;
    response += `*   **Workout Name:** ${details.name || 'Unnamed Workout'}
`; // Use markdown for structure
    if (details.duration) response += `*   **Duration:** ${formatDuration(details.duration)}
`;
    if (details.distance) response += `*   **Distance:** ${formatDistance(details.distance)}
`;
    if (details.calories) response += `*   **Calories Burned:** ≈${details.calories} kcal
`;
    if (details.intensity) response += `*   **Intensity:** ${details.intensity}
`;
    
    // Add cardio details if present (example: pace)
    if (details.cardioDetails?.pace) {
        response += `*   **Average Pace:** ${formatPace(details.cardioDetails.pace)}
`;
    }
    // TODO: Add more cardio details (heart rate, elevation etc.) here in a similar fashion

    if (details.notes) response += `*   **Your Notes:** ${details.notes}
`;

    if (details.exercises && details.exercises.length > 0) {
        response += `*   **Exercises Logged:**
`;
        details.exercises.forEach(ex => {
            const exName = ex.exercise?.name || 'Unnamed Exercise';
            // Basic sets info - can be expanded later
            const setsInfo = ex.sets?.length ? `(${ex.sets.length} sets)` : '(Sets info missing)'; 
            response += `    *   ${exName} ${setsInfo}
`;
            // TODO: Add more detailed set info (reps/weight)
        });
    }
    
    response += `
Anything else you want to know about this one, ${name}?`;
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
        return `Hmm ${name}, I seem to be missing the data for ${typeDesc}${metric} in ${missingPeriods.join(' or ')} to make that comparison. Maybe log some more workouts? 😉`;
    }

    const diff = value1 - value2;
    const percentageChange = (value2 !== 0 && !isNaN(value2)) ? (diff / Math.abs(value2)) * 100 : 0;

    let comparisonText: string;
    const higherIsBetterMetrics: Array<z.infer<typeof ValidMetrics>> = ['distance', 'duration', 'calories', 'count', 'volume', 'speed', 'elevation'];
    const lowerIsBetterMetrics: Array<z.infer<typeof ValidMetrics>> = ['pace'];

    const higherIsBetter = higherIsBetterMetrics.includes(metric);
    const lowerIsBetter = lowerIsBetterMetrics.includes(metric);

    if (Math.abs(percentageChange) < 1) { 
        comparisonText = `Looking good, ${name}! Your ${typeDesc}${metric} was pretty consistent: ${formattedValue1} ${period1Desc} vs ${formattedValue2} ${period2Desc}.`;
    } else {
        const direction = diff > 0 ? (higherIsBetter ? 'up' : (lowerIsBetter ? 'slower' : 'up')) 
                                  : (higherIsBetter ? 'down' : (lowerIsBetter ? 'faster' : 'down'));
        const trendWord = diff > 0 ? (higherIsBetter ? 'increase' : (lowerIsBetter ? 'decrease in speed' : 'increase'))
                                   : (higherIsBetter ? 'decrease' : (lowerIsBetter ? 'improvement' : 'decrease'));
        const emoji = direction === 'up' && higherIsBetter ? '📈' : (direction === 'down' && lowerIsBetter ? '🚀' : (direction === 'down' && higherIsBetter ? '📉' : ''));

        comparisonText = `Alright ${name}, comparing ${typeDesc}${metric}: you went from ${formattedValue2} ${period2Desc} to ${formattedValue1} ${period1Desc}. That's a ${Math.abs(percentageChange).toFixed(0)}% ${trendWord}! ${emoji}`;
    }

    return comparisonText;
} 