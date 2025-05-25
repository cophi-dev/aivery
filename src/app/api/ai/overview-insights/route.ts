import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';
import { startOfDay, endOfDay, parseISO, subWeeks, subMonths, differenceInDays, isFuture, isToday, format as formatDate } from 'date-fns';
import ActivityInsightModel, { IActivityInsight } from '@/lib/db/models/activityInsight';
import ExercisePRModel from '@/lib/db/models/exercisePR';

// Add global type declaration
declare global {
    var insightLocks: Set<string>;
    var lastRequestTimestamps: Map<string, number>;
}

// Initialize global locks and timestamps if not exists
if (!global.insightLocks) {
    global.insightLocks = new Set<string>();
}
if (!global.lastRequestTimestamps) {
    global.lastRequestTimestamps = new Map<string, number>();
}

// Update the existing type definition for PR records to include all possible fields
type WorkoutRecord = {
  type?: string;
  value?: number;
  exerciseName?: string;
  weight?: number;
  reps?: number;
  unit?: string;
  date?: Date;
  createdAt?: Date;
  // Add other potential fields
};

type PRRecord = {
  description: string;
  date: Date;
  workoutName: string;
};

// Helper function to get previous period dates
function getPreviousPeriodDates(startDate: Date, endDate: Date, periodType: 'daily' | 'weekly' | 'monthly'): [Date, Date] {
    switch (periodType) {
        case 'daily':
            return [subWeeks(startDate, 1), subWeeks(endDate, 1)];
        case 'weekly':
            return [subWeeks(startDate, 1), subWeeks(endDate, 1)];
        case 'monthly':
            return [subMonths(startDate, 1), endOfDay(subMonths(endDate, 1))];
        default:
            return [subWeeks(startDate, 1), subWeeks(endDate, 1)];
    }
}

// Define the expected response structure
type InsightResponse = {
    highlight: string;
    positiveTrends?: string[];
    negativeTrends?: string[];
    milestones?: string[];
};

