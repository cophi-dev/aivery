import { Account as NextAuthAccount } from 'next-auth'; // Type from next-auth
import AccountModel, { IAccount } from '@/lib/db/models/account'; // Your Mongoose model
import dbConnect from '@/lib/db/mongodb'; // Ensure db connection

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3';

interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
}

/**
 * Refreshes the Strava access token using the refresh token.
 * Updates the account in the database with the new tokens.
 */
export async function refreshStravaToken(account: IAccount): Promise<string | null> { // Use IAccount from your model
  console.log(`[refreshStravaToken] Attempting refresh for account ID: ${account._id}, Provider Account ID: ${account.providerAccountId}`);
  if (!account.refresh_token || !account.userId) {
    console.error(`[refreshStravaToken] ERROR: Strava refresh token or userId missing for account ${account._id}`);
    return null;
  }

  // Log only essential, non-sensitive parts
  console.log(`[refreshStravaToken] Details - UserID: ${account.userId}, Expires At: ${account.expires_at}, Has Refresh Token: ${!!account.refresh_token}`);

  try {
    await dbConnect(); // Ensure database is connected
    
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('[refreshStravaToken] ERROR: Missing Strava API credentials.');
      throw new Error('Missing Strava API credentials');
    }
    
    console.log(`[refreshStravaToken] Using Client ID: ${STRAVA_CLIENT_ID.substring(0, 3)}...`);
    
    console.log(`[refreshStravaToken] Calling Strava token endpoint: ${STRAVA_TOKEN_ENDPOINT}`);
    const response = await fetch(STRAVA_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava token refresh failed:', response.status, errorText);
      throw new Error(`Strava API Error (${response.status}): ${errorText || 'Failed to refresh token'}`);
    }

    const tokenData: StravaTokenResponse = await response.json();
    console.log(`[refreshStravaToken] Successfully fetched new token data. New expiry: ${tokenData.expires_at}`);

    // Update the account in the database using the model directly
    console.log(`[refreshStravaToken] Attempting to update AccountModel for ID: ${account._id}`);
    const updatedAccount = await AccountModel.findByIdAndUpdate(
      account._id, // Use the document's _id
      {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // Strava might return a new refresh token
        expires_at: tokenData.expires_at,
      },
      { new: true } // Return the updated document
    );

    if (!updatedAccount) {
      console.error(`[refreshStravaToken] ERROR: Failed to update account in DB for ID: ${account._id}. AccountModel.findByIdAndUpdate returned null.`);
      throw new Error("Failed to update account with new Strava tokens.");
    }
    
    console.log(`[refreshStravaToken] Successfully refreshed and updated DB for account ${account.providerAccountId}. New expiry: ${updatedAccount.expires_at}`);
    return tokenData.access_token; // Return the new access token

  } catch (error) {
    // Log the specific error
    console.error(`[refreshStravaToken] ERROR during refresh for account ${account.providerAccountId}:`, error);
    return null; // Indicate failure
  }
}

/**
 * Fetches recent Strava activities for the authenticated user.
 */
export async function getRecentStravaActivities(accessToken: string): Promise<any[]> {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const activitiesUrl = `${STRAVA_API_BASE_URL}/athlete/activities?after=${thirtyDaysAgo}&per_page=100`;

  console.log('Fetching Strava activities from URL:', activitiesUrl);

  try {
    const response = await fetch(activitiesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch Strava activities:', response.status, errorText);
      throw new Error(`Strava API Error: ${errorText || 'Failed to fetch activities'}`);
    }

    const activities = await response.json();
    console.log(`Fetched ${activities.length} Strava activities.`);
    
    // Log sample data for inspection, but only the first activity to avoid log overflow
    if (activities.length > 0) {
      const sampleActivity = activities[0];
      console.log('Sample Strava activity data:', {
        id: sampleActivity.id,
        name: sampleActivity.name,
        type: sampleActivity.type,
        distance: sampleActivity.distance, // Raw distance in meters
        distance_km: sampleActivity.distance / 1000, // Converted to km for comparison
        duration: sampleActivity.elapsed_time || sampleActivity.moving_time,
        start_date: sampleActivity.start_date,
        // Add other fields that might be relevant
        average_speed: sampleActivity.average_speed,
        max_speed: sampleActivity.max_speed,
        average_heartrate: sampleActivity.average_heartrate,
        max_heartrate: sampleActivity.max_heartrate,
      });
    }
    
    return activities;

  } catch (error) {
    console.error('Error fetching Strava activities:', error);
    return []; // Return empty array on failure
  }
} 