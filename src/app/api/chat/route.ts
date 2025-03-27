import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { 
  getWorkoutById, 
  getPreviousWorkouts, 
  getWorkoutsByUserId, 
  getMonthlyWorkoutDistanceByType,
  getWorkoutDistanceForDateRange,
  getMonthlyWorkoutDurationByType,
  getWorkoutDurationForDateRange,
  getWorkoutNotesByType,
  getTotalDistanceByType,
  getWorkoutTypeStats
} from "@/lib/db/repositories/workoutRepository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"
import { NextResponse } from "next/server"

// Allow responses up to 30 seconds
export const maxDuration = 30

// Helper function to calculate total weight lifted for strength workouts
function calculateTotalWeightLifted(workout: any): number {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0
  }
  
  return workout.exercises.reduce((total: number, exercise: any) => {
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      return total
    }
    
    const exerciseTotal = exercise.sets.reduce((setTotal: number, set: any) => {
      return setTotal + (set.weight || 0) * (set.reps || 0)
    }, 0)
    
    return total + exerciseTotal
  }, 0)
}

// Add after imports
interface WorkoutQuery {
  type: 'distance' | 'pace' | 'duration' | 'stats' | 'progress' | 'general';
  timeframe?: 'all' | 'year' | 'month' | 'week' | 'recent';
  workoutType?: string;
  specific?: string;
}

// Add before POST function
function analyzeWorkoutQuery(message: string): WorkoutQuery {
  const msg = message.toLowerCase();
  
  // Initialize query object
  const query: WorkoutQuery = {
    type: 'general'
  };

  // Detect workout type
  if (msg.includes('run') || msg.includes('running')) {
    query.workoutType = 'running';
  } else if (msg.includes('swim') || msg.includes('swimming')) {
    query.workoutType = 'swimming';
  } else if (msg.includes('cycl') || msg.includes('bike') || msg.includes('biking')) {
    query.workoutType = 'cycling';
  } else if (msg.includes('strength') || msg.includes('gym') || msg.includes('weight')) {
    query.workoutType = 'strength';
  }

  // Detect query type - enhance pace detection
  if (msg.includes('pace') || msg.includes('fastest') || msg.includes('speed') || msg.includes('quick')) {
    query.type = 'pace';
    if (msg.includes('fastest') || msg.includes('best') || msg.includes('quickest')) {
      query.specific = 'fastest';
    }
  } else if (msg.includes('distance') || msg.includes('far') || msg.includes('km') || msg.includes('kilometers')) {
    query.type = 'distance';
  } else if (msg.includes('time') || msg.includes('long') || msg.includes('duration')) {
    query.type = 'duration';
  } else if (msg.includes('stats') || msg.includes('statistics')) {
    query.type = 'stats';
  } else if (msg.includes('progress') || msg.includes('improve') || msg.includes('better')) {
    query.type = 'progress';
  }

  // Detect timeframe
  if (msg.includes('all time') || msg.includes('total') || msg.includes('ever')) {
    query.timeframe = 'all';
  } else if (msg.includes('this year') || msg.includes('year')) {
    query.timeframe = 'year';
  } else if (msg.includes('this month') || msg.includes('month')) {
    query.timeframe = 'month';
  } else if (msg.includes('this week') || msg.includes('week')) {
    query.timeframe = 'week';
  } else if (msg.includes('recent') || msg.includes('latest') || msg.includes('last')) {
    query.timeframe = 'recent';
  }

  // Detect specific queries
  if (msg.includes('longest')) {
    query.specific = 'longest';
  } else if (msg.includes('average') || msg.includes('avg')) {
    query.specific = 'average';
  }

  return query;
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be logged in to use the chat" },
        { status: 401 }
      );
    }
    
    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || "";
    
    // Create a system prompt that guides the AI to provide detailed responses
    const systemMessage = {
      role: "system",
      content: `You are Aivery, an enthusiastic and knowledgeable AI fitness coach specializing in analyzing Strava workout data. 
      
YOUR COMMUNICATION STYLE:
- Always provide complete, detailed responses with specific insights and advice
- NEVER respond with just one-word or very brief replies; give thorough and helpful answers
- Be conversational, friendly, and encouraging in your tone
- Use emoji occasionally to create an engaging conversation 🏃‍♀️ 🏋️‍♂️ 🚴‍♀️
- When users greet you (with messages like "hi", "hello", etc.), respond with a friendly greeting AND ask about their fitness goals or recent workouts

YOUR CAPABILITIES:
- Analyze workout patterns and provide detailed insights
- Calculate and interpret exercise metrics (pace, heart rate, etc.)
- Suggest improvements based on workout history
- Answer questions about workout types, training plans, and fitness concepts

RESPONSE GUIDELINES:
- When analyzing workouts, include specific numbers, comparisons to previous performances, and actionable advice
- Vary your response format - sometimes use bullet points, sometimes use paragraphs
- For greeting messages, respond with "Hi there! I'm Aivery, your AI fitness coach. How can I help with your workouts today?" (or similar variations)
- Always assume the user wants detailed information about their query
- If you're not sure about specific data, encourage the user to check their workout history and offer to help analyze it

SPECIAL DATA VISUALIZATION INSTRUCTIONS:
- If the user asks about their running pace or stats, ALWAYS begin with exactly: "Let me analyze your workouts and show you the data. Based on your running history..."
- If the user asks about a specific year (e.g., 2024 runs), ALWAYS begin with exactly: "Let me analyze your workouts from [YEAR] and show you the data. Based on your running history..."
- If the user asks about strength training, ALWAYS begin with exactly: "Let me check your strength workout data. Looking at your training history..."
- If the user asks for general workout stats or any other workout data, ALWAYS begin with exactly: "Let me pull up your workout statistics. Here's what I found in your history..."
- For EVERY response that relates to workout data, ALWAYS include one of the exact phrases above as the FIRST sentence

These exact phrases trigger the UI to show data visualizations, so they MUST be used precisely as written for any workout data requests.

NEVER respond with just a short, generic message like "Hello" or "I'll check that for you". Always provide a complete, thoughtful response.
`
    };
    
    // Use the AI SDK's streaming text feature with the OpenAI model
    const result = streamText({
      model: openai("gpt-3.5-turbo"),
      messages: [systemMessage, ...messages],
      temperature: 0.8, // Slightly increased for more varied responses
      maxTokens: 1200, // Increased to allow for more detailed responses
    });
    
    return result.toDataStreamResponse();
    
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "There was an error processing your request" },
      { status: 500 }
    );
  }
}

