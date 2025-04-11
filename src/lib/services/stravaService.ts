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

// Map Strava sport types to our workout types
function mapStravaType(sport: string, subSport?: string): string {
  if (!sport) return 'other'
  
  const sportLower = sport.toLowerCase()
  const subSportLower = subSport?.toLowerCase()

  // Map common sport types
  switch (sportLower) {
    // Running variants
    case 'running':
    case 'run':
    case 'trail_running':
    case 'trail_run':
    case 'treadmill_running':
    case 'treadmill':
    case 'track':
    case 'track_running':
    case 'virtual_run':
    case 'virtualrun':
      return 'running'
      
    // Cycling variants
    case 'cycling':
    case 'bike':
    case 'ride':
    case 'virtual_ride':
    case 'virtualride':
    case 'indoor_cycling':
    case 'mountainbikeride':
    case 'mountain_bike_ride':
    case 'mountain_biking':
    case 'gravel_ride':
    case 'gravel_cycling':
    case 'gravelride':
    case 'e_bike_ride':
    case 'ebikeride':
      return 'cycling'
      
    // Swimming variants
    case 'swimming':
    case 'swim':
    case 'pool_swimming':
    case 'poolswim':
    case 'open_water_swimming':
    case 'openwaterswim':
    case 'open_water':
      return 'swimming'
      
    // Walking variants
    case 'walking':
    case 'walk':
    case 'nordic_walking':
      return 'other'
      
    // Hiking variants
    case 'hiking':
    case 'hike':
    case 'mountain_hiking':
      return 'other'
      
    // Strength training
    case 'training':
    case 'workout':
    case 'strength_training':
    case 'weight_training':
    case 'weighttraining':
    case 'functional_strength':
    case 'functionalstrength':
    case 'strength':
    case 'crossfit':
    case 'stairstepper':
    case 'elliptical':
    case 'rowing':
    case 'row':
      return 'strength'
      
    // Flexibility
    case 'yoga':
    case 'flexibility':
    case 'stretching':
    case 'pilates':
      return 'flexibility'
      
    // HIIT
    case 'hiit':
    case 'high_intensity_interval_training':
    case 'highintensityintervaltraining':
    case 'circuit_training':
    case 'circuittraining':
    case 'interval_training':
    case 'intervaltraining':
      return 'hiit'
      
    // Winter sports
    case 'alpineski':
    case 'backcountryski':
    case 'nordicski':
    case 'snowboard':
    case 'snowshoe':
    case 'iceskate':
    case 'snowkite':
      return 'other'
      
    // Water sports
    case 'kayaking':
    case 'canoeing':
    case 'rowing':
    case 'stand_up_paddling':
    case 'standuppaddling':
    case 'surfing':
    case 'kitesurfing':
    case 'windsurfing':
    case 'sailing':
    case 'sail':
    case 'watersport':
      return 'other'
      
    // Ball sports
    case 'soccer':
    case 'golf':
    case 'volleyball':
    case 'tennis':
    case 'basketball':
    case 'football':
    case 'baseball':
    case 'pickleball':
      return 'other'
      
    // Other activities
    case 'handcycle':
    case 'inlineskate':
    case 'skateboard':
    case 'rockclimbing':
    case 'boxing':
      return 'other'
      
    default:
      // Check sub_sport for additional context
      if (subSportLower === 'strength_training' || 
          subSportLower === 'weight_training' || 
          subSportLower === 'crossfit' ||
          subSportLower === 'hiit' ||
          subSportLower === 'circuit') {
        return 'strength'
      } else if (subSportLower === 'yoga' || 
                subSportLower === 'stretching' ||
                subSportLower === 'pilates') {
        return 'flexibility'
      } else if (subSportLower === 'trail' || 
                subSportLower === 'track' ||
                subSportLower === 'treadmill') {
        return 'running'
      }
      return 'other'
  }
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
    
    // Extract heart rate zones data if available
    const heartRateZones = activity.zones?.heart_rate || activity.heartrate_zones;
    let heartRateData: any = {
      average: activity.average_heartrate || activity.avg_heart_rate || 0,
      max: activity.max_heartrate || activity.max_heart_rate || 0,
    };
    
    // Add heart rate zone distribution if available
    if (heartRateZones) {
      heartRateData.zones = {
        thresholds: {
          easy: heartRateZones.custom_zones ? heartRateZones.custom_zones[0] : 0,
          moderate: heartRateZones.custom_zones ? heartRateZones.custom_zones[1] : 0,
          hard: heartRateZones.custom_zones ? heartRateZones.custom_zones[2] : 0,
          peak: heartRateZones.custom_zones ? heartRateZones.custom_zones[3] : 0
        },
        distribution: {
          easy: heartRateZones.distribution_buckets ? heartRateZones.distribution_buckets[0] : 0,
          moderate: heartRateZones.distribution_buckets ? heartRateZones.distribution_buckets[1] : 0,
          hard: heartRateZones.distribution_buckets ? heartRateZones.distribution_buckets[2] : 0,
          peak: heartRateZones.distribution_buckets ? heartRateZones.distribution_buckets[3] : 0
        }
      };
    } else if (activity.records && activity.records.length > 0) {
      // Calculate heart rate zones from records if available
      const maxHR = heartRateData.max || 185; // Use max HR from data or default to 185
      const calculatedZones = calculateHeartRateZones(activity.records, maxHR);
      if (calculatedZones) {
        heartRateData.zones = calculatedZones;
      }
    }
    
    // Extract lap data if available
    const laps = activity.splits_metric || activity.laps || [];
    const formattedLaps = laps.map((lap: any, index: number) => ({
      number: index + 1,
      distance: lap.distance || 0,
      duration: lap.elapsed_time || lap.moving_time || 0,
      pace: lap.average_speed ? (1000 / lap.average_speed) / 60 : 0
    }));
    
    // Extract gear information if available
    const gearInfo = activity.gear ? {
      id: activity.gear.id,
      name: activity.gear.name,
      distance: activity.gear.distance
    } : undefined;
    
    // Extract weather data if available
    const weatherData = activity.weather ? {
      temperature: activity.weather.temperature,
      humidity: activity.weather.humidity,
      windSpeed: activity.weather.wind_speed,
      conditions: activity.weather.conditions
    } : undefined;
    
    // Extract segment efforts if available
    const segmentEfforts = activity.segment_efforts || [];
    const formattedSegmentEfforts = segmentEfforts.map((segment: any) => ({
      id: segment.id,
      name: segment.name,
      distance: segment.distance,
      elapsedTime: segment.elapsed_time,
      startDate: segment.start_date,
      average_heartrate: segment.average_heartrate,
      max_heartrate: segment.max_heartrate,
      prPowered: segment.pr_rank === 1,
      komPowered: segment.kom_rank === 1,
      startIndex: segment.start_index,
      endIndex: segment.end_index
    }));
    
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
      cardioDetails: {
        distance: parseFloat(distanceInKm.toFixed(3)),
        duration: activity.elapsed_time || activity.total_elapsed_time || 0,
        pace: activity.average_speed ? ((1000 / activity.average_speed) / 60) : 0,
        speed: activity.average_speed || activity.avg_speed || 0,
        maxSpeed: activity.max_speed || activity.enhanced_max_speed || 0,
        elevationGain: activity.total_elevation_gain || activity.total_ascent || 0,
        heartRate: heartRateData,
        laps: formattedLaps.length > 0 ? formattedLaps : undefined,
        power: (activity.average_watts || activity.avg_power) ? {
          average: activity.average_watts || activity.avg_power || 0,
          max: activity.max_watts || activity.max_power || 0
        } : undefined,
        sportDetails: {
          sport: activity.sport || activity.type || 'other',
          subSport: activity.sub_sport || undefined
        },
        // Add gear information if available
        gearInfo: gearInfo,
        // Add weather information if available
        weather: weatherData,
        // Add additional Strava-specific data
        stravaSpecific: {
          segmentEfforts: activity.segment_efforts ? activity.segment_efforts.length : 0,
          achievementCount: activity.achievement_count || 0,
          kudosCount: activity.kudos_count || 0,
          athleteWeight: activity.athlete_weight || 0,
          commute: activity.commute || false,
          deviceName: activity.device_name || '',
          segmentDetails: formattedSegmentEfforts.length > 0 ? formattedSegmentEfforts : undefined
        }
      }
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

