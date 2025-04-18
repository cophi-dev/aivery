import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User, { IUser } from "@/lib/db/models/user";
import { format, startOfDay } from "date-fns";
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { getToken } from "next-auth/jwt";

// Basic quotes for fallback
const FALLBACK_QUOTES = [
  "Push yourself because no one else is going to do it for you.",
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "You don't have to be extreme, just consistent.",
  "The difference between try and triumph is a little umph.",
  "The only place where success comes before work is in the dictionary.",
  "Don't stop when you're tired. Stop when you're done.",
  "No matter how slow you go, you're still lapping everyone on the couch.",
  "Fitness is not about being better than someone else, it's about being better than you used to be.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Do something today that your future self will thank you for.",
  "Rome wasn't built in a day, but they worked on it every single day.",
  "Strive for progress, not perfection.",
  "The hardest lift of all is lifting your butt off the couch.",
  "You're only one workout away from a good mood.",
  "Success starts with self-discipline.",
  "Don't wish for it, work for it.",
  "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.",
  "The body achieves what the mind believes.",
  "Exercise is a celebration of what your body can do, not a punishment for what you ate.",
];

// Get time of day greeting
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// Get day of week
function getDayOfWeek() {
  return format(new Date(), "EEEE");
}

// Check if it's weekend
function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

// Helper function to safely extract text from Claude response content
function getTextFromResponse(content: any): string | undefined {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }

  const firstBlock = content[0];

  // Handle different content block types safely
  if (firstBlock && typeof firstBlock === "object") {
    if ("text" in firstBlock) {
      return firstBlock.text as string;
    }
  }

  return undefined;
}

// Define the daily token limit
const DAILY_GROK_TOKEN_LIMIT = 500000;

