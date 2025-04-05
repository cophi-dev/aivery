import { getCollection } from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"
import { mockIntegrations } from "../db/mock-data"
import { exchangeCodeForToken, refreshToken } from "../strava/config"

// Define in this file directly instead of importing from the route
const DB_NAME = "aivery"
const INTEGRATIONS_COLLECTION = "integrations"
const WORKOUTS_COLLECTION = "workouts"
const PREFERENCES_COLLECTION = "preferences"

// Default supported activity types if no preferences are set
const DEFAULT_ACTIVITY_TYPES = ['run', 'swim'];

// All possible activity types that can be synced
export const SUPPORTED_ACTIVITY_TYPES = [
  { id: 'run', label: 'Running', enabled: true },
  { id: 'swim', label: 'Swimming', enabled: true },
  { id: 'ride', label: 'Cycling', enabled: false },
  { id: 'walk', label: 'Walking', enabled: false },
  { id: 'hike', label: 'Hiking', enabled: false },
  { id: 'workout', label: 'Strength Training', enabled: false, disabled: true }
];

// Define a more complete interface for cardioDetails
interface CardioDetails {
  distance: number;
  duration: number;
  pace?: string;
  speed?: string;
  maxSpeed?: string;
  elevationGain?: number;
  heartRate?: {
    average: number;
    max: number;
  };
  poolLength?: number;
  strokeType?: string;
  laps?: Array<{
    number?: number;
    time?: number;
    distance?: number;
    pace?: number;
    duration?: number;
  }>;
  power?: {
    average: number;
    max: number;
  };
}

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Map Strava sport types to our workout types
function mapStravaType(sport: string, subSport?: string): string {
  if (!sport) return 'other'
  
  const sportLower = sport.toLowerCase()
  const subSportLower = subSport?.toLowerCase()

  // Map common sport types
  switch (sportLower) {
    case 'running':
    case 'run':
    case 'trail_running':
    case 'treadmill_running':
      return 'running'
    case 'cycling':
    case 'bike':
    case 'ride':
    case 'virtual_ride':
    case 'indoor_cycling':
      return 'cycling'
    case 'swimming':
    case 'swim':
    case 'pool_swimming':
    case 'open_water_swimming':
      return 'swimming'
    case 'walking':
    case 'walk':
      return 'walking'
    case 'hiking':
    case 'hike':
      return 'hiking'
    case 'training':
    case 'workout':
    case 'strength_training':
    case 'weight_training':
    case 'functional_strength':
      return 'strength'
    case 'yoga':
    case 'flexibility':
      return 'flexibility'
    case 'hiit':
    case 'circuit_training':
    case 'crossfit':
      return 'hiit'
    default:
      // Check sub_sport for additional context
      if (subSportLower === 'strength_training' || subSportLower === 'weight_training') {
        return 'strength'
      }
      return 'other'
  }
}

// Helper function to calculate heart rate zones
function calculateIntensity(activity: any): "Low" | "Medium" | "High" {
  // Calculate intensity based on heartrate zones if available
  if (activity.has_heartrate || activity.avg_heart_rate) {
    const maxHr = activity.max_heartrate || activity.max_heart_rate || 0;
    const avgHr = activity.average_heartrate || activity.avg_heart_rate || 0;
    
    if (avgHr > maxHr * 0.85) return "High";
    if (avgHr > maxHr * 0.7) return "Medium";
    return "Low";
  }
  
  // Fallback to perceived exertion based on relative speed
  if ((activity.average_speed && activity.max_speed) || 
      (activity.avg_speed && activity.enhanced_max_speed)) {
    const avgSpeed = activity.average_speed || activity.avg_speed || 0;
    const maxSpeed = activity.max_speed || activity.enhanced_max_speed || 0;
    const relativeEffort = avgSpeed / maxSpeed;
    
    if (relativeEffort > 0.8) return "High";
    if (relativeEffort > 0.6) return "Medium";
    return "Low";
  }
  
  // Default to medium if no data available
  return "Medium";
}

