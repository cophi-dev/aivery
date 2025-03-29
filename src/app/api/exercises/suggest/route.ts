import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define exercise data type
interface ExerciseDetails {
  description: string;
  muscleGroups: string[];
}

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

// Common exercises database
const COMMON_EXERCISES: Record<string, ExerciseDetails> = {
  "bench press": {
    description: "A compound upper-body exercise where you press weight upward while lying on a bench",
    muscleGroups: ["chest", "shoulders", "triceps"]
  },
  "squat": {
    description: "A compound lower-body exercise where you bend your knees and hips to lower your body",
    muscleGroups: ["quadriceps", "glutes", "hamstrings", "core"]
  },
  "deadlift": {
    description: "A compound exercise that targets multiple muscle groups by lifting a weight from the floor",
    muscleGroups: ["back", "glutes", "hamstrings", "traps", "core"]
  },
  "pull up": {
    description: "An upper-body exercise where you pull your body up to a bar",
    muscleGroups: ["back", "biceps", "forearms"]
  },
  "push up": {
    description: "A bodyweight exercise performed face-down by raising and lowering the body using the arms",
    muscleGroups: ["chest", "shoulders", "triceps", "core"]
  },
  "overhead press": {
    description: "A shoulder exercise where you press weight overhead while standing or seated",
    muscleGroups: ["shoulders", "triceps", "traps", "core"]
  },
  "bicep curl": {
    description: "An isolation exercise that targets the biceps by curling weight towards the shoulders",
    muscleGroups: ["biceps", "forearms"]
  },
  "tricep extension": {
    description: "An isolation exercise that targets the triceps by extending the elbow joint",
    muscleGroups: ["triceps"]
  },
  "lateral raise": {
    description: "A shoulder isolation exercise performed by raising weights to the side",
    muscleGroups: ["shoulders", "traps"]
  },
  "leg press": {
    description: "A compound lower-body exercise performed on a machine where you push weight away with your legs",
    muscleGroups: ["quadriceps", "glutes", "hamstrings"]
  }
};

// Infer exercise details using AI
async function inferExerciseDetails(exerciseName: string) {
  if (!openai) {
    console.log('OpenAI API key not configured');
    return null;
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a fitness expert specializing in exercise identification and categorization.
          Your task is to identify the primary muscle groups worked and provide a brief description for a given exercise.
          Respond in JSON format only with fields "description" and "muscleGroups" (an array of strings, all lowercase).`
        },
        {
          role: "user",
          content: `Exercise name: ${exerciseName}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 150,
    });
    
    const result = response.choices[0].message.content;
    if (result) {
      try {
        return JSON.parse(result);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
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
    const body = await req.json();
    const { exerciseName } = body;
    
    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 });
    }
    
    // Try to find in common exercises first
    const commonMatch = findInCommonExercises(exerciseName);
    if (commonMatch) {
      return NextResponse.json({
        description: commonMatch.description,
        muscleGroups: commonMatch.muscleGroups,
        source: 'database'
      });
    }
    
    // Fall back to AI inference
    const aiResult = await inferExerciseDetails(exerciseName);
    if (aiResult) {
      return NextResponse.json({
        ...aiResult,
        source: 'ai'
      });
    }
    
    // If all fails, provide generic response
    return NextResponse.json({
      description: `Custom strength exercise: ${exerciseName}`,
      muscleGroups: ["custom"],
      source: 'generic'
    });
    
  } catch (error) {
    console.error('Error in exercise suggestion API:', error);
    return NextResponse.json(
      { error: 'Failed to suggest exercise details' },
      { status: 500 }
    );
  }
} 