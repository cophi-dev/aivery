import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
// Remove Google Generative AI import
// import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { IWorkout } from '@/lib/db/models/workout'; // Assuming IWorkout defines the structure
// Import the fetchWorkout server action
import { fetchWorkout } from "@/lib/workout-actions"; 

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

// Remove Google Generative AI client initialization
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Remove Gemini specific configs
// const generationConfig = { ... };
// const safetySettings = [ ... ];

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

// Define a potential type for user context (optional for now)
// interface UserContext {
//   location?: string;
//   favoriteActivity?: string;
//   // Add other relevant fields from user settings/profile later
// }

// Updated function signature (UserContext is optional)
function createHighlightPrompt(
  userName: string,
  workout: PromptWorkoutData,
  // userContext?: UserContext // Add this later if we fetch user profile data
): string {
  let workoutSummary = `Workout Type: ${workout.type}`;
  if (workout.duration) workoutSummary += `\\nDuration: ${Math.round(workout.duration / 60)} minutes`;
  if (workout.distance) workoutSummary += `\\nDistance: ${workout.distance.toFixed(2)} km`;
  if (workout.calculatedVolume) workoutSummary += `\\nTotal Volume: ${workout.calculatedVolume.toLocaleString()} kg`;
  if (workout.calories) workoutSummary += `\\nCalories Burned: ~${workout.calories} kcal`;
  if (workout.workoutExercises && workout.workoutExercises.length > 0) {
    const exerciseNames = workout.workoutExercises
      .map((ex: any) => ex?.exerciseId?.name || 'Unnamed Exercise')
      .slice(0, 3);
    workoutSummary += `\\nExercises: ${exerciseNames.join(', ')}${workout.workoutExercises.length > 3 ? '...' : ''}`;
  }

  // --- NEW SIMPLIFIED Prompt ---
  // Keep core instructions but reduce verbosity and examples.
  const systemPrompt = `
You are Aivery, an encouraging AI fitness companion. Generate ONE concise, positive, personalized, and factually accurate motivational highlight statement (max 25 words) for the user's workout.

User's Name: ${userName}

Workout Data:
${workoutSummary}

Instructions:
1.  **Single Sentence Output:** Generate ONLY the highlight statement (max 25 words). No extra text.
2.  **Personalize:** Address the user by name.
3.  **Focus:** Pick ONE key metric or achievement (e.g., Volume, Distance, Duration, Consistency).
4.  **Key Metrics:**
    *   **Strength:** Prioritize Total Volume (>0kg) or a key exercise.
    *   **Cardio (Run/Cycle/Swim):** Prioritize Distance, Pace, or Duration.
    *   **Other:** Choose the most relevant available metric.
5.  **Tone:** Vibrant, upbeat, encouraging, and shareable.

Example Highlights (Goal: Short & Punchy):
*   "Nice push-ups, ${userName}! Killer strength session! 💪"
*   "Great run, ${userName}! Solid distance covered! 🏃‍♀️"
*   "Solid ${Math.round((workout.duration || 0) / 60)} min session, ${userName}, keep up the consistency! 🔥"

Generate the highlight now!
`;

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
        const systemPrompt = createHighlightPrompt(userName, validatedWorkoutData);

        // 6. Call Grok API
        console.log(`[GET /ai/workout-highlight] Sending workout data to Grok for highlight generation for user: ${userName}, workout type: ${validatedWorkoutData.type}`);
        
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.error("[GET /ai/workout-highlight] GROK_API_KEY not configured.");
            return NextResponse.json({ error: "AI configuration error" }, { status: 500 });
        }

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
              // Adding a simple user message to trigger the system prompt processing
              { role: 'user', content: `Generate a workout highlight for ${userName}.` }
            ],
            max_tokens: 300, // Max length for highlight (Increased from 150)
            temperature: 0.8, // Allow some creativity
            stream: false,
          })
        });

        if (!fetchResponse.ok) {
            const errorBody = await fetchResponse.text();
            console.error(`[GET /ai/workout-highlight] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
            return NextResponse.json({ error: "Failed to generate highlight from AI" }, { status: 502 }); // Use 502 Bad Gateway
        }

        const data = await fetchResponse.json();
        console.log("[GET /ai/workout-highlight] Grok Raw Response:", JSON.stringify(data, null, 2)); // Log the full response

        // 7. Extract and Validate Response from Grok
        let aiHighlight = "Great workout! Keep pushing!"; // Default fallback
        try {
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                 const responseText = data.choices[0].message.content.trim();
                 aiHighlight = responseText.replace(/^[\"\']|[\"\']$/g, ""); // Remove surrounding quotes
             } else {
                 console.error("[GET /ai/workout-highlight] Grok response content is empty or missing.", data);
                 // Check finish reason if available
                 const finishReason = data.choices?.[0]?.finish_reason;
                 if (finishReason && finishReason !== 'stop') {
                     console.warn(`Grok generation finished unexpectedly. Reason: ${finishReason}`);
                     aiHighlight = `Highlight generation incomplete. (${finishReason})`;
                 }
             }
        } catch (extractionError) {
             console.error("[GET /ai/workout-highlight] Error extracting text from Grok response:", extractionError, data);
             // Add more specific error handling if Grok provides error details in the future
        }
        
        if (!aiHighlight || aiHighlight.trim() === "") {
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

    // 4. Call Grok API
    console.log(`[POST] Sending workout data to Grok for highlight generation for user: ${userName}, workout type: ${workout.type}`);
    
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
        console.error("[POST /ai/workout-highlight] GROK_API_KEY not configured.");
        return NextResponse.json({ error: "AI configuration error" }, { status: 500 });
    }

    const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini-latest',
        messages: [
          { role: 'system', content: prompt },
          // Adding a simple user message to trigger the system prompt processing
          { role: 'user', content: `Generate a workout highlight for ${userName}.` }
        ],
        max_tokens: 300, // Max length for highlight (Increased from 150)
        temperature: 0.8, // Allow some creativity
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
        const errorBody = await fetchResponse.text();
        console.error(`[POST /ai/workout-highlight] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
        return NextResponse.json({ error: "Failed to generate highlight from AI" }, { status: 502 }); // Use 502 Bad Gateway
    }

    const data = await fetchResponse.json();
    console.log("[POST] Grok Raw Response:", JSON.stringify(data, null, 2)); // Log the full response

    // 5. Extract and Validate Response from Grok
    let aiHighlight = "Great workout! Keep pushing!";
     try {
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
             const responseText = data.choices[0].message.content.trim();
             aiHighlight = responseText.replace(/^[\"\']|[\"\']$/g, ""); // Remove surrounding quotes
         } else {
             console.error("[POST /ai/workout-highlight] Grok response content is empty or missing.", data);
             // Check finish reason if available
             const finishReason = data.choices?.[0]?.finish_reason;
             if (finishReason && finishReason !== 'stop') {
                 console.warn(`Grok generation finished unexpectedly. Reason: ${finishReason}`);
                 aiHighlight = `Highlight generation incomplete. (${finishReason})`;
             }
         }
    } catch (extractionError) {
         console.error("[POST /ai/workout-highlight] Error extracting text from Grok response:", extractionError, data);
         // Add more specific error handling if Grok provides error details in the future
    }

    if (!aiHighlight || aiHighlight.trim() === "") {
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