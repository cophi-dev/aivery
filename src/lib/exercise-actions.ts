"use server"

import { revalidatePath } from "next/cache"
import {
  getAllExercises,
  getExercisesByCategory,
  getExercisesByMuscleGroup,
  getExerciseById,
  getExerciseByName,
  createExercise,
  updateExercise,
  deleteExercise,
  searchAllExercisesByName,
  getAllExercisesFromDB as getAllExercisesFromDBRepo,
  getUsedExercises as getUsedExercisesRepo,
} from "./db/repositories/exerciseRepository"
import type { ExerciseData, WorkoutExerciseData } from "@/types/db"
import { getCurrentUser } from "./auth"
import { 
  getWorkoutExercisesByExerciseId 
} from "@/lib/db/repositories/workoutExerciseRepository"
import { getSession } from "next-auth/react"
import { headers } from 'next/headers'
import { generateImage } from './openai-actions'
import { saveImageToR2, deleteImageFromR2 } from './r2-actions'

// Fetch exercises, potentially filtered by tags
export async function fetchExercises(tags?: string): Promise<ExerciseData[]> {
  try {
    const baseUrl = getApiBaseUrl(); // Get base URL (http://localhost:3000 or production URL)
    const url = new URL(`${baseUrl}/api/exercises`);

    // Add tags query parameter if provided
    if (tags) {
      url.searchParams.append('tags', tags);
    }

    console.log(`Fetching exercises from API: ${url.toString()}`);

    // NOTE: We are calling our *own* API endpoint here.
    // This endpoint handles authentication internally.
    // We need to ensure cookies/session are forwarded if auth relies on them,
    // but since it's a server-to-server call from an action, it might just work
    // or we might need to pass auth explicitly if the API requires it beyond the session check.
    // For simplicity now, assume the session check within the API route is sufficient for server-side calls.
    
    // Use fetch API for server-side actions
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // Add headers if necessary, e.g., Content-Type, but likely not needed for GET
        // We might need to forward authentication headers/cookies if the API route requires it
        // beyond the getServerSession check. Let's omit for now.
        'cookie': headers().get('cookie') ?? '',
      },
      // Ensure Next.js doesn't cache this aggressively if data changes often
      cache: 'no-store', 
    });

    if (!response.ok) {
      // Log detailed error info
      const errorBody = await response.text();
      console.error(`Error fetching exercises API: ${response.status} ${response.statusText}`, errorBody);
      // Throw an error or return empty array based on desired handling
      // throw new Error(`Failed to fetch exercises: ${response.status}`);
      return []; // Return empty array on error
    }

    const exercises: ExerciseData[] = await response.json();
    return exercises;

  } catch (error) {
    console.error("Error in fetchExercises action:", error);
    return []; // Return empty array on error
  }
}

// Fetch exercises by category
export async function fetchExercisesByCategory(category: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByCategory(category);
  } catch (error) {
    console.error(`Error fetching exercises by category ${category}:`, error);
    return []; 
  }
}

// Fetch exercises by muscle group
export async function fetchExercisesByMuscleGroup(muscleGroup: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByMuscleGroup(muscleGroup);
  } catch (error) {
    console.error(`Error fetching exercises by muscle group ${muscleGroup}:`, error);
    return []; 
  }
}

// Fetch a single exercise
export async function fetchExercise(id: string): Promise<ExerciseData | null> {
  try {
    return await getExerciseById(id);
  } catch (error) {
    console.error(`Error fetching exercise ${id}:`, error);
    return null;
  }
}

// Fetch a single exercise by name
export async function fetchExerciseByName(name: string): Promise<ExerciseData | null> {
  try {
    return await getExerciseByName(name);
  } catch (error) {
    console.error(`Error fetching exercise by name ${name}:`, error);
    return null;
  }
}

