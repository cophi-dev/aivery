import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { format } from 'date-fns';
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from 'mongodb';
import { getToken } from "next-auth/jwt";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return format(new Date(), 'EEEE');
}

// Check if it's weekend
function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

// Use OpenAI to generate a personalized quote
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
    if (!process.env.OPENAI_API_KEY) {
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
      "recovery reminder"
    ];
    
    // Select a random prompt type for variety
    const promptType = promptTypes[Math.floor(Math.random() * promptTypes.length)];
    
    // Create a prompt with user context
    let prompt = `Generate a short, conversational ${promptType} for a fitness app user (max 100 characters). Make it sound natural like something a real coach would say to ${context.nickname || "a client"}, not like a generic motivational poster. If possible, personalize it to the details below.\n\n`;
    
    // Add a random seed to force uniqueness in each request
    const randomSeed = Math.floor(Math.random() * 10000) + Date.now();
    prompt += `Random seed: ${randomSeed}\n\n`;
    
    prompt += "User context:\n";
    if (context.nickname) prompt += `- User's name: ${context.nickname}\n`;
    if (context.workoutCount !== undefined) {
      if (context.workoutCount === 0) {
        prompt += `- New user who hasn't logged any workouts yet\n`;
      } else if (context.workoutCount < 5) {
        prompt += `- Beginner who has logged ${context.workoutCount} workouts\n`;
      } else if (context.workoutCount < 20) {
        prompt += `- Regular user with ${context.workoutCount} workouts logged\n`;
      } else {
        prompt += `- Dedicated user with ${context.workoutCount} workouts logged\n`;
      }
    }
    
    if (context.recentWorkoutTypes?.length) {
      prompt += `- Recent workout types: ${context.recentWorkoutTypes.join(', ')}\n`;
      // Add some workout-specific context
      const workoutType = context.recentWorkoutTypes[0]?.toLowerCase();
      if (workoutType?.includes('strength') || workoutType?.includes('weight')) {
        prompt += `- Seems to enjoy strength training\n`;
      } else if (workoutType?.includes('cardio') || workoutType?.includes('run')) {
        prompt += `- Seems to enjoy cardio workouts\n`;
      } else if (workoutType?.includes('yoga') || workoutType?.includes('stretch')) {
        prompt += `- Seems to enjoy yoga or flexibility training\n`;
      }
    }
    
    if (context.activityLevel) prompt += `- Activity level: ${context.activityLevel}\n`;
    if (context.timeOfDay) prompt += `- Current time of day: ${context.timeOfDay}\n`;
    if (context.dayOfWeek) prompt += `- Today is ${context.dayOfWeek}\n`;
    if (context.isWeekend !== undefined) prompt += `- It's the ${context.isWeekend ? 'weekend' : 'middle of the week'}\n`;
    
    prompt += "\nThe message should sound like a real personal trainer giving a casual, friendly tip to their client. Avoid cliches, gym-bro language, and overused fitness quotes. Use conversational language and sometimes address the user by name if provided.";
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an experienced, friendly personal fitness coach who specializes in personalized guidance. You speak conversationally and naturally, like you're talking directly to your client. You always consider the individual's context and preferences when giving advice. You're supportive without being cheesy, knowledgeable without being pedantic, and friendly without being artificial."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 75,
      temperature: 0.85,
      frequency_penalty: 1.0,
      presence_penalty: 1.0,
    });

    const generatedQuote = response.choices[0].message.content?.trim();
    
    if (generatedQuote && generatedQuote.length <= 150) {
      // Remove any quotation marks from the beginning and end of the quote
      return generatedQuote.replace(/^["'](.*)["']$/, '$1');
    }
    
    return null;
  } catch (error) {
    console.error('Error generating quote with OpenAI:', error);
    return null;
  }
}

/**
 * GET handler for dynamic quotes
 * This endpoint always returns a different quote with each request
 * No caching is done
 */
