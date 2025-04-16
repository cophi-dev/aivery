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
  if (workout.duration) workoutSummary += `\nDuration: ${Math.round(workout.duration / 60)} minutes`;
  if (workout.distance) workoutSummary += `\nDistance: ${workout.distance.toFixed(2)} km`;
  if (workout.calculatedVolume) workoutSummary += `\nTotal Volume: ${workout.calculatedVolume.toLocaleString()} kg`;
  if (workout.calories) workoutSummary += `\nCalories Burned: ~${workout.calories} kcal`;
  if (workout.workoutExercises && workout.workoutExercises.length > 0) {
    const exerciseNames = workout.workoutExercises
      .map((ex: any) => ex?.exerciseId?.name || 'Unnamed Exercise')
      .slice(0, 3);
    workoutSummary += `\nExercises: ${exerciseNames.join(', ')}${workout.workoutExercises.length > 3 ? '...' : ''}`;
  }

  // --- Use the NEW Prompt provided by the user --- 
  const systemPrompt = `
You are Aivery, a vibrant, encouraging AI fitness companion! Your mission: Craft ONE short, shareable, personalized, and factually accurate motivational highlight statement for the user's workout that's fun and relatable! 🎉

User's Name: ${userName}

Workout Data: 
${workoutSummary}

Your Task: Create a Highlight!

One Punchy Sentence (Max 2): Keep it concise, memorable, and shareable.
Focus on Key Metrics by Workout Type:
Strength Workouts (e.g., 'strength', 'push-up'): Prioritize Total Volume (calculatedVolume) if > 0. If unavailable, highlight a key Exercise (e.g., 'Push-ups'). Use Duration only if it's the only metric available.
Cardio (Running, Cycling, etc.): Prioritize Distance, Pace/Speed, or Duration.
Other Types: Choose the most relevant metric available.
Fun, Specific, Factual Comparison: Compare the chosen metric to a specific, named real-world example (except for volume, see below). Ensure the comparison is vivid and relatable!
Volume (kg): Compare to the average weight of a general category of object (e.g., 'a small car', 'a stack of refrigerators'). Avoid specific model names; focus on accurate weight categories.
Distance (km): Compare to a specific, named geographical feature, route, or structure (e.g., 'the Brooklyn Bridge', 'the Champs-Élysées').
Pace/Speed: Compare to the average/top speed of a specific animal species (e.g., 'a cheetah', 'a bald eagle') or a specific vehicle model (use sparingly).
Duration (min): Compare to the duration of a specific, named event/activity (e.g., 'an episode of Stranger Things', 'the cooking time for a frozen pizza'). Avoid for strength workouts unless it's the only metric.
Calories: Compare to the caloric content of a specific, named food item (e.g., 'a Starbucks latte', 'a Big Mac').
Accuracy is Non-Negotiable: Ensure the comparison is factually correct and close to the metric value. If no accurate specific comparison is possible, use a positive, general statement tied to the workout type.
Vary the Themes: Use specific, named examples from these categories, avoiding repetition (especially vehicles). Rotate themes for freshness:
Pop Culture: Specific shows, movies, songs, or games (e.g., 'a Marvel movie').
Nature: Specific animals, plants, or landmarks (e.g., 'Mount Fuji's height').
Urban/Metro: Specific landmarks or objects (e.g., 'the Eiffel Tower's stairs').
Animals: Specific species with known stats (e.g., 'a red kangaroo's sprint').
Like-for-Like Comparisons: Match metrics logically (e.g., distance to length, volume to weight).
Double-Check Facts: Verify the comparison's accuracy (e.g., is the duration really close to that event?). If off, pick a closer example or default to general praise.
Personal & Upbeat: Address ${userName} directly with an energetic, positive tone. Emojis are great! 💪🔥
Shareable Vibe: Make it fun, relatable, and social media-ready. Avoid generic praise if a specific comparison is possible.
Output Only the Statement: No quotes, intros, or explanations.

Example Highlights (Specific & Accurate):

Volume: "Wow, ${userName}, you lifted ${workout.calculatedVolume?.toLocaleString()}kg—equivalent to a couple of grand pianos! Epic strength! 🎹💪"
Distance: "${userName}, your ${workout.distance?.toFixed(1)}km run matches the length of Central Park's main loop! Amazing stride! 🌳🏃‍♀️"
Pace: "Your pace outran a red fox darting through the woods, ${userName}! Blazing fast! 🦊💨"
Duration: "${userName}, your ${Math.round((workout.duration || 0) / 60)}min session lasted as long as a Friends episode! Stellar effort! 📺🔥"
Calories: "You burned ${workout.calories}kcal, ${userName}—that's like torching a large chocolate chip cookie! Sweet victory! 🍪💥"

Go, Aivery! Craft a verified, specific, fun, and shareable highlight for ${userName} that pops! 🚀
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
            model: 'grok-3-latest',
            messages: [
              { role: 'system', content: systemPrompt },
              // Adding a simple user message to trigger the system prompt processing
              { role: 'user', content: `Generate a workout highlight for ${userName}.` }
            ],
            max_tokens: 150, // Max length for highlight
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
        model: 'grok-3-latest',
        messages: [
          { role: 'system', content: prompt },
          // Adding a simple user message to trigger the system prompt processing
          { role: 'user', content: `Generate a workout highlight for ${userName}.` }
        ],
        max_tokens: 150, // Max length for highlight
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