import { getCollection } from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"
import { mockIntegrations } from "../db/mock-data"
import { exchangeCodeForToken, refreshToken } from "../strava/config"

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

export async function connectStrava(userId: string, authCode: string) {
  try {
    console.log(`Connecting Strava for user ${userId} with auth code ${authCode}`)

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
    console.error("Error connecting to Strava:", error)
    throw error;
  }
}

// Helper function to get a valid access token
async function getValidAccessToken(userId: string) {
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

// Function to fetch activities from Strava API
async function fetchStravaActivities(accessToken: string) {
  const perPage = 100; // Max allowed by Strava API
  let page = 1;
  let allActivities: any[] = [];
  let hasMoreActivities = true;

  while (hasMoreActivities) {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const activities = await response.json();
    
    if (activities.length === 0) {
      hasMoreActivities = false;
    } else {
      allActivities = [...allActivities, ...activities];
      page++;
    }
  }

  return allActivities;
}

// Function to transform Strava activity to our workout format
function transformStravaActivity(activity: any) {
  // Common fields for all activities
  const workout: any = {
    sourceId: activity.id.toString(),
    name: activity.name,
    date: new Date(activity.start_date),
    duration: Math.round(activity.elapsed_time / 60), // Convert seconds to minutes
    distance: activity.distance / 1000, // Convert meters to kilometers
    type: activity.type.toLowerCase(),
    notes: `Imported from Strava: ${activity.name}`,
    source: "strava",
    stravaLink: `https://www.strava.com/activities/${activity.id}`,
    cardioDetails: {
      distance: activity.distance / 1000, // km
      duration: Math.round(activity.elapsed_time / 60), // minutes
      pace: activity.average_speed ? (60 / (activity.average_speed * 3.6)).toFixed(2) : undefined, // min/km
      speed: activity.average_speed ? (activity.average_speed * 3.6).toFixed(2) : undefined, // km/h
      maxSpeed: activity.max_speed ? (activity.max_speed * 3.6).toFixed(2) : undefined, // km/h
      elevationGain: activity.total_elevation_gain,
      heartRate: activity.has_heartrate ? {
        average: activity.average_heartrate,
        max: activity.max_heartrate
      } : undefined
    }
  };

  // Add activity-specific fields
  if (activity.type.toLowerCase() === 'swim') {
    workout.cardioDetails.poolLength = activity.pool_length;
    workout.cardioDetails.strokeType = activity.stroke_type;
  }

  if (activity.type.toLowerCase() === 'run') {
    // Additional running-specific data if available
    // Laps data would require another API call to get detailed info
  }

  return workout;
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

// Update the sync function to use preferences
export async function syncStravaWorkouts(userId: string) {
  try {
    console.log(`Syncing Strava workouts for user ${userId}`);

    // Get user preferences for which activity types to sync
    const activityTypes = await getUserStravaSyncPreferences(userId);
    console.log(`User preferences for activity types:`, activityTypes);
    
    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    
    // Fetch activities from Strava API
    const activities = await fetchStravaActivities(accessToken);
    
    // Filter based on user preferences
    const filteredActivities = activities.filter(activity => 
      activityTypes.includes(activity.type.toLowerCase())
    );
    
    console.log(`Fetched ${activities.length} activities, filtered to ${filteredActivities.length} based on user preferences`);

    // Transform activities to our format
    const workouts = filteredActivities.map(transformStravaActivity);

    // Store workouts in the database
    const workoutsCollection = await getCollection(WORKOUTS_COLLECTION);
    const integrationCollection = await getCollection(INTEGRATIONS_COLLECTION);

    let importedCount = 0;
    const typeCounts: Record<string, number> = {};

    for (const workout of workouts) {
      // Track activity type counts
      const type = workout.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      // Check if workout already exists
      const existingWorkout = await workoutsCollection.findOne({
        userId: new ObjectId(userId),
        sourceId: workout.sourceId,
        source: "strava",
      });

      if (!existingWorkout) {
        await workoutsCollection.insertOne({
          ...workout,
          userId: new ObjectId(userId),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        importedCount++;
      }
    }

    // Update last synced timestamp
    await integrationCollection.updateOne(
      { userId: new ObjectId(userId), provider: "strava" },
      { $set: { lastSynced: new Date(), updatedAt: new Date() } },
    );

    return { 
      count: importedCount,
      types: typeCounts
    };
  } catch (error) {
    console.error("Error syncing Strava workouts:", error);
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
async function findUserByStravaAthleteId(athleteId: number | string) {
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

// Sync a single activity from Strava based on webhook event
export async function syncStravaActivity(athleteId: number | string, activityId: string) {
  try {
    console.log(`Syncing Strava activity ${activityId} for athlete ${athleteId}`);
    
    // Find the user associated with this athlete ID
    const userId = await findUserByStravaAthleteId(athleteId);
    
    if (!userId) {
      console.log(`No matching user found for athlete ${athleteId}`);
      return { success: false, error: "No matching user found" };
    }
    
    // Get the user's preferences for which activity types to sync
    const activityTypes = await getUserStravaSyncPreferences(userId.toString());
    
    // Get a valid access token for API calls
    const accessToken = await getValidAccessToken(userId.toString());
    
    // Fetch the activity details
    const activity = await fetchStravaActivity(accessToken, activityId);
    
    // Check if the activity type is one the user wants to sync
    if (!activityTypes.includes(activity.type.toLowerCase())) {
      console.log(`Activity type ${activity.type} is not in user's sync preferences: ${activityTypes.join(', ')}`);
      return { success: true, skipped: true, reason: "Activity type not in sync preferences" };
    }
    
    // Transform the activity to our format
    const workout = transformStravaActivity(activity);
    
    // Check if this activity already exists in our database
    const workoutsCollection = await getCollection(WORKOUTS_COLLECTION);
    const existingWorkout = await workoutsCollection.findOne({
      userId: new ObjectId(userId),
      sourceId: workout.sourceId,
      source: "strava",
    });
    
    if (existingWorkout) {
      // Update the existing workout
      await workoutsCollection.updateOne(
        { _id: existingWorkout._id },
        { 
          $set: {
            ...workout,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`Updated existing workout for activity ${activityId}`);
      return { success: true, updated: true };
    } else {
      // Insert as a new workout
      await workoutsCollection.insertOne({
        ...workout,
        userId: new ObjectId(userId),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`Imported new workout for activity ${activityId}`);
      return { success: true, created: true };
    }
  } catch (error) {
    console.error(`Error syncing Strava activity ${activityId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

