import { getCollection } from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"
import { mockIntegrations } from "../db/mock-data"
import { exchangeCodeForToken, refreshToken } from "../strava/config"
import axios from "axios"
import mongoose from 'mongoose'; // Import mongoose
import WorkoutModel from '../db/models/workout'; // Import Workout model
import ExerciseModel from '../db/models/exercise'; // Import Exercise model
import WorkoutExerciseModel from '../db/models/workoutExercise'; // Import WorkoutExercise model

// Define in this file directly instead of importing from the route
const DB_NAME = "aivery"
const INTEGRATIONS_COLLECTION = "integrations"
const WORKOUTS_COLLECTION = "workouts"
const PREFERENCES_COLLECTION = "preferences"
const EXERCISES_COLLECTION = "exercises"
const WORKOUT_EXERCISES_COLLECTION = "workoutExercises"

// Type definitions for Strava activities
interface StravaActivity {
  id?: number | string;
  name?: string;
  description?: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  start_date?: string;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  total_elevation_gain?: number;
  sport_type?: string;
}

interface ImportActivity {
  id: string;
  title: string;
  description: string;
  type: string;
  distance: number;
  duration: number;
  date: Date;
  calories: number;
  averageHeartRate: number;
  maxHeartRate: number;
  averageSpeed: number;
  maxSpeed: number;
  totalElevationGain: number;
  sportType: string;
  source: string;
  sourceData: any;
}

// Default supported activity types if no preferences are set
const DEFAULT_ACTIVITY_TYPES = ['run', 'swim'];

// All possible activity types that can be synced
export const SUPPORTED_ACTIVITY_TYPES = [
  { id: 'run', label: 'Running', enabled: true },
  { id: 'swim', label: 'Swimming', enabled: true },
  { id: 'ride', label: 'Cycling', enabled: false },
  { id: 'walk', label: 'Walking', enabled: false },
  { id: 'hike', label: 'Hiking', enabled: false },
  { id: 'workout', label: 'Strength Training', enabled: false }
];

