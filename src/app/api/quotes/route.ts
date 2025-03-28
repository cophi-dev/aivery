import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";
import { format } from 'date-fns';
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from 'mongodb';
import { getToken } from "next-auth/jwt";

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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return format(new Date(), 'EEEE');
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
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      temp: data.main.temp,
      condition: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      isRainy: data.weather[0].main.toLowerCase().includes('rain'),
      isSnowy: data.weather[0].main.toLowerCase().includes('snow'),
      isClear: data.weather[0].main.toLowerCase().includes('clear'),
      isCloudy: data.weather[0].main.toLowerCase().includes('cloud'),
      isHot: data.main.temp > 25,
      isCold: data.main.temp < 10
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
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
    const randomSeed = Math.floor(Math.random() * 10000) + (context.forceRefresh ? Date.now() : 0);
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
    
    if (context.weather) {
      prompt += `- Current weather: ${context.weather.condition} (${context.weather.temp}°C)\n`;
      if (context.weather.isRainy) prompt += `- It's raining outside\n`;
      if (context.weather.isSnowy) prompt += `- It's snowing outside\n`;
      if (context.weather.isHot) prompt += `- It's hot outside\n`;
      if (context.weather.isCold) prompt += `- It's cold outside\n`;
    }
    
    prompt += "\nThe message should sound like a real personal trainer giving a casual, friendly tip to their client. Avoid cliches, gym-bro language, and overused fitness quotes. Use conversational language and sometimes address the user by name if provided.";
    
    // Request new types of variety in language
    if (Math.random() > 0.7) {
      prompt += "\n\nOptionally, you can phrase this as a gentle question to get the user thinking.";
    } else if (Math.random() > 0.5) {
      prompt += "\n\nOptionally, you can include a bit of gentle humor if appropriate.";
    }
    
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

export async function GET(request: NextRequest) {
  try {
    // Add cache control headers to prevent caching
    const headers = new Headers();
    headers.append('Cache-Control', 'no-store, max-age=0, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');
    
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const unique = searchParams.get('unique');
    const force = searchParams.get('force') === 'true';
    
    // Add a random parameter to ensure different quotes on reload
    const timestamp = Date.now();
    
    // Try to get weather data if coordinates provided
    let weather = null;
    try {
      if (lat && lon) {
        weather = await getWeather(lat, lon);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
    }
    
    // Try to get user session but don't require it - try multiple auth methods
    let userDetails: {
      nickname?: string;
      activityLevel?: string;
      workoutCount?: number;
      recentWorkoutTypes?: string[];
    } | null = null;
    
    // Try to authenticate using multiple methods
    let userId = null;
    let userName = null;
    
    try {
      // Method 1: Server session
      const session = await getServerSession(authOptions);
      
      // Method 2: JWT token
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      });
      
      // Use any authentication method that works
      userId = session?.user?.id || token?.sub;
      userName = session?.user?.name || token?.name;
      
      // Only proceed with user-specific logic if we have a user ID
      if (userId) {
        await dbConnect();
        
        // Get user data
        const user = await User.findById(userId).lean();
        if (user) {
          userDetails = {
            nickname: (user as any).nickname || userName || 'there',
            activityLevel: (user as any).activityLevel
          };
          
          // Get workout count
          const workoutCollection = await getCollection('workouts');
          const workoutCount = await workoutCollection.countDocuments({ 
            userId: new ObjectId(userId) 
          });
          
          // Get recent workout types (up to 3)
          const recentWorkouts = await workoutCollection.find({ 
            userId: new ObjectId(userId) 
          })
          .sort({ date: -1 })
          .limit(3)
          .toArray();
          
          const workoutTypes = recentWorkouts
            .map((w: any) => w.type)
            .filter((t: any) => !!t);
          
          userDetails.workoutCount = workoutCount;
          userDetails.recentWorkoutTypes = workoutTypes;
        }
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      // Continue without user data - we'll use fallback quotes
    }
    
    // Get time-based context
    const timeOfDay = getTimeBasedGreeting();
    const dayOfWeek = getDayOfWeek();
    const weekend = isWeekend();
    
    // Prepare context for AI quote
    const quoteContext = {
      nickname: userDetails?.nickname || 'there',
      workoutCount: userDetails?.workoutCount,
      recentWorkoutTypes: userDetails?.recentWorkoutTypes,
      activityLevel: userDetails?.activityLevel,
      timeOfDay,
      dayOfWeek,
      isWeekend: weekend,
      weather,
      forceRefresh: force
    };
    
    // Try to generate an AI quote
    let quote = await generateAIQuote(quoteContext);
    
    // Fall back to static quotes if AI generation fails
    if (!quote) {
      quote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    }
    
    // Return the quote
    return NextResponse.json({ quote }, { headers });
  } catch (error) {
    console.error('Error generating quote:', error);
    
    // Return a fallback quote in case of error
    const fallbackQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    return NextResponse.json({ quote: fallbackQuote });
  }
} 