// Use Grok to generate a personalized quote
async function generateAIQuote(context: {
  nickname?: string;
  workoutCount?: number;
  recentWorkoutTypes?: string[];
  activityLevel?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  isWeekend?: boolean;
  weather?: any;
  forceRefresh?: boolean;
}) : Promise<{ quote: string | null; usage: any | null }> {
  try {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      console.log("[generateAIQuote-dynamic] Grok API key not configured");
      return { quote: null, usage: null };
    }

    const promptTypes = [
      "practical fitness tip",
      "gentle reminder",
      "personal motivation",
      "time-specific suggestion",
      "weather-based advice",
      "personalized encouragement",
      "health fact",
      "mindfulness tip",
      "nutrition suggestion",
      "recovery reminder",
    ];

    const promptType =
      promptTypes[Math.floor(Math.random() * promptTypes.length)];

    let systemPrompt = `Act as a friendly fitness coach. Provide a brief, motivational, and personalized quote/tip (max 100 chars).

Style Guidelines:
1. Use the user's exact name (provided in context) if available.
2. STRICTLY keep the response under 100 characters.
3. DO NOT use greetings (e.g., "Hi Name,"). Start directly with the advice.
4. Be specific and relevant to the user context provided.
5. Use natural, conversational language.
6. Vary the tone: sometimes encouraging, sometimes a gentle challenge, sometimes practical advice.
7. Frame it as a question sometimes to encourage reflection.
8. DO NOT use markdown formatting or quotation marks around the final output. Just return the plain text quote.`;

    let userContextPrompt = "Generate a quote based on this context:";

    if (context.nickname) {
      userContextPrompt += `\n- User name: ${context.nickname}`;
    }
    if (context.workoutCount !== undefined) {
      userContextPrompt += `\n- Workout Count: ${context.workoutCount}`;
      const level = context.workoutCount === 0 ? "New user" : context.workoutCount < 5 ? "Beginner" : context.workoutCount < 20 ? "Regular" : "Dedicated";
      userContextPrompt += `\n- Dedication Level: ${level}`;
    }
    if (context.recentWorkoutTypes?.length) {
      userContextPrompt += `\n- Recent workout types: ${context.recentWorkoutTypes.join(", ")}`;
      const primaryType = context.recentWorkoutTypes[0]?.toLowerCase();
      if (primaryType?.includes("strength") || primaryType?.includes("weight")) userContextPrompt += `\n- Likely Preference: Strength`;
      else if (primaryType?.includes("cardio") || primaryType?.includes("run") || primaryType?.includes("cycle")) userContextPrompt += `\n- Likely Preference: Cardio`;
      else if (primaryType?.includes("yoga") || primaryType?.includes("stretch")) userContextPrompt += `\n- Likely Preference: Flexibility`;
    }
    if (context.timeOfDay) userContextPrompt += `\n- Time of Day: ${context.timeOfDay}`;
    if (context.dayOfWeek) userContextPrompt += `\n- Day of Week: ${context.dayOfWeek}`;
    if (context.isWeekend !== undefined) userContextPrompt += `\n- Is Weekend: ${context.isWeekend}`;
    // Note: Weather context removed from dynamic prompt as it's less likely to be useful for rapidly changing quotes

    userContextPrompt += `\n\nQuote Type to Generate: ${promptType}`; // Add selected type for AI context
    // Adding timestamp to user prompt to help ensure fresh response from API/cache layers
    userContextPrompt += `\n\nTimestamp: ${Date.now()}`;

    console.log(`[generateAIQuote-dynamic] Sending request to Grok with context for ${context.nickname || 'user'}`);

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
          { role: 'user', content: userContextPrompt }
        ],
        max_tokens: 500, // Increased value significantly
        temperature: 0.9, 
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[generateAIQuote-dynamic] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
      return { quote: null, usage: null };
    }

    const data = await fetchResponse.json();
    const usage = data.usage; // Capture usage details
    console.log("[generateAIQuote-dynamic] Grok Raw Response:", data);

    let generatedQuote: string | null = null;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        generatedQuote = data.choices[0].message.content.trim();
    } else {
        console.warn("[generateAIQuote-dynamic] Unexpected Grok response structure:", data);
        return { quote: null, usage: usage }; // Return usage even on structure error
    }

    if (generatedQuote) {
      const cleanedQuote = generatedQuote.replace(/^["'\s]+|["'\s]+$/g, '');
      if (cleanedQuote.length > 0 && cleanedQuote.length <= 150) {
        console.log(`[generateAIQuote-dynamic] Generated quote: "${cleanedQuote}"`);
        return { quote: cleanedQuote, usage: usage }; // Return quote and usage
      } else {
        console.warn(`[generateAIQuote-dynamic] Generated quote too long or empty: "${cleanedQuote}" (Original: "${generatedQuote}")`);
        return { quote: null, usage: usage }; // Return usage even if quote is invalid
      }
    }

    return { quote: null, usage: usage }; // Return usage if no quote generated
  } catch (error) {
    console.error("Error generating quote with Grok:", error);
    return { quote: null, usage: null }; // Return null on major error
  }
}

/**
 * GET handler for dynamic quotes
 * This endpoint always returns a different quote with each request
 * No caching is done
 */
