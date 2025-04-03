import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AccountModel from '@/lib/db/models/account';
import dbConnect from '@/lib/db/mongodb';

// Endpoint to force a Strava connection to be considered valid
export async function POST(request: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.error("POST /api/strava/force-valid: Not authenticated");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`POST /api/strava/force-valid: User ${userId} marking connection as valid.`);

    // Find the Strava account
    const stravaAccount = await AccountModel.findOne({
      userId: userId,
      provider: 'strava'
    }).exec();

    if (!stravaAccount) {
      console.error(`POST /api/strava/force-valid: Strava account not found for user ${userId}`);
      return NextResponse.json({ error: 'Strava account not connected' }, { status: 400 });
    }

    // Mark as force-valid
    await AccountModel.updateOne(
      { _id: stravaAccount._id },
      { $set: { forceValid: true, forcedValidAt: new Date() } }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Strava connection marked as valid'
    });
  } catch (error: any) {
    console.error("POST /api/strava/force-valid Error:", error);
    const errorMessage = error.message || 'Failed to mark Strava connection as valid';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Endpoint to remove the force-valid flag
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.error("DELETE /api/strava/force-valid: Not authenticated");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`DELETE /api/strava/force-valid: User ${userId} removing force-valid flag.`);

    // Find the Strava account
    const stravaAccount = await AccountModel.findOne({
      userId: userId,
      provider: 'strava'
    }).exec();

    if (!stravaAccount) {
      console.error(`DELETE /api/strava/force-valid: Strava account not found for user ${userId}`);
      return NextResponse.json({ error: 'Strava account not connected' }, { status: 400 });
    }

    // Remove force-valid flag
    await AccountModel.updateOne(
      { _id: stravaAccount._id },
      { $unset: { forceValid: "", forcedValidAt: "" } }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Force-valid flag removed'
    });
  } catch (error: any) {
    console.error("DELETE /api/strava/force-valid Error:", error);
    const errorMessage = error.message || 'Failed to remove force-valid flag';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 