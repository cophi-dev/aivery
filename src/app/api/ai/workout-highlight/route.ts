import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { IWorkout } from '@/lib/db/models/workout'; // Assuming IWorkout defines the structure

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define the expected request body schema
const HighlightRequestSchema = z.object({
  userName: z.string(),
  workout: z.object({ // Define the expected fields from IWorkout we need
      _id: z.any().optional(), // Or specific type if needed
      type: z.string(),
      duration: z.number().optional().nullable(),
      distance: z.number().optional().nullable(),
      volume: z.number().optional().nullable(),
      calories: z.number().optional().nullable(),
      exercises: z.array(z.any()).optional().nullable(), // Keep exercises general for now
      notes: z.string().optional().nullable(),
      // Add any other relevant fields from IWorkout used in the prompt
  }),
});

type HighlightRequest = z.infer<typeof HighlightRequestSchema>;

// Helper function to create the prompt for Claude
function createHighlightPrompt(userName: string, workout: HighlightRequest['workout']): string {
    let workoutSummary = `Workout Type: ${workout.type}`;
    if (workout.duration) workoutSummary += `\nDuration: ${Math.round(workout.duration / 60)} minutes`;
    if (workout.distance) workoutSummary += `\nDistance: ${workout.distance.toFixed(2)} km`;
    if (workout.volume) workoutSummary += `\nTotal Volume: ${workout.volume.toLocaleString()} kg`;
    if (workout.calories) workoutSummary += `\nCalories Burned: ~${workout.calories} kcal`;
    if (workout.exercises && workout.exercises.length > 0) {
        workoutSummary += `\nExercises: ${workout.exercises.slice(0, 3).map((ex: any) => ex.name || 'Unnamed Exercise').join(', ')}${workout.exercises.length > 3 ? '...' : ''}`;
    }
    if (workout.notes) workoutSummary += `\nNotes: ${workout.notes.substring(0, 100)}${workout.notes.length > 100 ? '...' : ''}`;

    const systemPrompt = `
You are an AI fitness coach assistant integrated into a workout tracking app. Your goal is to generate a single, short, fun, and encouraging insight statement (a "highlight") for a specific workout that the user just viewed.

**User's Name:** ${userName}

**Workout Data:**
${workoutSummary}

**Instructions:**
1.  **Generate ONE concise statement (1-2 sentences max).**
2.  **Be positive, encouraging, and slightly informal.** Use the user's name (${userName}).
3.  **Be Creative:** Use fun, relatable analogies or comparisons based on the provided workout data (e.g., distance compared to landmarks, calories to food items, volume to heavy objects). Avoid generic statements if specific data is available.
4.  **Focus on the data provided:** Base the insight primarily on the numbers (duration, distance, volume, calories) or the type of workout.
5.  **Keep it fresh:** Try to generate slightly different phrasing or analogies each time, even for similar workouts.
6.  **Output ONLY the statement text.** Do not include greetings, introductory phrases, or markdown formatting. Just the raw insight string.

**Example Insights (for inspiration, don't copy directly):**
*   "Crushing ${workout.distance?.toFixed(1)}km, ${userName}! That's like running across the Golden Gate Bridge! 🌉 Keep it up!"
*   "Wow ${userName}, lifting ${workout.volume?.toLocaleString()}kg total? That's heavier than a grand piano! 🎹 Strong work!"
*   "Solid ${Math.round((workout.duration || 0) / 60)} minutes, ${userName}! You burned enough calories for a slice of pizza! 🍕"
*   "Great consistency, ${userName}! Another ${workout.type} session in the books. You're building momentum! 🚀"

Now, generate a highlight for the provided workout data.`;

    return systemPrompt;
}


export async function POST(req: NextRequest) {
  try {
    // 1. Check Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and Validate Request Body
    let requestBody: HighlightRequest;
    try {
      const rawBody = await req.json();
      requestBody = HighlightRequestSchema.parse(rawBody);
    } catch (error) {
      console.error("Invalid request body:", error);
      return NextResponse.json({ error: "Invalid request body", details: (error as z.ZodError).errors }, { status: 400 });
    }

    const { userName, workout } = requestBody;

    // 3. Create Prompt for AI
    const prompt = createHighlightPrompt(userName, workout);

    // 4. Call Anthropic API
    console.log(`Sending workout data to Anthropic for highlight generation for user: ${userName}, workout type: ${workout.type}`);
    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 150, // Limit response length
      system: prompt, // Use the generated prompt as the system message
      messages: [
         // No user message needed as the prompt contains all context
         // Alternatively, could send a minimal user message like "Generate highlight"
         // Let's try sending the prompt as system and no user message first.
         { role: "user", content: "Generate the highlight statement based on the workout data provided in the system prompt." } // Minimal user message
      ],
    });

    console.log("Anthropic Raw Response:", msg);

    // 5. Extract and Validate Response
    let aiInsight = "Great workout! Keep pushing!"; // Default fallback
    const firstBlock = msg.content?.[0];

    if (firstBlock && firstBlock.type === "text") {
        aiInsight = firstBlock.text.trim();
        // Basic cleanup: remove potential markdown quotes
        aiInsight = aiInsight.replace(/^["']|["']$/g, "");
    } else {
        console.error("Anthropic response content is empty or not text", msg.content);
    }

    if (!aiInsight) {
        aiInsight = `Awesome effort on that ${workout.type}, ${userName}! Keep it up!`; // Personalized fallback
    }

    console.log(`Generated AI Highlight for ${userName}: "${aiInsight}"`);

    // 6. Return Response
    return NextResponse.json({ insight: aiInsight });

  } catch (error) {
    console.error("API AI Highlight Error:", error);
    // Attempt to get user name for error message if possible (might not be available here easily)
    // Consider parsing error type for better messages
    return NextResponse.json(
      { insight: "Awesome effort on that workout! Keep it up!" }, // Generic fallback on server error
      { status: 500 }
    );
  }
} 