export async function GET(request: NextRequest) {
  let sessionUserId: string | null = null;
  let userNickname: string | null = null;
  let userWorkoutCount: number = 0;
  let userRecentWorkoutTypes: string[] = [];
  let userActivityLevel: string = "new";
  let dailyUsage: number = 0;
  let lastReset: Date | null = null;
  let proceedWithAICall = false; // Flag to control AI call
  let grokUsageData: any = null; // To store usage from Grok response

  try {
    // Add cache control headers to prevent caching
    const headers = new Headers();
    headers.append(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    headers.append("Pragma", "no-cache");
    headers.append("Expires", "0");

    // Get unique parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const requestId = searchParams.get("nocache") || Date.now().toString();
    // Get any lastQuote that was sent
    const lastQuote = searchParams.get("lastQuote")
      ? decodeURIComponent(searchParams.get("lastQuote") || "")
      : "";

    // Get a truly unique random seed based on current time with microsecond precision
    const now = Date.now();
    const randomSeed =
      now + Math.floor(Math.random() * 1000000) + Math.random();

    // Log to verify the function is being called each time
    console.log(
      `[QUOTES-DYNAMIC] Request at ${new Date(now).toISOString()} with seed: ${randomSeed} and ID: ${requestId.substring(0, 10)}`,
    );
    if (lastQuote) {
      console.log(
        `[QUOTES-DYNAMIC] Last quote reported by client: "${lastQuote.substring(0, 30)}..."`,
      );
    }

    // Track previously returned quotes to avoid repeating
    const lastQuotesCookie = request.cookies.get("last-quotes");
    let lastQuotes: string[] = [];

    if (lastQuotesCookie) {
      try {
        lastQuotes = JSON.parse(lastQuotesCookie.value);
        if (!Array.isArray(lastQuotes)) {
          lastQuotes = [];
        }
      } catch (e) {
        console.error("Error parsing last quotes cookie:", e);
        lastQuotes = [];
      }
    }

    // If the client reported a last quote, add it to our tracking
    if (lastQuote && !lastQuotes.includes(lastQuote)) {
      lastQuotes.unshift(lastQuote);
      lastQuotes = lastQuotes.slice(0, 5);
    }

    // Start by trying to get the user session
    const token = await getToken({ req: request });
    const session = await getServerSession(authOptions);

    sessionUserId = token?.id || null;
    
    if (sessionUserId) {
      await dbConnect();
      // Fetch user including rate limit fields, cast to IUser
      const userDoc = await User.findById(sessionUserId)
        .select("nickname name dailyGrokTokenUsage lastGrokUsageReset")
        .lean() as IUser | null; // Cast here

      if (userDoc) {
        userNickname = userDoc.nickname || userDoc.name || null;
        dailyUsage = userDoc.dailyGrokTokenUsage || 0;
        lastReset = userDoc.lastGrokUsageReset || null;

        const todayStart = startOfDay(new Date());

        // Check if reset is needed
        if (!lastReset || lastReset < todayStart) {
          console.log(`[RateLimit] Resetting token usage for user ${sessionUserId}. Previous reset: ${lastReset}`);
          dailyUsage = 0;
          lastReset = todayStart;
          // Update DB immediately for reset (can be fire-and-forget)
          User.updateOne({ _id: sessionUserId }, { $set: { dailyGrokTokenUsage: 0, lastGrokUsageReset: todayStart } })
            .catch(err => console.error("[RateLimit] Failed to update reset date in DB:", err));
        }

        // Check if user is under the limit BEFORE making the call
        // Estimate token usage for this call (prompt ~250 + max_output ~500 = 750)
        const estimatedCallTokens = 750; 
        if (dailyUsage + estimatedCallTokens <= DAILY_GROK_TOKEN_LIMIT) {
          proceedWithAICall = true;
          console.log(`[RateLimit] User ${sessionUserId} under limit (${dailyUsage}/${DAILY_GROK_TOKEN_LIMIT}). Proceeding with AI call.`);
          // Fetch context needed for the prompt only if proceeding
          const workoutsCollection = await getCollection("workouts");
          const recentWorkouts = await workoutsCollection
            .find({ userId: new ObjectId(sessionUserId) })
            .sort({ date: -1 })
            .limit(5)
            .project({ type: 1 })
            .toArray();
          userWorkoutCount = await workoutsCollection.countDocuments({ userId: new ObjectId(sessionUserId) });
          userActivityLevel = userWorkoutCount > 20 ? "active" : userWorkoutCount > 5 ? "regular" : "new";
          userRecentWorkoutTypes = recentWorkouts.map((w) => w.type).filter((value, index, self) => self.indexOf(value) === index);

        } else {
          console.log(`[RateLimit] User ${sessionUserId} EXCEEDED limit (${dailyUsage}/${DAILY_GROK_TOKEN_LIMIT}). Skipping AI call.`);
          proceedWithAICall = false;
        }
      }
    }

    // Attempt to generate an AI quote ONLY if allowed
    let aiQuoteResult: { quote: string | null; usage: any | null } = { quote: null, usage: null };
    let quoteSource = "fallback";

    if (proceedWithAICall && sessionUserId) { 
      try {
        aiQuoteResult = await generateAIQuote({
          nickname: userNickname ?? undefined, // Handle null case
          workoutCount: userWorkoutCount,
          recentWorkoutTypes: userRecentWorkoutTypes,
          activityLevel: userActivityLevel,
          timeOfDay: getTimeBasedGreeting(),
          dayOfWeek: getDayOfWeek(),
          isWeekend: isWeekend(),
          forceRefresh: true,
        });
        grokUsageData = aiQuoteResult.usage; // Store usage data

        if (aiQuoteResult.quote) {
          quoteSource = "ai";
          console.log(`[QUOTES-DYNAMIC] Generated AI quote for user: ${userNickname}`);
        }
      } catch (error) {
        console.error("Error generating AI quote:", error);
      }
    }

    // Use the AI quote if available, otherwise use a fallback
    let quote = aiQuoteResult.quote;

    if (!quote) { // If AI failed or was skipped due to limit
        // Get available quotes, excluding the last used one
        let availableQuotes = [...FALLBACK_QUOTES];

        if (lastQuote) {
          availableQuotes = FALLBACK_QUOTES.filter((q) => q !== lastQuote);
        }

        // Simple random selection
        const index = Math.floor(Date.now() % availableQuotes.length);
        quote = availableQuotes[index];

        quoteSource = "static";
    }
    
    // AFTER potentially getting a quote, update usage count if AI was called and successful
    if (quoteSource === 'ai' && sessionUserId && grokUsageData) {
      // Prioritize total_tokens reported by API, fall back to sum if needed
      const tokensUsed = grokUsageData.total_tokens || (
                         (grokUsageData.prompt_tokens || 0) + 
                         (grokUsageData.completion_tokens || 0) + 
                         (grokUsageData.completion_tokens_details?.reasoning_tokens || 0)
                       );
                         
      if (tokensUsed > 0) {
         console.log(`[RateLimit] Updating usage for user ${sessionUserId}. Adding ${tokensUsed} tokens.`);
         User.updateOne({ _id: sessionUserId }, { $inc: { dailyGrokTokenUsage: tokensUsed } })
           .catch(err => console.error("[RateLimit] Failed to update usage count in DB:", err));
      } else {
         console.warn("[RateLimit] AI call succeeded but reported 0 tokens used?", grokUsageData);
      }
    }

    // Add a cache-busting timestamp to the quote (invisible to user)
    const timestampedQuote = quote;

    // Update or create the cookie with recent quotes
    if (lastQuotes.length > 0) {
      try {
        // Sanitize quotes to ensure they contain only ASCII characters
        const sanitizedQuotes = lastQuotes.map((q) =>
          encodeURIComponent(q.replace(/[^\x00-\x7F]/g, "")),
        );
        const newCookie = JSON.stringify(
          [
            encodeURIComponent(quote.replace(/[^\x00-\x7F]/g, "")),
            ...sanitizedQuotes,
          ].slice(0, 5),
        );
        headers.append(
          "Set-Cookie",
          `last-quotes=${newCookie}; Path=/; Max-Age=86400; SameSite=Strict`,
        );
      } catch (cookieError) {
        console.error("Error setting quote cookie:", cookieError);
        // Continue without setting cookie
      }
    }

    // Log the quote being returned
    console.log(
      `[QUOTES-DYNAMIC] Returning ${quoteSource} quote: "${timestampedQuote.substring(0, 40)}..."`,
    );

    // Return response with the quote
    return NextResponse.json(
      {
        quote: timestampedQuote,
        id: requestId,
        source: quoteSource,
        timestamp: Date.now(),
      },
      {
        headers,
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in dynamic quote API:", error);
    return NextResponse.json(
      {
        error: "Failed to generate quote",
        quote:
          "Your body can stand almost anything. It's your mind you have to convince.",
        fallback: true,
      },
      { status: 500 },
    );
  }
}
