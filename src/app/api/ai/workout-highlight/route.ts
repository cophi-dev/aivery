import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
// Remove Google Generative AI import
// import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
// import { IWorkout } from '@/lib/db/models/workout'; // Remove duplicate import
// Import the fetchWorkout server action
import { fetchWorkout } from "@/lib/workout-actions";
// import { connectToDb } from "@/lib/db"; // Import DB connection - Removed: Assuming implicit connection
import User, { IUser } from "@/lib/db/models/user"; // Import User model and IUser interface
import Workout, { IWorkout } from "@/lib/db/models/workout"; // Import Workout model AND IWorkout interface

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
  userId: z.string(), // Ensure userId is present for historical context queries
});

type PromptWorkoutData = z.infer<typeof PromptWorkoutSchema>;

// Define the expected request body schema (for POST, might be deprecated later)
const HighlightRequestSchema = z.object({
  userName: z.string(),
  workout: PromptWorkoutSchema, // Reuse the prompt schema here
});

type HighlightRequest = z.infer<typeof HighlightRequestSchema>;

// Type for basic historical context
interface HistoricalContext {
  bestDistance?: number | null;
  fastestDurationForDistance?: number | null;
  highestVolume?: number | null;
  workoutCountForType?: number;
}

// Updated function signature to include user and historical context
function createHighlightPrompt(
  userName: string,
  workout: PromptWorkoutData, // Contains workout details
  user: IUser | null,        // Contains user preferences/goals
  historicalContext: HistoricalContext // Contains PBs, counts, etc.
): string {
  let workoutSummary = `Workout Type: ${workout.type}`;
  if (workout.duration) workoutSummary += `\\nDuration: ${Math.round(workout.duration / 60)} minutes`;
  if (workout.distance) workoutSummary += `\\nDistance: ${workout.distance.toFixed(2)} km`; // Assuming km
  if (workout.calculatedVolume) workoutSummary += `\\nTotal Volume: ${workout.calculatedVolume.toLocaleString()} kg`; // Assuming kg
  if (workout.calories) workoutSummary += `\\nCalories Burned: ~${workout.calories} kcal`;
  if (workout.workoutExercises && workout.workoutExercises.length > 0) {
    const exerciseNames = workout.workoutExercises
      .map((ex: any) => ex?.exerciseId?.name || 'Unnamed Exercise')
      .slice(0, 3);
    workoutSummary += `\\nExercises: ${exerciseNames.join(', ')}${workout.workoutExercises.length > 3 ? '...' : ''}`;
  }
  if (workout.notes) workoutSummary += `\\nNotes: ${workout.notes}`;

  // --- Add User Preferences and Goals to Prompt ---
  let userContextSummary = "";
  if (user?.aiPreferences) {
    userContextSummary += "\\n\\nUser Preferences & Goals:";
    if (user.aiPreferences.location) userContextSummary += `\\n- Location: ${user.aiPreferences.location}`;
    if (user.aiPreferences.units) userContextSummary += `\\n- Prefers Units: ${user.aiPreferences.units}`;
    if (user.aiPreferences.fitnessGoals) userContextSummary += `\\n- Fitness Goals: ${user.aiPreferences.fitnessGoals}`;
    if (user.aiPreferences.trainingPreferences) userContextSummary += `\\n- Training Preferences: ${user.aiPreferences.trainingPreferences}`;
  }

  // --- Add Historical Context to Prompt ---
  let historicalContextSummary = "";
  if (Object.keys(historicalContext).length > 0) {
      historicalContextSummary += "\\n\\nHistorical Context for this Workout Type:";
      if (historicalContext.workoutCountForType) {
          historicalContextSummary += `\\n- Total ${workout.type} workouts logged: ${historicalContext.workoutCountForType}`;
      }
      if (historicalContext.bestDistance) {
          historicalContextSummary += `\\n- Best distance: ${historicalContext.bestDistance.toFixed(2)} km`;
      }
      if (historicalContext.fastestDurationForDistance && workout.distance) {
          historicalContextSummary += `\\n- Fastest ${workout.distance.toFixed(2)} km time: ${Math.round(historicalContext.fastestDurationForDistance / 60)} minutes`;
      }
      if (historicalContext.highestVolume) {
          historicalContextSummary += `\\n- Highest volume: ${historicalContext.highestVolume.toLocaleString()} kg`;
      }
  }

  // --- Enhanced Prompt for Creative, Varied Metaphors ---
  const systemPrompt = `
You are Aivery, a witty, trend-savvy AI fitness companion. Generate ONE vibrant, personalized, shareable highlight statement (max 30 words) for the user's workout with a unique, pop culture-inspired metaphor.

User's Name: ${userName}

Workout Data:
${workoutSummary}
${userContextSummary}
${historicalContextSummary}

Instructions:
1. **Single Sentence Output**: Generate ONLY the highlight statement (max 30 words). No extra text.
2. **Personalize**: Use the user's name and reference their goals/preferences if relevant.
3. **Focus**: Highlight ONE key metric/achievement (e.g., Volume, Distance, Duration, Consistency, PB).
4. **Compare**: If historical context exists, note improvement (e.g., "New PB!", "X% faster!").
5. **Vivid Pop Culture Metaphor**: Create a unique, high-energy metaphor tied to 2025 pop culture (e.g., blockbuster movies, hit songs, viral X trends, iconic games, or TV moments). Avoid vague or abstract analogies (e.g., no "glitchy AI bosses"). Ensure it's visual, relatable, and meme-worthy for social media. Tailor to workout type:
   - **Running**: Focus on Distance, Pace, or Duration. Metaphors: Epic racing or fleeing from iconic threats (e.g., 2025 action movie villains, X trend dance challenges, music festival sprints). Themes: chases, races, or cultural moments. Examples (inspiration only): "Like outrunning a *Jurassic World* T-Rex!", "Sprinting to a Billie Eilish encore!"
   - **Strength**: Emphasize Total Volume or PB. Metaphors: Lifting iconic objects or superhero feats (e.g., 2025 comic book heroes, gaming power-ups). Examples: "Like hurling a *Marvel* shield!", "Stacking plates like a *Fortnite* skyscraper!"
   - **HIIT**: Highlight intensity, reps, or rounds. Metaphors: Surviving chaotic or fast-paced scenarios (e.g., 2025 reality TV, heist films). Examples: "Like dodging traps in a *Mission: Impossible* run!", "As wild as a *Squid Game* sprint!"
   - **Pilates/Yoga**: Focus on reps, duration, or consistency. Metaphors: Graceful or serene cultural icons (e.g., 2025 award shows, zen influencers). Examples: "Smooth as a *Bridgerton* waltz!", "Zen like a *Mandalorian* meditation!"
   - **Cycling**: Prioritize Distance or Speed. Metaphors: High-speed races or vibrant journeys (e.g., 2025 sci-fi racers, music videos). Examples: "Like speeding in a *Tron* race!", "Pedaling to a *Dua Lipa* beat!"
   - **Swimming**: Focus on Distance or Time. Metaphors: Oceanic adventures or fluid quests (e.g., 2025 fantasy epics, aquatic heroes). Examples: "Like surfing a *Moana* wave!", "Gliding like a *Aquaman* sprint!"
   - **Other (e.g., CrossFit, Dance)**: Pick a relevant metric. Metaphors: Epic battles or performances (e.g., 2025 festivals, adventure games). Examples: "Like slaying a *Witcher* beast!", "Vibing like a *Coachella* star!"
6. **Maximize Variety**: Ensure metaphors are unique per workout, especially for runs. Avoid repeating themes (e.g., no similar sci-fi or chase metaphors twice). Vary starters (e.g., "Blazed," "Smashed," "Rocked").
7. **Tone**: Punchy, meme-worthy, and 2025-trendy. Include 1-2 vibrant emojis for social media pop.
8. **Avoid Generic Metaphors**: Skip abstract or overused analogies (e.g., no "glitchy AI" or "zombie chases"). Create visual, specific images tied to recognizable pop culture.
9. **Inspiration, Not Templates**: Use examples only for tone and energy, not as scripts. Invent fresh metaphors reflecting 2025 trends.

Generate the highlight now!

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
            console.log("[GET /ai/workout-highlight] Unauthorized: No session user ID.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;
        // Prefer nickname, fallback to name
        let userName = session.user.nickname || session.user.name || "Fitness Pro";
        console.log(`[GET /ai/workout-highlight] User authenticated: ${userId} (${userName})`);

        // 2. Get workoutId from URL parameters
        const workoutId = req.nextUrl.searchParams.get("workoutId");
        if (!workoutId) {
            console.log("[GET /ai/workout-highlight] Bad Request: workoutId missing.");
            return NextResponse.json({ error: "workoutId query parameter is required" }, { status: 400 });
        }
        console.log(`[GET /ai/workout-highlight] Received request for workoutId: ${workoutId}`);

        // --- Connect to DB ---
        // await connectToDb();
        // console.log("[GET /ai/workout-highlight] Database connected.");

        // --- Fetch User Data (Including Preferences) ---
        let user: IUser | null = null;
        try {
             // Cast the lean result to IUser
             user = await User.findById(userId).select('+aiPreferences').lean<IUser>();
             if (!user) {
                 // This shouldn't happen if session is valid, but good to check
                 console.error(`[GET /ai/workout-highlight] Fatal: User ${userId} not found in DB despite valid session.`);
                 return NextResponse.json({ error: "User data not found" }, { status: 404 });
             }
             // If nickname is missing in session but present in DB, use DB version
             if (!userName || userName === "Fitness Pro") {
                 userName = user.nickname || user.name || "Fitness Pro";
             }
             console.log(`[GET /ai/workout-highlight] User data fetched successfully for ${userId}. Has AI Prefs: ${!!user.aiPreferences}`);
        } catch (userFetchError) {
             console.error(`[GET /ai/workout-highlight] Error fetching user ${userId}:`, userFetchError);
             // Don't fail the request, proceed without user context
             // return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
        }

        // 3. Fetch workout data using the server action
        console.log(`[GET /ai/workout-highlight] Fetching workout ${workoutId} for user ${userId}`);
        let workoutData: any; // Use 'any' temporarily as fetchWorkout return type might not be strictly IWorkout
        try {
            workoutData = await fetchWorkout(workoutId); // fetchWorkout should return lean() data
            if (!workoutData) {
                console.log(`[GET /ai/workout-highlight] Workout ${workoutId} not found.`);
                return NextResponse.json({ error: "Workout not found" }, { status: 404 });
            }
            // Validate ownership
            if (String(workoutData.userId) !== userId) { // Ensure string comparison
                 console.warn(`[GET /ai/workout-highlight] Forbidden: User ${userId} attempted to access workout ${workoutId} owned by ${workoutData.userId}.`);
                 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            console.log(`[GET /ai/workout-highlight] Workout ${workoutId} fetched successfully.`);

            // Check if the fetched workout data includes a pre-generated highlight
            if (workoutData.aiHighlight) {
                console.log(`[GET /ai/workout-highlight] Found existing AI highlight for workout ${workoutId}. Returning cached version.`);
                return NextResponse.json({ highlight: workoutData.aiHighlight });
            }
            console.log(`[GET /ai/workout-highlight] No cached highlight found for workout ${workoutId}. Generating new one.`);

        } catch (fetchError) {
             console.error(`[GET /ai/workout-highlight] Error fetching workout ${workoutId}:`, fetchError);
             return NextResponse.json({ error: "Failed to fetch workout data" }, { status: 500 });
        }

        // 4. Validate fetched workout data against the prompt schema
        let validatedWorkoutData: PromptWorkoutData;
        try {
            // Ensure userId is added if not returned by fetchWorkout (it should be)
            if (!workoutData.userId) {
                workoutData.userId = userId;
            }
            validatedWorkoutData = PromptWorkoutSchema.parse(workoutData);
            console.log(`[GET /ai/workout-highlight] Workout data validated against schema.`);
        } catch(validationError) {
             console.error(`[GET /ai/workout-highlight] Fetched workout data failed prompt schema validation:`, validationError);
             // Proceed cautiously
             validatedWorkoutData = workoutData as PromptWorkoutData; // Use potentially incomplete data
             if (!validatedWorkoutData.userId) validatedWorkoutData.userId = userId; // Ensure userId is set
             console.warn(`[GET /ai/workout-highlight] Proceeding with workout data despite validation errors.`);
        }

        // --- Fetch Historical Context ---
        let historicalContext: HistoricalContext = {};
        try {
            console.log(`[GET /ai/workout-highlight] Fetching historical context for user ${userId}, type: ${validatedWorkoutData.type}`);
            const workoutType = validatedWorkoutData.type;
            const workoutDistance = validatedWorkoutData.distance;

            // Count total workouts of this type
            const count = await Workout.countDocuments({ userId: userId, type: workoutType });
            historicalContext.workoutCountForType = count;

            // Find bests based on type
            if (workoutType === 'running' || workoutType === 'cycling' || workoutType === 'swimming') {
                // Best Distance - Use IWorkout type hint
                const bestDistWorkout = await Workout.findOne({ userId: userId, type: workoutType, distance: { $ne: null } })
                                                     .sort({ distance: -1 }).limit(1).lean<IWorkout>();
                historicalContext.bestDistance = bestDistWorkout?.distance;

                // Fastest time for *this* distance (if distance exists and > 0)
                if (workoutDistance && workoutDistance > 0) {
                    // Use IWorkout type hint
                    const fastestTimeWorkout = await Workout.findOne({
                        userId: userId,
                        type: workoutType,
                        distance: workoutDistance, // Match exact distance
                        duration: { $ne: null }
                    }).sort({ duration: 1 }).limit(1).lean<IWorkout>();

                    // Safely access duration property
                    const fastestDuration = fastestTimeWorkout?.duration;

                    // Also check if current workout is the new fastest
                    if (fastestDuration && validatedWorkoutData.duration && validatedWorkoutData.duration < fastestDuration) {
                         historicalContext.fastestDurationForDistance = validatedWorkoutData.duration; // This is the new PB
                    } else {
                         historicalContext.fastestDurationForDistance = fastestDuration;
                    }
                }
            } else if (workoutType === 'strength' || workoutType === 'Strength') { // Check both cases just in case
                 // Highest Volume - Use IWorkout type hint
                 const bestVolumeWorkout = await Workout.findOne({ userId: userId, type: workoutType, calculatedVolume: { $gt: 0 } })
                                                       .sort({ calculatedVolume: -1 }).limit(1).lean<IWorkout>();
                 historicalContext.highestVolume = bestVolumeWorkout?.calculatedVolume;
            }
            console.log(`[GET /ai/workout-highlight] Historical context fetched:`, historicalContext);

        } catch (histError) {
            console.error(`[GET /ai/workout-highlight] Error fetching historical context for user ${userId}:`, histError);
            // Continue without historical context
        }


        // 5. Create Enhanced Prompt for AI
        const systemPrompt = createHighlightPrompt(
            userName,
            validatedWorkoutData,
            user, // Pass fetched user data
            historicalContext // Pass fetched historical context
        );
        console.log(`[GET /ai/workout-highlight] Generated enhanced prompt for Grok. Length: ${systemPrompt.length}`);

        // 6. Call Grok API
        console.log(`[GET /ai/workout-highlight] Sending workout data to Grok for highlight generation for user: ${userName}, workout type: ${validatedWorkoutData.type}`);

        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.error("[GET /ai/workout-highlight] GROK_API_KEY not configured.");
            return NextResponse.json({ error: "AI configuration error" }, { status: 500 });
        }

        const startTime = Date.now();
        const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokApiKey}`
          },
          body: JSON.stringify({
            model: 'grok-3-mini-latest', // Ensure using the correct model
            messages: [
              // System prompt contains all context now
              { role: 'system', content: systemPrompt },
              // Simplified user message, maybe just trigger generation
              { role: 'user', content: `Generate the highlight.` }
            ],
            max_tokens: 1024, // Increased max_tokens again to 1024
            temperature: 0.7, // Slightly reduced temperature for more focused output
            stream: false,
          })
        });
        const endTime = Date.now();
        console.log(`[GET /ai/workout-highlight] Grok API call duration: ${endTime - startTime} ms`);


        if (!fetchResponse.ok) {
            const errorBody = await fetchResponse.text();
            console.error(`[GET /ai/workout-highlight] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
            try {
                const parsedError = JSON.parse(errorBody);
                return NextResponse.json({ error: `AI service error: ${parsedError.error?.message || 'Unknown AI error'}` }, { status: 502 });
            } catch {
                return NextResponse.json({ error: "Failed to generate highlight from AI (non-JSON error)" }, { status: 502 });
            }
        }

        const data = await fetchResponse.json();
        // Only log choices/usage for brevity unless debugging is needed
        // console.log("[GET /ai/workout-highlight] Grok Raw Response:", JSON.stringify(data, null, 2));
        console.log("[GET /ai/workout-highlight] Grok Response Usage:", data.usage);


        // 7. Extract and Validate Response from Grok
        let aiHighlight = "Great workout! Keep pushing!"; // Default fallback
        try {
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                 const responseText = data.choices[0].message.content.trim();
                 // Remove potential markdown like quotes or asterisks if the AI adds them
                 aiHighlight = responseText.replace(/^[\\\"\\\'\*]+|[\\\"\\\'\*]+$/g, "").trim();
                 // Basic length check
                 if (aiHighlight.length > 150) { // Approx 30 words limit check
                    console.warn(`[GET /ai/workout-highlight] Generated highlight seems long (${aiHighlight.length} chars), potentially truncating or using fallback.`);
                    // Optional: Truncate or use fallback? For now, use as is.
                 }
             } else {
                 console.error("[GET /ai/workout-highlight] Grok response content is empty or missing.", data);
                 const finishReason = data.choices?.[0]?.finish_reason;
                 if (finishReason && finishReason !== 'stop') {
                     console.warn(`[GET /ai/workout-highlight] Grok generation finished unexpectedly. Reason: ${finishReason}`);
                     aiHighlight = `Workout logged! (${finishReason})`; // Provide some feedback
                 } else {
                     aiHighlight = "Workout logged successfully."; // Generic success if reason is 'stop' but content missing
                 }
             }
        } catch (e) {
             console.error("[GET /ai/workout-highlight] Error processing Grok response:", e, data);
             // Fallback already set
        }

        console.log(`[GET /ai/workout-highlight] Generated AI Highlight for ${userName}: "${aiHighlight}"`);

        // Save highlight to DB
        try {
             await Workout.findByIdAndUpdate(workoutId, { $set: { aiHighlight: aiHighlight } });
             console.log(`[GET /ai/workout-highlight] Successfully saved AI highlight to workout ${workoutId}`);
         } catch (dbUpdateError) {
             console.error(`[GET /ai/workout-highlight] Failed to save AI highlight for workout ${workoutId}:`, dbUpdateError);
             // Don't fail the request, just log the error
         }

        // 8. Return the highlight
        return NextResponse.json({ highlight: aiHighlight });

    } catch (error) {
        console.error("[GET /ai/workout-highlight] Unexpected error in GET handler:", error);
        // Log the specific error instance if possible
        let errorMessage = "Internal server error";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler (Consider Deprecating or Refactoring) ---
// This handler seems less used now that GET fetches by ID.
// Keep it for now, but it might need updates if used.
// ... existing POST handler code ...
// Ensure POST handler also connects to DB if it performs DB operations
// await connectToDb(); // Add if needed in POST - Removed call
// ... rest of POST handler ...

export async function POST(req: NextRequest) {
    try {
        // Check Authentication (Example - adapt if needed)
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        // Example: Fetch user data if needed for POST context (similar to GET)
        // let user: IUser | null = null;
        // try {
        //    user = await User.findById(userId).select('+aiPreferences').lean();
        // } catch { /* handle error */ }

        // Parse request body
        const body = await req.json();
        let validatedRequest: HighlightRequest;
        try {
            validatedRequest = HighlightRequestSchema.parse(body);
        } catch (validationError) {
            return NextResponse.json({ error: "Invalid request body", details: validationError }, { status: 400 });
        }

        // Note: POST handler currently uses userName from request body.
        // You might want to use session.user.name/nickname like in GET.
        const userName = validatedRequest.userName || session.user.nickname || session.user.name || "Fitness Pro";
        const workoutData = validatedRequest.workout; // Contains workout data from body

        // Fetch historical context if needed for POST (similar to GET)
        // This would require workoutData to have userId and type
        let historicalContext: HistoricalContext = {};
        // try {
        //    if (workoutData.userId && workoutData.type) {
        //        // ... add historical fetch logic here ...
        //    }
        // } catch { /* handle error */ }

        // Create Prompt - PASSING NULL/EMPTY for user/history context in POST for now
        const systemPrompt = createHighlightPrompt(
            userName,
            workoutData, // Use workout data from request body
            null, // Pass null for user in POST context for now
            {} // Pass empty object for historical context in POST for now
        );

        // Call Grok API (similar logic as GET)
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
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Generate a workout highlight for ${userName}.` }
            ],
            max_tokens: 1024, // Increased max_tokens for POST handler as well
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
            aiHighlight = `Awesome effort on that ${workoutData.type}, ${userName}! Keep it up!`;
        }

        console.log(`[POST] Generated AI Highlight for ${userName}: "${aiHighlight}"`);

        // 6. Return Response (using 'highlight' key)
        return NextResponse.json({ highlight: aiHighlight });

    } catch (error) {
        console.error("[POST /ai/workout-highlight] Error in POST handler:", error);
        return NextResponse.json(
            { error: "Internal server error in POST" },
            { status: 500 }
        );
    }
} 