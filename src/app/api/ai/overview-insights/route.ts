import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
// Consider importing User model if needed for personalization
// import UserModel from '@/lib/db/models/user';
import { ObjectId } from 'mongodb';
import { startOfDay, endOfDay, parseISO, subWeeks, subMonths, differenceInDays, isFuture, isToday, format as formatDate } from 'date-fns';
import ActivityInsightModel, { IActivityInsight } from '@/lib/db/models/activityInsight'; // Import the new model

// Define the expected response structure (mirroring AiveryInsights component)
type InsightResponse = {
    highlight: string;
    positiveTrends?: string[];
    negativeTrends?: string[];
    milestones?: string[];
};

// Helper function to fetch and summarize workout data for a period
async function getWorkoutSummaryForPeriod(userId: string, startDate: Date, endDate: Date): Promise<any> { // TODO: Define a stricter type for summary
    const workouts = await WorkoutModel.find({
        userId: new ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
    })
    .sort({ date: -1 }) 
    // Removed .select() to get all fields needed for workout details
    .lean<IWorkout[]>();

    let totalWorkouts = workouts.length;
    let totalDuration = 0;
    let totalDistance = 0; // in meters
    let totalVolume = 0;
    let workoutTypes = new Set<string>();
    const latestWorkoutDate: Date | null = workouts.length > 0 ? workouts[0].date : null;

    // NEW: Create array for workout summaries
    const workoutSummaries: { type: string, date: Date, durationSeconds?: number, distanceMeters?: number, volumeKg?: number }[] = [];

    workouts.forEach(w => {
        const durationSec = w.duration || 0;
        const volumeKg = w.calculatedVolume || 0;
        let distanceMeters = 0;

        totalDuration += durationSec;
        totalVolume += volumeKg;
        workoutTypes.add(w.type);

        // Aggregate distance (prefer cardioDetails, fallback to distance)
        if (w.cardioDetails?.distance) {
            distanceMeters = w.cardioDetails.distance * 1000; // km to meters
        } else if (typeof w.distance === 'number') {
             // If distance is small (< 100), assume it's in km and convert to meters
            distanceMeters = (w.distance < 100 ? w.distance * 1000 : w.distance);
        }
        totalDistance += distanceMeters;

        // Add individual workout summary for the prompt
        workoutSummaries.push({
            type: w.type,
            date: w.date,
            durationSeconds: durationSec,
            distanceMeters: distanceMeters > 0 ? distanceMeters : undefined, // Only include if > 0
            volumeKg: volumeKg > 0 ? volumeKg: undefined // Only include if > 0
        });
    });

    return {
        count: totalWorkouts,
        totalDurationSeconds: totalDuration,
        totalDistanceMeters: totalDistance,
        totalVolumeKg: totalVolume,
        types: Array.from(workoutTypes),
        latestWorkoutDate: latestWorkoutDate,
        // Include the summarized workouts array
        workouts: workoutSummaries 
    };
}


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;
        const userName = session.user.nickname || session.user.name || "there"; // For prompt personalization

        const { searchParams } = new URL(req.url);
        const startDateStr = searchParams.get('start');
        const endDateStr = searchParams.get('end');
        // const periodType = 'weekly'; // REMOVE Hardcoding

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ error: "Missing required query parameters: start, end" }, { status: 400 });
        }

        let startDate: Date;
        let endDate: Date;
        try {
            startDate = startOfDay(parseISO(startDateStr));
            endDate = endOfDay(parseISO(endDateStr));
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error("Invalid date format");
            }
        } catch (error) {
            return NextResponse.json({ error: "Invalid date format. Please use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)." }, { status: 400 });
        }

        // --- Determine Period Type and Previous Period Dates ---
        const daysInPeriod = differenceInDays(endDate, startDate) + 1;
        let periodType: 'weekly' | 'monthly' | 'custom' = 'custom'; // Default to custom
        let prevStartDate: Date;
        let prevEndDate: Date;

        if (daysInPeriod >= 6 && daysInPeriod <= 8) { // Allow 6-8 days for weekly
            periodType = 'weekly';
            prevStartDate = subWeeks(startDate, 1);
            prevEndDate = subWeeks(endDate, 1);
        } else if (daysInPeriod >= 28 && daysInPeriod <= 31) { // Allow 28-31 days for monthly
            periodType = 'monthly';
            prevStartDate = subMonths(startDate, 1);
            prevEndDate = endOfDay(subMonths(endDate, 1)); // Ensure previous month end is end of day
        } else {
            // For custom ranges, maybe compare to the immediately preceding period of the same length?
            // Or disable comparison? For now, let's fetch previous week as a default fallback.
             console.warn(`[/api/ai/overview-insights] Custom date range detected (${daysInPeriod} days). Falling back to previous week comparison.`);
            prevStartDate = subWeeks(startDate, 1);
            prevEndDate = subWeeks(endDate, 1);
        }
        // --- End Period Determination ---

        // --- Check if the current period is ongoing --- (No change needed)
        const isOngoingPeriod = isToday(endDate) || isFuture(endDate);

        await dbConnect();

        // --- Caching Logic --- 
        // 1. Get the timestamp of the actual latest workout in the *current* period
        const latestWorkoutInPeriod = await WorkoutModel.findOne({
            userId: new ObjectId(userId),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 }).select('date').lean<{ date: Date } | null>();
        const actualLatestWorkoutTimestamp = latestWorkoutInPeriod ? latestWorkoutInPeriod.date : null;

        // 2. Check for a cached insight using the *determined* periodType
        const cachedInsight = await ActivityInsightModel.findOne({
            userId: new ObjectId(userId),
            periodType: periodType, // Use determined periodType
            periodStartDate: startDate
        }).lean<IActivityInsight>();

        // 3. Validate cache
        if (cachedInsight) {
            const isCacheValid = 
                // If no workout exists now, cache is valid only if it also had no workout
                (actualLatestWorkoutTimestamp === null && cachedInsight.lastWorkoutTimestamp === null) ||
                // If a workout exists now, cache is valid only if its timestamp matches the actual latest
                (actualLatestWorkoutTimestamp && cachedInsight.lastWorkoutTimestamp && 
                 actualLatestWorkoutTimestamp.getTime() === cachedInsight.lastWorkoutTimestamp.getTime());

            if (isCacheValid) {
                console.log(`[/api/ai/overview-insights] Returning cached insight for ${userId} / ${periodType} / ${startDateStr}`);
                return NextResponse.json(cachedInsight.insightData);
            } else {
                console.log(`[/api/ai/overview-insights] Cache invalidated for ${userId} / ${periodType} / ${startDateStr}. Actual latest: ${actualLatestWorkoutTimestamp}, Cached latest: ${cachedInsight.lastWorkoutTimestamp}`);
            }
        }
        // --- End Caching Logic ---

        // --- Generate Insight (if cache missed or invalidated) ---
        console.log(`[/api/ai/overview-insights] Generating new ${periodType} insight for ${userId} / ${startDateStr}`);

        // Fetch data for current and *correct* previous periods
        const [currentPeriodSummary, previousPeriodSummary] = await Promise.all([
            getWorkoutSummaryForPeriod(userId, startDate, endDate),
            getWorkoutSummaryForPeriod(userId, prevStartDate, prevEndDate) // Uses correctly calculated prev dates
        ]);

        // --- Build the Dynamically Adapted System Prompt ---
        const formattedStartDate = formatDate(startDate, 'MMM d');
        const formattedEndDate = formatDate(endDate, 'MMM d, yyyy'); // Add year for clarity
        const formattedPrevStartDate = formatDate(prevStartDate, 'MMM d');
        const formattedPrevEndDate = formatDate(prevEndDate, 'MMM d, yyyy');

        const currentPeriodJSON = JSON.stringify(currentPeriodSummary, null, 2);
        const previousPeriodJSON = JSON.stringify(previousPeriodSummary, null, 2);

        let systemPrompt = `\
You are Aivery, a motivating and insightful AI fitness coach integrated into a fitness tracking app.

The user, ${userName}, is viewing their ${periodType} activity overview (${formattedStartDate} - ${formattedEndDate}) to understand their progress and receive guidance.

The previous ${periodType} period was: ${formattedPrevStartDate} - ${formattedPrevEndDate}.\n`;

        if (isOngoingPeriod) {
            systemPrompt += `\nThe current period is ONGOING.\n\n`;
        } else {
            systemPrompt += `\nThe period being viewed is COMPLETE.\n\n`;
        }

        systemPrompt += `Your goal is to analyze the user's performance for the specified period, compare it to the previous period, and provide SPECIFIC, actionable, and personalized insights.

Data for the Current Period (${formattedStartDate} - ${formattedEndDate}):
${currentPeriodJSON}

Data for the Previous Period (${formattedPrevStartDate} - ${formattedPrevEndDate}):
${previousPeriodJSON}

INSTRUCTIONS:
`;

        // --- Add Period-Specific Instructions --- 
        if (periodType === 'monthly') {
            systemPrompt += `Monthly Analysis Focus:
1. Compare overall monthly totals (workouts, duration, distance, volume in tons) to the previous month. Calculate percentage changes.
2. Analyze trends ACROSS THE WEEKS within the *current* month using the 'workouts' array (e.g., identify peak activity weeks, consistency patterns, weeks with higher/lower volume or distance).
3. Highlight significant monthly achievements (e.g., highest weekly volume/distance achieved this month, beating last month's total).
4. Provide a summary focused on monthly consistency and progress. Offer forward-looking advice for the *next* month.
`;
        } else { // Weekly or Custom (using weekly logic as fallback)
            systemPrompt += `Weekly Analysis Focus:
1. Compare key metrics (workouts, duration, distance, volume in tons) to the previous week. Calculate percentage changes.
2. Identify notable achievements within the current week (e.g., longest run, highest volume session) using the 'workouts' array.
3. If the week is ONGOING, compare progress so far to the previous week's *total* and suggest how to finish strong.
4. If the week is COMPLETE, summarize performance and suggest focus areas for the *next* week.
`;
        }
        // --- End Period-Specific Instructions ---

        systemPrompt += `
General Instructions (Apply to All Periods):
Analyze Trends with Precision: Convert duration to MM:SS, distance to km (1 decimal), volume to tons (1-2 decimals). Reference specific workout types.
Identify Milestones/Highlights: Look for longest distance, highest volume, fastest pace (if possible) within the *current* period's workouts array.
Generate Insights (Context-Driven): Adapt tone and advice based on whether the period is ongoing or complete.
Formulate Output (JSON Structure):
- highlight (string): Concise, engaging summary sentence (most significant observation).
- positiveTrends (string[]): 1-3 bullet points on improvements or consistency (use specific numbers).
- negativeTrends (string[]): 0-2 bullet points on areas to watch, phrased constructively with advice.
- milestones (string[]): 0-2 bullet points listing specific achievements.
Consider User Context: Comment on recency using latestWorkoutDate. Reference specific workouts if data is rich. Balance motivation with realistic advice.
Output Format: Respond ONLY with a valid JSON object matching the structure above. No extra text or markdown.
Tone: Friendly, encouraging, data-driven, actionable, concise.
`;
        // --- End Prompt Build ---

        // console.log("System Prompt for Grok:", systemPrompt); // DEBUG

        // --- Call Grok API ---
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.error("[/api/ai/overview-insights] GROK_API_KEY not configured.");
            // Return a generic insight instead of erroring out completely?
            return NextResponse.json({
                 highlight: "Keep up the great work on your fitness journey!",
                 positiveTrends: [],
                 negativeTrends: [],
                 milestones: []
            } as InsightResponse, { status: 200 }); // Or return 503 Service Unavailable
        }

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`
            },
            body: JSON.stringify({
                model: 'grok-3-mini-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: "Generate the overview insights based on the data provided in the system prompt, adhering strictly to the requested JSON format." }
                ],
                max_tokens: 2048,
                temperature: 0.5,
                stream: false,
                // response_format: { type: "json_object" }, // UNCOMMENT if Grok supports JSON mode
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[/api/ai/overview-insights] Grok API error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Grok API request failed with status ${response.status}`); // Let the outer catch handle it
        }

        const data = await response.json();
        // console.log("[/api/ai/overview-insights] Grok Raw Response:", data); // DEBUG

        // TODO: Add token usage tracking if necessary
        // await updateTokenUsage(userId, data.usage);

        let insightJsonString = "";
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            insightJsonString = data.choices[0].message.content.trim();
        } else {
            console.error("[/api/ai/overview-insights] Grok response content is empty or not as expected", data);
            throw new Error("AI returned an unexpected response structure.");
        }

        // JSON should be returned directly now, no need to extract from markdown
        // const jsonMatch = insightJsonString.match(/\`\`\`(?:json)?\n([\s\S]*?)\n\`\`\`/);
        // if (jsonMatch && jsonMatch[1]) {
        //     insightJsonString = jsonMatch[1];
        // }

        try {
            const parsedInsights: InsightResponse = JSON.parse(insightJsonString);
            // TODO: Add schema validation (e.g., using Zod) if needed

            // --- Store the newly generated insight using determined periodType ---
            await ActivityInsightModel.findOneAndUpdate(
                {
                    userId: new ObjectId(userId),
                    periodType: periodType, // Use determined periodType
                    periodStartDate: startDate
                },
                {
                    $set: {
                        insightData: parsedInsights,
                        lastWorkoutTimestamp: actualLatestWorkoutTimestamp, 
                        generatedAt: new Date(), 
                    }
                },
                { upsert: true, new: true } 
            );
            console.log(`[/api/ai/overview-insights] Stored new ${periodType} insight for ${userId} / ${startDateStr}`);
            // --- End Store Insight --- 

            return NextResponse.json(parsedInsights);
        } catch (parseError) {
            console.error("[/api/ai/overview-insights] Failed to parse JSON response from Grok:", parseError);
            console.error("[/api/ai/overview-insights] Raw response string:", insightJsonString);
            // Fallback or re-throw? For now, return a generic insight.
             return NextResponse.json({
                 highlight: "Successfully fetched data, but had trouble generating AI insights.",
                 positiveTrends: [],
                 negativeTrends: [],
                 milestones: []
            } as InsightResponse);
        }

    } catch (error) {
        console.error("Error in /api/ai/overview-insights:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        // Return a generic insight on error
        return NextResponse.json({
             highlight: "Couldn't generate insights due to an internal error.",
             positiveTrends: [`Error details: ${errorMessage}`], // Include error details for debugging (optional)
             negativeTrends: [],
             milestones: []
        } as InsightResponse, { status: 500 });
    }
} 