// Define a more complete interface for cardioDetails
interface CardioDetails {
  distance: number;
  duration: number;
  pace?: number;
  speed?: number;
  maxSpeed?: number;
  elevationGain?: number;
  heartRate?: {
    average: number;
    max: number;
    zones?: {
      thresholds: {
        easy: number;
        moderate: number;
        hard: number;
        peak: number;
      };
      distribution: {
        easy: number;
        moderate: number;
        hard: number;
        peak: number;
      };
    };
  };
  laps?: Array<{
    number: number;
    distance: number;
    duration: number;
    pace?: number;
  }>;
  poolLength?: number;
  strokeType?: string;
  bikeType?: string;
  power?: {
    average: number;
    max: number;
  };
  sportDetails?: {
    sport: string;
    subSport?: string;
  };
  gearInfo?: {
    id: string;
    name: string;
    distance: number;
  };
  weather?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    conditions: string;
  };
  stravaSpecific?: {
    segmentEfforts: number;
    achievementCount: number;
    kudosCount: number;
    athleteWeight: number;
    commute: boolean;
    deviceName: string;
    segmentDetails?: Array<{
      id: string;
      name: string;
      distance: number;
      elapsedTime: number;
      startDate: string;
      average_heartrate: number;
      max_heartrate: number;
      prPowered: boolean;
      komPowered: boolean;
      startIndex: number;
      endIndex: number;
    }>;
  };
}

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Maps Strava activity type to our application's workout type
export function mapStravaType(activityType: string, sportType?: string): string {
  // Handle cases where both activity type and sport type are undefined
  if (!activityType && !sportType) {
    return 'other';
  }
  
  const lowerActivity = activityType?.toLowerCase() || '';
  const lowerSport = sportType?.toLowerCase() || '';
  
  // Check if either contains a keyword and map accordingly
  if (lowerActivity.includes('run') || lowerSport.includes('run') || 
      lowerActivity.includes('treadmill') || lowerSport.includes('treadmill')) {
    return 'running';
  }
  
  if (lowerActivity.includes('ride') || lowerActivity.includes('cycl') || 
      lowerActivity.includes('bike') || lowerSport.includes('cycl') || 
      lowerSport.includes('bike') || lowerSport.includes('ride')) {
    return 'cycling';
  }
  
  if (lowerActivity.includes('swim') || lowerSport.includes('swim')) {
    return 'swimming';
  }
  
  if (lowerActivity.includes('walk') || lowerSport.includes('walk')) {
    return 'walking';
  }
  
  if (lowerActivity.includes('hike') || lowerSport.includes('hike')) {
    return 'hiking';
  }
  
  if (lowerActivity.includes('weight') || lowerActivity.includes('strength') || 
      lowerActivity.includes('gym') || lowerActivity.includes('workout') ||
      lowerSport.includes('weight') || lowerSport.includes('strength') || 
      lowerSport.includes('gym') || lowerSport.includes('workout')) {
    return 'strength';
  }
  
  if (lowerActivity.includes('yoga') || lowerActivity.includes('meditation') ||
      lowerSport.includes('yoga') || lowerSport.includes('meditation')) {
    return 'yoga';
  }
  
  if (lowerActivity.includes('pilates') || lowerSport.includes('pilates')) {
    return 'pilates';
  }
  
  if (lowerActivity.includes('hiit') || lowerActivity.includes('circuit') || 
      lowerActivity.includes('crossfit') || lowerSport.includes('hiit') || 
      lowerSport.includes('circuit') || lowerSport.includes('crossfit')) {
    return 'hiit';
  }
  
  if (lowerActivity.includes('stretch') || lowerActivity.includes('flexibility') ||
      lowerSport.includes('stretch') || lowerSport.includes('flexibility')) {
    return 'flexibility';
  }

  if (lowerActivity.includes('row') || lowerSport.includes('row')) {
    return 'rowing';
  }

  if (lowerActivity.includes('ski') || lowerSport.includes('ski')) {
    return 'skiing';
  }

  if (lowerActivity.includes('cardio') || lowerActivity.includes('elliptical') || 
      lowerActivity.includes('stair') || lowerSport.includes('cardio') || 
      lowerSport.includes('elliptical') || lowerSport.includes('stair')) {
    return 'cardio';
  }
  
  // If we reach here and have unmapped types, log for future improvement
  if (activityType || sportType) {
    console.log(`Unmapped Strava activity type: ${activityType}, sport type: ${sportType}`);
  }
  
  return 'other';
}

// Helper function to calculate intensity based on heart rate
function calculateIntensity(activity: any): "Low" | "Medium" | "High" {
  const avgHeartRate = activity.average_heartrate || activity.avg_heart_rate || 0;
  if (avgHeartRate > 160) {
    return "High";
  } else if (avgHeartRate > 130) {
    return "Medium";
  } else {
    return "Low";
  }
}