export async function GET(request: NextRequest) {
  try {
    // Add cache control headers to prevent caching
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');
    
    // Get unique parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const requestId = searchParams.get('nocache') || Date.now().toString();
    
    // Get a truly unique random seed based on current time
    const now = Date.now();
    const randomSeed = now + Math.floor(Math.random() * 1000000);
    
    // Log to verify the function is being called each time
    console.log(`[QUOTES-DYNAMIC] Request at ${new Date(now).toISOString()} with seed: ${randomSeed} and ID: ${requestId.substring(0, 10)}`);
    
    // Track previously returned quotes using cookies to avoid repeating
    // Get the last 5 quotes from cookies
    const lastQuotesCookie = request.cookies.get('last-quotes');
    let lastQuotes: string[] = [];
    
    if (lastQuotesCookie) {
      try {
        lastQuotes = JSON.parse(lastQuotesCookie.value);
        if (!Array.isArray(lastQuotes)) {
          lastQuotes = [];
        }
      } catch (e) {
        console.error('Error parsing last quotes cookie:', e);
        lastQuotes = [];
      }
    }
    
    // Try to get user session - OPTIONAL
    let userData: any = null;
    let userId = null;
    
    try {
      // Try to get auth info but don't require it
      const session = await getServerSession(authOptions);
      const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
      
      // Use any user ID available
      userId = session?.user?.id || token?.sub;
      
      // If we have a user ID, try to get user data
      if (userId) {
        await dbConnect();
        userData = await User.findById(userId).lean();
      }
    } catch (authError) {
      console.error('Auth error in dynamic quotes API:', authError);
      // Continue without user data
    }
    
    // Get contextual info for the quote
    const timeOfDay = getTimeBasedGreeting();
    const dayOfWeek = getDayOfWeek();
    const isWeekendToday = isWeekend();
    
    // Get workout data if available
    let workoutCount = 0;
    let recentWorkoutTypes: string[] = [];
    
    if (userId) {
      try {
        const workoutCollection = await getCollection('workouts');
        
        // Get workout count
        workoutCount = await workoutCollection.countDocuments({ 
          userId: new ObjectId(userId) 
        });
        
        // Get recent workout types (up to 3)
        const recentWorkouts = await workoutCollection.find({ 
          userId: new ObjectId(userId) 
        })
        .sort({ date: -1 })
        .limit(3)
        .toArray();
        
        recentWorkoutTypes = recentWorkouts
          .map((w: any) => w.type)
          .filter((t: any) => !!t);
      } catch (dbError) {
        console.error('Error fetching workout data:', dbError);
      }
    }
    
    // Prepare context for AI quote
    const quoteContext = {
      nickname: userData?.nickname || userData?.name || 'there',
      workoutCount,
      recentWorkoutTypes,
      activityLevel: userData?.activityLevel || 'active',
      timeOfDay,
      dayOfWeek,
      isWeekend: isWeekendToday,
      forceRefresh: true
    };
    
    // Try to generate an AI quote if we have user data
    let quote = null;
    if (userData || workoutCount > 0) {
      quote = await generateAIQuote(quoteContext);
      console.log(`[QUOTES-DYNAMIC] AI quote generated: ${quote?.substring(0, 30) || 'null'}`);
    }
    
    // If AI failed or we have no user data, use fallback quotes
    if (!quote) {
      // Create a filtered list without the most recently used quotes
      let availableQuotes = [...FALLBACK_QUOTES];
      
      // Filter out the last used quotes if we have alternates
      if (lastQuotes.length > 0 && lastQuotes.length < FALLBACK_QUOTES.length - 1) {
        availableQuotes = FALLBACK_QUOTES.filter(q => !lastQuotes.includes(q));
      }
      
      // Use truly random selection from the filtered list
      const index = Math.abs(randomSeed) % availableQuotes.length;
      quote = availableQuotes[index];
      
      // Force a different quote if the last one is the same and we have more options
      if (lastQuotes.length > 0 && quote === lastQuotes[0] && availableQuotes.length > 1) {
        // Pick a different index
        const newIndex = (index + 1) % availableQuotes.length;
        quote = availableQuotes[newIndex];
        console.log(`[QUOTES-DYNAMIC] Forced different quote to avoid repetition`);
      }
      
      // If we have a nickname, try to personalize the static quote
      if (userData?.nickname || userData?.name) {
        const name = userData?.nickname || userData?.name;
        // 50% chance to add the name to the beginning of the quote
        if (Math.random() > 0.5) {
          quote = `${name}, ${quote.charAt(0).toLowerCase() + quote.slice(1)}`;
        }
      }
      
      console.log(`[QUOTES-DYNAMIC] Using fallback quote: ${quote.substring(0, 30)}...`);
    } else {
      console.log(`[QUOTES-DYNAMIC] Using AI-generated quote: ${quote.substring(0, 30)}...`);
    }
    
    // Update the last quotes list
    if (quote) {
      lastQuotes.unshift(quote);
      // Keep only the last 5 quotes
      lastQuotes = lastQuotes.slice(0, 5);
    }
    
    // Create response
    const response = NextResponse.json({ 
      quote, 
      timestamp: now,
      personalized: !!userData,
      timeOfDay,
      dayOfWeek,
      workoutCount: workoutCount || 0,
      uniqueId: requestId,
      avoidedRepetition: true
    }, { headers });
    
    // Set the updated last quotes cookie
    response.cookies.set({
      name: 'last-quotes',
      value: JSON.stringify(lastQuotes),
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('[QUOTES-DYNAMIC] Error:', error);
    
    // Even in case of error, return a unique quote
    const timestamp = Date.now();
    const fallbackIndex = timestamp % FALLBACK_QUOTES.length;
    
    return NextResponse.json({ 
      quote: FALLBACK_QUOTES[fallbackIndex],
      error: true,
      timestamp
    });
  }
} 