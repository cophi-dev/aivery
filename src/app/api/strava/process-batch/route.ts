import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { createWorkout } from "@/lib/workout-actions"
import { transformStravaActivity } from "@/lib/services/stravaService"
import { revalidatePath } from "next/cache"
import { gunzip } from 'zlib'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'
import os from 'os'
import { FitFileParser } from '@/lib/services/fitFileService'
import mongoose from 'mongoose'
import WorkoutModel from '@/lib/db/models/workout'
import ExerciseModel from '@/lib/db/models/exercise'
import { updateUserWorkoutSummaries, updateExercisePRs } from '@/lib/workout-actions'
import { 
  processTcxFile,
  generateActivityName,
  extractStravaIdFromFilename
} from '@/lib/services/stravaArchiveService'

// Keep runtime (Node.js needed for processing)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Set max duration to 60s (Hobby plan limit)

const gunzipAsync = promisify(gunzip)

// Helper function to determine a more specific type from filename and path
function determineActivityTypeFromFilePath(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  
  // Check activity/workout type from filename and path
  if (lowerPath.includes('run') || lowerPath.includes('running')) return 'running';
  if (lowerPath.includes('ride') || lowerPath.includes('cycling') || lowerPath.includes('bike')) return 'cycling';
  if (lowerPath.includes('swim') || lowerPath.includes('swimming')) return 'swimming';
  if (lowerPath.includes('walk') || lowerPath.includes('walking')) return 'walking';
  if (lowerPath.includes('hike') || lowerPath.includes('hiking')) return 'hiking';
  
  return ''; // Return empty if can't determine
}

// This mapping addresses standard FIT file sport types and maps them to our application types
function mapSportTypeToActivityType(sportType: string): string {
  if (!sportType) return 'other';
  
  const lowerSport = sportType.toLowerCase();
  
  // Map common sport types to our application's activity types
  // Running activities
  if (lowerSport.includes('run') || 
      lowerSport.includes('treadmill') || 
      lowerSport.includes('trail')) return 'running';
  
  // Cycling activities
  if (lowerSport.includes('cycl') || 
      lowerSport.includes('bike') || 
      lowerSport.includes('ride') ||
      lowerSport.includes('virtual_ride') ||
      lowerSport.includes('indoor_cycling')) return 'cycling';
  
  // Swimming activities  
  if (lowerSport.includes('swim') || 
      lowerSport.includes('pool') || 
      lowerSport.includes('open_water')) return 'swimming';
  
  // Walking activities
  if (lowerSport.includes('walk')) return 'walking';
  
  // Hiking activities
  if (lowerSport.includes('hike')) return 'hiking';
  
  // Strength activities
  if (lowerSport.includes('weight') || 
      lowerSport.includes('strength') || 
      lowerSport.includes('gym') || 
      lowerSport.includes('workout') ||
      lowerSport.includes('functional_strength')) return 'strength';
  
  // Yoga activities
  if (lowerSport.includes('yoga') || 
      lowerSport.includes('meditation')) return 'yoga';
  
  // Pilates activities
  if (lowerSport.includes('pilates')) return 'pilates';
  
  // Rowing activities
  if (lowerSport.includes('row')) return 'rowing';
  
  // Skiing activities
  if (lowerSport.includes('ski')) return 'skiing';
  
  // Cardio activities
  if (lowerSport.includes('cardio') || 
      lowerSport.includes('elliptical') || 
      lowerSport.includes('stair')) return 'cardio';
  
  // HIIT activities
  if (lowerSport.includes('hiit') || 
      lowerSport.includes('circuit') || 
      lowerSport.includes('crossfit')) return 'hiit';
  
  // Flexibility activities
  if (lowerSport.includes('stretch') || 
      lowerSport.includes('flexibility')) return 'flexibility';
  
  console.log(`Unmapped sport type: ${sportType}, defaulting to 'other'`);
  return 'other'; // Default to other if no match found
}