// Create a new exercise
export async function createExerciseAction(exerciseData: Partial<ExerciseData>): Promise<ExerciseData | null> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check if an exercise with the same name already exists
    const existingExercise = await getExerciseByName(exerciseData.name || "");
    if (existingExercise) {
      throw new Error("An exercise with this name already exists");
    }

    const newExercise = await createExercise(exerciseData);
    
    revalidatePath("/exercises");
    revalidatePath(`/exercises/${newExercise._id}`);
    revalidatePath("/workouts/new");
    
    return newExercise;
  } catch (error) {
    console.error("Error creating exercise:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create exercise");
  }
}

// Update an existing exercise
export async function updateExerciseAction(id: string, exerciseData: Partial<ExerciseData>): Promise<ExerciseData | null> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    // If name is changing, check if the new name already exists for a different exercise
    if (exerciseData.name) {
      const existingExercise = await getExerciseByName(exerciseData.name);
      if (existingExercise && existingExercise._id !== id) {
        throw new Error("An exercise with this name already exists");
      }
    }

    const updatedExercise = await updateExercise(id, exerciseData);
    
    revalidatePath("/exercises");
    revalidatePath(`/exercises/${id}`);
    revalidatePath("/workouts/new");
    
    return updatedExercise;
  } catch (error) {
    console.error(`Error updating exercise ${id}:`, error);
    throw new Error(error instanceof Error ? error.message : `Failed to update exercise ${id}`);
  }
}

// Delete an exercise
export async function deleteExerciseAction(id: string): Promise<boolean> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    const success = await deleteExercise(id);
    
    revalidatePath("/exercises");
    revalidatePath(`/exercises/${id}`);
    revalidatePath("/workouts/new");
    
    return success;
  } catch (error) {
    console.error(`Error deleting exercise ${id}:`, error);
    throw new Error(`Failed to delete exercise ${id}`);
  }
}

// Function to get exercise history
export async function getExerciseHistory(exerciseId: string): Promise<WorkoutExerciseData[]> {
  try {
    const workoutExercises = await getWorkoutExercisesByExerciseId(exerciseId)
    return workoutExercises
  } catch (error) {
    console.error("Error fetching exercise history:", error)
    throw new Error("Failed to fetch exercise history")
  }
}

// Search all exercises by name for autocomplete/lookup
export async function searchAllExercisesAction(nameQuery: string): Promise<ExerciseData[]> {
  try {
    // Basic validation
    if (!nameQuery || nameQuery.trim().length < 2) {
      return [];
    }
    // No auth check needed here typically, as exercise names aren't usually sensitive
    // Add auth check if exercise data visibility should be restricted per user
    return await searchAllExercisesByName(nameQuery);
  } catch (error) {
    console.error(`Error searching exercises action with query '${nameQuery}':`, error);
    return []; // Return empty array on error to avoid breaking the UI
  }
}

// --- NEW Action to fetch ALL exercises ---
export async function fetchAllExercisesAction(): Promise<ExerciseData[]> {
  try {
    // No auth check needed here typically, adjust if needed
    return await getAllExercises();
  } catch (error) {
    console.error("Error fetching all exercises action:", error);
    return []; // Return empty array on error
  }
}
// --- END NEW Action --- 

// Ensure getApiBaseUrl exists or define it
function getApiBaseUrl(): string {
    // Example implementation (adjust based on your setup)
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
        return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }    
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Fallback for local dev
} 

