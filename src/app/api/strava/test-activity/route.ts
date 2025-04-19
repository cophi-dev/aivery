import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshStravaToken } from '@/lib/strava';
import AccountModel from '@/lib/db/models/account';
import dbConnect from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// Endpoint for testing Strava activity fetching and transformation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();
    
    // Get activity ID from query params
    const url = new URL(request.url);
    const activityId = url.searchParams.get('activityId');
    
    if (!activityId) {
      return NextResponse.json({ 
        error: 'Missing activityId parameter',
        usage: 'Add ?activityId=12345678 to fetch a specific activity' 
      }, { status: 400 });
    }

    // Get user's Strava account
    const stravaAccount = await AccountModel.findOne({
      userId: session.user.id,
      provider: 'strava'
    });

    if (!stravaAccount) {
      return NextResponse.json({ error: 'Strava account not connected' }, { status: 400 });
    }

    // Ensure token is valid
    let accessToken = stravaAccount.access_token;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    
    if (!accessToken || (stravaAccount.expires_at && stravaAccount.expires_at < (nowInSeconds + 300))) {
      console.log('Refreshing expired token...');
      accessToken = await refreshStravaToken(stravaAccount);
      if (!accessToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
      }
    }

    // Fetch the specific activity
    console.log(`Fetching Strava activity ${activityId}...`);
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `Failed to fetch activity: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const activity = await response.json();
    
    // Extract relevant data to see the actual values
    const extractedData = {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance, // Raw distance in meters
      distance_km: activity.distance / 1000, // Converted to km
      start_date: activity.start_date,
      elapsed_time: activity.elapsed_time,
      moving_time: activity.moving_time,
      total_elevation_gain: activity.total_elevation_gain,
      average_speed: activity.average_speed, // m/s
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      pace_min_per_km: activity.average_speed ? ((1000 / activity.average_speed) / 60).toFixed(2) : 'N/A'
    };
    
    // Simulate the transformation we'd do for import
    const transformedData = {
      userId: session.user.id,
      name: activity.name,
      type: activity.type === 'Run' ? 'running' : activity.type === 'Swim' ? 'swimming' : 'other',
      date: new Date(activity.start_date),
      duration: activity.moving_time || activity.elapsed_time || 0,
      distance: parseFloat((activity.distance / 1000).toFixed(2)), // km with 2 decimals
      intensity: activity.average_heartrate ? 'Medium' : 'Low',
      // Add cardio details and other fields as needed
    };

    return NextResponse.json({
      success: true,
      activity: extractedData,
      transformedWorkout: transformedData,
      raw: activity // Include the full raw data for inspection
    });
  } catch (error) {
    console.error('Error testing Strava activity:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
} 