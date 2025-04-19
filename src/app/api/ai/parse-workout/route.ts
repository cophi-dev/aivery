import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

// Placeholder type for the structured data we expect from the AI
// TODO: Refine this based on the actual AI output format and form state needs
type ParsedWorkoutData = {
  workoutType?: string; // e.g., "gym", "home_strength"
  workoutName?: string; // e.g., "Morning Strength Session"
  exercises: Array<{
    name: string; // e.g., "Squats"
    notes?: string;
    sets: Array<{
      weight?: string; // e.g., "60"
      reps?: string;   // e.g., "5"
      notes?: string;  // e.g., "RPE 8"
      // Add duration/distance if needed for AI parsing
    }>;
  }>;
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
            workoutType: { type: "string", description: "Infer the activity type (e.g., gym, home_strength, strength, running, cycling). Default to 'strength' if multiple exercise types are present." },
            workoutName: { type: "string", description: "Infer a suitable name for the workout based on the content, or generate one like 'Strength Session'" },
            exercises: {
                type: "array",
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
                                    weight: { type: "string", description: "Weight used for the set. Handle variations like 'bw', '+5kg', '10 lbs'. Extract only the number. Use '0' for bodyweight." },
                                    reps: { type: "string", description: "Number of repetitions performed." },
                                    notes: { type: "string", description: "Any notes specific to this set (e.g., RPE, failure)." },
                                },
                                required: ["reps"]
                            }
                        }
                    },
                    required: ["name", "sets"]
                }
            }
        },
        required: ["exercises"]
    }, null, 2);

    const systemPrompt = `You are an expert workout log parser. Your task is to analyze the provided raw workout log text and extract the information into a structured JSON object adhering strictly to the following schema. ONLY return the JSON object, nothing else.

RULES:
- Parse the structure like "Exercise Name: Set1, Set2, ...". Sets can be separated by commas or semicolons.
- A set is typically defined as "[Sets]x[Reps] [Weight] [Units]" (e.g., "1x5 60 kg", "3x8 bw", "1x10 +5kg").
- Extract the number of sets and create a distinct JSON entry for each set.
- If weight is specified as "bw" or "bodyweight", use "0" for the weight value.
- If weight has a plus sign (e.g., "+5kg", "+10 lbs"), extract only the number ("5", "10").
- Ignore units (kg, lbs) for weight, just return the number as a string.
- Extract reps accurately.
- Capture any notes associated with a set (e.g., "RPE 8", "to failure").
- Capture any notes associated with the whole exercise.
- Infer workoutType and workoutName if possible, otherwise default workoutType to 'strength' if exercises are present.
- Strictly adhere to the JSON schema format provided below. DO NOT add any introduction, explanation, or markdown formatting.

JSON SCHEMA:
\`\`\`json
${jsonSchema}
\`\`\`

EXAMPLE INPUT:
Squats: 1x5 60 kg, 3x5 50 kg; Bench Press: 4x5 60 kg (RPE 8), 1x3 65kg (fail); Pull-ups: 3x6 +5 kg

EXPECTED JSON OUTPUT FOR EXAMPLE:
{
  "workoutType": "strength",
  "workoutName": "Strength Session",
  "exercises": [
    {
      "name": "Squats",
      "sets": [
        { "weight": "60", "reps": "5" },
        { "weight": "50", "reps": "5" },
        { "weight": "50", "reps": "5" },
        { "weight": "50", "reps": "5" }
      ]
    },
    {
      "name": "Bench Press",
      "sets": [
        { "weight": "60", "reps": "5", "notes": "RPE 8" },
        { "weight": "60", "reps": "5", "notes": "RPE 8" },
        { "weight": "60", "reps": "5", "notes": "RPE 8" },
        { "weight": "60", "reps": "5", "notes": "RPE 8" },
        { "weight": "65", "reps": "3", "notes": "fail" }
      ]
    },
    {
      "name": "Pull-ups",
      "sets": [
        { "weight": "5", "reps": "6" },
        { "weight": "5", "reps": "6" },
        { "weight": "5", "reps": "6" }
      ]
    }
  ]
}
`;

    console.log("[AI Parse Workout] Calling Grok API...");
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
            // Pass the raw log text as the user message for parsing
            { role: 'user', content: rawLogText }
        ],
        max_tokens: 2048, // Increased to accommodate potentially large JSON output
        temperature: 0.1, // Low temperature for deterministic JSON parsing
        stream: false,
        // Attempt to enforce JSON output - check if Grok supports this
        // response_format: { type: "json_object" }, 
      })
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[AI Parse Workout] Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
      return NextResponse.json({ error: "Sorry, there was an error communicating with the AI." }, { status: 502 });
    }

    const data = await fetchResponse.json();
    console.log("[AI Parse Workout] Grok Raw Response:", data);

    // TODO: Add token usage update logic here, similar to other API routes?
    // const usage = data.usage;
    // await updateTokenUsage(userId, usage); // Need userId if implementing rate limiting/tracking

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

        const parsedData: ParsedWorkoutData = JSON.parse(jsonToParse);

        // Basic validation (can be enhanced with Zod later)
        if (!parsedData || !Array.isArray(parsedData.exercises)) {
            throw new Error("Parsed JSON is missing the required 'exercises' array.");
        }

        console.log('[AI Parse Workout] Successfully parsed data from AI:', parsedData);
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