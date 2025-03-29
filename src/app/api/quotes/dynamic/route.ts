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
    
    // Add instructions to avoid redundant greetings
    prompt += `IMPORTANT: Do NOT include greetings like "Hey ${context.nickname}" or "Hello there" since this will be displayed directly after the user's name. Start with the actual fitness tip/advice.\n\n`;
    
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
    // Get any lastQuote that was sent
    const lastQuote = searchParams.get('lastQuote') ? decodeURIComponent(searchParams.get('lastQuote') || '') : '';
    
    // Get a truly unique random seed based on current time with microsecond precision
    const now = Date.now();
    const randomSeed = now + Math.floor(Math.random() * 1000000) + Math.random();
    
    // Log to verify the function is being called each time
    console.log(`[QUOTES-DYNAMIC] Request at ${new Date(now).toISOString()} with seed: ${randomSeed} and ID: ${requestId.substring(0, 10)}`);
    if (lastQuote) {
      console.log(`[QUOTES-DYNAMIC] Last quote reported by client: "${lastQuote.substring(0, 30)}..."`);
    }
    
    // Track previously returned quotes to avoid repeating
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
    
    // If the client reported a last quote, add it to our tracking
    if (lastQuote && !lastQuotes.includes(lastQuote)) {
      lastQuotes.unshift(lastQuote);
      lastQuotes = lastQuotes.slice(0, 5);
    }
    
    // Start by trying to get the user session
    const token = await getToken({ req: request });
    const session = await getServerSession(authOptions);
    
    // Attempt to generate an AI quote
    let aiQuote = null;
    let quoteSource = 'fallback';
    
    if (session?.user?.id) {
      try {
        // Get the user's data for personalization
        await dbConnect();
        const userId = session.user.id;
        
        // Get the user's recent workouts for context
        const workoutsCollection = await getCollection('workouts');
        const recentWorkouts = await workoutsCollection
          .find({ userId: new ObjectId(userId) })
          .sort({ date: -1 })
          .limit(5)
          .toArray();
          
        // Get user's workout count
        const workoutCount = await workoutsCollection.countDocuments({ 
          userId: new ObjectId(userId) 
        });
        
        // Get user's activity level based on workout frequency
        let activityLevel = 'new';
        if (workoutCount > 20) activityLevel = 'active';
        else if (workoutCount > 5) activityLevel = 'regular';
        
        // Get recent workout types
        const recentWorkoutTypes = recentWorkouts
          .map(w => w.type)
          .filter((value, index, self) => self.indexOf(value) === index); // unique values
        
        // Load user data to get nickname
        const userDoc = await User.findById(userId).select('nickname name').lean();
        const nickname = userDoc ? (userDoc as any).nickname || (userDoc as any).name || null : null;
        
        // Generate a quote with context
        aiQuote = await generateAIQuote({
          nickname,
          workoutCount,
          recentWorkoutTypes,
          activityLevel,
          timeOfDay: getTimeBasedGreeting(),
          dayOfWeek: getDayOfWeek(),
          isWeekend: isWeekend(),
          forceRefresh: true,
        });
        
        if (aiQuote) {
          quoteSource = 'ai';
          console.log(`[QUOTES-DYNAMIC] Generated AI quote for user: ${nickname}`);
        }
      } catch (error) {
        console.error('Error generating AI quote:', error);
      }
    }
    
    // Use the AI quote if available, otherwise use a fallback
    let quote = aiQuote;
    
    // If no AI quote or AI quote matches the last one, use a fallback quote
    if (!quote || (lastQuote && quote === lastQuote)) {
      // Create a filtered list without the most recently used quotes
      let availableQuotes = [...FALLBACK_QUOTES];
      
      // Filter out all the last used quotes if we have alternates
      if (lastQuotes.length > 0 && lastQuotes.length < FALLBACK_QUOTES.length - 1) {
        availableQuotes = FALLBACK_QUOTES.filter(q => !lastQuotes.includes(q));
        console.log(`[QUOTES-DYNAMIC] ${availableQuotes.length} quotes available after filtering out last ${lastQuotes.length} quotes`);
      }
      
      // Use more entropy for randomness
      const index = Math.floor((Date.now() + Math.random() * 10000000) % availableQuotes.length);
      quote = availableQuotes[index];
      
      // Force a different quote if the last one is the same and we have more options
      if (lastQuote && quote === lastQuote && availableQuotes.length > 1) {
        // Pick a different index, ensure it's different
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * availableQuotes.length);
        } while (newIndex === index && availableQuotes.length > 1);
        
        quote = availableQuotes[newIndex];
        console.log(`[QUOTES-DYNAMIC] Forced different quote to avoid repetition`);
      }
      
      quoteSource = 'static';
    }
    
    // Add a cache-busting timestamp to the quote (invisible to user)
    const timestampedQuote = quote;
    
    // Update or create the cookie with recent quotes
    if (lastQuotes.length > 0) {
      try {
        // Sanitize quotes to ensure they contain only ASCII characters
        const sanitizedQuotes = lastQuotes.map(q => 
          encodeURIComponent(q.replace(/[^\x00-\x7F]/g, ''))
        );
        const newCookie = JSON.stringify([encodeURIComponent(quote.replace(/[^\x00-\x7F]/g, '')), ...sanitizedQuotes].slice(0, 5));
        headers.append('Set-Cookie', `last-quotes=${newCookie}; Path=/; Max-Age=86400; SameSite=Strict`);
      } catch (cookieError) {
        console.error('Error setting quote cookie:', cookieError);
        // Continue without setting cookie
      }
    }
    
    // Log the quote being returned
    console.log(`[QUOTES-DYNAMIC] Returning ${quoteSource} quote: "${timestampedQuote.substring(0, 40)}..."`);
    
    // Return response with the quote
    return NextResponse.json(
      { 
        quote: timestampedQuote,
        id: requestId,
        source: quoteSource,
        timestamp: Date.now()
      },
      { 
        headers,
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in dynamic quote API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate quote',
        quote: "Your body can stand almost anything. It's your mind you have to convince.", 
        fallback: true 
      },
      { status: 500 }
    );
  }
} 