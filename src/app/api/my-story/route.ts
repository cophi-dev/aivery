import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import UserModel, { IUser } from '@/lib/db/models/user';
import WorkoutModel from '@/lib/db/models/workout';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Generate a simple fallback story when the Anthropic API fails
 */
function generateFallbackStory(user: IUser, workoutCount: number, workoutTypes: Record<string, number>) {
  const userName = user.name || user.nickname || "Fitness Enthusiast";
  const location = user.aiPreferences?.location ? ` in ${user.aiPreferences.location}` : "";
  const goals = user.aiPreferences?.fitnessGoals || "improving fitness and wellbeing";
  
  let workoutTypeText = "";
  if (Object.keys(workoutTypes).length > 0) {
    const types = Object.entries(workoutTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => type)
      .slice(0, 3)
      .join(", ");
    workoutTypeText = `focusing on ${types}`;
  }
  
  return `
    <article>
      <h1>${userName}'s Fitness Journey</h1>
      
      <p>Welcome to the story of ${userName}'s fitness journey${location}. With a focus on ${goals}, 
      ${userName} has been making steady progress towards reaching personal health and fitness goals.</p>
      
      <h2>Progress So Far</h2>
      <p>${workoutCount > 0 
        ? `With ${workoutCount} workouts logged so far ${workoutTypeText}, ${userName} has shown great dedication to their fitness routine.`
        : `${userName} is just getting started on their fitness journey, ready to make progress towards their goals.`
      }</p>
      
      <h2>Looking Forward</h2>
      <p>The journey to better fitness is ongoing, and every workout counts. By continuing to log activities 
      and track progress with Aivery, ${userName} will be able to see improvements over time and stay motivated.</p>
      
      <p>Keep pushing forward, ${userName}! Your dedication is inspiring, and the best is yet to come.</p>
    </article>
  `;
}

/**
 * GET /api/my-story - Generate a story about the user
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Connect to database
    await dbConnect();

    // Get user data with details
    const userData = await UserModel.findById(session.user.id).lean();
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Safely cast to IUser after confirming it exists
    const user = userData as unknown as IUser;

    // Get user's workouts - limit to fewer workouts to reduce tokens
    const workouts = await WorkoutModel.find({ userId: session.user.id })
      .sort({ date: -1 })
      .limit(10) // Reduced from 20 to 10
      .lean();

    // Extract key info for AI prompt - simplified to reduce tokens
    const userInfo = {
      name: user.name || user.nickname || "Fitness Enthusiast",
      workoutCount: workouts.length,
      aiPreferences: {
        location: user.aiPreferences?.location || "",
        trainingPreferences: user.aiPreferences?.trainingPreferences || "",
        fitnessGoals: user.aiPreferences?.fitnessGoals || "",
      },
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
    };

    // Simplify workout data analysis to reduce tokens
    const workoutTypes = workouts.reduce((acc, workout) => {
      acc[workout.type] = (acc[workout.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total stats with simplified data
    const totalStats = workouts.reduce((acc, workout) => {
      acc.duration += workout.duration || 0;
      acc.volume += workout.volume || 0;
      acc.distance += workout.distance || workout.cardioDetails?.distance || 0;
      return acc;
    }, { duration: 0, volume: 0, distance: 0 });

    // Only include basic info from the 3 most recent workouts
    const recentWorkoutsSimplified = workouts.slice(0, 3).map(w => ({ 
      type: w.type, 
      date: new Date(w.date).toLocaleDateString() 
    }));

    // Generate the story using the fallback (now primary) method
    let generatedStory = generateFallbackStory(user, workouts.length, workoutTypes);

    if (!generatedStory) {
      // This condition might be less likely now, but keep as safety net
      generatedStory = "<p>We couldn't generate your story at this time. Please check your data.</p>";
    }

    return NextResponse.json({ 
      message: "Story generated successfully",
      story: generatedStory
    });
  } catch (error) {
    console.error("Error generating story:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
} 