export async function connectStrava(userId: string, authCode: string) {
  try {
    console.log(`Connecting Strava for user ${userId} with auth code ${authCode.substring(0, 5)}...`)

    // Log environment variables for debugging
    console.log('Strava connection environment:', {
      nodeEnv: process.env.NODE_ENV || 'not set',
      stravaClientId: process.env.STRAVA_CLIENT_ID ? `${process.env.STRAVA_CLIENT_ID.substring(0, 3)}...` : 'not set',
      stravaClientIdLength: process.env.STRAVA_CLIENT_ID ? process.env.STRAVA_CLIENT_ID.length : 0,
      hasStravaSecret: !!process.env.STRAVA_CLIENT_SECRET,
      secretLength: process.env.STRAVA_CLIENT_SECRET ? process.env.STRAVA_CLIENT_SECRET.length : 0,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set'
    });

    // Exchange auth code for tokens using Strava's OAuth API
    const tokenData = await exchangeCodeForToken(authCode);
    
    // Store the tokens in the database
    const collection = await getCollection(INTEGRATIONS_COLLECTION)

    // Check if integration already exists
    const existingIntegration = await collection.findOne({
      userId: new ObjectId(userId),
      provider: "strava",
    })

    if (existingIntegration) {
      // Update existing integration
      console.log(`Updating existing Strava integration for user ${userId}`);
      await collection.updateOne(
        { _id: existingIntegration._id },
        {
          $set: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(tokenData.expires_at * 1000),
            athleteId: tokenData.athlete?.id,
            updatedAt: new Date(),
          },
        },
      )
      return { id: existingIntegration._id.toString(), provider: "strava" }
    } else {
      // Create new integration
      console.log(`Creating new Strava integration for user ${userId}`);
      const result = await collection.insertOne({
        userId: new ObjectId(userId),
        provider: "strava",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(tokenData.expires_at * 1000),
        athleteId: tokenData.athlete?.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      return { id: result.insertedId.toString(), provider: "strava" }
    }
  } catch (error) {
    console.error("Error connecting to Strava:", error);
    
    // Add more context to the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const enhancedError = new Error(
      `Failed to connect Strava account: ${errorMessage}. ` +
      `Check that Strava API credentials are correctly configured.`
    );
    
    // Preserve the original stack trace if possible
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }
    
    throw enhancedError;
  }
}

