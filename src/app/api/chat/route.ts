import { openai } from "@ai-sdk/openai"
import { OpenAI } from "openai";
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

// Initialize the OpenAI SDK
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

// Add before POST function
async function generatePersonalizedGreeting(userId: string): Promise<string | null> {
  try {
    await dbConnect();
    
    // Get recent workouts
    const recentWorkouts = await getWorkoutsByUserId(userId, 5);
    
    if (!recentWorkouts || recentWorkouts.length === 0) {
      return null; // No workouts found, will use default greeting
    }
    
    // Get workout stats for most frequent type
    const workoutCollection = await getCollection('workouts');
    
    // Count workouts by type
    const workoutTypes = await workoutCollection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get total workout count
    const totalWorkoutCount = await workoutCollection.countDocuments({ 
      userId: new ObjectId(userId) 
    });
    
    // Generate context for greeting
    const lastWorkout = recentWorkouts[0];
    const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60 * 24));
    
    // Get most frequent workout type and its stats
    let mostFrequentType = null;
    let workoutTypeData = {};
    
    if (workoutTypes.length > 0) {
      mostFrequentType = workoutTypes[0]._id;
      
      // Get additional stats for the most frequent workout type
      if (mostFrequentType) {
        const typeStats = await getWorkoutTypeStats(userId, mostFrequentType);
        workoutTypeData = {
          totalSessions: typeStats.totalSessions,
          totalDistance: typeStats.totalDistance,
          totalDuration: typeStats.totalDuration,
          averageDistance: typeStats.averageDistance,
          averageDuration: typeStats.averageDuration
        };
      }
    }
    
    // Get all workout types with counts for context
    const workoutTypeCounts = workoutTypes.reduce((obj: Record<string, number>, type: any) => {
      obj[type._id] = type.count;
      return obj;
    }, {});
    
    // Generate a simple context message for the AI
    const context = {
      lastWorkoutType: lastWorkout.type,
      daysSinceLastWorkout,
      totalWorkouts: totalWorkoutCount,
      preferredActivity: mostFrequentType,
      workoutTypeCounts, // Add all workout types with their counts
      lastWorkoutDistance: lastWorkout.distance || null,
      lastWorkoutDuration: lastWorkout.duration || null,
      mostFrequentTypeStats: workoutTypeData
    };
    
    console.log("Greeting context:", JSON.stringify(context, null, 2));
    
    // Use OpenAI to generate a personalized greeting
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a friendly fitness coach. Generate a brief, natural-sounding greeting (1-2 sentences max) based on the user's workout data. Make it personal, positive, and engaging. DO NOT explain the data or mention that you're analyzing it. Just create a natural greeting a real coach might say. No introductions like "Hey there!" or "Hi! I'm your fitness coach" - just dive right into the personalized observation. Reference specific data like number of workouts by type or most frequent activity when relevant.`
        },
        {
          role: "user",
          content: JSON.stringify(context)
        }
      ],
      temperature: 0.8,
      max_tokens: 80,
    });
    
    return response.choices[0].message?.content || null;
  } catch (error) {
    console.error("Error generating personalized greeting:", error);
    return null; // Fall back to default greeting
  }
}

export async function POST(request: Request) {
  try {
    // Parse request body
    let messages;
    let workoutId;
    
    try {
      const body = await request.json();
      messages = body.messages;
      workoutId = body.workoutId;
      
      if (!messages || !Array.isArray(messages)) {
        return NextResponse.json(
          { error: "Invalid messages format" },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
    
    // Validate user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be logged in to use the chat" },
        { status: 401 }
      );
    }
    
    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || "";
    
    // Check if this is a request for an initial greeting
    const isGreetingRequest = messages.length === 1 && 
                              messages[0].role === "user" && 
                              messages[0].content === "__GREETING__";
    
    if (isGreetingRequest && session?.user?.id) {
      try {
        const personalizedGreeting = await generatePersonalizedGreeting(session.user.id);
        
        if (personalizedGreeting) {
          return new Response(personalizedGreeting, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            }
          });
        }
      } catch (error) {
        console.error("Error in greeting generation:", error);
        // Continue with normal processing if greeting fails
      }
    }
    
    // Create a system prompt that guides the AI to provide detailed responses
    const systemMessage = {
      role: "system",
      content: `You are an authentic, personable AI fitness coach. While you offer expert guidance, your style is more like a friendly workout buddy than a formal trainer.
      
YOUR PERSONALITY & STYLE:
- Be warm, approachable and use natural language (not robotic or overly formal)
- Match the user's energy - casual with casual users, more technical with fitness enthusiasts
- Keep responses concise but helpful - don't ramble
- Use emojis sparingly but naturally to add personality 💪 🏃‍♀️
- Address the user directly and conversationally
- Show genuine enthusiasm for the user's fitness journey
- When appropriate, share brief personal anecdotes as if you were a real coach

YOUR CAPABILITIES:
- Provide fitness advice and workout recommendations
- Answer questions about training techniques and nutrition
- Motivate users in their fitness journey
- Suggest improvements to workout routines
- Explain exercise concepts in easy-to-understand terms

RESPONSE GUIDELINES:
- For greeting messages like "hi" or "hey", respond casually with something like "Hey there! What's up with your fitness journey today?" or "Hey! How can I help with your workouts today?"
- Be conversational first, informational second
- Use natural language patterns with contractions (I'm, you're, that's)
- Vary your responses - don't be repetitive or formulaic
- Be encouraging without being cheesy

IMPORTANT - AVOID DATA VISUALIZATION TRIGGERS:
DO NOT use any of these exact phrases in your responses unless specifically instructed:
- "Let me analyze your workouts and show you the data"
- "Let me check your strength workout data"
- "Let me pull up your workout statistics"

For ALL conversations, focus on providing helpful advice, answering questions, and engaging in conversation WITHOUT using those trigger phrases.

For example:
- User: "How was my run?" → "Based on what you've shared, it looks like a solid run! Do you want to talk about specific aspects of it, or are you looking for recovery tips?"
- User: "Can you help with my workouts?" → "For sure! What kind of training are you into right now, and what specifically can I help with?"
- User: "Show me my running stats" → "I'd be happy to chat about your running! What specific aspects are you curious about - pace, distance, or how you're progressing?"
`
    };
    
    try {
      // Use the OpenAI SDK to get a response
      const result = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [systemMessage, ...messages],
        temperature: 0.8, // Slightly increased for more varied responses
        max_tokens: 800, // Adjusted for more concise responses
      });
      
      // Return as a basic text response
      return new Response(result.choices[0].message?.content || "Sorry, I couldn't generate a response. Please try again.", {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    } catch (error) {
      // Send a fallback response if OpenAI call fails
      return new Response(
        "I'm having trouble connecting right now. Please try again in a moment.",
        { 
          status: 200, 
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "There was an error processing your request" },
      { status: 500 }
    );
  }
}