// Implementation of processFitFile that worked in previous commit
async function processFitFile(buffer: Buffer, fileName: string): Promise<any> {
  try {
    console.log(`Processing FIT file: ${fileName}, size: ${buffer.length} bytes`);
    
    const parser = new FitFileParser();
    const data = await parser.parse(buffer);
    
    // Create workout data with proper duration handling - keep in seconds for Strava transform
    const workout: any = {
      date: data.start_time,
      duration: data.total_timer_time || data.total_moving_time || data.total_elapsed_time || 0, // Keep in seconds
      elapsed_time: data.total_elapsed_time || 0, // Keep in seconds
      distance: data.total_distance || 0, // Keep in meters
      type: 'other',
      title: `Activity imported from ${fileName}`,
      sport: data.sport || 'other',
      sub_sport: data.sub_sport,
      avg_heart_rate: data.avg_heart_rate,
      max_heart_rate: data.max_heart_rate,
      total_elevation_gain: data.total_ascent,
      avg_speed: data.enhanced_avg_speed || data.avg_speed,
      max_speed: data.enhanced_max_speed || data.max_speed,
      records: data.records || [] // Include records for better data processing
    };

    // Map the sport type
    if (workout.sport) {
      workout.type = mapSportTypeToActivityType(workout.sport);
    }
    
    // Try to extract activity type from filename and path
    const normalizedPath = fileName.toLowerCase().replace(/\\/g, '/');
    
    // Check both filename and directory structure for activity type clues
    if (normalizedPath.includes('run') || normalizedPath.includes('/runs/')) {
      workout.type = 'running';
      workout.sport = 'running';
    } else if (normalizedPath.includes('ride') || normalizedPath.includes('cycling') || 
               normalizedPath.includes('/rides/') || normalizedPath.includes('/cycling/')) {
      workout.type = 'cycling';
      workout.sport = 'cycling';
    } else if (normalizedPath.includes('swim') || normalizedPath.includes('/swims/')) {
      workout.type = 'swimming';
      workout.sport = 'swimming';
    } else if (normalizedPath.includes('walk') || normalizedPath.includes('/walks/')) {
      workout.type = 'walking';
      workout.sport = 'walking';
    } else if (normalizedPath.includes('hike') || normalizedPath.includes('/hikes/')) {
      workout.type = 'hiking';
      workout.sport = 'hiking';
    }
    
    // Extract Strava ID from filename to help with deduplication
    const idMatch = fileName.match(/(\d{5,})/);
    if (idMatch) {
      workout.id = idMatch[1];
    }
    
    // Create a workout object matching StravaActivity interface structure
    const result = {
      id: workout.id,
      name: workout.title,
      type: workout.type,
      start_date: workout.date?.toISOString() || null,
      description: `Imported from ${fileName}`,
      moving_time: Math.max(60, workout.duration || 0), // Minimum 60 seconds
      elapsed_time: Math.max(60, workout.elapsed_time || workout.duration || 0), // Minimum 60 seconds
      distance: workout.distance, // Keep in meters for Strava transform
      calories: workout.calories || Math.round((workout.duration / 60) * 10), // Calculate from seconds
      average_speed: workout.avg_speed,
      max_speed: workout.max_speed,
      average_heartrate: workout.avg_heart_rate,
      max_heartrate: workout.max_heart_rate,
      total_elevation_gain: workout.total_elevation_gain,
      sport_type: workout.sport || workout.type,
      equipment: null, // Use null instead of empty string
      muscleGroups: null, // Use null instead of empty string
      notes: `Imported from ${fileName}`,
      records: workout.records // Pass through records for additional processing
    };
    
    console.log('Successfully extracted FIT data:', {
      type: result.type,
      start_date: result.start_date,
      moving_time: `${result.moving_time}s`,
      elapsed_time: `${result.elapsed_time}s`,
      distance: `${result.distance}m`
    });
    
    return result;
  } catch (error) {
    console.error(`Error processing FIT file ${fileName}:`, error);
    throw new Error(`Failed to process FIT file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Simple implementation of processGpxFile
async function processGpxFile(buffer: Buffer, fileName: string): Promise<any> {
  try {
    console.log(`Processing GPX file: ${fileName} (${buffer.length} bytes)`);
    
    // Use xml2js instead of gpxparser (which has browser dependencies)
    const xml2js = await import('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    // Parse the GPX data
    try {
      const gpxData = await parser.parseStringPromise(buffer.toString('utf-8'));
      console.log('Successfully parsed GPX data');
      
      if (!gpxData.gpx || !gpxData.gpx.trk) {
        console.warn(`No track data found in GPX file: ${fileName}`);
        return null;
      }
      
      // Extract track data
      const track = gpxData.gpx.trk;
      const trackName = track.name || '';
      
      // Handle different track point structures
      let trackPoints = track.trkseg && track.trkseg.trkpt ? 
                       (Array.isArray(track.trkseg.trkpt) ? track.trkseg.trkpt : [track.trkseg.trkpt]) : 
                       [];
      
      // Handle case where there might be multiple track segments
      if (track.trkseg && Array.isArray(track.trkseg)) {
        trackPoints = track.trkseg.reduce((points: any[], seg: any) => {
          if (seg.trkpt) {
            const segPoints = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
            return points.concat(segPoints);
          }
          return points;
        }, []);
      }
      
      console.log(`Found ${trackPoints.length} track points in GPX file`);
      
      if (trackPoints.length === 0) {
        console.warn(`No track points found in GPX file: ${fileName}`);
        return null;
      }
      
      // Try to get start and end times
      const currentTime = new Date();
      // Using a fallback date based on filename if needed
      let fallbackDate = new Date();
      const idMatch = fileName.match(/(\d+)/);
      if (idMatch) {
        // Try to derive a date from the filename number
        const numericValue = parseInt(idMatch[1]);
        if (!isNaN(numericValue) && numericValue > 1000000000) {
          // Looks like a unix timestamp or big number
          fallbackDate = new Date(numericValue * 1000);
          if (fallbackDate > currentTime || fallbackDate < new Date('2005-01-01')) {
            fallbackDate = new Date(); // Reset if clearly invalid
          }
        }
      }
      
      // Check if any track points have valid time
      const hasValidTimes = trackPoints.some((p: any) => {
        try {
          return p.time && !isNaN(new Date(p.time).getTime());
        } catch {
          return false;
        }
      });
      
      let startTime: Date = fallbackDate;
      let endTime: Date = new Date(fallbackDate.getTime() + 3600000); // 1 hour later as default
      
      if (hasValidTimes) {
        // Find first valid time point
        for (const point of trackPoints) {
          try {
            if (point.time) {
              const pointTime = new Date(point.time);
              if (!isNaN(pointTime.getTime())) {
                startTime = pointTime;
                break;
              }
            }
          } catch {
            // Ignore invalid times
          }
        }
        
        // Find last valid time point
        for (let i = trackPoints.length - 1; i >= 0; i--) {
          try {
            if (trackPoints[i].time) {
              const pointTime = new Date(trackPoints[i].time);
              if (!isNaN(pointTime.getTime())) {
                endTime = pointTime;
                break;
              }
            }
          } catch {
            // Ignore invalid times
          }
        }
      }
      
      let totalDistance = 0;
      let totalElevationGain = 0;
      let sport = 'other';
      let heartRates: number[] = [];
      
      // Function to calculate distance between two points using Haversine formula
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // Distance in meters
      };
      
      // Calculate distance and elevation gain from track points
      if (trackPoints.length > 1) { // Make sure we have at least 2 points
        // Calculate distance by summing distances between consecutive points
        let validPointsCount = 0;
        
        for (let i = 1; i < trackPoints.length; i++) {
          const prevPoint = trackPoints[i-1];
          const currPoint = trackPoints[i];
          
          // Check if points have valid lat/lon coordinates
          if (prevPoint.$ && currPoint.$ && 
              prevPoint.$.lat && prevPoint.$.lon && 
              currPoint.$.lat && currPoint.$.lon) {
            
            const prevLat = parseFloat(prevPoint.$.lat);
            const prevLon = parseFloat(prevPoint.$.lon);
            const currLat = parseFloat(currPoint.$.lat);
            const currLon = parseFloat(currPoint.$.lon);
            
            // Skip invalid coordinates
            if (isNaN(prevLat) || isNaN(prevLon) || isNaN(currLat) || isNaN(currLon)) {
              continue;
            }
            
            // Check for unreasonable jumps in coordinates (likely errors)
            const latDiff = Math.abs(currLat - prevLat);
            const lonDiff = Math.abs(currLon - prevLon);
            
            if (latDiff > 0.1 || lonDiff > 0.1) { // More than ~11km jump is unlikely
              console.log(`Skipping large coordinate jump: (${prevLat},${prevLon}) to (${currLat},${currLon})`);
              continue;
            }
            
            const pointDistance = calculateDistance(prevLat, prevLon, currLat, currLon);
            totalDistance += pointDistance;
            validPointsCount++;
          }
          
          // Calculate elevation gain (only positive changes)
          if (prevPoint.ele && currPoint.ele) {
            const prevEle = parseFloat(prevPoint.ele);
            const currEle = parseFloat(currPoint.ele);
            
            // Skip invalid elevation values
            if (isNaN(prevEle) || isNaN(currEle)) {
              continue;
            }
            
            // Only count reasonable elevation changes (less than 100m between points)
            const elevationDiff = currEle - prevEle;
            if (elevationDiff > 0 && elevationDiff < 100) {
              totalElevationGain += elevationDiff;
            }
          }
          
          // Extract heart rate data from extensions
          if (currPoint.extensions) {
            const extensionsData = currPoint.extensions;
            let hr: number | undefined;
            
            // Try different extension formats
            if (extensionsData.TrackPointExtension && extensionsData.TrackPointExtension.hr) {
              hr = parseInt(extensionsData.TrackPointExtension.hr, 10);
            } else if (extensionsData['gpxtpx:TrackPointExtension'] && extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr']) {
              hr = parseInt(extensionsData['gpxtpx:TrackPointExtension']['gpxtpx:hr'], 10);
            } else if (extensionsData.heart_rate) {
              hr = parseInt(extensionsData.heart_rate, 10);
            }
            
            if (hr && !isNaN(hr) && hr > 30 && hr < 250) { // Basic heart rate validation
              heartRates.push(hr);
            }
          }
        }
        
        console.log(`Calculated total distance: ${totalDistance}m from ${validPointsCount} valid point pairs`);
        
        // If distance calculation failed (0 or unreasonably small), try to extract from track metadata
        if (totalDistance < 10 && track.extensions) {
          // Try to extract distance from track extensions
          try {
            if (track.extensions.TrackStatsExtension && track.extensions.TrackStatsExtension.distance) {
              totalDistance = parseFloat(track.extensions.TrackStatsExtension.distance);
              console.log(`Using distance from track extension: ${totalDistance}m`);
            }
          } catch (e) {
            console.log(`Failed to extract distance from track extensions: ${e}`);
          }
        }
        
        // Try to determine sport type from filename, path, or track name
        const fullPath = fileName.toLowerCase();
        const checkName = (fullPath + ' ' + trackName).toLowerCase();
        
        // Look for clear indicators of activity type in the file path and track name
        if (checkName.includes('run') || fullPath.includes('/runs/') || fullPath.includes('\\runs\\')) {
          sport = 'running';
        } else if (checkName.includes('ride') || checkName.includes('cycling') || 
                  fullPath.includes('/rides/') || fullPath.includes('\\rides\\') ||
                  fullPath.includes('/cycling/') || fullPath.includes('\\cycling\\')) {
          sport = 'cycling';
        } else if (checkName.includes('swim') || fullPath.includes('/swims/') || fullPath.includes('\\swims\\')) {
          sport = 'swimming';
        } else if (checkName.includes('walk') || fullPath.includes('/walks/') || fullPath.includes('\\walks\\')) {
          sport = 'walking';
        } else if (checkName.includes('hike') || fullPath.includes('/hikes/') || fullPath.includes('\\hikes\\')) {
          sport = 'hiking';
        }
      }
      
      // Calculate duration in seconds
      let totalElapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;
      
      // Validate duration - if it's less than 1 minute or more than 24 hours, use a reasonable default
      if (totalElapsedTime < 60 || totalElapsedTime > 86400) {
        console.log(`Unreasonable duration (${totalElapsedTime}s), using calculated value based on distance`);
        
        // Estimate duration based on distance and activity type
        if (totalDistance > 0) {
          // Use different pace estimates based on sport
          let secondsPerKm = 300; // Default: 5 min/km
          
          if (sport === 'running') {
            secondsPerKm = 300; // 5:00 min/km
          } else if (sport === 'cycling') {
            secondsPerKm = 120; // 2:00 min/km (30 km/h)
          } else if (sport === 'swimming') {
            secondsPerKm = 1200; // 20:00 min/km
          } else if (sport === 'walking') {
            secondsPerKm = 720; // 12:00 min/km
          } else if (sport === 'hiking') {
            secondsPerKm = 900; // 15:00 min/km
          }
          
          totalElapsedTime = (totalDistance / 1000) * secondsPerKm;
          console.log(`Estimated duration from distance: ${totalElapsedTime}s for ${totalDistance}m`);
        } else {
          // If we also don't have distance, use a reasonable default of 30 minutes
          totalElapsedTime = 1800;
          console.log(`Using default duration of 30 minutes`);
        }
      }
      
      // Calculate average and max heart rate if available
      let avgHeartRate: number | undefined;
      let maxHeartRate: number | undefined;
      
      if (heartRates.length > 0) {
        avgHeartRate = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
        maxHeartRate = Math.max(...heartRates);
      }
      
      // Ensure distance is reasonable
      if (totalDistance <= 0) {
        if (sport === 'running') {
          totalDistance = totalElapsedTime * (10 / 3.6); // Assume 10 km/h pace
        } else if (sport === 'cycling') {
          totalDistance = totalElapsedTime * (20 / 3.6); // Assume 20 km/h pace
        } else if (sport === 'swimming') {
          totalDistance = totalElapsedTime * (3 / 3.6); // Assume 3 km/h pace
        } else if (sport === 'walking') {
          totalDistance = totalElapsedTime * (5 / 3.6); // Assume 5 km/h pace
        } else if (sport === 'hiking') {
          totalDistance = totalElapsedTime * (4 / 3.6); // Assume 4 km/h pace
        } else {
          totalDistance = totalElapsedTime * (8 / 3.6); // General default
        }
        console.log(`Using estimated distance of ${totalDistance}m based on duration`);
      }
      
      // Create activity object with non-zero metrics
      const activity = {
        type: sport,
        date: startTime,
        duration: Math.max(60, totalElapsedTime), // Minimum 1 minute duration
        distance: Math.max(10, totalDistance), // Minimum 10 meters
        calories: Math.round(totalElapsedTime / 60 * 10), // rough estimate: 10 calories per minute
        average_speed: totalDistance / totalElapsedTime, // m/s
        max_speed: (totalDistance / totalElapsedTime) * 1.5, // a bit faster than average as estimate
        avg_heart_rate: avgHeartRate,
        max_heart_rate: maxHeartRate,
        title: track.name || `${sport.charAt(0).toUpperCase() + sport.slice(1)} on ${startTime.toISOString().split('T')[0]}`,
        description: track.desc || `Imported from ${fileName}`,
        total_elevation_gain: totalElevationGain,
        sport_type: sport
      };
      
      console.log('Successfully extracted GPX data:', {
        type: activity.type,
        date: activity.date,
        duration: activity.duration,
        distance: activity.distance
      });
      
      return activity;
      
    } catch (xmlError) {
      console.error('Error parsing GPX XML:', xmlError);
      return null;
    }
  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    throw new Error(`Failed to process GPX file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to find or create a base ExerciseData entry
async function findOrCreateBaseExercise(type: string, category: 'cardio' | 'strength' | 'flexibility' = 'cardio'): Promise<{ _id: string, name: string, category: string } | null> {
  if (!type || type === 'unknown') {
    return null;
  }
  
  try {
    const db = await (await import('@/lib/db/mongodb')).getDatabase();
    let exercise = await db.collection('exercises').findOne({ name: { $regex: new RegExp(`^${type}$`, 'i') } });
    
    if (!exercise) {
      console.log(`Base exercise for type "${type}" not found, creating...`);
      const newExerciseData = {
        name: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize
        category: category,
        muscleGroups: [], // Default to empty
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await db.collection('exercises').insertOne(newExerciseData);
      exercise = await db.collection('exercises').findOne({ _id: result.insertedId });
      console.log(`Created base exercise for "${type}" with ID: ${result.insertedId}`);
    }
    
    if (!exercise) {
        console.error(`Failed to find or create exercise for type "${type}"`);
        return null;
    }

    return {
      _id: exercise._id.toString(),
      name: exercise.name,
      category: exercise.category
    };
  } catch (error) {
    console.error(`Error finding or creating base exercise for type "${type}":`, error);
    return null;
  }
}

// Function to generate a user-friendly workout name
function generateWorkoutName(workout: any): string {
  const date = new Date(workout.date);
  const hour = date.getHours();
  
  // Determine time of day
  let timeOfDay = '';
  if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
  else timeOfDay = 'Night';

  // Capitalize workout type
  const type = workout.type.charAt(0).toUpperCase() + workout.type.slice(1);
  
  // Format distance if available
  let distanceStr = '';
  if (workout.distance) {
    const distanceKm = workout.distance / 1000; // Convert meters to km
    if (distanceKm >= 1) {
      distanceStr = ` (${Math.round(distanceKm * 10) / 10}km)`;
    } else {
      distanceStr = ` (${Math.round(workout.distance)}m)`;
    }
  }

  // Format date
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return `${timeOfDay} ${type}${distanceStr} - ${dateStr}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting batch processing for Strava import ===')
    
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('No authenticated session')
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    console.log('User authenticated:', userId)
    
    // Get batch parameters from request
    const { processingId, batchIndex, batchSize = 10 } = await request.json()
    
    if (!processingId) {
      return NextResponse.json({ success: false, error: "Missing processingId parameter" }, { status: 400 })
    }
    
    if (batchIndex === undefined) {
      return NextResponse.json({ success: false, error: "Missing batchIndex parameter" }, { status: 400 })
    }
    
    // Construct the path to the temp directory
    const tempDir = path.join(process.env.TMPDIR || os.tmpdir(), `strava-import-${processingId}`)
    const processingStatePath = path.join(tempDir, 'processing-state.json')
    
    // Try to get state from MongoDB first (more reliable across function calls)
    let state;
    try {
      // Get from MongoDB
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      const dbState = await db.collection('strava_import_state').findOne({ processingId })
      
      if (dbState) {
        console.log('Found processing state in MongoDB')
        state = dbState
      } else {
        // Fall back to local file if not in MongoDB
        console.log('Processing state not found in MongoDB, trying local file')
        
        // Check if the processing state file exists
        try {
          await fs.access(processingStatePath)
          // Load from file
          const stateContent = await fs.readFile(processingStatePath, 'utf-8')
          state = JSON.parse(stateContent)
          console.log('Found processing state in local file')
        } catch (fileError) {
          console.error('Processing state file not found:', processingStatePath)
          return NextResponse.json({ success: false, error: "Processing state not found. Import may have expired." }, { status: 404 })
        }
      }
    } catch (dbError) {
      console.error('Error fetching processing state from database:', dbError)
      
      // Fall back to local file
      try {
        await fs.access(processingStatePath)
        const stateContent = await fs.readFile(processingStatePath, 'utf-8')
        state = JSON.parse(stateContent)
        console.log('Fell back to local file for processing state')
      } catch (fileError) {
        console.error('Processing state file not found after database error:', processingStatePath)
        return NextResponse.json({ success: false, error: "Processing state not found in database or filesystem. Import may have expired." }, { status: 404 })
      }
    }
    
    // Verify this is the user's import
    if (state.userId !== userId) {
      console.error('User ID mismatch:', { stateUserId: state.userId, userId })
      return NextResponse.json({ success: false, error: "Unauthorized access to import" }, { status: 403 })
    }
    
    // Get the batch of files to process
    const activityFiles = state.activityFiles || []
    const startIndex = batchIndex * batchSize
    const endIndex = Math.min(startIndex + batchSize, activityFiles.length)
    const batchFiles = activityFiles.slice(startIndex, endIndex)
    
    if (batchFiles.length === 0) {
      console.log('No files in batch, possibly already processed')
      return NextResponse.json({ 
        success: true, 
        message: "No files to process",
        batchIndex,
        processed: 0,
        imported: 0,
        errors: 0,
        nextBatch: startIndex < activityFiles.length ? batchIndex + 1 : null,
        progress: {
          total: activityFiles.length,
          processed: state.processedFiles?.length || 0,
          imported: state.importedFiles?.length || 0,
          errors: state.errorFiles?.length || 0
        },
        isComplete: endIndex >= activityFiles.length
      })
    }
    
    console.log(`Processing batch ${batchIndex + 1}, files ${startIndex + 1}-${endIndex} of ${activityFiles.length}`)
    
    // Add summary metrics to batch results
    const batchResults = {
      processed: 0,
      imported: 0,
      errors: 0,
      activityTypesCounts: {} as Record<string, number>,
      errorDetails: [] as string[],
      batchDistanceKm: 0, 
      batchDurationSeconds: 0
    }
    
    for (const relativeFilePath of batchFiles) {
      try {
        const fullPath = path.join(tempDir, relativeFilePath)
        const fileName = path.basename(fullPath)
        
        console.log(`Processing file: ${fileName}`)
        
        // Check if file exists
        try {
          await fs.access(fullPath)
        } catch (fileError) {
          console.error(`File not found: ${fullPath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`File not found: ${relativeFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Read file content
        const fileContent = await fs.readFile(fullPath)
        
        // Process file based on type
        let workout = null
        const normalizedFilePath = relativeFilePath.replace(/\\/g, '/')
        
        if (normalizedFilePath.toLowerCase().endsWith('.fit.gz')) {
          console.log(`Processing FIT.GZ file: ${normalizedFilePath}`)
          try {
            const unzippedContent = await gunzipAsync(fileContent)
            workout = await processFitFile(unzippedContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing FIT.GZ file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else if (normalizedFilePath.toLowerCase().endsWith('.gpx')) {
          console.log(`Processing GPX file: ${normalizedFilePath}`)
          try {
            workout = await processGpxFile(fileContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing GPX file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else if (normalizedFilePath.toLowerCase().endsWith('.fit')) {
          console.log(`Processing FIT file: ${normalizedFilePath}`)
          try {
            workout = await processFitFile(fileContent, normalizedFilePath)
          } catch (error) {
            console.error(`Error processing FIT file: ${normalizedFilePath}`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Error processing ${normalizedFilePath}: ${error instanceof Error ? error.message : String(error)}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
            
            continue
          }
        } else {
          console.log(`Unsupported file type: ${normalizedFilePath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`Unsupported file type: ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // Mark as processed even if we don't import it
        batchResults.processed++
        if (!state.processedFiles.includes(relativeFilePath)) {
          state.processedFiles.push(relativeFilePath)
        }
        
        // Skip if no workout data extracted
        if (!workout) {
          console.log(`No workout data extracted from ${normalizedFilePath}`)
          batchResults.errors++
          batchResults.errorDetails.push(`No workout data extracted: ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          continue
        }
        
        // ---> workout object now adheres closer to StravaActivity structure <---
        
        // Transform using the standardized function
        const transformedWorkout = transformStravaActivity(workout);
        
        // Update batch metrics (converting units appropriately)
        const distanceInKm = transformedWorkout.distance ? transformedWorkout.distance / 1000 : 0; // Convert meters to kilometers
        const durationInSeconds = transformedWorkout.duration || 0; // Duration is already in seconds

        // Accumulate for the batch response
        batchResults.batchDistanceKm += distanceInKm;
        batchResults.batchDurationSeconds += durationInSeconds;

        // Update state's total metrics (state uses km and minutes)
        state.totalDistance = (state.totalDistance || 0) + distanceInKm;
        state.totalDuration = (state.totalDuration || 0) + (durationInSeconds / 60); // Convert seconds to minutes for state

        // Log the metrics for debugging
        console.log(`Batch Add: ${distanceInKm.toFixed(2)}km, ${durationInSeconds}s. Batch Totals: ${batchResults.batchDistanceKm.toFixed(2)}km, ${batchResults.batchDurationSeconds}s`);
        console.log(`State Totals: ${state.totalDistance.toFixed(2)}km, ${state.totalDuration.toFixed(2)}min`);
        
        // Prepare the final object for saving
        const workoutToSave = {
          ...transformedWorkout,
          userId: userId,
          source: "strava",
          equipment: [], // Equipment should be an array
          muscleGroups: [], // Keep muscle groups as array since that's expected
          sourceId: (() => {
            const id = extractStravaIdFromFilename(normalizedFilePath)
            return id && /^\d{5,}$/.test(id) ? id : undefined
          })(),
          stravaLink: (() => {
            const id = extractStravaIdFromFilename(normalizedFilePath)
            return id && /^\d{5,}$/.test(id) ? `https://www.strava.com/activities/${id}` : undefined
          })()
        }
        
        // Count activity type
        const activityType = workoutToSave.type || 'unknown'
        batchResults.activityTypesCounts[activityType] = (batchResults.activityTypesCounts[activityType] || 0) + 1
        
        // Check for required data without providing fallbacks
        if (!workoutToSave.date || !workoutToSave.duration) {
          console.log(`Workout missing required data: date=${!!workoutToSave.date}, duration=${!!workoutToSave.duration}`)
          batchResults.errors++
          batchResults.errorDetails.push(`Missing required data: date=${!!workoutToSave.date}, duration=${!!workoutToSave.duration} in ${normalizedFilePath}`)
          
          // Add to error files in state
          if (!state.errorFiles.includes(relativeFilePath)) {
            state.errorFiles.push(relativeFilePath)
          }
          
          // Skip this file instead of using fallbacks
          continue
        }
        
        // Try to improve activity type mapping if generic
        if (workoutToSave.type === 'unknown' || workoutToSave.type === 'other') {
          console.log(`Detected activity with generic type: ${workoutToSave.type}, attempting to improve mapping`)
          if (workoutToSave.distance && workoutToSave.distance > 0) {
            if (workout.average_speed) {
              const speedInKmHr = workout.average_speed * 3.6 // m/s to km/h
              if (speedInKmHr > 15) {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely cycling`)
                workoutToSave.type = 'cycling'
              } else if (speedInKmHr > 3) {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely running`)
                workoutToSave.type = 'running'
              } else {
                console.log(`Speed detected as ${speedInKmHr} km/h, likely walking`)
                workoutToSave.type = 'walking'
              }
            }
          }
        }
        
        // Save the workout
        try {
          // Convert duration from seconds to minutes and distance from meters to kilometers
          const durationInMinutes = Math.round((workoutToSave.duration / 60) * 100) / 100;  // Convert seconds to minutes, preserve 2 decimal places
          const distanceInKm = Math.round(workoutToSave.distance / 1000 * 100) / 100;  // Convert meters to km, round to 2 decimals

          // Generate a user-friendly name
          const workoutName = generateWorkoutName({
            ...workoutToSave,
            date: workoutToSave.date || new Date(),
            distance: workoutToSave.distance || 0
          });

          console.log(`Creating cardio workout: ${workoutName} (duration: ${durationInMinutes}min, distance: ${distanceInKm}km)`);
          
          // Calculate pace in minutes per kilometer
          const paceMinPerKm = distanceInKm > 0 ? (workoutToSave.duration / 60) / distanceInKm : 0; // Convert duration to minutes first
          console.log(`Calculated pace: ${paceMinPerKm} min/km`);

          // Find or create the base exercise for this workout type
          const baseExercise = await findOrCreateBaseExercise(workoutToSave.type);
          let workoutExerciseDocData = null; // Initialize as null

          if (baseExercise) {
            // Prepare the WorkoutExerciseData document *without* saving yet
            workoutExerciseDocData = {
              _id: new mongoose.Types.ObjectId(), // Generate new ID for the exercise entry
              workoutId: null, // Will be set after saving the main workout
              exerciseId: { // Embedded reference
                _id: baseExercise._id,
                name: baseExercise.name,
                category: baseExercise.category,
              },
              sets: [], // No sets for imported cardio
              duration: workoutToSave.duration, // Store duration in seconds
              distance: workoutToSave.distance, // Store distance in meters
              order: 0, // First (and only) exercise for this import
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            console.log(`Prepared WorkoutExercise entry for ${baseExercise.name}`);
          } else {
            console.warn(`Could not find or create base exercise for type: ${workoutToSave.type}. Workout will be saved without a workoutExercise entry.`);
          }

          // Prepare data for WorkoutModel (without workoutExercises array)
          const workoutDocData = {
            ...workoutToSave, // Includes original duration in seconds
            _id: new mongoose.Types.ObjectId(), // Generate new ID for the workout itself
            name: workoutName,
            userId: new mongoose.Types.ObjectId(userId),
            source: "strava",
            sourceId: workoutToSave.id, // Use the original Strava ID if available
            stravaLink: workoutToSave.stravaLink,
            cardioDetails: {
              duration: workoutToSave.duration, // Keep original duration in seconds
              distance: distanceInKm, // CORRECTED: Use distance in KM
              pace: paceMinPerKm, // Store pace in minutes per kilometer
              speed: workoutToSave.distance > 0 ? (workoutToSave.distance / workoutToSave.duration) * 3.6 : 0, // Calculate speed in km/h from m/s
              maxSpeed: workoutToSave.maxSpeed ? workoutToSave.maxSpeed * 3.6 : undefined, // Convert maxSpeed to km/h if present
              elevationGain: workoutToSave.totalElevationGain,
              heartRate: workoutToSave.averageHeartRate ? {
                average: workoutToSave.averageHeartRate,
                max: workoutToSave.maxHeartRate
              } : undefined,
              sportDetails: {
                sport: workoutToSave.sportType || workoutToSave.type, // Corrected: Use sportType
                subSport: workoutToSave.type // Use mapped type as subSport
              }
            },
            // Remove redundant top-level fields now in cardioDetails
            distance: undefined, // Ensure top-level distance is not saved
            pace: undefined, // Ensure top-level pace is not saved
            duration: workoutToSave.duration, // Ensure top-level duration remains (in seconds)
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Remove undefined fields to avoid saving them as null
          Object.keys(workoutDocData).forEach(key => (workoutDocData as any)[key] === undefined && delete (workoutDocData as any)[key]);
          Object.keys(workoutDocData.cardioDetails).forEach(key => (workoutDocData.cardioDetails as any)[key] === undefined && delete (workoutDocData.cardioDetails as any)[key]);
          
          console.log(`Attempting to save workout: ${workoutName}`);
          const db = await (await import('@/lib/db/mongodb')).getDatabase();
          
          // Step 1: Save the main workout document
          const workoutInsertResult = await db.collection('workouts').insertOne(workoutDocData);
          console.log(`Successfully saved workout: ${workoutName} with ID ${workoutDocData._id}`);

          // Step 2: If a WorkoutExercise doc was prepared, update its workoutId and save it
          if (workoutExerciseDocData) {
            // Assign the saved workout's ID (using type assertion to handle null -> ObjectId)
            (workoutExerciseDocData as any).workoutId = workoutDocData._id; 
            try {
              await db.collection('workoutexercises').insertOne(workoutExerciseDocData);
              console.log(`Successfully saved WorkoutExercise entry ${workoutExerciseDocData._id} for workout ${workoutDocData._id}`);
            } catch (exerciseSaveError) {
              console.error(`Failed to save WorkoutExercise entry for workout ${workoutDocData._id}:`, exerciseSaveError);
              // Decide if this error should prevent the batch from succeeding or just log
              // For now, we'll just log it and count the workout as imported
            }
          }
          
          batchResults.imported++;
          
          // Add to imported files in state
          if (!state.importedFiles.includes(relativeFilePath)) {
            state.importedFiles.push(relativeFilePath)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          const isMissingExerciseError = errorMsg.includes('Essential exercise data missing') || 
                                     errorMsg.includes('Could not find') ||
                                     errorMsg.includes('in exercises collection')
          
          if (isMissingExerciseError) {
            console.log(`Missing exercise type: ${workoutToSave.type}. Attempting to create base exercise.`)
            try {
              await findOrCreateBaseExercise(workoutToSave.type)
              
              // Try again after creating the exercise with the same converted units
              const durationInMinutes = Math.round((workoutToSave.duration / 60) * 100) / 100;  // Convert seconds to minutes, preserve 2 decimal places
              const distanceInKm = Math.round(workoutToSave.distance / 1000 * 100) / 100;  // Convert meters to km, round to 2 decimals
              
              // Generate a user-friendly name
              const workoutName = generateWorkoutName({
                ...workoutToSave,
                date: workoutToSave.date || new Date(),
                distance: workoutToSave.distance || 0
              });
              
              await createWorkout({
                ...workoutToSave,
                name: workoutName,
                duration: durationInMinutes,
                distance: distanceInKm
              });
              
              console.log(`Successfully imported workout after creating base exercise`)
              batchResults.imported++
              
              // Add to imported files in state
              if (!state.importedFiles.includes(relativeFilePath)) {
                state.importedFiles.push(relativeFilePath)
              }
            } catch (secondError) {
              console.error(`Error saving workout after creating base exercise:`, secondError)
              batchResults.errors++
              batchResults.errorDetails.push(`Save error after exercise creation: ${secondError instanceof Error ? secondError.message : String(secondError)}`)
              
              // Add to error files in state
              if (!state.errorFiles.includes(relativeFilePath)) {
                state.errorFiles.push(relativeFilePath)
              }
            }
          } else {
            console.error(`Error saving workout:`, error)
            batchResults.errors++
            batchResults.errorDetails.push(`Save error: ${errorMsg}`)
            
            // Add to error files in state
            if (!state.errorFiles.includes(relativeFilePath)) {
              state.errorFiles.push(relativeFilePath)
            }
          }
        }
      } catch (error) {
        console.error(`Unexpected error processing file:`, error)
        batchResults.errors++
        batchResults.errorDetails.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
        
        // Add to error files in state if not already added
        if (!state.errorFiles.includes(relativeFilePath)) {
          state.errorFiles.push(relativeFilePath)
        }
      }
    }
    
    // Update the processing state
    state.status = endIndex >= activityFiles.length ? 'completed' : 'processing'
    
    // Save state back to both file system (if available) and MongoDB
    try {
      await fs.writeFile(processingStatePath, JSON.stringify(state))
      console.log('Updated state in filesystem')
    } catch (fsError) {
      console.error('Could not update state file:', fsError)
      // Continue - we'll save to MongoDB anyway
    }
    
    // Always update MongoDB state as the reliable source
    try {
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      await db.collection('strava_import_state').updateOne(
        { processingId },
        { $set: state }
      )
      console.log('Updated state in MongoDB')
    } catch (dbError) {
      console.error('Error updating state in MongoDB:', dbError)
      // If we also failed to update the file, this is a serious error
      if (!fsSync.existsSync(processingStatePath)) {
        return NextResponse.json({
          success: false,
          error: 'Failed to save processing state to both filesystem and database'
        }, { status: 500 })
      }
    }
    
    // Check if all batches are complete
    const isComplete = endIndex >= activityFiles.length
    
    // If complete, revalidate paths and update summaries/PRs
    if (isComplete) {
      console.log(`Strava import complete for user ${userId}. Revalidating paths and updating summaries/PRs.`);
      revalidatePath("/calendar");
      revalidatePath("/activity"); // Assuming this is your workout history page
      revalidatePath("/dashboard");
      
      // --- Add PR and Summary Updates ---
      try {
        // Don't await these individually, let them run in parallel
        const summaryPromise = updateUserWorkoutSummaries(userId);
        const prPromise = updateExercisePRs(userId); // Process all workouts for the user
        await Promise.all([summaryPromise, prPromise]);
        console.log(`Successfully updated summaries and exercise PRs for user ${userId} after import.`);
      } catch (updateError) {
        console.error(`Error updating summaries/PRs after import for user ${userId}:`, updateError);
        // Decide if this should cause the overall endpoint to report an error.
        // For now, we'll log it but still return success for the batch processing itself.
      }
      // --- End PR and Summary Updates ---
    }
    
    return NextResponse.json({
      success: true,
      batchIndex,
      processed: batchResults.processed,
      imported: batchResults.imported,
      errors: batchResults.errors,
      errorDetails: batchResults.errorDetails.slice(0, 5), // Just return the first 5 errors
      activityTypes: batchResults.activityTypesCounts,
      batchTotalDistance: batchResults.batchDistanceKm,
      batchTotalDuration: batchResults.batchDurationSeconds,
      nextBatch: endIndex < activityFiles.length ? batchIndex + 1 : null,
      progress: {
        total: activityFiles.length,
        processed: state.processedFiles.length,
        imported: state.importedFiles.length,
        errors: state.errorFiles.length
      },
      isComplete
    })
    
  } catch (error) {
    console.error("Error in batch processing:", error)
    return NextResponse.json({
      success: false,
      error: `Batch processing error: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
}

// Add a GET endpoint to check progress and final results
export async function GET(request: NextRequest) {
  try {
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('No authenticated session')
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    
    // Get processing ID from URL
    const { searchParams } = new URL(request.url)
    const processingId = searchParams.get('processingId')
    
    if (!processingId) {
      return NextResponse.json({ success: false, error: "Missing processingId parameter" }, { status: 400 })
    }
    
    // Construct the path to the temp directory
    const tempDir = path.join(process.env.TMPDIR || os.tmpdir(), `strava-import-${processingId}`)
    const processingStatePath = path.join(tempDir, 'processing-state.json')
    
    // Try to get state from MongoDB first
    let state;
    try {
      // Get from MongoDB
      const db = await (await import('@/lib/db/mongodb')).getDatabase()
      const dbState = await db.collection('strava_import_state').findOne({ processingId })
      
      if (dbState) {
        console.log('Found processing state in MongoDB')
        state = dbState
      } else {
        // Fall back to local file if not in MongoDB
        console.log('Processing state not found in MongoDB, trying local file')
        
        // Check if the processing state file exists
        try {
          await fs.access(processingStatePath)
          // Load from file
          const stateContent = await fs.readFile(processingStatePath, 'utf-8')
          state = JSON.parse(stateContent)
          console.log('Found processing state in local file')
        } catch (fileError) {
          console.error('Processing state file not found:', processingStatePath)
          return NextResponse.json({ success: false, error: "Processing state not found. Import may have expired." }, { status: 404 })
        }
      }
    } catch (dbError) {
      console.error('Error fetching processing state from database:', dbError)
      
      // Fall back to local file
      try {
        await fs.access(processingStatePath)
        const stateContent = await fs.readFile(processingStatePath, 'utf-8')
        state = JSON.parse(stateContent)
        console.log('Fell back to local file for processing state')
      } catch (fileError) {
        console.error('Processing state file not found after database error:', processingStatePath)
        return NextResponse.json({ success: false, error: "Processing state not found in database or filesystem. Import may have expired." }, { status: 404 })
      }
    }
    
    // Verify this is the user's import
    if (state.userId !== userId) {
      console.error('User ID mismatch:', { stateUserId: state.userId, userId })
      return NextResponse.json({ success: false, error: "Unauthorized access to import" }, { status: 403 })
    }
    
    // Prepare status response
    const activityFiles = state.activityFiles || []
    const isComplete = state.status === 'completed' || state.processedFiles.length >= activityFiles.length
    
    return NextResponse.json({
      status: 'processing',
      progress: {
        processed: state.processed || 0,
        imported: state.imported || 0,
        errors: state.errors || 0,
        totalFiles: state.totalFiles || 0,
        totalDistance: Math.round((state.totalDistance || 0) * 100) / 100, // Round to 2 decimal places
        totalDuration: Math.round((state.totalDuration || 0) * 100) / 100, // Round to 2 decimal places
        activityTypesCounts: state.activityTypesCounts || {},
        errorDetails: state.errorDetails || [],
        importedFiles: state.importedFiles || []
      }
    });
  } catch (error) {
    console.error("Error checking progress:", error)
    return NextResponse.json({
      success: false,
      error: `Error checking progress: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
} 