// Helper function to get a valid access token
export async function getValidAccessToken(userId: string) {
  const collection = await getCollection(INTEGRATIONS_COLLECTION);
  const integration = await collection.findOne({
    userId: new ObjectId(userId),
    provider: "strava",
  });

  if (!integration) {
    throw new Error("Strava integration not found");
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(integration.expiresAt);

  if (expiresAt <= now) {
    // Token is expired, refresh it
    console.log("Refreshing expired Strava token");
    const refreshData = await refreshToken(integration.refreshToken);

    // Update the tokens in the database
    await collection.updateOne(
      { _id: integration._id },
      {
        $set: {
          accessToken: refreshData.access_token,
          refreshToken: refreshData.refresh_token,
          expiresAt: new Date(refreshData.expires_at * 1000),
          updatedAt: new Date(),
        },
      }
    );

    return refreshData.access_token;
  }

  // Token is still valid
  return integration.accessToken;
}

// Function to transform Strava activity to our workout format
export function transformStravaActivity(activity: any) {
  console.log('Starting Strava activity transformation:', activity);
  
  if (!activity) {
    console.error('No activity data provided to transform');
    throw new Error('No activity data provided to transform');
  }

  try {
    // Check if distance is already in km (likely < 100) or in meters (likely > 100)
    // Strava's API returns distance in meters, but our imported activities might already be in km
    const distanceValue = activity.distance || activity.total_distance || 0;
    const distanceInKm = distanceValue > 100 ? distanceValue / 1000 : distanceValue;
    
    const transformed = {
      name: activity.name || `${activity.type} Activity`,
      date: new Date(activity.start_date || activity.timestamp),
      duration: activity.elapsed_time || activity.total_elapsed_time || 0,
      distance: parseFloat(distanceInKm.toFixed(3)),
      type: activity.type || mapStravaType(activity.sport, activity.sub_sport),
      notes: activity.description || '',
      intensity: calculateIntensity(activity),
      source: 'strava',
      sourceId: activity.id,
      elevationGain: activity.total_elevation_gain || activity.total_ascent || 0,
      averageHeartRate: activity.average_heartrate || activity.avg_heart_rate || 0,
      maxHeartRate: activity.max_heartrate || activity.max_heart_rate || 0,
      averagePower: activity.average_watts || activity.avg_power || 0,
      maxPower: activity.max_watts || activity.max_power || 0,
      averageSpeed: activity.average_speed || activity.avg_speed || 0,
      maxSpeed: activity.max_speed || activity.enhanced_max_speed || 0,
    };

    console.log('Transformed activity:', transformed);
    return transformed;
  } catch (error) {
    console.error('Error transforming Strava activity:', error);
    throw error;
  }
}

// New function to get user's Strava sync preferences
async function getUserStravaSyncPreferences(userId: string) {
  try {
    const preferencesCollection = await getCollection(PREFERENCES_COLLECTION);
    
    // Look for existing preferences
    const preferences = await preferencesCollection.findOne({
      userId: new ObjectId(userId),
      type: "strava_sync"
    });
    
    if (preferences?.activityTypes) {
      return preferences.activityTypes;
    }
    
    // If no preferences exist, use defaults and create them
    await preferencesCollection.insertOne({
      userId: new ObjectId(userId),
      type: "strava_sync",
      activityTypes: DEFAULT_ACTIVITY_TYPES,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return DEFAULT_ACTIVITY_TYPES;
  } catch (error) {
    console.error("Error getting user preferences:", error);
    // Return defaults if there's an error
    return DEFAULT_ACTIVITY_TYPES;
  }
}

// New function to update user's Strava sync preferences
export async function updateStravaSyncPreferences(userId: string, activityTypes: string[]) {
  try {
    const preferencesCollection = await getCollection(PREFERENCES_COLLECTION);
    
    // Check if preferences exist
    const existing = await preferencesCollection.findOne({
      userId: new ObjectId(userId),
      type: "strava_sync"
    });
    
    if (existing) {
      // Update existing preferences
      await preferencesCollection.updateOne(
        { _id: existing._id },
        { 
          $set: { 
            activityTypes,
            updatedAt: new Date()
          } 
        }
      );
    } else {
      // Create new preferences
      await preferencesCollection.insertOne({
        userId: new ObjectId(userId),
        type: "strava_sync",
        activityTypes,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error updating preferences:", error);
    throw error;
  }
}

// Function to handle single activity sync (used by webhook)
export async function syncStravaActivity(userId: string, activityId: string) {
  try {
    const accessToken = await getValidAccessToken(userId);
    const activity = await fetchStravaActivity(accessToken, activityId);
    
    if (!activity) {
      throw new Error(`No activity found with ID ${activityId}`);
    }

    const workout = transformStravaActivity(activity);
    
    // Get the workouts collection
    const workoutsCollection = await getCollection(WORKOUTS_COLLECTION);
    
    // Check if workout already exists
    const existingWorkout = await workoutsCollection.findOne({
      userId: new ObjectId(userId),
      sourceId: activityId,
      source: "strava"
    });

    if (existingWorkout) {
      // Update existing workout
      await workoutsCollection.updateOne(
        { _id: existingWorkout._id },
        { 
          $set: {
            ...workout,
            updatedAt: new Date()
          }
        }
      );
      return { success: true, action: "updated" };
    } else {
      // Insert new workout
      await workoutsCollection.insertOne({
        ...workout,
        userId: new ObjectId(userId),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, action: "created" };
    }
  } catch (error) {
    console.error(`Error syncing Strava activity ${activityId}:`, error);
    throw error;
  }
}

export async function getStravaIntegration(userId: string) {
  try {
    const collection = await getCollection(INTEGRATIONS_COLLECTION);
    const integration = await collection.findOne({
      userId: new ObjectId(userId),
      provider: "strava",
    });

    if (!integration) {
      return null;
    }

    return {
      id: integration._id.toString(),
      provider: integration.provider,
      lastSynced: integration.lastSynced,
      athleteId: integration.athleteId
    };
  } catch (error) {
    console.error("Error getting Strava integration:", error);
    throw error;
  }
}

// Function to fetch a single activity from Strava API
async function fetchStravaActivity(accessToken: string, activityId: string) {
  console.log(`Fetching Strava activity ${activityId}`);
  
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`);
  }

  return response.json();
}

// Find the user associated with a Strava athlete ID
// Export this function so it can be used by the webhook handler
export async function findUserByStravaAthleteId(athleteId: number | string) {
  const integrationCollection = await getCollection(INTEGRATIONS_COLLECTION);
  
  const integration = await integrationCollection.findOne({
    provider: "strava",
    athleteId: Number(athleteId)
  });
  
  if (!integration) {
    throw new Error(`No user found for Strava athlete ID: ${athleteId}`);
  }
  
  return integration.userId;
}

