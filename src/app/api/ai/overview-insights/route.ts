import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
// Consider importing User model if needed for personalization
// import UserModel from '@/lib/db/models/user';
import { ObjectId } from 'mongodb';
import { startOfDay, endOfDay, parseISO, subWeeks, differenceInDays, isFuture, isToday, format as formatDate } from 'date-fns';
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
    .sort({ date: -1 }) // Sort by date descending to easily find the latest
    .lean<IWorkout[]>();

    let totalWorkouts = workouts.length;
    let totalDuration = 0;
    let totalDistance = 0; // in meters
    let totalVolume = 0;
    let workoutTypes = new Set<string>();
    const latestWorkoutDate: Date | null = workouts.length > 0 ? workouts[0].date : null;

    workouts.forEach(w => {
        totalDuration += w.duration || 0;
        totalVolume += w.calculatedVolume || 0;
        workoutTypes.add(w.type);

        // Aggregate distance (prefer cardioDetails, fallback to distance)
        if (w.cardioDetails?.distance) {
            totalDistance += (w.cardioDetails.distance * 1000); // km to meters
        } else if (typeof w.distance === 'number') {
             // If distance is small (< 100), assume it's in km and convert to meters
            totalDistance += (w.distance < 100 ? w.distance * 1000 : w.distance);
        }
    });

    return {
        count: totalWorkouts,
        totalDurationSeconds: totalDuration,
        totalDistanceMeters: totalDistance,
        totalVolumeKg: totalVolume,
        types: Array.from(workoutTypes),
        // Return the date of the latest workout in this period, or null
        latestWorkoutDate: latestWorkoutDate,
        // DO NOT include raw workouts by default to keep prompt small
        // workouts: workouts 
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
        const periodType = 'weekly'; // Hardcode for now, could be a param later

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

        // Calculate previous period dates (assuming weekly for now, like the component)
        // const daysInPeriod = differenceInDays(endDate, startDate) + 1;
        const prevStartDate = subWeeks(startDate, 1);
        const prevEndDate = subWeeks(endDate, 1);

        // --- NEW: Check if the current period is ongoing ---
        const isOngoingPeriod = isToday(endDate) || isFuture(endDate);
        // --- END NEW ---

        await dbConnect();

        // --- Caching Logic --- 
        // 1. Get the timestamp of the actual latest workout in the *current* period
        const latestWorkoutInPeriod = await WorkoutModel.findOne({
            userId: new ObjectId(userId),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 }).select('date').lean<{ date: Date } | null>();
        const actualLatestWorkoutTimestamp = latestWorkoutInPeriod ? latestWorkoutInPeriod.date : null;

        // 2. Check for a cached insight for this user/periodType/startDate
        const cachedInsight = await ActivityInsightModel.findOne({
            userId: new ObjectId(userId),
            periodType: periodType,
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
        console.log(`[/api/ai/overview-insights] Generating new insight for ${userId} / ${periodType} / ${startDateStr}`);

        // Fetch data for current and previous periods
        // The summary objects will now NOT contain the full workout list
        const [currentPeriodSummary, previousPeriodSummary] = await Promise.all([
            getWorkoutSummaryForPeriod(userId, startDate, endDate),
            getWorkoutSummaryForPeriod(userId, prevStartDate, prevEndDate)
        ]);

        // Build the system prompt dynamically based on whether the period is ongoing
        let systemPrompt = `\
You are Aivery, a motivating and insightful AI fitness coach integrated into a fitness tracking app.
The user, ${userName}, is viewing their activity overview.

`;

        if (isOngoingPeriod) {
            systemPrompt += `The current period being viewed is ONGOING: ${formatDate(startDate, 'MMM d')} - ${formatDate(endDate, 'MMM d')}. The previous period was: ${formatDate(prevStartDate, 'MMM d')} - ${formatDate(prevEndDate, 'MMM d')}.\n\n`;
        } else {
            systemPrompt += `The period being viewed is COMPLETE: ${formatDate(startDate, 'MMM d')} - ${formatDate(endDate, 'MMM d')}. The previous period was: ${formatDate(prevStartDate, 'MMM d')} - ${formatDate(prevEndDate, 'MMM d')}.\n\n`;
        }

        systemPrompt += `Your goal is to analyze their performance, compare it to the previous period, and provide SPECIFIC, actionable insights.\n\nData for the Current Period (${formatDate(startDate, 'MMM d')} - ${formatDate(endDate, 'MMM d')}):
${JSON.stringify(currentPeriodSummary, null, 2)}

Data for the Previous Period (${formatDate(prevStartDate, 'MMM d')} - ${formatDate(prevEndDate, 'MMM d')}):
${JSON.stringify(previousPeriodSummary, null, 2)}

INSTRUCTIONS:
1.  **Analyze Trends SPECIFICALLY:** Compare key metrics (workout count, total duration [seconds], total distance [meters], total volume [kg]) between the current and previous periods. Calculate percentage changes where meaningful. Mention specific workout types (e.g., running, strength) if data is available. Be precise (e.g., \"Running distance increased by 1.5km (20%)\").
2.  **Identify Milestones/Highlights:** Look for potential personal records or significant achievements within the current period's workouts (e.g., longest run distance, highest single-workout volume, fastest pace for a specific distance). Mention the specific achievement.
3.  **Generate Insights (Context Matters!):**
    *   **If the period is COMPLETE:** Focus on summarizing the past performance, comparing directly to the previous period.
    *   **If the period is ONGOING:** Focus on trends observed *so far*, compare to the previous period's *total*, and offer forward-looking encouragement or suggestions for the *rest* of the period. Frame comparisons appropriately (e.g., \"You're currently on track to exceed last week's distance\").
    *   Formulate:
        *   highlight (string): A single, engaging sentence summarizing the most important observation. Make it specific and context-aware (past vs. ongoing).
        *   positiveTrends (string[]): 1-3 bullet points highlighting positive changes or consistent good performance, with specific numbers or types.
        *   negativeTrends (string[]): 0-2 bullet points highlighting areas for attention. Phrase constructively and specifically. For ongoing periods, suggest adjustments for the remaining days.
        *   milestones (string[]): 0-2 bullet points listing notable achievements identified.
4.  **Output Format:** Respond ONLY with a valid JSON object containing the keys 'highlight' (string), 'positiveTrends' (array of strings), 'negativeTrends' (array of strings), and 'milestones' (array of strings). Do not include markdown formatting.
5.  **Tone:** Be friendly, encouraging, specific, and insightful. Avoid generic statements. Keep insights concise.
        `;

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
                model: 'grok-3-mini-latest', // Or grok-1? Check docs for best model for structured JSON
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: "Generate the overview insights based on the data provided in the system prompt, adhering strictly to the requested JSON format." }
                ],
                max_tokens: 2048, // Increased from 1024
                temperature: 0.5, // Adjust for desired creativity vs consistency
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

            // --- Store the newly generated insight --- 
            await ActivityInsightModel.findOneAndUpdate(
                {
                    userId: new ObjectId(userId),
                    periodType: periodType,
                    periodStartDate: startDate
                },
                {
                    $set: {
                        insightData: parsedInsights,
                        lastWorkoutTimestamp: actualLatestWorkoutTimestamp, // Store the timestamp of the latest workout used
                        generatedAt: new Date(), // Update generation time
                    }
                },
                { upsert: true, new: true } // Create if not found, update if found
            );
            console.log(`[/api/ai/overview-insights] Stored new insight for ${userId} / ${periodType} / ${startDateStr}`);
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