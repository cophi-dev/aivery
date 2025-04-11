import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';

export const dynamic = 'force-dynamic';

// Helper function to validate and format Strava ID
function formatStravaId(sourceId: string | undefined): string | undefined {
  if (!sourceId) return undefined;
  
  // Extract numeric ID if it's a full URL
  const urlMatch = sourceId.match(/\/activities\/(\d+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // If it's already a numeric ID, return it
  if (/^\d+$/.test(sourceId)) {
    return sourceId;
  }
  
  return undefined;
}

// Helper function to generate a full Strava link from an ID
function generateStravaLink(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return `https://www.strava.com/activities/${id}`;
}

// Extract Strava ID from workout name
function extractIdFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  
  // Look for a pattern like (Strava: 12345678)
  const match = name.match(/\(Strava:\s*(\d+)\)/i);
  if (match && match[1]) {
    return match[1];
  }
  
  return undefined;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  
  // Only allow authenticated users
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Admin check - only allow the user who's making the request to fix their own workouts
  const userId = session.user.id;
  
  try {
    await dbConnect();
    
    // Find all workouts with Strava as the source
    const stravaWorkouts = await WorkoutModel.find({ 
      userId: userId,
      source: 'strava' 
    });
    
    console.log(`Found ${stravaWorkouts.length} Strava workouts to check`);
    
    let updated = 0;
    let alreadyCorrect = 0;
    let noValidId = 0;
    
    // Process each workout
    for (const workout of stravaWorkouts) {
      // Try to get a valid ID from multiple sources in order of preference
      let validId = 
        formatStravaId(workout.sourceId) || 
        formatStravaId(workout.stravaLink) || 
        extractIdFromName(workout.name);
      
      if (validId) {
        // Check if anything needs to be changed
        const needsSourceIdUpdate = workout.sourceId !== validId;
        const needsLinkUpdate = workout.stravaLink !== generateStravaLink(validId);
        
        if (needsSourceIdUpdate || needsLinkUpdate) {
          // Update the workout
          workout.sourceId = validId;
          workout.stravaLink = generateStravaLink(validId);
          await workout.save();
          updated++;
        } else {
          alreadyCorrect++;
        }
      } else {
        // Try to extract from notes if no valid ID found
        const notesMatch = workout.notes ? workout.notes.match(/https:\/\/(?:www\.)?strava\.com\/activities\/(\d+)/) : null;
        if (notesMatch && notesMatch[1]) {
          workout.sourceId = notesMatch[1];
          workout.stravaLink = `https://www.strava.com/activities/${notesMatch[1]}`;
          await workout.save();
          updated++;
        } else {
          // No valid ID found from any source
          noValidId++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      total: stravaWorkouts.length,
      updated,
      alreadyCorrect,
      noValidId,
      message: `Fixed ${updated} Strava workout links. ${alreadyCorrect} were already correct. ${noValidId} had no valid ID.`
    });
    
  } catch (error) {
    console.error('Error fixing Strava links:', error);
    return NextResponse.json({ 
      error: 'An error occurred while fixing Strava links', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 