// Helper function to fetch and summarize workout data for a period
async function getWorkoutSummaryForPeriod(userId: string, startDate: Date, endDate: Date): Promise<any> {
    // DEBUG: Log the exact dates being used for the query
    console.log('[overview-insights] Fetching workouts with date range:', {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    });

    // Create a wider date range to account for timezone differences
    // Use a full day buffer to ensure we catch all workouts
    const expandedStartDate = new Date(startDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before
    const expandedEndDate = new Date(endDate.getTime() + (24 * 60 * 60 * 1000)); // 24 hours after

    console.log('[overview-insights] Using expanded date range for MongoDB query:', {
        start: expandedStartDate.toISOString(),
        end: expandedEndDate.toISOString()
    });

    // Use the expanded date range for the query
    const workouts = await WorkoutModel.find({
        userId: new ObjectId(userId),
        date: { $gte: expandedStartDate, $lte: expandedEndDate }
    })
    .sort({ date: -1 }) 
    .lean<IWorkout[]>();

    // Also fetch exercise PRs for this period
    const exercisePRs = await ExercisePRModel.find({
        userId: new ObjectId(userId),
        date: { $gte: expandedStartDate, $lte: expandedEndDate }
    }).lean();

    // DEBUG: Log the found workouts and PRs
    console.log(`[overview-insights] Found ${workouts.length} workouts in expanded period`);
    console.log(`[overview-insights] Found ${exercisePRs.length} exercise PRs in expanded period`);
    if (workouts.length > 0) {
        console.log('[overview-insights] First workout date:', workouts[0].date);
        console.log('[overview-insights] All workout dates:', workouts.map(w => w.date));
    }
    
    // Post-filter workouts to make sure they fall within the actual requested day
    // Convert all dates to UTC midnight for comparison
    const startUtc = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endUtc = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
    
    console.log('[overview-insights] Using UTC comparison dates:', {
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString()
    });
    
    const filteredWorkouts = workouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        const workoutUtc = new Date(Date.UTC(workoutDate.getUTCFullYear(), workoutDate.getUTCMonth(), workoutDate.getUTCDate(), 
                                           workoutDate.getUTCHours(), workoutDate.getUTCMinutes(), workoutDate.getUTCSeconds()));
        return workoutUtc >= startUtc && workoutUtc <= endUtc;
    });

    // Filter PRs to the actual requested period
    const filteredPRs = exercisePRs.filter(pr => {
        const prDate = new Date(pr.date);
        const prUtc = new Date(Date.UTC(prDate.getUTCFullYear(), prDate.getUTCMonth(), prDate.getUTCDate(),
                                      prDate.getUTCHours(), prDate.getUTCMinutes(), prDate.getUTCSeconds()));
        return prUtc >= startUtc && prUtc <= endUtc;
    });
    
    console.log(`[overview-insights] After filtering: ${filteredWorkouts.length} workouts in actual period`);
    console.log(`[overview-insights] After filtering: ${filteredPRs.length} PRs in actual period`);
    if (filteredWorkouts.length > 0) {
        console.log('[overview-insights] First filtered workout date:', filteredWorkouts[0].date);
        console.log('[overview-insights] All filtered workout dates:', filteredWorkouts.map(w => w.date));
    }

    let totalWorkouts = filteredWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0; // in meters
    let totalVolume = 0;
    let workoutTypes = new Set<string>();
    const latestWorkoutDate: Date | null = filteredWorkouts.length > 0 ? filteredWorkouts[0].date : null;

    const workoutSummaries: { type: string, date: Date, durationSeconds?: number, distanceMeters?: number, volumeKg?: number }[] = [];
    const recentPRs: PRRecord[] = [];

    // Process workouts
    filteredWorkouts.forEach(w => {
        const durationSec = w.duration || 0;
        const volumeKg = w.calculatedVolume || 0;
        let distanceMeters = 0;

        totalDuration += durationSec;
        totalVolume += volumeKg;
        workoutTypes.add(w.type);

        if (w.cardioDetails?.distance) {
            distanceMeters = w.cardioDetails.distance * 1000; // km to meters
        } else if (typeof w.distance === 'number') {
            distanceMeters = (w.distance < 100 ? w.distance * 1000 : w.distance);
        }
        totalDistance += distanceMeters;

        workoutSummaries.push({
            type: w.type,
            date: w.date,
            durationSeconds: durationSec,
            distanceMeters: distanceMeters > 0 ? distanceMeters : undefined,
            volumeKg: volumeKg > 0 ? volumeKg: undefined
        });

        // Process workout records
        if (w.records && w.records.length > 0) {
            const typedRecords = w.records as WorkoutRecord[];
            typedRecords.forEach(record => {
                let prDescription = '';
                if (record.type === 'longestRun' && record.value) {
                    prDescription = `Longest Run: ${record.value.toFixed(2)} km`;
                } else if (record.type === 'fastest5kPace' && record.value) {
                    const paceMinutes = Math.floor(record.value / 60);
                    const paceSeconds = Math.round(record.value % 60);
                    prDescription = `Fastest 5K Pace: ${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`;
                } else if (record.type === 'maxStrengthVolume' && record.value) {
                    const tons = record.value / 1000;
                    prDescription = `Max Strength Volume: ${tons.toFixed(2)} tons`;
                }

                if (prDescription) {
                    recentPRs.push({
                        description: prDescription,
                        date: w.date,
                        workoutName: w.name || 'Workout'
                    });
                }
            });
        }
    });

    // Process exercise PRs
    filteredPRs.forEach(pr => {
        let prDescription = '';
        if (pr.unit === 'reps') {
            prDescription = `New PR in ${pr.exerciseName}: ${pr.value} reps`;
        } else if (pr.unit === 'kg') {
            prDescription = `New PR in ${pr.exerciseName}: ${pr.value}kg`;
        }

        if (prDescription) {
            recentPRs.push({
                description: prDescription,
                date: pr.date,
                workoutName: 'Strength Training' // Default name since we might not have the workout reference
            });
        }
    });

    return {
        count: totalWorkouts,
        totalDurationSeconds: totalDuration,
        totalDistanceMeters: totalDistance,
        totalVolumeKg: totalVolume,
        types: Array.from(workoutTypes),
        latestWorkoutDate: latestWorkoutDate,
        workouts: workoutSummaries,
        recentPRs: recentPRs
    };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        const userId = session.user.id;

        const url = new URL(request.url);
        const startDateStr = url.searchParams.get('start');
        const endDateStr = url.searchParams.get('end');
        const requestTimestamp = Date.now();

        if (!startDateStr || !endDateStr) {
            return NextResponse.json({ error: "Missing date parameters" }, { status: 400 });
        }

        // Store this request's timestamp
        const userDateKey = `${userId}-${startDateStr}`;
        global.lastRequestTimestamps.set(userDateKey, requestTimestamp);

        // DEBUG: Log the raw date strings
        console.log('[overview-insights] Raw date parameters:', { startDateStr, endDateStr, requestTimestamp });
        
        // Parse dates and ensure they're in UTC
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        // Set to start and end of the UTC day
        const utcStartDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
        const utcEndDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
        
        // DEBUG: Log the parsed date objects
        console.log('[overview-insights] Parsed UTC date objects:', { 
            startDate: utcStartDate.toISOString(),
            endDate: utcEndDate.toISOString(),
            originalStart: startDate.toISOString(),
            originalEnd: endDate.toISOString()
        });
        
        const daysDiff = differenceInDays(utcEndDate, utcStartDate);
        
        const periodType = daysDiff <= 1 ? 'daily' : daysDiff <= 7 ? 'weekly' : 'monthly';
        const isOngoingPeriod = isFuture(utcEndDate) || isToday(utcEndDate);

        const [prevStartDate, prevEndDate] = getPreviousPeriodDates(utcStartDate, utcEndDate, periodType);

        // Cache check
        const expandedStartDate = new Date(Date.UTC(
            utcStartDate.getUTCFullYear(),
            utcStartDate.getUTCMonth(),
            utcStartDate.getUTCDate() - 2, // 2 days before
            0, 0, 0, 0 // Start of day in UTC
        ));
        
        const expandedEndDate = new Date(Date.UTC(
            utcEndDate.getUTCFullYear(),
            utcEndDate.getUTCMonth(),
            utcEndDate.getUTCDate() + 2, // 2 days after
            23, 59, 59, 999 // End of day in UTC
        ));
        
        // Use expanded date range for cache check as well to be consistent
        const latestWorkoutInPeriod = await WorkoutModel.findOne({
            userId: new ObjectId(userId),
            date: { $gte: new Date(expandedStartDate), $lte: new Date(expandedEndDate) }
        }).sort({ date: -1 }).select('date').lean<{ date: Date } | null>();
        
        // DEBUG: Log if we found any workouts in the period
        console.log('[overview-insights] Latest workout in period:', latestWorkoutInPeriod);
        
        const actualLatestWorkoutTimestamp = latestWorkoutInPeriod ? latestWorkoutInPeriod.date : null;

        console.log('[overview-insights-TRACE] Attempting to find cached insight in DB.');
        const cachedInsight = await ActivityInsightModel.findOne({
            userId: new ObjectId(userId),
            periodType: periodType,
            periodStartDate: utcStartDate
        }).lean<IActivityInsight>();
        console.log('[overview-insights-TRACE] Finished attempting to find cached insight. Found:', cachedInsight ? `Insight for ${cachedInsight.periodStartDate}` : 'null');

        let isCacheValid = false;
        let shouldGenerateNewInsight = true;

        // Before returning any response, check if this request is still the most recent one
        const checkIfStillValid = () => {
            const lastTimestamp = global.lastRequestTimestamps.get(userDateKey);
            return lastTimestamp === requestTimestamp;
        };

        // If there's a valid cache, check if this request is still relevant
        if (cachedInsight) {
            if (!checkIfStillValid()) {
                console.log('[overview-insights] Dropping outdated request:', { startDateStr, requestTimestamp });
                return NextResponse.json({ error: "Superseded by newer request" }, { status: 409 });
            }
            
            const timestampValid = Boolean(
                (actualLatestWorkoutTimestamp === null && cachedInsight.lastWorkoutTimestamp === null) ||
                (actualLatestWorkoutTimestamp && cachedInsight.lastWorkoutTimestamp && 
                 actualLatestWorkoutTimestamp.getTime() === cachedInsight.lastWorkoutTimestamp.getTime())
            );
            
            isCacheValid = timestampValid;

            if (isOngoingPeriod) {
                const cacheAge = Date.now() - (cachedInsight.generatedAt?.getTime() || 0);
                const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
                
                if (cacheAge < CACHE_TTL) {
                    isCacheValid = true;
                    shouldGenerateNewInsight = false;
                }
            }

            // If cache was initially deemed valid, but its content is essentially empty, 
            // force a regeneration.
            if (isCacheValid && 
                (!cachedInsight.insightData || !cachedInsight.insightData.highlight)
            ) {
                console.log('[overview-insights] Cached insight data is present but lacks a highlight or is empty. Forcing regeneration.');
                isCacheValid = false;
                shouldGenerateNewInsight = true;
            }

            if (isCacheValid) {
                console.log('[overview-insights] Cache is valid and has content, returning cached insight data.');
                return NextResponse.json({
                    ...cachedInsight.insightData,
                    isFinal: true,
                    timestamp: requestTimestamp
                });
            }
        }

        // For loading states, also check if request is still valid
        if (!shouldGenerateNewInsight) {
            if (!checkIfStillValid()) {
                return NextResponse.json({ error: "Superseded by newer request" }, { status: 409 });
            }
            return NextResponse.json({
                highlight: "Refreshing your insights...",
                positiveTrends: ["Your latest activity data is being analyzed."],
                negativeTrends: [],
                milestones: [],
                timestamp: requestTimestamp
            });
        }

        const lockKey = `insight-generation-${userId}-${startDateStr}`;
        if (global.insightLocks.has(lockKey)) {
            if (!checkIfStillValid()) {
                return NextResponse.json({ error: "Superseded by newer request" }, { status: 409 });
            }
            return NextResponse.json({
                highlight: "Analyzing your latest activities...",
                positiveTrends: ["Your performance data is being processed."],
                negativeTrends: [],
                milestones: [],
                timestamp: requestTimestamp
            });
        }

        global.insightLocks.add(lockKey);

        try {
            console.log('[overview-insights-TRACE] Attempting to get workout summaries.');
            const [periodSummary, previousPeriodSummary] = await Promise.all([
                getWorkoutSummaryForPeriod(userId, utcStartDate, utcEndDate),
                getWorkoutSummaryForPeriod(userId, prevStartDate, prevEndDate)
            ]);
            console.log('[overview-insights-TRACE] Successfully fetched workout summaries.');
            // console.log('[overview-insights-TRACE] Current period summary:', JSON.stringify(periodSummary, null, 2).substring(0, 500) + '...');
            // console.log('[overview-insights-TRACE] Previous period summary:', JSON.stringify(previousPeriodSummary, null, 2).substring(0, 500) + '...');
            
            // Make these variables mutable so they can be modified by weekly view logic
            let currentPeriodSummary = periodSummary;
            const formattedStartDate = formatDate(utcStartDate, 'MMM d');
            let currentPeriodJSON = JSON.stringify(currentPeriodSummary, null, 2);

            console.log('[overview-insights-TRACE] Constructing system prompt for Grok.');
            let systemPrompt = `You're Aivery, ${session.user.nickname || session.user.name || 'there'}'s fitness buddy who's been tracking their journey. You know their patterns, celebrate their wins, and notice the small things that matter.

${session.user.nickname || session.user.name || 'They'}'re looking at their ${periodType} overview for ${formattedStartDate} - and you're here to help them see what really happened, not just the numbers.

${isOngoingPeriod ? 'This period is still happening - focus on what they\'ve accomplished so far and any patterns you\'re noticing.' : 'This period is done - time to reflect on the full picture and what it means for their journey.'}

BE THEIR FITNESS BUDDY:
- Talk like you know their story - reference specific workouts and patterns
- If they crushed a PR, get genuinely excited about it
- If they had quiet weeks or struggles, acknowledge that with understanding
- Notice the less obvious wins - consistency, effort, trying new things
- Point out patterns they might not see themselves
- Be real about both progress and challenges
- Use their name and make it feel personal

IMPORTANT PERSONAL RECORD FORMATTING INSTRUCTIONS:
If any Personal Records (PRs) were achieved:
- Use the exact phrase "new PR" or "Personal Record" in the text when referring to them
- Format them as "PR in [exercise]: [value] [unit]" or "New PR: [value] [unit] in [exercise]"
- Include specific numbers and units when mentioning PRs
- Look for "New PR in" text in the recentPRs section and ALWAYS highlight these as the user's greatest achievements
- Example proper formats: "New PR in Bench Press: 100 kg" or "5K pace PR: 5:30 min/km"
- FOR BODYWEIGHT EXERCISES: Especially mention PRs involving reps, such as "New PR in Pull-up: 14 reps"

Data for ${formattedStartDate}:
${currentPeriodJSON}

INSTRUCTIONS:

1. CONTEXT AWARENESS:
   - If today is a REST DAY (no workout yet):
     • Summarize what the user has already achieved this week
     • Reflect whether rest seems EARNED (high recent volume/intensity) or if activity is lagging
     • Only suggest movement if weekly effort is unusually low
   - If today has an ACTIVITY:
     • Describe it using precise metrics (duration, distance, volume)

2. Metric Precision:
   - Duration: Format as "2h 24m" for hours, "45m" for under an hour
   - Distance: Under 1km show in meters (e.g., "850m"), over 1km show with one decimal (e.g., "5.2km")
   - Volume: Show in tons with one decimal (e.g., "7.5t")
   - Use compact units (km, m, t) without spaces
   - Always specify the timeframe context (e.g., "so far", "in this period", "this week")

3. Analysis Focus:
   - Identify patterns in workout frequency and types
   - Note intensity distribution and recovery periods
   - Highlight achievements within the current period
   - Consider the balance of different workout types
   - Look for signs of progression or consistency

4. Output Structure (JSON):
   - highlight (string): Most significant observation about this period's activity
   - positiveTrends (string[]): 2-3 specific achievements or patterns from this period
   - negativeTrends (string[]): 0-1 constructive suggestions based on current patterns
     • Be specific and direct - avoid "if" statements in favor of clear observations
     • Base suggestions only on concrete data patterns visible in the workout history
     • If no clear issues are evident, identify a potential optimization area rather than inventing a problem
   - milestones (string[]): 1-2 specific achievements from this period

5. Tone and Language:
   - Be encouraging and motivating while maintaining accuracy
   - Focus on current achievements and potential
   - Keep insights actionable and forward-looking
   - Use clear, simple language
   - Round numbers for readability unless precision is crucial

Output Format: Respond ONLY with a valid JSON object matching the structure above. No extra text or markdown.`;
            console.log(`[overview-insights-TRACE] System prompt constructed. Length: ${systemPrompt.length}`);

            // --- End Prompt Build ---

            // console.log("[overview-insights-TRACE] Full System Prompt for Grok:", systemPrompt); // DEBUG - Potentially very long

            // --- Call Grok API ---
            console.log('[overview-insights-TRACE] Checking for GROK_API_KEY.');
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
            console.log('[overview-insights-TRACE] GROK_API_KEY found. Preparing to call Grok API.');

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${grokApiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-3-mini',
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
            console.log(`[overview-insights-TRACE] Grok API response received. Status: ${response.status}, OK: ${response.ok}`);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[/api/ai/overview-insights] Grok API error: ${response.status} ${response.statusText}`, errorBody);
                throw new Error(`Grok API request failed with status ${response.status}`); // Let the outer catch handle it
            }

            console.log('[overview-insights-TRACE] Attempting to parse Grok API response JSON.');
            const data = await response.json();
            console.log('[overview-insights-TRACE] Grok API response JSON parsed successfully.');
            // console.log("[/api/ai/overview-insights] Grok Raw Response:", data); // DEBUG

            // TODO: Add token usage tracking if necessary
            // await updateTokenUsage(userId, data.usage);

            let insightJsonString = "";
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                insightJsonString = data.choices[0].message.content.trim();
                
                // Try to fix common JSON formatting issues
                if (!insightJsonString.endsWith('}')) {
                    console.warn("[/api/ai/overview-insights] Malformed JSON detected, attempting to fix...");
                    // If we have an opening brace but no closing brace, add one
                    if (insightJsonString.includes('{') && !insightJsonString.endsWith('}')) {
                        insightJsonString += '"}]}';
                    }
                }
                
                // Validate JSON structure before parsing
                try {
                    // First, check if it's valid JSON
                    const parsed = JSON.parse(insightJsonString);
                    
                    // Then validate required fields
                    if (!parsed.highlight || typeof parsed.highlight !== 'string') {
                        throw new Error('Missing or invalid highlight field');
                    }
                    
                    // Ensure arrays are properly formatted
                    parsed.positiveTrends = Array.isArray(parsed.positiveTrends) ? parsed.positiveTrends : [];
                    parsed.negativeTrends = Array.isArray(parsed.negativeTrends) ? parsed.negativeTrends : [];
                    parsed.milestones = Array.isArray(parsed.milestones) ? parsed.milestones : [];
                    
                    // Re-stringify with proper formatting
                    insightJsonString = JSON.stringify(parsed);
                } catch (validationError) {
                    console.error("[/api/ai/overview-insights] JSON validation failed:", validationError);
                    console.error("[/api/ai/overview-insights] Problematic JSON:", insightJsonString);
                    
                    // Return a graceful fallback response
                    return NextResponse.json({
                        highlight: "Your fitness journey continues - keep up the great work!",
                        positiveTrends: ["We're having trouble analyzing your trends right now, but your consistency is showing."],
                        negativeTrends: [],
                        milestones: []
                    } as InsightResponse);
                }
            } else {
                console.error("[/api/ai/overview-insights] Grok response content is empty or not as expected", data);
                throw new Error("AI returned an unexpected response structure.");
            }

            try {
                console.log('[overview-insights-TRACE] Attempting to parse final insight JSON string.');
                const parsedInsights: InsightResponse = JSON.parse(insightJsonString);
                console.log('[overview-insights-TRACE] Final insight JSON string parsed successfully.');

                // Store the newly generated insight
                console.log('[overview-insights-TRACE] Attempting to store insight in DB.');
                await ActivityInsightModel.findOneAndUpdate(
                    {
                        userId: new ObjectId(userId),
                        periodType: periodType,
                        periodStartDate: utcStartDate
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
                console.log('[overview-insights-TRACE] Insight stored in DB successfully.');

                // Before returning the final insights, check one last time if this request is still valid
                if (!checkIfStillValid()) {
                    console.log('[overview-insights] Dropping outdated insight generation:', { startDateStr, requestTimestamp });
                    return NextResponse.json({ error: "Superseded by newer request" }, { status: 409 });
                }

                // Add timestamp to the response
                const finalResponse = {
                    ...parsedInsights,
                    timestamp: requestTimestamp,
                    // Add additional metadata to help client determine if this is final
                    isFinal: true,
                    generatedAt: new Date().toISOString()
                };
                console.log('[overview-insights-TRACE] Returning final response to client.');
                return NextResponse.json(finalResponse);
            } catch (parseError) {
                console.error("[/api/ai/overview-insights] Failed to parse JSON response from Grok:", parseError);
                console.error("[/api/ai/overview-insights] Raw response string:", insightJsonString);
                
                // Return a proper error response with timestamp
                 return NextResponse.json({
                     highlight: "Successfully fetched data, but had trouble generating AI insights.",
                     positiveTrends: [],
                     negativeTrends: [],
                    milestones: [],
                    timestamp: requestTimestamp,
                    error: {
                        message: "Failed to parse AI response",
                        type: "PARSE_ERROR"
                    }
                } as InsightResponse);
            }

        } catch (error) {
            console.error("[overview-insights-TRACE] Error in insight generation try block:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            const requestTimestamp = Date.now(); // Add timestamp for error responses
            return NextResponse.json({
                highlight: "Couldn't generate insights due to an error.",
                positiveTrends: [`Error details: ${errorMessage}`],
                negativeTrends: [],
                milestones: []
            } as InsightResponse, { status: 500 });
        } finally {
            console.log(`[overview-insights-TRACE] Releasing lock: ${lockKey}`);
            global.insightLocks.delete(lockKey);
        }

    } catch (error) {
        console.error("[overview-insights-TRACE] Error in main GET handler try block:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        const requestTimestamp = Date.now(); // Add timestamp for error responses
        return NextResponse.json({
            highlight: "Couldn't process your request.",
            positiveTrends: [`Error details: ${errorMessage}`],
            negativeTrends: [],
            milestones: [],
            timestamp: requestTimestamp
        } as InsightResponse, { status: 500 });
    }
} 