import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { callLLM, LLMProvider } from '@/lib/services/llm';

// Placeholder type for the structured data we expect from the AI
// TODO: Refine this based on the actual AI output format and form state needs
type ParsedWorkoutData = {
  workoutType?: string; // e.g., "gym", "home_strength", "running"
  workoutName?: string; // e.g., "Morning Strength Session", "10k Run"
  workoutDate?: string; // NEW: Date of the workout (YYYY-MM-DD format)
  exercises: Array<{ // Keep empty array [] for non-strength/non-exercise specific logs
    name: string; // e.g., "Squats"
    notes?: string;
    sets: Array<{
      weight?: string; // e.g., "60"
      reps?: string;   // e.g., "5"
      notes?: string;  // e.g., "RPE 8"
      // Add duration/distance if needed for AI parsing
    }>;
  }>;
  // NEW: Add cardio details
  cardioDetails?: {
      distance?: number; // in km
      duration?: number; // in minutes
  };
  // Add other potential top-level fields if needed (e.g., date?)
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawLogText = body.logText;

    if (!rawLogText || typeof rawLogText !== 'string' || rawLogText.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid logText in request body' }, { status: 400 });
    }

    console.log('Received raw log text:', rawLogText);

    // --- Grok API Interaction ---
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
        console.error("[AI Parse Workout] GROK_API_KEY not configured.");
        return NextResponse.json({ error: "AI service is unavailable due to configuration issues." }, { status: 503 });
    }

    // Define the desired JSON output structure for the AI
    const jsonSchema = JSON.stringify({
        type: "object",
        properties: {
            workoutType: { type: "string", description: "Infer the activity type (e.g., strength, running, cycling, swimming, walking, yoga). Use 'strength' for gym/home strength. If multiple types seem present, prioritize the most specific (e.g., 'running' over 'strength' if a run is mentioned alongside exercises)." },
            workoutName: { type: "string", description: "Infer a suitable name (e.g., 'Morning Run', 'Leg Day'). If distance/duration present, use that (e.g., '10k Run')." },
            // NEW: Add workoutDate property
            workoutDate: { type: "string", format: "date", description: "Infer the date of the workout. Look for explicit dates (e.g., 'Mar 6', '6. März', '2024-03-06'), relative dates ('Today', 'Yesterday'). If year is missing, assume the current year. Format as YYYY-MM-DD." },
            // Make exercises optional, default to empty array if not applicable
            exercises: {
                type: "array",
                description: "List of strength exercises performed. Leave empty [] for pure cardio activities unless specific intervals are logged.",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The name of the exercise (e.g., Squats, Bench Press)." },
                        notes: { type: "string", description: "Any specific notes mentioned for the entire exercise." },
                        sets: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    weight: { type: "string", description: "Weight used for the set (number only). Use '0' for bodyweight. Extract number even if units (kg/lbs) or '+' are present." },
                                    reps: { type: "string", description: "Number of repetitions performed." },
                                    notes: { type: "string", description: "Any notes specific to this set (e.g., RPE, failure)." },
                                },
                                required: ["reps"] // Weight is not strictly required (bodyweight)
                            }
                        }
                    },
                    required: ["name", "sets"]
                },
                default: [] // Default to empty array
            },
            // NEW: Add cardioDetails block
            cardioDetails: {
                type: "object",
                description: "Details for cardio activities like running, cycling, swimming. Only populate if distance or duration is mentioned.",
                properties: {
                    distance: { type: "number", description: "Distance covered, converted to kilometers (km). E.g., '5 miles' becomes 8.05. '10k' becomes 10." },
                    duration: { type: "number", description: "Total duration of the activity, converted to minutes. E.g., '1 hour' becomes 60. '1h 30min' becomes 90." }
                },
                // Not required, only include if applicable
            }
        },
        // Only exercises is technically required, but often workoutType is inferrable
        required: ["exercises"] // Keep exercises required, but it can be empty
    }, null, 2);

    const systemPrompt = `You are an expert workout log parser. Your task is to analyze the provided raw workout log text and extract the information into a structured JSON object adhering strictly to the following schema. ONLY return the JSON object, nothing else. No introductory text, no markdown formatting like \`\`\`json ... \`\`\`.

RULES:
*   **Output Format:** Strictly JSON. No extra text or markdown.
*   **Workout Date:** Infer the 'workoutDate' if mentioned. Look for explicit dates (e.g., 'Mar 6', '6. März', '2024-03-06') or relative terms ('Today', 'Yesterday'). If a year isn't specified, assume the current year. Return the date in **YYYY-MM-DD** format. If no date is mentioned, omit the field.
*   **Workout Type:** Infer 'workoutType' (e.g., 'running', 'strength', 'cycling'). Prioritize specific cardio types if mentioned. Default to 'strength' if only set-based exercises are found.
*   **Workout Name:** Create a concise 'workoutName'. If distance/duration given (e.g., '10k run in 50 min'), use that (e.g., '10k Run'). Otherwise, infer (e.g., 'Strength Session', 'Morning Swim').
*   **Cardio Parsing:**
    *   If the log describes a cardio activity (run, cycle, swim, walk) with distance and/or duration, populate the 'cardioDetails' object.
    *   Convert distance to **kilometers (km)** (e.g., '5 miles' -> 8.05, '10k' -> 10).
    *   Convert duration to **total minutes** (e.g., '1 hour' -> 60, '1h 30min' -> 90, '50 min' -> 50).
    *   If it's primarily cardio, the 'exercises' array should usually be empty [].
*   **Strength Exercise Parsing:**
    *   Parse structure like "Exercise Name: Set1, Set2...". Sets are separated by commas or semicolons.
    *   A set is often "[Sets]x[Reps] [Weight] [Units]" (e.g., "1x5 60 kg", "3x8 bw", "1x10 +5kg").
    *   Create a distinct JSON entry in the 'exercises' array for each *exercise*, and within that, a distinct entry in 'sets' for *each individual set* (e.g., "3x5 50kg" becomes 3 set entries).
    *   Extract 'weight' as a string number only. Ignore units (kg, lbs). Use "0" for "bw" or bodyweight. Extract number if '+' is present (e.g., "+5kg" -> "5").
    *   Extract 'reps' accurately as a string.
    *   Capture 'notes' for sets or the whole exercise.
*   **Consistency:** If both cardio and strength seem present, try to determine the primary 'workoutType' and populate fields accordingly. If unsure, default to 'strength' and parse exercises.

JSON SCHEMA:
${jsonSchema}

EXAMPLE INPUT 1 (Strength with Date):
6. März: Gym, Squats: 1x5 60 kg, 3x5 50 kg; Bench Press: 4x5 60 kg (RPE 8)

EXPECTED JSON OUTPUT 1 (Assuming current year is 2024):
{
  "workoutDate": "2024-03-06",
  "workoutType": "strength",
  "workoutName": "Strength Session",
  "exercises": [
    {"name": "Squats", "sets": [{"weight": "60", "reps": "5"},{"weight": "50", "reps": "5"},{"weight": "50", "reps": "5"},{"weight": "50", "reps": "5"}]},
    {"name": "Bench Press", "sets": [{"weight": "60", "reps": "5", "notes": "RPE 8"},{"weight": "60", "reps": "5", "notes": "RPE 8"},{"weight": "60", "reps": "5", "notes": "RPE 8"},{"weight": "60", "reps": "5", "notes": "RPE 8"}]}
  ]
}

EXAMPLE INPUT 2 (Cardio):
Yesterday: 10 km run in 50 min

EXPECTED JSON OUTPUT 2 (Assuming today is 2024-04-30):
{
  "workoutDate": "2024-04-29",
  "workoutType": "running",
  "workoutName": "10k Run",
  "cardioDetails": {
    "distance": 10,
    "duration": 50
  },
  "exercises": []
}

EXAMPLE INPUT 3 (Cardio with Notes):
Easy 5 mile cycle, felt good. Took 1 hour 5 mins.

EXPECTED JSON OUTPUT 3:
{
  "workoutType": "cycling",
  "workoutName": "5 Mile Cycle",
  "cardioDetails": {
    "distance": 8.05,
    "duration": 65
  },
  "exercises": [],
  "notes": "Easy cycle, felt good." // Example: Allow top-level notes if schema supported, otherwise omit.
}
`;

    console.log("[AI Parse Workout] Calling Grok API with updated prompt/schema...");

    // --- NEW: Remove potential colon after date before sending to AI ---
    const cleanedLogText = rawLogText.replace(/(\d{1,2}\.\s+\w+):/, '$1'); 
    console.log('[AI Parse Workout] Cleaned log text for AI:', cleanedLogText);
    // --- END NEW ---

    // Use env vars for provider/model
    const provider = (process.env.LLM_PROVIDER_PARSE as LLMProvider) || 'grok';
    const model = process.env.LLM_MODEL_PARSE || 'grok-3-mini';
    console.log(`[AI Parse Workout] Using provider: ${provider}, model: ${model}`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanedLogText }
      ],
      max_tokens: 2048,
      temperature: 0.1,
      stream: false,
    });
    console.log('[AI Parse Workout] LLM Raw Response:', data);

    // Replace fetchResponse error handling with data error handling if needed
    if (!data || !data.choices) {
      console.error(`[AI Parse Workout] LLM response missing choices or is invalid`, data);
      return NextResponse.json({ error: "Sorry, there was an error communicating with the AI." }, { status: 502 });
    }

    let parsedJsonString: string | null = null;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        parsedJsonString = data.choices[0].message.content.trim();
    } else {
        console.error("[AI Parse Workout] Grok response content is empty or not as expected", data);
        return NextResponse.json({ error: "AI returned an unexpected response structure." }, { status: 500 });
    }

    // Add null check here before proceeding
    if (parsedJsonString === null) {
        console.error("[AI Parse Workout] Extracted JSON string is null.");
        return NextResponse.json({ error: "AI failed to return parseable content." }, { status: 500 });
    }

    try {
        // Attempt to parse the JSON string returned by the AI
        // Sometimes the AI might wrap the JSON in markdown, try to extract
        const jsonMatch = parsedJsonString.match(/```(?:json)?\n?([^\s\S]*?)\n?```/);
        const jsonToParse = jsonMatch ? jsonMatch[1] : parsedJsonString;

        let parsedData: ParsedWorkoutData;
        try {
           parsedData = JSON.parse(jsonToParse);
        } catch (innerParseError) {
          console.error("[AI Parse Workout] Initial JSON parse failed. Raw string:", jsonToParse);
          throw innerParseError; // Re-throw if basic parsing fails
        }

        // Basic validation (can be enhanced with Zod later)
        if (!parsedData || !Array.isArray(parsedData.exercises)) {
            throw new Error("Parsed JSON is missing the required 'exercises' array (even if empty).");
        }
        if (parsedData.cardioDetails && (typeof parsedData.cardioDetails !== 'object' || parsedData.cardioDetails === null)) {
            throw new Error("Parsed JSON has invalid 'cardioDetails' structure.");
        }
        if (parsedData.cardioDetails?.distance && typeof parsedData.cardioDetails.distance !== 'number') {
             throw new Error("Parsed JSON 'cardioDetails.distance' must be a number.");
        }
         if (parsedData.cardioDetails?.duration && typeof parsedData.cardioDetails.duration !== 'number') {
             throw new Error("Parsed JSON 'cardioDetails.duration' must be a number.");
        }
        // NEW: Validate workoutDate format if present
        if (parsedData.workoutDate && !/^\d{4}-\d{2}-\d{2}$/.test(parsedData.workoutDate)) {
            console.warn(`[AI Parse Workout] Parsed workoutDate "${parsedData.workoutDate}" does not match YYYY-MM-DD format. Attempting to continue, but might cause issues.`);
            // Optionally, try to reformat or discard it here if needed.
            // For now, just warn and proceed.
        }

        // Log the full parsed data structure
        console.log('[AI Parse Workout] Successfully parsed data from AI:', JSON.stringify(parsedData, null, 2));
        return NextResponse.json(parsedData);
       
    } catch (parseError) {
        console.error("[AI Parse Workout] Failed to parse JSON response from Grok:", parseError);
        console.error("[AI Parse Workout] Raw response string:", parsedJsonString);
        return NextResponse.json({ error: "AI returned invalid data format.", details: (parseError as Error).message }, { status: 500 });
    }
    // --- End Grok API Interaction ---

  } catch (error) {
    console.error('Error processing AI workout log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to parse workout log', details: errorMessage }, { status: 500 });
  }
}

// Optional: Add GET or other handlers if needed, though POST is primary for this.
// export async function GET(request: NextRequest) { ... } 