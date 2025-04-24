import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import User, { IUser } from "@/lib/db/models/user"; // Import IUser
import dbConnect from "@/lib/db/mongodb"; // If needed for user lookup
import { getWorkoutDistanceForDateRange } from "@/lib/db/repositories/workoutRepository"; // Re-import repository function
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears,
  parse,
  startOfDay // Import startOfDay
} from "date-fns"; // Import date-fns functions
import { getServerSession } from "next-auth"; // RE-ADD import
import mongoose from 'mongoose'; // Import mongoose

// Force dynamic rendering and prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Allow responses up to 30 seconds
export const maxDuration = 30;

// Define the daily token limit
const DAILY_GROK_TOKEN_LIMIT = 500000;

// Helper function to safely extract text from Claude response content
function getTextFromResponse(content: any): string | undefined {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }
  const firstBlock = content[0];
  if (firstBlock && typeof firstBlock === "object" && "text" in firstBlock) {
    return firstBlock.text as string;
  }
  return undefined;
}

// Helper function to parse timeframe strings
function getDateRangeFromTimeframe(
  timeframe: string
): { start: Date; end: Date } | null {
  const now = new Date();
  timeframe = timeframe.toLowerCase().trim();
  const currentYear = now.getFullYear();

  if (timeframe.includes("this week")) {
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  if (timeframe.includes("last week")) {
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    return { start: lastWeekStart, end: endOfWeek(lastWeekStart, { weekStartsOn: 1 }) };
  }
  if (timeframe.includes("this month")) {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
   if (timeframe.includes("last month")) {
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    return { start: lastMonthStart, end: endOfMonth(lastMonthStart) };
  }
  // Specific months (e.g., "march", "march 2024")
  const monthMatch = timeframe.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:[a-z]*)?(?: (\d{4}))?/
  );
  if (monthMatch) {
    const monthIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec",
    ].findIndex((m) => monthMatch[1].startsWith(m));
    if (monthIndex !== -1) {
      const year = monthMatch[2] ? parseInt(monthMatch[2], 10) : currentYear;
      const monthStart = new Date(year, monthIndex, 1);
      return { start: monthStart, end: endOfMonth(monthStart) };
    }
  }
  if (timeframe.includes("this year")) {
    return { start: startOfYear(now), end: endOfYear(now) };
  }
   if (timeframe.includes("last year")) {
    const lastYearStart = startOfYear(subYears(now, 1));
    return { start: lastYearStart, end: endOfYear(lastYearStart) };
  }
  // Specific year (e.g., "2024", "in 2023")
  const yearMatch = timeframe.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const yearStart = new Date(year, 0, 1);
    return { start: yearStart, end: endOfYear(yearStart) };
  }

  return null; // Cannot determine date range
}

// Helper function to extract workout type
function getWorkoutTypeFromQuery(query: string): string | null {
    query = query.toLowerCase();
    if (query.includes('run') || query.includes('running')) return 'running';
    if (query.includes('cycle') || query.includes('cycling') || query.includes('bike')) return 'cycling';
    if (query.includes('swim') || query.includes('swimming')) return 'swimming';
    // Add other types if needed
    return null;
  }