// Calculate heart rate zones from heart rate records
function calculateHeartRateZones(records: any[], maxHeartRate: number = 185): any {
  if (!records || records.length === 0) {
    return null;
  }

  // Filter records with heart rate data
  const hrRecords = records.filter(r => r.heart_rate && r.heart_rate > 0);
  if (hrRecords.length === 0) {
    return null;
  }

  // Define heart rate zones (using percentages of max HR)
  const zoneThresholds = {
    easy: Math.round(maxHeartRate * 0.6), // 60% of max HR
    moderate: Math.round(maxHeartRate * 0.7), // 70% of max HR
    hard: Math.round(maxHeartRate * 0.8), // 80% of max HR
    peak: Math.round(maxHeartRate * 0.9) // 90% of max HR
  };

  // Count records in each zone
  let zoneCounts = {
    easy: 0,
    moderate: 0,
    hard: 0,
    peak: 0
  };

  hrRecords.forEach(record => {
    const hr = record.heart_rate;
    if (hr < zoneThresholds.easy) {
      zoneCounts.easy++;
    } else if (hr < zoneThresholds.moderate) {
      zoneCounts.moderate++;
    } else if (hr < zoneThresholds.hard) {
      zoneCounts.hard++;
    } else if (hr < zoneThresholds.peak) {
      zoneCounts.peak++;
    } else {
      zoneCounts.peak++;
    }
  });

  // Calculate percentages
  const totalRecords = hrRecords.length;
  const zoneDistribution = {
    easy: Math.round((zoneCounts.easy / totalRecords) * 100),
    moderate: Math.round((zoneCounts.moderate / totalRecords) * 100),
    hard: Math.round((zoneCounts.hard / totalRecords) * 100),
    peak: Math.round((zoneCounts.peak / totalRecords) * 100)
  };

  return {
    thresholds: zoneThresholds,
    distribution: zoneDistribution
  };
}

// Add type definitions at the top of the file
interface StravaActivity {
  id?: number | string;
  name?: string;
  description?: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  start_date?: string;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  total_elevation_gain?: number;
  sport_type?: string;
}

