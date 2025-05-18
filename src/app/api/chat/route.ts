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
import { getRecentWorkouts } from "@/lib/db/repositories/workoutRepository";
import { callLLM, LLMProvider } from '@/lib/services/llm';

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
  let grokUsageData: any = null;

  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Authentication required", { status: 401 });
    }
    userId = session.user.id;
    userName = session.user.name || "User";
    await dbConnect();
    
    // --- Rate Limit Check ---
    // REMINDER: Apply this pre-check pattern (fetch usage, check limit, handle reset)
    //           before *any* new Grok API call is made in this route.
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

    // Fetch user details and context
    const user = await User.findById(userId).lean<IUser>();
    const recentWorkouts = await getRecentWorkouts(userId, 3);
    const last3WorkoutsString = recentWorkouts.length
      ? recentWorkouts.map(w => 
          `- ${w.date ? new Date(w.date).toLocaleDateString() : 'Unknown date'}: ${w.name || w.type} (${w.duration ? Math.round(w.duration/60) + ' min' : ''}${w.distance ? ', ' + w.distance + ' km' : ''})`
        ).join('\n')
      : 'No recent workouts found.';
    const prs = user?.personalRecords || {};
    const personalRecordsString = [
      prs.longestRun ? `Longest Run: ${prs.longestRun.value} km on ${prs.longestRun.date ? new Date(prs.longestRun.date).toLocaleDateString() : ''}` : null,
      prs.fastest5kPace ? `Fastest 5K Pace: ${prs.fastest5kPace.value} sec/m on ${prs.fastest5kPace.date ? new Date(prs.fastest5kPace.date).toLocaleDateString() : ''}` : null,
      prs.maxStrengthVolume ? `Max Strength Volume: ${prs.maxStrengthVolume.value} kg on ${prs.maxStrengthVolume.date ? new Date(prs.maxStrengthVolume.date).toLocaleDateString() : ''}` : null,
    ].filter(Boolean).join('\n') || 'No personal records found.';
    const goalsString = user?.aiPreferences?.fitnessGoals
      || (user?.goals && user.goals.length ? user.goals.join(', ') : 'No goals specified.');

    // Parse request
    const body = await req.json();
    const currentQuery = body.query;
    const messageHistory = body.history || [];
    if (!currentQuery) {
      return new Response("Query is required", { status: 400 });
    }

    // Main chat LLM call
    const provider = (process.env.LLM_PROVIDER_CHAT as LLMProvider) || 'grok';
    const model = process.env.LLM_MODEL_CHAT || 'grok-3-mini-latest';
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: `You are Aivery, a friendly and insightful AI fitness coach.

USER CONTEXT:
- Name: ${userName}
- Last 3 Workouts:
${last3WorkoutsString}
- Personal Records:
${personalRecordsString}
- Current Goals/Targets:
${goalsString}

RESPONSE GUIDELINES:
- Use the USER CONTEXT above to personalize your answer.
- If user data is missing or unclear, provide a general, actionable suggestion based on best fitness coaching practices. Only ask for clarification if essential.
- Be concise, actionable, and supportive.

FORMATTING REQUIREMENTS:
- Use proper markdown formatting to improve readability:
  - Use ## for main headings and ### for subheadings
  - Use bullet lists (- item) for listing items
  - Use numbered lists (1. step) for sequential steps
  - Use **bold** for emphasis and *italics* for secondary emphasis
  - Use \`code\` for measurements, exercises, or specific training terms
  - Use > blockquotes for important tips or quotes
  - For tables, use proper markdown table format

- Structure complex answers with clear sections, using headings to separate them
- For workout plans or exercise routines, format them clearly with proper spacing and organization
- Ensure all formatted elements have proper spacing before and after them` },
        ...(Array.isArray(messageHistory) ? messageHistory.filter(m => m && m.role && m.content) : []),
        { role: 'user', content: currentQuery }
      ],
      max_tokens: 1024,
      temperature: 0.7,
      stream: false,
      fallbackResponse: `I'll do my best to answer your fitness question: "${currentQuery}"`,
    });
    grokUsageData = data.usage;
    let aiResponse = '';
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      aiResponse = data.choices[0].message.content.trim();
    } else {
      aiResponse = "Sorry, I couldn't generate a response.";
    }
    // --- Update Token Usage ---
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
    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    console.error("Chat API Error:", error);

    // Instead of returning an error, return a friendly fallback message
    const fallbackResponse = `I'll do my best to help with your question, although I'm having some technical difficulties at the moment.`;
    
    return NextResponse.json({ 
      response: fallbackResponse,
      error: error instanceof Error ? error.message : String(error) // For logging purposes only
    });
  }
}

// Removed complex helper functions like processAIDataRequest, fetchDataBasedOnAnalysis etc.
// Removed workoutRepository imports as data fetching logic is simplified/removed for now
// Removed workout-analysis imports
// Note: Ensure getWorkoutDistanceForDateRange and dbConnect are correctly imported and work