// --- Main POST handler ---
export async function POST(req: Request) {
  let session;
  let userId: string | undefined;
  let userName: string | undefined = "User";
  let dataContext = "No specific data provided for this query.";
  let grokUsageData: any = null; // To store usage from Grok response

  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("[CHAT] User not authenticated");
      return new Response("Authentication required", { status: 401 });
    }
    userId = session.user.id;
    userName = session.user.name || "User";
    
    // --- Rate Limit Check ---
    // REMINDER: Apply this pre-check pattern (fetch usage, check limit, handle reset)
    //           before *any* new Grok API call is made in this route.
    await dbConnect(); // Connect DB first
    let dailyUsage = 0;
    let lastReset: Date | null = null;
    let proceedWithAICall = false;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error("[CHAT_RATE_LIMIT] Invalid User ID for lookup:", userId);
        // Handle appropriately - maybe return an error or default context
        // For now, we prevent AI call
    } else {
        const userDoc = await User.findById(userId)
          .select("dailyGrokTokenUsage lastGrokUsageReset")
          .lean() as Pick<IUser, 'dailyGrokTokenUsage' | 'lastGrokUsageReset'> | null;

        if (userDoc) {
            dailyUsage = userDoc.dailyGrokTokenUsage || 0;
            lastReset = userDoc.lastGrokUsageReset || null;
            const todayStart = startOfDay(new Date());

            // Check if reset is needed
            if (!lastReset || lastReset < todayStart) {
              console.log(`[CHAT_RATE_LIMIT] Resetting token usage for user ${userId}.`);
              dailyUsage = 0;
              lastReset = todayStart;
              // Update DB immediately (fire-and-forget)
              User.updateOne({ _id: userId }, { $set: { dailyGrokTokenUsage: 0, lastGrokUsageReset: todayStart } })
                .catch(err => console.error("[CHAT_RATE_LIMIT] Failed to update reset date in DB:", err));
            }

            // Check if user is under the limit (estimate needed)
            // Chat is hard to estimate perfectly. Let's use a simple check:
            // If usage is already near the limit, block. Otherwise, allow and count later.
            if (dailyUsage < DAILY_GROK_TOKEN_LIMIT) {
              proceedWithAICall = true;
              console.log(`[CHAT_RATE_LIMIT] User ${userId} under limit (${dailyUsage}/${DAILY_GROK_TOKEN_LIMIT}). Proceeding.`);
            } else {
              console.log(`[CHAT_RATE_LIMIT] User ${userId} EXCEEDED limit (${dailyUsage}/${DAILY_GROK_TOKEN_LIMIT}). Blocking AI call.`);
              proceedWithAICall = false;
              // Return rate limit exceeded response
              return NextResponse.json(
                 { error: "Daily AI usage limit reached. Please contact hi@aivery.com for assistance." },
                 { status: 429 } // HTTP 429 Too Many Requests
              );
            }
        } else {
            console.warn(`[CHAT_RATE_LIMIT] User document not found for ID: ${userId}. Allowing call but cannot track usage.`);
            proceedWithAICall = true; // Allow call but log warning
        }
    }
    
    // If check failed or limit exceeded, we would have already returned 429
    if (!proceedWithAICall) {
        // This should theoretically not be reached if limit exceeded due to early return
        console.error("[CHAT] AI call blocked unexpectedly after rate limit logic.");
        return new Response("Internal server error related to rate limiting.", { status: 500 });
    }
    // --- End Rate Limit Check ---

    console.log("[CHAT] API Key Loaded:", !!process.env.GROK_API_KEY);

    const body = await req.json();
    const currentQuery = body.query;
    const messageHistory = body.history || [];

    if (!currentQuery) {
      return new Response("Query is required", { status: 400 });
    }

    console.log(
      `[CHAT] Received query from user ${userId} (${userName}):`,
      currentQuery
    );

    // --- Check for General Fitness Questions ---
    const queryLower = currentQuery.toLowerCase();
    const generalKeywords = ['what is', 'explain', 'define', 'benefits of', 'how does', 'compare', 'difference between'];
    const fitnessConcepts = ['lactate threshold', 'vo2 max', 'hiit', 'macros', 'progressive overload', 'heart rate zones', 'hydration', 'protein synthesis', 'muscle hypertrophy']; // Add more concepts

    let isGeneralQuestion = generalKeywords.some(keyword => queryLower.startsWith(keyword)) ||
                            fitnessConcepts.some(concept => queryLower.includes(concept));

    if (isGeneralQuestion) {
      console.log("[CHAT] Detected general fitness question.");
      dataContext = "User is asking a general fitness question. Please answer using your base knowledge.";
      // Skip specific data fetching logic below
    } else {
      // --- Attempt to fetch data based on query (Existing Logic) ---
      // Simple check for distance-related queries
      if (queryLower.includes("distance") || (queryLower.includes("how far") && (queryLower.includes("run") || queryLower.includes("cycle") || queryLower.includes("swim") )) ) {
        console.log("[CHAT] Detected potential distance query.");
        const workoutType = getWorkoutTypeFromQuery(queryLower);
        const timeframeMatch = queryLower.match(/(?:in|last|this|during|for)\s+([a-zA-Z0-9\s]+)/); // Basic timeframe extraction
        const timeframe = timeframeMatch ? timeframeMatch[1].trim() : "this month"; // Default to this month if not found

        console.log(`[CHAT] Extracted type: ${workoutType}, timeframe: ${timeframe}`);

        if (workoutType) {
          const dateRange = getDateRangeFromTimeframe(timeframe);
          if (dateRange) {
            console.log(`[CHAT] Fetching ${workoutType} distance for range:`, dateRange);
            if (userId) {
              try {
                await dbConnect(); // Ensure DB connection
                // Call the repository function - it returns a number or throws an error
                const totalDistance: number = await getWorkoutDistanceForDateRange(
                  userId,
                  workoutType,
                  dateRange.start,
                  dateRange.end
                );
                console.log("[CHAT] Total distance fetched:", totalDistance);
                
                // Check if totalDistance is a valid number and greater than 0
                if (typeof totalDistance === 'number' && totalDistance > 0) {
                   // Note: We don't get the count from this specific function
                   dataContext = `Data for ${userName}: Total ${workoutType} distance for timeframe '${timeframe}' was ${totalDistance.toFixed(1)} km. Use this data to answer.`;
                } else {
                   // Handle case where distance is 0 (or potentially NaN/undefined, though caught by check)
                   dataContext = `Data for ${userName}: No ${workoutType} workouts with distance were found for timeframe '${timeframe}'. Inform the user.`;
                }
              } catch (dbError) {
                 console.error("[CHAT] Database error fetching distance:", dbError);
                 dataContext = `Error fetching workout data for ${timeframe}. Inform the user an error occurred.`;
              }
            } else {
                console.error("[CHAT] Cannot fetch distance, userId is undefined after authentication check.");
                // Optionally set context indicating user ID issue, or keep default
            }
          } else {
              console.log("[CHAT] Could not determine date range from timeframe:", timeframe);
              dataContext = `Could not determine the date range for timeframe '${timeframe}'. Ask the user to clarify the period.`;
          }
        } else {
           console.log("[CHAT] Could not determine workout type for distance query.");
           // Keep default dataContext
        }
      } else {
          console.log("[CHAT] Query not identified as a distance query or general question. Skipping data fetch.");
          // Keep default dataContext: "No specific data provided for this query."
      }
      // --- End Data Fetching Logic ---
    }
    // --- End Check for General Fitness Questions ---

    const validHistory = messageHistory.filter(
      (msg: { role: string }) => msg.role === "user" || msg.role === "assistant"
    );

    const messagesWithIds = [
      ...validHistory,
      { role: "user" as const, content: currentQuery, id: `temp-user-${Date.now()}` },
    ];

    const messagesForAnthropicApi = messagesWithIds.map(({ role, content }) => ({
      role: role as "user" | "assistant",
      content,
    }));

    // System prompt now includes the fetched data context
    const systemPrompt = `Act as Aivery, a friendly and encouraging AI fitness coach.
The user's name is ${userName}.
Keep responses concise and helpful, focusing on fitness, health, and wellness.

DATABASE SCHEMA OVERVIEW (Key Fields):
- UserData: _id, email, name, image, aiPreferences { location, fitnessGoals, trainingPreferences, ... }, height, weight, age, gender, ...
- WorkoutData: _id, userId, type (strength, run, cycle, swim, ...), name, date, duration, distance, calories, notes, intensity, workoutExercises[], cardioDetails { pace, speed, heartRate, laps, ... }, source, records[] { timestamp, heart_rate, speed, ... }, calculatedVolume, ...
- ExerciseData: _id, name, description, muscleGroups, category (strength, cardio, flexibility), equipment, instructions
- WorkoutExerciseData: _id, workoutId, exerciseId { _id, name, category }, sets[], notes, order, duration, distance
- Set: _id, weight, reps, duration, distance, notes
- ChatMessage: _id, userId, content, role, workoutId

CONTEXT: ${dataContext}

RESPONSE GUIDELINES:
- If CONTEXT provides specific data (like distance or count), **use that data directly** in your answer.
- If CONTEXT indicates no data was found or an error occurred, inform the user accordingly.
- If CONTEXT indicates the timeframe was unclear, ask the user to clarify.
- If CONTEXT is the default 'No specific data provided...', answer generally based on the user's query and your knowledge.
- Refer to the DATABASE SCHEMA OVERVIEW to understand the types of data that *can* be tracked, even if not present in the current CONTEXT. If the user asks about data that *could* exist according to the schema but isn't in the CONTEXT, you can mention that the data point exists but wasn't provided for this specific query (or offer to look it up if appropriate actions are available).
- Do not invent data. Only state what is in the CONTEXT or generally known based on the schema.
- Use markdown formatting (bold, italics, lists).`;

    console.log("[CHAT] Calling Grok API with system prompt:", systemPrompt); // Log the prompt
    
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
        console.error("[CHAT] GROK_API_KEY not configured.");
        return new Response("AI service is unavailable due to configuration issues.", { status: 503 });
    }

    const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini-latest',
        messages: [
            { role: 'system', content: systemPrompt },
            ...messagesForAnthropicApi
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[CHAT] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
      return new Response("Sorry, there was an error communicating with the AI.", { status: 502 });
    }

    const data = await fetchResponse.json();
    grokUsageData = data.usage; // Capture usage data
    console.log("[CHAT] Grok Raw Response:", data);

    let aiResponse: string | null = null;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        aiResponse = data.choices[0].message.content.trim();
    } else {
        console.warn("[CHAT] Unexpected Grok response structure:", data);
    }

    console.log("[CHAT] AI Response generated.");

    // --- Update Token Usage ---
    // REMINDER: Apply this post-update pattern (get tokens used, increment DB count)
    //           after *any* Grok API call successfully returns usage data.
    if (userId && grokUsageData) {
      const tokensUsed = grokUsageData.total_tokens || (
                         (grokUsageData.prompt_tokens || 0) + 
                         (grokUsageData.completion_tokens || 0) + 
                         (grokUsageData.completion_tokens_details?.reasoning_tokens || 0)
                       );
      if (tokensUsed > 0) {
        console.log(`[CHAT_RATE_LIMIT] Updating usage for user ${userId}. Adding ${tokensUsed} tokens.`);
        User.updateOne({ _id: userId }, { $inc: { dailyGrokTokenUsage: tokensUsed } })
          .catch(err => console.error("[CHAT_RATE_LIMIT] Failed to update usage count in DB:", err));
      }
    }
    // --- End Update Token Usage ---

    return NextResponse.json({ response: aiResponse || "Sorry, I couldn't generate a response." });
  } catch (error: any) {
    console.error("Chat API Error:", error);

    let userErrorMessage = "Sorry, I encountered an error. Please try again.";
    let statusCode = 500;

    if (error.status === 400 && error?.error?.type === "invalid_request_error") {
      userErrorMessage = `There was an issue with the request format: ${error.error.message}`;
      statusCode = 400;
    } else if (error.status === 401 || error.status === 403) {
      userErrorMessage =
        "There seems to be an authentication issue with the AI service.";
      statusCode = error.status;
    } else if (error.status === 429) {
      userErrorMessage =
        "The AI service is experiencing high traffic. Please try again shortly.";
      statusCode = 429;
    }
    if (
      userErrorMessage.includes("API key") ||
      userErrorMessage.includes("Grok")
    ) {
      userErrorMessage =
        "An unexpected error occurred while communicating with the AI service.";
    }

    return new Response(userErrorMessage, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: statusCode,
    });
  }
}

// Removed complex helper functions like processAIDataRequest, fetchDataBasedOnAnalysis etc.
// Removed workoutRepository imports as data fetching logic is simplified/removed for now
// Removed workout-analysis imports
// Note: Ensure getWorkoutDistanceForDateRange and dbConnect are correctly imported and work
