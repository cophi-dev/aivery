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
  if (!account.refresh_token || !account.userId) {
    console.error('Strava refresh token or userId missing for account:', account.providerAccountId);
    return null;
  }

  console.log(`Refreshing Strava token for account ${account.providerAccountId}`);

  try {
    await dbConnect(); // Ensure database is connected
    
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('Missing Strava API credentials. Check STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET env variables');
      throw new Error('Missing Strava API credentials');
    }
    
    console.log(`Using Client ID: ${STRAVA_CLIENT_ID.substring(0, 3)}... for token refresh`);
    
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

    // Update the account in the database using the model directly
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
      throw new Error("Failed to update account with new Strava tokens.");
    }
    
    console.log(`Strava token refreshed and updated for account ${account.providerAccountId}`);
    return tokenData.access_token; // Return the new access token

  } catch (error) {
    console.error('Error refreshing Strava token:', error);
    return null; // Indicate failure
  }
}

/**
 * Fetches recent Strava activities for the authenticated user.
 */
export async function getRecentStravaActivities(accessToken: string): Promise<any[]> {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const activitiesUrl = `${STRAVA_API_BASE_URL}/athlete/activities?after=${thirtyDaysAgo}&per_page=100`;

  console.log('Fetching Strava activities...');

  try {
    const response = await fetch(activitiesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch Strava activities:', response.status, errorData);
      throw new Error(`Strava API Error: ${errorData.message || 'Failed to fetch activities'}`);
    }

    const activities = await response.json();
    console.log(`Fetched ${activities.length} Strava activities.`);
    return activities;

  } catch (error) {
    console.error('Error fetching Strava activities:', error);
    return []; // Return empty array on failure
  }
} 