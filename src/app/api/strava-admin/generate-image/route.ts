import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import WorkoutModel from "@/lib/db/models/workout";
import OpenAI from "openai";
import mongoose from "mongoose";
// Import the new prompt generation library
import { generatePrompt, formatDuration } from "@/lib/generateImagePrompt"; 

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

// Define an interface representing the structure returned by .lean()
// Ensure it includes all fields needed by the prompt library
interface LeanWorkout {
  _id: mongoose.Types.ObjectId | string; 
  userId: mongoose.Types.ObjectId | string;
  name?: string;
  date: Date | string; // Needed for startTime
  duration?: number;
  distance?: number;
  type?: string;
  cardioDetails?: {
      elevationGain?: number;
      weather?: { description?: string }; // Define shape for weather object
  };
}

// Removed old local prompt generation functions

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { activityId } = await request.json();

    if (!activityId || typeof activityId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid activityId' }, { status: 400 });
    }

    await dbConnect();

    const userId = session.user.id;

    // Fetch workout data including fields needed for the prompt lib
    const workout: LeanWorkout | null = await WorkoutModel.findOne({
      _id: activityId,
      userId: userId,
      source: 'strava',
    }, { 
      name: 1, // Although not used in new prompt, keep for potential future use
      date: 1, 
      duration: 1,
      distance: 1,
      type: 1,
      'cardioDetails.elevationGain': 1, 
      'cardioDetails.weather': 1 
    }).lean<LeanWorkout>().exec();

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found or not accessible' }, { status: 404 });
    }
    
    if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key not configured.");
        return NextResponse.json({ error: 'Image generation service is not configured.' }, { status: 500 });
    }

    // Prepare arguments for the new prompt function using the fetched workout data
    const promptArgs = {
        type: workout.type,
        distanceKm: workout.distance ? (workout.distance / 1000).toFixed(1) : null,
        // Use the imported formatDuration function
        durationFormatted: formatDuration(workout.duration),
        elevation: workout.cardioDetails?.elevationGain,
        startTime: workout.date,
        locationName: undefined, // Still unavailable
        weather: workout.cardioDetails?.weather
    };

    // Generate the prompt using the imported library function
    const prompt = generatePrompt(promptArgs);

    // Call OpenAI API (remains the same)
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1", 
      prompt: prompt,
      n: 1, 
      size: "1024x1024", 
      quality: "high"
    });

    // Handle response (remains the same)
    const imageBase64 = imageResponse.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("OpenAI API did not return base64 image data.", imageResponse);
      const errorDetail = (imageResponse as any)?.error?.message || "Unknown OpenAI API issue."; 
      throw new Error(`Failed to generate image data. Detail: ${errorDetail}`);
    }
    console.log(`Generated image data (base64) for activity ${activityId}`);
    return NextResponse.json({ success: true, imageBase64: imageBase64 });

  } catch (error) {
    console.error("Error generating Strava activity image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during image generation";
    const clientErrorMessage = errorMessage.includes("billing") ? "Image generation failed due to a billing issue." 
                             : errorMessage.includes("quota") ? "Image generation failed due to quota limits."
                             : "Failed to generate image.";
    return NextResponse.json({ success: false, error: clientErrorMessage }, { status: 500 });
  }
} 