interface ImportActivity {
  id: string;
  title: string;
  description: string;
  type: string;
  distance: number;
  duration: number;
  date: Date;
  calories: number;
  averageHeartRate: number;
  maxHeartRate: number;
  averageSpeed: number;
  maxSpeed: number;
  totalElevationGain: number;
  sportType: string;
  source: string;
  sourceData: any;
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

/**
 * Transform a Strava activity to our workout format
 */
export const transformStravaActivity = (activity: StravaActivity): ImportActivity => {
  // Map activity type using our comprehensive mapping function
  const mappedType = mapStravaType(activity.type || '', activity.sport_type);
  
  // KEEP distance in METERS
  let distance = 0;
  if (activity.distance !== undefined && activity.distance !== null && activity.distance > 0) {
    distance = activity.distance; // Keep distance in meters
    console.log(`Using distance: ${distance}m`);
  } else {
    console.log(`No valid distance provided or distance is zero: ${activity.distance}`);
  }
  
  // KEEP duration in SECONDS
  // Use moving_time primarily, fallback to elapsed_time
  let duration = 0; // Declare duration variable here
  if (activity.moving_time !== undefined && activity.moving_time !== null && activity.moving_time > 0) {
    duration = activity.moving_time; // Keep duration in seconds
    console.log(`Using moving_time: ${duration}s`);
  } else if (activity.elapsed_time !== undefined && activity.elapsed_time !== null && activity.elapsed_time > 0) {
    duration = activity.elapsed_time; // Fallback to elapsed_time in seconds
    console.log(`Using elapsed_time as fallback: ${duration}s`);
  } else {
    console.log(`No valid duration provided: moving_time=${activity.moving_time}, elapsed_time=${activity.elapsed_time}`);
  }
  
  // Ensure duration is at least 0
  duration = Math.max(0, duration);
  
  // REMOVED: Sanity checks/estimations based on minutes/km - data should be correct now 
  
  console.log(`Processing Strava activity: ${activity.name || 'Unnamed Activity'}, Type: ${activity.type} -> ${mappedType}, Distance: ${distance}m, Duration: ${duration}s`);
  
  // Ensure all required fields for ImportActivity are provided, even if using defaults/zeros
  return {
    id: activity.id?.toString() || '',
    title: activity.name || 'Untitled Activity',
    description: activity.description || '',
    type: mappedType,
    distance: distance, // Return METERS
    duration: duration, // Return SECONDS
    date: parseStravaDate(activity.start_date), // parseStravaDate handles undefined/null start_date
    calories: activity.calories || 0,
    averageHeartRate: activity.average_heartrate || 0,
    maxHeartRate: activity.max_heartrate || 0,
    // Ensure averageSpeed calculation is safe
    averageSpeed: (distance > 0 && duration > 0) ? distance / duration : 0, // m/s
    maxSpeed: activity.max_speed || 0,
    totalElevationGain: activity.total_elevation_gain || 0,
    sportType: activity.sport_type || '',
    source: 'strava',
    sourceData: activity // Keep original activity data for reference if needed
  };
};

/**
 * Parses a Strava date string and ensures it's valid
 * Falls back to current date if unable to parse
 */
function parseStravaDate(dateString?: string): Date {
  if (!dateString) {
    return new Date(); // Default to current date if no date provided
  }
  
  try {
    const parsedDate = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
      console.warn(`Invalid Strava date: ${dateString}, using current date`);
      return new Date(); // Keep fallback for truly invalid dates
    }
    
    console.log(`Parsed Strava date: ${parsedDate.toISOString()} from ${dateString}`);
    return parsedDate;
  } catch (error) {
    console.error(`Error parsing Strava date: ${dateString}`, error);
    return new Date();
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
  console.log(`Syncing Strava activity ${activityId} for user ${userId}...`);
  let accessToken = "";
  try {
    accessToken = await getValidAccessToken(userId);
  } catch (tokenError) {
     console.error(`Failed to get valid Strava token for user ${userId}:`, tokenError);
     throw new Error(`Strava token error for user ${userId}`); 
  }

  try {
    // Fetch activity details from Strava API
    const activity = await fetchStravaActivity(accessToken, activityId);
    
    // Ensure activity object exists
    if (!activity || typeof activity !== 'object') {
      throw new Error(`Invalid activity data received from Strava for activity ID ${activityId}`);
    }

    console.log(`Fetched Strava activity ${activityId} details. Type: ${activity.type}, Sport Type: ${activity.sport_type}`);

    // Map Strava activity type to our internal type
    const mappedType = mapStravaType(activity.type, activity.sport_type);
    console.log(`Mapped Strava type '${activity.type}/${activity.sport_type}' to internal type '${mappedType}'`);

    // Prepare workout data for saving (existing logic)
    const workoutData: any = {
      userId: new mongoose.Types.ObjectId(userId),
      source: "strava",
      sourceId: activityId,
      name: activity.name || `Strava ${mappedType}`, 
      date: parseStravaDate(activity.start_date),
      type: mappedType,
      duration: activity.moving_time || activity.elapsed_time || 0, // Use moving_time primarily, fallback to elapsed_time (seconds)
      intensity: calculateIntensity(activity),
      notes: activity.description || "",
      stravaLink: `https://www.strava.com/activities/${activityId}`,
      // Add initial cardioDetails structure if applicable
      cardioDetails: { 
        distance: activity.distance || 0, // Store distance in METERS
        duration: activity.moving_time || 0, // Use moving_time for active duration (seconds)
        // Calculate pace using consistent distance (meters) and duration (moving_time seconds)
        pace: (activity.distance && activity.moving_time && activity.distance > 0 && activity.moving_time > 0) 
              ? (activity.moving_time / 60) / (activity.distance / 1000) 
              : undefined, // Pace in min/km
        speed: activity.average_speed ? activity.average_speed * 3.6 : undefined, // Convert m/s to km/h (keep original Strava value if needed)
        maxSpeed: activity.max_speed ? activity.max_speed * 3.6 : undefined,
        elevationGain: activity.total_elevation_gain,
        heartRate: {
          average: activity.average_heartrate,
          max: activity.max_heartrate
        },
        // power: activity.average_watts ? { average: activity.average_watts, max: activity.max_watts } : undefined,
        // Laps/Sets need separate processing later
      },
      // Ensure top-level distance matches cardioDetails distance (store in METERS)
      distance: activity.distance || 0, // Store distance in METERS
    };
    
    // Remove undefined heart rate values
    if (!workoutData.cardioDetails.heartRate.average) delete workoutData.cardioDetails.heartRate.average;
    if (!workoutData.cardioDetails.heartRate.max) delete workoutData.cardioDetails.heartRate.max;
    if (Object.keys(workoutData.cardioDetails.heartRate).length === 0) delete workoutData.cardioDetails.heartRate;
    
    // Remove cardioDetails if no significant data
    if (!workoutData.cardioDetails.distance && !workoutData.cardioDetails.duration) {
        delete workoutData.cardioDetails;
    }

    console.log(`Prepared workout data for activity ${activityId}:`, JSON.stringify(workoutData).substring(0, 500) + "...");

    // --- Upsert Workout Document --- (Keep existing logic)
    const savedWorkout = await WorkoutModel.findOneAndUpdate(
      { userId: workoutData.userId, source: "strava", sourceId: activityId },
      { $set: workoutData },
      { new: true, upsert: true, runValidators: true }
    );
    console.log(`Upserted Workout document ${savedWorkout._id} for Strava activity ${activityId}`);

    // --- ADDED: Create/Update WorkoutExercise --- 
    // 1. Find the canonical Exercise document based on mappedType
    let exercise = await ExerciseModel.findOne({ 
      // Try matching common variations for the mapped type
      name: { $regex: new RegExp(`^${mappedType}$`, 'i') } 
    }).lean() as any;
    
    if (!exercise) {
        // Basic fallback: If type is 'running', find 'Running'. If 'cycling', find 'Cycling', etc.
        const capitalizedType = mappedType.charAt(0).toUpperCase() + mappedType.slice(1);
        console.log(`Exercise for type '${mappedType}' not found by regex, trying capitalized: '${capitalizedType}'`);
        exercise = await ExerciseModel.findOne({ name: capitalizedType }).lean() as any;
    }
    
    // If still not found, maybe create a basic one? Or log error?
    if (!exercise) {
        console.error(`Canonical Exercise document not found for mapped type: ${mappedType}. Cannot create WorkoutExercise.`);
        // Optionally, create a basic exercise entry here if desired
        // exercise = await ExerciseModel.create({ name: mappedType.charAt(0).toUpperCase() + mappedType.slice(1), category: 'cardio' }); // Example creation
        // if (!exercise) throw new Error(`Failed to find or create Exercise for type ${mappedType}`);
         throw new Error(`Canonical Exercise not found for type ${mappedType}`); // Fail for now
    }
    console.log(`Found canonical Exercise ${exercise._id} (${exercise.name}) for type ${mappedType}`);

    // 2. Prepare WorkoutExercise data (basic for now, sets added later)
    const workoutExerciseData = {
      userId: savedWorkout.userId,
      workoutId: savedWorkout._id,
      exerciseId: exercise._id, 
      order: 0, // Assuming only one exercise entry per Strava activity for now
      sets: [], // Placeholder - Laps/intervals processing needed here
      // Add duration/distance if applicable (maybe from cardioDetails?)
      // Duration in seconds (already using moving_time from cardioDetails)
      duration: workoutData.cardioDetails?.duration, // Duration in seconds
      // Distance in meters (already using meters from cardioDetails)
      distance: workoutData.cardioDetails?.distance, // Distance in meters
    };

    // 3. Upsert WorkoutExercise document
    const savedWorkoutExercise = await WorkoutExerciseModel.findOneAndUpdate(
      { workoutId: savedWorkout._id, exerciseId: exercise._id }, // Find based on workout and exercise link
      { $set: workoutExerciseData },
      { new: true, upsert: true, runValidators: true }
    );
    console.log(`Upserted WorkoutExercise document ${savedWorkoutExercise._id} linking workout ${savedWorkout._id} to exercise ${exercise._id}`);

    // --- END ADDED SECTION --- 

  } catch (error) {
    console.error(`Error syncing Strava activity ${activityId} for user ${userId}:`, error);
    throw error; // Re-throw error to be caught by the webhook handler
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

