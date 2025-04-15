import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { IWorkout } from '@/lib/db/models/workout'; // Assuming IWorkout defines the structure
// Import the fetchWorkout server action
import { fetchWorkout } from "@/lib/workout-actions"; 

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define the expected workout data structure needed for the prompt
// (should match relevant fields returned by fetchWorkout)
const PromptWorkoutSchema = z.object({
  _id: z.any().optional(),
  type: z.string(),
  duration: z.number().optional().nullable(),
  distance: z.number().optional().nullable(),
  calculatedVolume: z.number().optional().nullable(), // Use calculatedVolume if available
  calories: z.number().optional().nullable(),
  workoutExercises: z.array(z.any()).optional().nullable(), // Keep exercises general
  notes: z.string().optional().nullable(),
  name: z.string().optional().nullable(), // Add name if used in prompt
});

type PromptWorkoutData = z.infer<typeof PromptWorkoutSchema>;

// Define the expected request body schema (for POST, might be deprecated later)
const HighlightRequestSchema = z.object({
  userName: z.string(),
  workout: PromptWorkoutSchema, // Reuse the prompt schema here
});

type HighlightRequest = z.infer<typeof HighlightRequestSchema>;

// Helper function to create the prompt for Claude
// Modified to accept PromptWorkoutData
function createHighlightPrompt(userName: string, workout: PromptWorkoutData): string {
    let workoutSummary = `Workout Type: ${workout.type}`;
    if (workout.duration) workoutSummary += `\nDuration: ${Math.round(workout.duration / 60)} minutes`;
    if (workout.distance) workoutSummary += `\nDistance: ${workout.distance.toFixed(2)} km`;
    // Use calculatedVolume if present
    if (workout.calculatedVolume) workoutSummary += `\nTotal Volume: ${workout.calculatedVolume.toLocaleString()} kg`;
    if (workout.calories) workoutSummary += `\nCalories Burned: ~${workout.calories} kcal`;
    if (workout.workoutExercises && workout.workoutExercises.length > 0) {
        // Extract exercise names safely
        const exerciseNames = workout.workoutExercises
          .map((ex: any) => ex?.exerciseId?.name || 'Unnamed Exercise')
          .slice(0, 3);
        workoutSummary += `\nExercises: ${exerciseNames.join(', ')}${workout.workoutExercises.length > 3 ? '...' : ''}`;
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
*   "Wow ${userName}, lifting ${workout.calculatedVolume?.toLocaleString()}kg total? That's heavier than a grand piano! 🎹 Strong work!"
*   "Solid ${Math.round((workout.duration || 0) / 60)} minutes, ${userName}! You burned enough calories for a slice of pizza! 🍕"
*   "Great consistency, ${userName}! Another ${workout.type} session in the books. You're building momentum! 🚀"

Now, generate a highlight for the provided workout data.`;

    return systemPrompt;
}

// --- GET Handler --- 
export async function GET(req: NextRequest) {
    try {
        // 1. Check Authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;
        const userName = session.user.nickname || session.user.name || "Fitness Pro"; // Get user name

        // 2. Get workoutId from URL parameters
        const workoutId = req.nextUrl.searchParams.get("workoutId");
        if (!workoutId) {
            return NextResponse.json({ error: "workoutId query parameter is required" }, { status: 400 });
        }

        // 3. Fetch workout data using the server action
        console.log(`[GET /ai/workout-highlight] Fetching workout ${workoutId} for user ${userId}`);
        let workoutData: any;
        try {
            workoutData = await fetchWorkout(workoutId);
            if (!workoutData) {
                console.log(`[GET /ai/workout-highlight] Workout ${workoutId} not found.`);
                return NextResponse.json({ error: "Workout not found" }, { status: 404 });
            }
            // Validate ownership (fetchWorkout should already do this, but double-check)
            if (workoutData.userId !== userId) {
                 console.warn(`[GET /ai/workout-highlight] User ${userId} attempted to access workout ${workoutId} owned by ${workoutData.userId}.`);
                 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        } catch (fetchError) {
             console.error(`[GET /ai/workout-highlight] Error fetching workout ${workoutId}:`, fetchError);
             return NextResponse.json({ error: "Failed to fetch workout data" }, { status: 500 });
        }
        
        // 4. Validate fetched data against the prompt schema (optional but good practice)
        let validatedWorkoutData: PromptWorkoutData;
        try {
            validatedWorkoutData = PromptWorkoutSchema.parse(workoutData);
        } catch(validationError) {
             console.error(`[GET /ai/workout-highlight] Fetched workout data failed prompt schema validation:`, validationError);
             // Proceed with potentially incomplete data or return error?
             // Let's proceed for now, createHighlightPrompt might handle missing fields.
             validatedWorkoutData = workoutData as PromptWorkoutData; // Use fetched data anyway
        }

        // 5. Create Prompt for AI
        const prompt = createHighlightPrompt(userName, validatedWorkoutData);

        // 6. Call Anthropic API
        console.log(`[GET /ai/workout-highlight] Sending workout data to Anthropic for highlight generation for user: ${userName}, workout type: ${validatedWorkoutData.type}`);
        const msg = await anthropic.messages.create({
          model: "claude-3-haiku-20240307", // Consider updating model if needed
          max_tokens: 150,
          system: prompt, 
          messages: [
             { role: "user", content: "Generate the highlight statement based on the workout data provided in the system prompt." } 
          ],
        });

        console.log("[GET /ai/workout-highlight] Anthropic Raw Response:", msg);

        // 7. Extract and Validate Response
        let aiHighlight = "Great workout! Keep pushing!"; // Default fallback
        const firstBlock = msg.content?.[0];
        if (firstBlock && firstBlock.type === "text") {
            aiHighlight = firstBlock.text.trim().replace(/^["']|["']$/g, "");
        } else {
            console.error("[GET /ai/workout-highlight] Anthropic response content is empty or not text", msg.content);
        }
        if (!aiHighlight) {
            aiHighlight = `Awesome effort on that ${validatedWorkoutData.type}, ${userName}! Keep it up!`; // Personalized fallback
        }

        console.log(`[GET /ai/workout-highlight] Generated AI Highlight for ${userName}: "${aiHighlight}"`);

        // 8. Return Response
        return NextResponse.json({ highlight: aiHighlight }); // Changed key to 'highlight'

    } catch (error) {
        console.error("API AI Highlight GET Error:", error);
        return NextResponse.json(
          // Use "highlight" key for consistency
          { highlight: "Awesome effort on that workout! Keep it up!" }, 
          { status: 500 }
        );
    }
}

// --- POST Handler (Keep for potential future use or compatibility) ---
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
      // Use the schema that includes userName and the workout structure
      requestBody = HighlightRequestSchema.parse(rawBody);
    } catch (error) {
      console.error("Invalid request body:", error);
      return NextResponse.json({ error: "Invalid request body", details: (error as z.ZodError).errors }, { status: 400 });
    }

    const { userName, workout } = requestBody;

    // 3. Create Prompt for AI (using the validated workout structure)
    const prompt = createHighlightPrompt(userName, workout);

    // 4. Call Anthropic API
    console.log(`[POST] Sending workout data to Anthropic for highlight generation for user: ${userName}, workout type: ${workout.type}`);
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", 
      max_tokens: 150,
      system: prompt,
      messages: [
         { role: "user", content: "Generate the highlight statement based on the workout data provided in the system prompt." } 
      ],
    });

    console.log("[POST] Anthropic Raw Response:", msg);

    // 5. Extract and Validate Response
    let aiHighlight = "Great workout! Keep pushing!"; 
    const firstBlock = msg.content?.[0];
    if (firstBlock && firstBlock.type === "text") {
        aiHighlight = firstBlock.text.trim().replace(/^["']|["']$/g, "");
    } else {
        console.error("[POST] Anthropic response content is empty or not text", msg.content);
    }
    if (!aiHighlight) {
        aiHighlight = `Awesome effort on that ${workout.type}, ${userName}! Keep it up!`; 
    }

    console.log(`[POST] Generated AI Highlight for ${userName}: "${aiHighlight}"`);

    // 6. Return Response (using 'highlight' key)
    return NextResponse.json({ highlight: aiHighlight });

  } catch (error) {
    console.error("API AI Highlight POST Error:", error);
    return NextResponse.json(
      { highlight: "Awesome effort on that workout! Keep it up!" }, 
      { status: 500 }
    );
  }
} 