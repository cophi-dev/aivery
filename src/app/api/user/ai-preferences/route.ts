import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import UserModel, { IUser } from '@/lib/db/models/user';
import dbConnect from '@/lib/db/mongodb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface AIPreferences {
  location?: string;
  units?: string;
  trainingPreferences?: string;
  fitnessGoals?: string;
  dietaryPreferences?: string;
}

/**
 * PUT /api/user/ai-preferences - Update AI personalization preferences
 */
export async function PUT(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error("Authentication failed in AI preferences route")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Parse request body
    const data = await request.json()
    const { 
      location, 
      units, 
      trainingPreferences, 
      fitnessGoals, 
      dietaryPreferences 
    } = data

    // Connect to database
    await dbConnect()

    console.log(`Updating AI preferences for user ${session.user.id}`, data)

    // Update user with findOneAndUpdate to avoid mongoose document issues
    const result = await UserModel.findByIdAndUpdate(
      session.user.id,
      {
        $set: {
          'aiPreferences.location': location,
          'aiPreferences.units': units,
          'aiPreferences.trainingPreferences': trainingPreferences,
          'aiPreferences.fitnessGoals': fitnessGoals,
          'aiPreferences.dietaryPreferences': dietaryPreferences
        }
      },
      { new: true, upsert: true }
    )

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log(`Successfully updated AI preferences for user ${session.user.id}`)

    return NextResponse.json({ 
      message: "AI preferences updated successfully",
      preferences: {
        location,
        units,
        trainingPreferences,
        fitnessGoals,
        dietaryPreferences
      }
    })
  } catch (error) {
    console.error("Error updating AI preferences:", error)
    return NextResponse.json(
      { error: "Failed to update AI preferences" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/ai-preferences - Get AI personalization preferences
 */
export async function GET(req: NextRequest) {
  // Get the session - check if user is authenticated
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Connect to database
    await dbConnect();
    
    // Get user
    const userId = session.user.id;
    const user = await UserModel.findById(userId).select('aiPreferences').lean();
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      aiPreferences: user.aiPreferences || {
        location: "",
        units: "metric",
        trainingPreferences: "",
        fitnessGoals: "",
        dietaryPreferences: ""
      }
    });
  } catch (error) {
    console.error('[API] Error getting AI preferences:', error);
    return NextResponse.json(
      { error: 'Failed to get AI preferences' },
      { status: 500 }
    );
  }
} 