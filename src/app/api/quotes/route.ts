import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { format } from "date-fns";
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { getToken } from "next-auth/jwt";

export const dynamic = 'force-dynamic';

// Define workout type
interface WorkoutType {
  _id: string;
  type?: string;
  name?: string;
  date: string;
  duration?: number;
}

// Define user type
interface UserType {
  _id: string;
  name?: string;
  nickname?: string;
  email?: string;
  workouts?: WorkoutType[];
  activityLevel?: string;
  gender?: string;
  age?: number;
}

// Basic quotes cache for when we can't use AI
const fallbackQuotes = [
  "Consistency matters more than intensity.",
  "Small habits add up to big changes.",
  "Focus on progress, not perfection.",
  "Rest is as important as activity.",
  "Move a little every day.",
  "Do what works for you.",
  "Set realistic goals and adjust as needed.",
  "Listen to your body.",
  "Build fitness into your routine.",
  "Every bit of movement counts.",
  "Drink more water than you think you need.",
  "Some exercise is better than none.",
  "Moderation is sustainable.",
  "Progress takes patience.",
  "Balance is key to long-term success.",
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

// Get weather data if location is provided
async function getWeather(lat?: string, lon?: string) {
  if (!lat || !lon || !process.env.WEATHER_API_KEY) return null;

  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      temp: data.main.temp,
      condition: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      isRainy: data.weather[0].main.toLowerCase().includes("rain"),
      isSnowy: data.weather[0].main.toLowerCase().includes("snow"),
      isClear: data.weather[0].main.toLowerCase().includes("clear"),
      isCloudy: data.weather[0].main.toLowerCase().includes("cloud"),
      isHot: data.main.temp > 25,
      isCold: data.main.temp < 10,
    };
  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
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
}) {
  try {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      console.log("[generateAIQuote] Grok API key not configured");
      return null;
    }

    // Different prompt types to offer variety
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

    // Select a random prompt type for variety
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
    if (context.weather) {
      userContextPrompt += `\n- Current Weather: ${context.weather.condition}, ${context.weather.temp}°C`;
    }

    userContextPrompt += `\n\nQuote Type to Generate: ${promptType}`; // Add selected type for AI context

    console.log(`[generateAIQuote] Sending request to Grok with context for ${context.nickname || 'user'}`);

    // Call Grok API
    const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContextPrompt }
        ],
        max_tokens: 50, // Reduced max_tokens to better enforce ~100 char limit (response includes prompt tokens sometimes)
        temperature: 0.8, // Slightly higher temp for more quote variety
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[generateAIQuote] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
      return null;
    }

    const data = await fetchResponse.json();
    console.log("[generateAIQuote] Grok Raw Response:", data);

    let generatedQuote: string | null = null;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        generatedQuote = data.choices[0].message.content.trim();
    } else {
        console.warn("[generateAIQuote] Unexpected Grok response structure:", data);
        return null;
    }

    if (generatedQuote) {
      // Basic cleanup: remove surrounding quotes and trim again
      const cleanedQuote = generatedQuote.replace(/^["'\s]+|["'\s]+$/g, '');

      if (cleanedQuote.length > 0 && cleanedQuote.length <= 150) { // Allow slightly longer for safety
        console.log(`[generateAIQuote] Generated quote: "${cleanedQuote}"`);
        return cleanedQuote;
      } else {
          console.warn(`[generateAIQuote] Generated quote too long or empty after cleaning: "${cleanedQuote}" (Original: "${generatedQuote}")`);
          return null; // Fallback if quote is too long or empty
      }
    }

    return null;
  } catch (error) {
    console.error("Error generating quote with Grok:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Add cache control headers to prevent caching
    const headers = new Headers();
    headers.append("Cache-Control", "no-store, max-age=0, must-revalidate");
    headers.append("Pragma", "no-cache");
    headers.append("Expires", "0");

    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const unique = searchParams.get("unique") || Date.now().toString(); // Always use a unique value
    const force = searchParams.get("force") === "true";

    // Truly unique identifier that changes every millisecond + random component
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Ensure each browser instance gets a different quote
    const userAgent = request.headers.get("user-agent") || "";
    const clientId = request.headers.get("x-client-id") || "";

    // Console log every request to verify it's being called
    console.log(
      `[QUOTES API] Request at ${new Date().toISOString()} | UniqueID: ${uniqueId.substring(0, 10)}... | UA hash: ${hashString(userAgent).substring(0, 8)}`,
    );

    // Try to get weather data if coordinates provided
    let weather = null;
    try {
      if (lat && lon) {
        weather = await getWeather(lat, lon);
      }
    } catch (weatherError) {
      console.error("Error fetching weather:", weatherError);
      // Continue without weather data
    }

    // Get user session - OPTIONAL for this endpoint
    let session;
    let token;
    let userData: any = null;

    try {
      // Try to get auth info but don't require it
      session = await getServerSession(authOptions);
      token = await getToken({
        req: request as any,
        secret: process.env.NEXTAUTH_SECRET,
      });

      // If we have a session, try to get user data
      if ((session?.user?.id || token?.sub) && !force) {
        await dbConnect();

        const userId = session?.user?.id || token?.sub;

        if (userId) {
          // Get user data
          userData = await User.findById(userId).lean();

          if (!userData) {
            console.log("User not found, using anonymous mode");
          }
        }
      }
    } catch (authError) {
      console.error("Auth error in quotes API:", authError);
      // Continue without user data
    }

    // Get contextual info for the quote
    const timeOfDay = getTimeBasedGreeting();
    const dayOfWeek = getDayOfWeek();
    const isWeekendToday = isWeekend();

    // Prepare context for AI quote
    const quoteContext = {
      nickname: userData?.nickname || "there",
      workoutCount: userData?.workouts?.length || 0,
      recentWorkoutTypes: userData?.workouts?.map((w: any) => w.type) || [],
      activityLevel: userData?.activityLevel || "active",
      timeOfDay,
      dayOfWeek,
      isWeekend: isWeekendToday,
      weather,
      forceRefresh: true, // Always force refresh to get new quotes
    };

    // Try to generate an AI quote
    let quote = await generateAIQuote(quoteContext);

    // Fall back to static quotes if AI generation fails
    if (!quote) {
      // Use truly random selection with current timestamp to ensure different quotes
      const seed = Date.now() + Math.random() * 10000;
      const randomIndex = Math.floor(seed % fallbackQuotes.length);

      // Double-check we're not returning the same quote
      console.log(`[QUOTES API] Using fallback quote index ${randomIndex}`);
      quote = fallbackQuotes[randomIndex];
    }

    // Return the quote with detailed metadata to help debugging
    return NextResponse.json(
      {
        quote,
        timestamp: Date.now(),
        meta: {
          uniqueId: uniqueId.substring(0, 10),
          generatedAt: new Date().toISOString(),
          isFallback: !quote,
          timeOfDay,
        },
      },
      { headers },
    );
  } catch (error) {
    console.error("Error generating quote:", error);

    // Return a truly random fallback quote
    const now = Date.now();
    const randomSeed = now + Math.floor(Math.random() * 100000);
    const randomIndex = Math.floor(randomSeed % fallbackQuotes.length);
    const fallbackQuote = fallbackQuotes[randomIndex];

    return NextResponse.json({
      quote: fallbackQuote,
      timestamp: now,
      error: "Error generating quote",
      meta: {
        error: true,
        errorTime: new Date().toISOString(),
        randomSeed: randomSeed % 1000,
      },
    });
  }
}

// Simple string hashing function
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16); // Convert to hex
}