// --- NEW ACTION: Generate and save exercise image --- 
export async function generateAndSaveExerciseImage(
  exerciseId: string,
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  console.log(`[Action] generateAndSaveExerciseImage called for exercise ID: ${exerciseId}`);

  // 1. Check for API Key
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.error("[Action generateAndSaveExerciseImage] GROK_API_KEY environment variable not set.");
    return { success: false, error: "Image generation API key is not configured." };
  }

  // 2. Call Image Generation API
  const apiUrl = "https://api.x.ai/v1/images/generations";
  try {
    console.log(`[Action generateAndSaveExerciseImage] Sending request to ${apiUrl} with prompt: "${prompt}"`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "grok-2-image",
        prompt: prompt,
        // Add other parameters like size if needed/available
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Action generateAndSaveExerciseImage] API Error (${response.status}): ${errorBody}`);
      return { success: false, error: `Image generation failed: ${response.statusText} (${errorBody})` };
    }

    const result = await response.json();
    console.log("[Action generateAndSaveExerciseImage] API Response:", JSON.stringify(result));

    // 3. Extract Image URL (adjust based on actual API response structure)
    const imageUrl = result?.data?.[0]?.url; 
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error("[Action generateAndSaveExerciseImage] Could not extract image URL from API response:", result);
      return { success: false, error: "Failed to extract image URL from generation response." };
    }
    console.log(`[Action generateAndSaveExerciseImage] Generated image URL: ${imageUrl}`);

    // 4. Update Exercise in DB
    // We'll use $push to add the image URL to the images array
    const updatedExercise = await updateExercise(exerciseId, { 
      $push: { images: imageUrl } 
    } as any); // Use 'as any' for MongoDB operators if type doesn't directly support it

    if (!updatedExercise) {
      console.error(`[Action generateAndSaveExerciseImage] Failed to update exercise ${exerciseId} in DB.`);
      // Optionally try to delete the generated image if DB update fails?
      return { success: false, error: "Failed to save generated image URL to the database." };
    }

    console.log(`[Action generateAndSaveExerciseImage] Successfully added image URL to exercise ${exerciseId}.`);

    // 5. Revalidate Path
    revalidatePath(`/exercises/${exerciseId}`);

    return { success: true, imageUrl: imageUrl };

  } catch (error: any) {
    console.error("[Action generateAndSaveExerciseImage] Error:", error);
    return { success: false, error: error.message || "An unexpected error occurred during image generation." };
  }
}
// --- END NEW ACTION --- 

// Fetch ALL Exercises Action (NEW)
export async function getAllExercisesFromDB(): Promise<ExerciseData[]> {
  try {
    return await getAllExercisesFromDBRepo();
  } catch (error) {
    console.error(`Action Error - getAllExercisesFromDB:`, error);
    return []; // Return empty array on error
  }
}

// Fetch USED Exercises Action (NEW - wraps renamed repo function)
export async function getUsedExercises(): Promise<ExerciseData[]> {
  try {
    return await getUsedExercisesRepo();
  } catch (error) {
    console.error(`Action Error - getUsedExercises:`, error);
    return []; // Return empty array on error
  }
}

// Update Exercise Action
export async function updateExerciseAction(
  id: string, 
  exerciseData: Partial<ExerciseData>
): Promise<ExerciseData | null> {
  try {
    const updatedExercise = await updateExercise(id, exerciseData);
    if (updatedExercise) {
      revalidatePath("/exercises");       // Revalidate list page
      revalidatePath(`/exercises/${id}`); // Revalidate detail page
    }
    return updatedExercise;
  } catch (error) {
    console.error(`Action Error - updateExerciseAction (ID: ${id}):`, error);
    throw new Error("Failed to update exercise via action.");
  }
}

// Delete Exercise Action
export async function deleteExerciseAction(id: string): Promise<boolean> {
  let imageUrlToDelete: string | undefined = undefined;
  try {
    // Optionally, fetch the exercise first to get the image URL if you need to delete it
    const exerciseToDelete = await getExerciseById(id);
    imageUrlToDelete = exerciseToDelete?.images?.[0]; // Assuming first image

    const success = await deleteExercise(id);
    if (success) {
      revalidatePath("/exercises");
       // Optionally, delete the associated image from R2
      // if (imageUrlToDelete) {
      //   try {
      //     await deleteImageFromR2(imageUrlToDelete); 
      //     console.log(`Deleted associated image from R2: ${imageUrlToDelete}`);
      //   } catch (r2Error) {
      //     console.error(`Failed to delete image from R2 (${imageUrlToDelete}):`, r2Error);
      //     // Decide if you want to surface this error or just log it
      //   }
      // }
    }
    return success;
  } catch (error) {
    console.error(`Action Error - deleteExerciseAction (ID: ${id}):`, error);
    throw new Error("Failed to delete exercise via action.");
  }
}

// Fetch Exercises by Category Action
export async function getExercisesByCategory(category: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByCategory(category);
  } catch (error) {
    console.error(`Action Error - getExercisesByCategory (Category: ${category}):`, error);
    return [];
  }
}

// Fetch Exercises by Muscle Group Action
export async function getExercisesByMuscleGroup(muscleGroup: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByMuscleGroup(muscleGroup);
  } catch (error) {
    console.error(`Action Error - getExercisesByMuscleGroup (Muscle: ${muscleGroup}):`, error);
    return [];
  }
}

// Search All Exercises Action
export async function searchAllExercisesByNameAction(nameQuery: string): Promise<ExerciseData[]> {
   try {
     return await searchAllExercisesByName(nameQuery);
   } catch (error) {
     console.error(`Action Error - searchAllExercisesByNameAction (Query: ${nameQuery}):`, error);
     return []; // Return empty array on error
   }
}

// Generate and Save Exercise Image Action
export async function generateAndSaveExerciseImage(exerciseId: string, prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  if (!exerciseId) return { success: false, error: "Exercise ID is required." };
  if (!prompt) return { success: false, error: "Prompt is required." };

  try {
    // 1. Generate Image using OpenAI
    const generationResult = await generateImage(prompt);
    if (!generationResult.success || !generationResult.imageUrl) {
      return { success: false, error: generationResult.error || "Failed to generate image." };
    }

    const generatedImageUrl = generationResult.imageUrl;

    // 2. Save Image URL to R2 (or just get the final URL if generateImage handles upload)
    // Assuming generateImage returns a temporary URL and we need to save it permanently
    // If generateImage already saves to R2 and returns the final URL, skip this
    // For demonstration, let's assume generateImage gives a URL we need to process/store
    // const r2Result = await saveImageToR2(generatedImageUrl, `${exerciseId}-${Date.now()}.png`);
    // if (!r2Result.success || !r2Result.imageUrl) {
    //   return { success: false, error: r2Result.error || "Failed to save image to storage." };
    // }
    // const finalImageUrl = r2Result.imageUrl;
    const finalImageUrl = generatedImageUrl; // Use direct URL if generateImage handles storage

    // 3. Update Exercise Document in DB
    const updatedExercise = await updateExercise(exerciseId, { 
      images: [finalImageUrl] // Replace or add to existing images array as needed
    });

    if (!updatedExercise) {
      // Optional: Try to delete the uploaded image if DB update fails
      // await deleteImageFromR2(finalImageUrl).catch(err => console.error("Failed to cleanup R2 image after DB update failure:", err));
      return { success: false, error: "Failed to update exercise with new image URL." };
    }
    
    revalidatePath(`/exercises/${exerciseId}`); // Revalidate the specific exercise page

    return { success: true, imageUrl: finalImageUrl };

  } catch (error: any) {
    console.error(`Action Error - generateAndSaveExerciseImage (ID: ${exerciseId}):`, error);
    return { success: false, error: error.message || "An unexpected error occurred." };
  }
}

// --- Helper / Legacy Functions (Consider removal if not used) ---

// Simple wrapper for getting all exercises - might be legacy if categories are used
// export async function fetchExercises(tags?: string): Promise<ExerciseData[]> {
//   // This might need updating based on whether you filter by tags server-side
//   // or fetch all and filter client-side.
//   console.log("fetchExercises called with tags:", tags); // Log tags
//   try {
//     // Currently fetches ALL exercises, ignoring tags for now
//     // Adapt this if server-side tag filtering is implemented
//     return await getAllExercisesFromDBRepo(); 
//   } catch (error) {
//     console.error("Action Error - fetchExercises:", error);
//     return [];
//   }
// } 