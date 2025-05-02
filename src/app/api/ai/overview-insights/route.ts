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

        // --- Build the NEW System Prompt ---
        const formattedStartDate = formatDate(startDate, 'MMM d');
        const formattedEndDate = formatDate(endDate, 'MMM d');
        const formattedPrevStartDate = formatDate(prevStartDate, 'MMM d');
        const formattedPrevEndDate = formatDate(prevEndDate, 'MMM d');

        const currentPeriodJSON = JSON.stringify(currentPeriodSummary, null, 2);
        const previousPeriodJSON = JSON.stringify(previousPeriodSummary, null, 2);

        let systemPrompt = `\
You are Aivery, a motivating and insightful AI fitness coach integrated into a fitness tracking app.

The user, ${userName}, is viewing their activity overview to understand their progress and receive guidance.

`;

        if (isOngoingPeriod) {
            systemPrompt += `The current period being viewed is ONGOING: ${formattedStartDate} - ${formattedEndDate}. The previous period was: ${formattedPrevStartDate} - ${formattedPrevEndDate}.\n\n`;
        } else {
            systemPrompt += `The period being viewed is COMPLETE: ${formattedStartDate} - ${formattedEndDate}. The previous period was: ${formattedPrevStartDate} - ${formattedPrevEndDate}.\n\n`;
        }

        systemPrompt += `Your goal is to analyze the user's performance, compare it to the previous period, and provide SPECIFIC, actionable, and personalized insights to help them improve or maintain their fitness routine.

Data for the Current Period (${formattedStartDate} - ${formattedEndDate}):
${currentPeriodJSON}

Data for the Previous Period (${formattedPrevStartDate} - ${formattedPrevEndDate}):
${previousPeriodJSON}

INSTRUCTIONS:
Analyze Trends with Precision:
Compare key metrics between the current and previous periods: workout count, total duration (convert seconds to MM:SS format), total distance (convert meters to km, round to 1 decimal), and total volume (convert kg to tons, round to 1 decimal).
Calculate percentage changes for each metric where meaningful (e.g., "Distance dropped by 1.2 km (-15%)").
Reference specific workout types (e.g., running, strength) from the types field and workouts array.
If the period is ONGOING, contextualize comparisons (e.g., "So far, your distance is 5.0 km, down 43% from last week's total of 8.8 km").
Identify Milestones/Highlights:
Analyze the workouts array in the current period to identify notable achievements, such as:
Longest single-workout distance (e.g., "Longest run of 5.0 km on May 1").
Highest single-workout volume (e.g., "Highest strength volume of 1.2 t on Apr 30").
Fastest pace for a specific distance, if calculable (e.g., pace = durationSeconds / distanceMeters, converted to min/km).
Only include milestones that are significant and directly tied to the data.
Generate Insights (Context-Driven):
If the period is COMPLETE: Summarize overall performance, compare directly to the previous period, and highlight what worked well or needs improvement.
If the period is ONGOING: Focus on trends so far, compare to the previous period's total, and provide forward-looking suggestions for the remaining days (e.g., "Add a 3–5 km run this weekend to surpass last week's 8.8 km").
Formulate:
highlight (string): A concise, engaging sentence summarizing the most significant observation. Tailor to the period's status (e.g., ONGOING: "You're off to a strong start with 3 workouts—let's add a run to beat last week's distance!").
positiveTrends (string[]): 1–3 bullet points on positive changes or consistent performance. Include specific numbers and workout types (e.g., "Your strength volume rose to 3.1 t, up 41% from last week's 2.2 t").
negativeTrends (string[]): 0–2 bullet points on areas to improve. Phrase constructively with actionable advice (e.g., ONGOING: "Distance is at 5.0 km, down 43% from 8.8 km—plan a 4–6 km run this weekend").
milestones (string[]): 0–2 bullet points listing notable achievements from step 2 (e.g., "Achieved your longest run of 5.0 km on May 1").
Consider User Context:
Use the latestWorkoutDate to comment on recency (e.g., "Your latest workout on May 1 shows you're staying active").
If specific workout data is available in the workouts array, reference it for personalization (e.g., "Your Night Run on May 1 added 5.0 km—great effort!").
Balance encouragement with realistic suggestions based on the user's current activity level.
Output Format:
Respond ONLY with a valid JSON object containing the keys highlight (string), positiveTrends (array of strings), negativeTrends (array of strings), and milestones (array of strings).
Do not include markdown formatting or extra text outside the JSON structure.
Tone and Style:
Be friendly, encouraging, and motivational (e.g., "Great work staying balanced!").
Avoid generic statements—always tie insights to specific data.
Keep each bullet point concise (1 sentence) and actionable.
Use a supportive tone for negative trends (e.g., "Let's boost your distance with a longer run this weekend!").
`;
        // --- End NEW System Prompt ---

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