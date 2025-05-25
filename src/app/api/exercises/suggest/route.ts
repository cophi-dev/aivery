export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMProvider } from '@/lib/services/llm';
// import Anthropic from "@anthropic-ai/sdk"; // REMOVED

// Helper function to safely extract text from Claude response content
// function getTextFromResponse(content: any): string | undefined { // REMOVED - Not needed for Grok
//   if (!content || !Array.isArray(content) || content.length === 0) {
//     return undefined;
//   }
//
//   const firstBlock = content[0];
//
//   // Handle different content block types safely
//   if (firstBlock && typeof firstBlock === "object") {
//     if ("text" in firstBlock) {
//       return firstBlock.text as string;
//     }
//   }
//
//   return undefined;
// }

// Define exercise data type
interface ExerciseDetails {
  description: string;
  muscleGroups: string[];
}

// Initialize Anthropic client // REMOVED
// const anthropic = process.env.ANTHROPIC_API_KEY // REMOVED
//   ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) // REMOVED
//   : null; // REMOVED

// Common exercises database
const COMMON_EXERCISES: Record<string, ExerciseDetails> = {
  "bench press": {
    description:
      "A compound upper-body exercise where you press weight upward while lying on a bench",
    muscleGroups: ["chest", "shoulders", "triceps"],
  },
  squat: {
    description:
      "A compound lower-body exercise where you bend your knees and hips to lower your body",
    muscleGroups: ["quadriceps", "glutes", "hamstrings", "core"],
  },
  deadlift: {
    description:
      "A compound exercise that targets multiple muscle groups by lifting a weight from the floor",
    muscleGroups: ["back", "glutes", "hamstrings", "traps", "core"],
  },
  "pull up": {
    description: "An upper-body exercise where you pull your body up to a bar",
    muscleGroups: ["back", "biceps", "forearms"],
  },
  "push up": {
    description:
      "A bodyweight exercise performed face-down by raising and lowering the body using the arms",
    muscleGroups: ["chest", "shoulders", "triceps", "core"],
  },
  "overhead press": {
    description:
      "A shoulder exercise where you press weight overhead while standing or seated",
    muscleGroups: ["shoulders", "triceps", "traps", "core"],
  },
  "bicep curl": {
    description:
      "An isolation exercise that targets the biceps by curling weight towards the shoulders",
    muscleGroups: ["biceps", "forearms"],
  },
  "tricep extension": {
    description:
      "An isolation exercise that targets the triceps by extending the elbow joint",
    muscleGroups: ["triceps"],
  },
  "lateral raise": {
    description:
      "A shoulder isolation exercise performed by raising weights to the side",
    muscleGroups: ["shoulders", "traps"],
  },
  "leg press": {
    description:
      "A compound lower-body exercise performed on a machine where you push weight away with your legs",
    muscleGroups: ["quadriceps", "glutes", "hamstrings"],
  },
};

// Infer exercise details using AI (Now using Grok)
async function inferExerciseDetails(exerciseName: string): Promise<ExerciseDetails | null> { // Adjusted return type
  const provider = (process.env.LLM_PROVIDER_EXERCISE as LLMProvider) || 'grok';
  const model = process.env.LLM_MODEL_EXERCISE || 'grok-3-mini';
  if (!process.env.GROK_API_KEY && provider === 'grok') {
    console.log("[inferExerciseDetails] GROK_API_KEY not configured");
    return null;
  }

  try {
    const systemPrompt = `Act as a fitness expert identifying exercise details.

OUTPUT ONLY THE FOLLOWING JSON STRUCTURE, NOTHING ELSE:
{
  "description": "Brief exercise description (1-2 sentences max)",
  "muscleGroups": ["primary_muscle", "secondary_muscle_1", "secondary_muscle_2"]
}

- Use anatomically correct muscle groups (e.g., 'pectoralis major', 'latissimus dorsi', 'quadriceps femoris').
- Be concise.`;

    const userPrompt = `Exercise: ${exerciseName}`;

    console.log(`[inferExerciseDetails] Using provider: ${provider}, model: ${model} for: "${exerciseName}"`);
    const data = await callLLM({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 150,
      temperature: 0.3,
      stream: false,
    });
    console.log("[inferExerciseDetails] LLM Raw Response:", data);
    let resultText: string | null = null;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        resultText = data.choices[0].message.content.trim();
    } else {
        console.warn("[inferExerciseDetails] Unexpected LLM response structure:", data);
        return null;
    }

    if (resultText) {
      try {
        // Sometimes the model might still wrap the JSON in markdown, try to extract
        const jsonMatch = resultText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        const jsonToParse = jsonMatch ? jsonMatch[1] : resultText;

        const parsedResult: ExerciseDetails = JSON.parse(jsonToParse);
        // Basic validation
        if (parsedResult && typeof parsedResult.description === 'string' && Array.isArray(parsedResult.muscleGroups)) {
             console.log(`[inferExerciseDetails] Successfully parsed LLM result for "${exerciseName}"`);
             return parsedResult;
        } else {
            console.error("[inferExerciseDetails] Parsed JSON has incorrect structure:", parsedResult);
            return null;
        }
      } catch (e) {
        console.error(`[inferExerciseDetails] Failed to parse LLM JSON response for "${exerciseName}":`, e);
        console.error("[inferExerciseDetails] Raw response text:", resultText);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error(`[inferExerciseDetails] Error calling LLM for "${exerciseName}":`, error);
    return null;
  }
}

// Normalize exercise name for lookup
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

// Look up exercise in common database
function findInCommonExercises(exerciseName: string) {
  const normalized = normalizeExerciseName(exerciseName);

  // Exact match
  if (COMMON_EXERCISES[normalized]) {
    return COMMON_EXERCISES[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(COMMON_EXERCISES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Set cache control headers to prevent caching
    const headers = new Headers();
    headers.append(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    headers.append("Pragma", "no-cache");
    headers.append("Expires", "0");

    const body = await req.json();
    const { exerciseName } = body;

    if (!exerciseName) {
      return NextResponse.json(
        { error: "Exercise name is required" },
        { status: 400, headers },
      );
    }

    // Log activity to help with debugging
    console.log(
      `[EXERCISE-SUGGEST] Suggesting details for: "${exerciseName}" at ${new Date().toISOString()}`,
    );

    // Try to find in common exercises first
    const commonMatch = findInCommonExercises(exerciseName);
    if (commonMatch) {
      return NextResponse.json(
        {
          description: commonMatch.description,
          muscleGroups: commonMatch.muscleGroups,
          source: "database",
        },
        { headers },
      );
    }

    // Fall back to AI inference
    const aiResult = await inferExerciseDetails(exerciseName);
    if (aiResult) {
      return NextResponse.json(
        {
          ...aiResult,
          source: "ai",
        },
        { headers },
      );
    }

    // If all fails, provide generic response
    return NextResponse.json(
      {
        description: `Custom strength exercise: ${exerciseName}`,
        muscleGroups: ["custom"],
        source: "generic",
      },
      { headers },
    );
  } catch (error) {
    console.error("Error in exercise suggestion API:", error);

    const headers = new Headers();
    headers.append(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );

    return NextResponse.json(
      { error: "Failed to suggest exercise details" },
      { status: 500, headers },
    );
  }
}
