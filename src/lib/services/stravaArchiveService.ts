import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';
import { Buffer } from 'buffer';
import * as FitFileParser from 'fit-file-parser';
import { parseStringPromise } from 'xml2js';
import { calculateDistance } from '@/lib/utils';
import { Parser as TcxParser, Activity as TcxActivity, Trackpoint as TcxTrackpoint } from 'tcx-js';
// We need FitFileParser and xml2js potentially
// import FitFileParser from 'fit-file-parser'; // Or the correct import based on usage
// import xml2js from 'xml2js'; // Or the correct import based on usage
// Import any other necessary types or functions (e.g., from workout actions, DB models if needed directly)
// import { getDatabase } from '@/lib/db/mongodb'; // If createBaseExerciseForType stays

// Promisify gunzip
const gunzipAsync = promisify(gunzipCb);

// Map Strava sport types to our workout types
export function mapStravaType(sport: string, subSport?: string): string {
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
      return 'yoga'
    case 'pilates':
      return 'pilates'
    case 'flexibility':
    case 'stretching':
      return 'flexibility'
    case 'hiit':
    case 'circuit_training':
    case 'crossfit':
      return 'hiit'
    default:
      // Check sub_sport for additional context
      if (subSportLower === 'strength_training' || subSportLower === 'weight_training') {
        return 'strength'
      } else if (subSportLower === 'yoga') {
        return 'yoga'
      } else if (subSportLower === 'pilates') {
        return 'pilates'
      }
      return 'other'
  }
}

// Helper function to calculate heart rate zones
export function calculateIntensity(activity: any): "Low" | "Medium" | "High" {
  // Calculate intensity based on heartrate zones if available
  if (activity.has_heartrate || activity.avg_heart_rate) {
    const maxHr = activity.max_heartrate || activity.max_heart_rate || 0;
    const avgHr = activity.average_heartrate || activity.avg_heart_rate || 0;
    
    if (maxHr <= 0) return "Medium"; // Avoid division by zero or nonsensical results

    if (avgHr > maxHr * 0.85) return "High";
    if (avgHr > maxHr * 0.7) return "Medium";
    return "Low";
  }
  
  // Fallback to perceived exertion based on relative speed
  if ((activity.average_speed && activity.max_speed) || 
      (activity.avg_speed && activity.enhanced_max_speed)) {
    const avgSpeed = activity.average_speed || activity.avg_speed || 0;
    const maxSpeed = activity.max_speed || activity.enhanced_max_speed || 0;
    
    if (maxSpeed <= 0) return "Medium"; // Avoid division by zero
    const relativeEffort = avgSpeed / maxSpeed;
    
    if (relativeEffort > 0.8) return "High";
    if (relativeEffort > 0.6) return "Medium";
    return "Low";
  }
  
  return "Medium"; // Default to medium if no data available
}

// Helper function to calculate heart rate zones
export function calculateHeartRateZones(avgHr?: number, maxHr?: number) {
  if (!avgHr || !maxHr || maxHr <= 0) return undefined;
  
  const distribution = estimateZoneDistribution(avgHr, maxHr);
  
  // Only return zones if we have a valid distribution
  if (!distribution) return undefined;
  
  return {
    thresholds: {
      easy: Math.round(maxHr * 0.6),    // 60% of max HR - Zone 1
      moderate: Math.round(maxHr * 0.7), // 70% of max HR - Zone 2
      hard: Math.round(maxHr * 0.8),     // 80% of max HR - Zone 3
      peak: Math.round(maxHr * 0.9)      // 90% of max HR - Zone 4
    },
    distribution 
  };
}

// Estimate time distribution in heart rate zones based on average HR
export function estimateZoneDistribution(avgHr?: number, maxHr?: number) {
  if (!avgHr || !maxHr || maxHr <= 0) return undefined;
  
  const zoneBoundaries = [0.6, 0.7, 0.8, 0.9];
  const avgHrPercentage = avgHr / maxHr;
  let primaryZone = 0;
  for (let i = 0; i < zoneBoundaries.length; i++) {
    if (avgHrPercentage >= zoneBoundaries[i]) primaryZone = i + 1;
    else break;
  }
  
  const distribution = { easy: 0, moderate: 0, hard: 0, peak: 0 };
  switch (primaryZone) {
    case 0: distribution.easy = 100; break;
    case 1: distribution.easy = 70; distribution.moderate = 30; break;
    case 2: distribution.easy = 20; distribution.moderate = 60; distribution.hard = 20; break;
    case 3: distribution.moderate = 20; distribution.hard = 60; distribution.peak = 20; break;
    case 4: distribution.hard = 30; distribution.peak = 70; break;
  }
  return distribution;
}

// Function to generate a meaningful activity name
export function generateActivityName(activityData: any, startTime: Date, mappedType: string): string {
  const formattedDate = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const hour = startTime.getHours();
  let timeOfDay = 
    hour >= 5 && hour < 12 ? 'Morning' : 
    hour >= 12 && hour < 17 ? 'Afternoon' : 
    hour >= 17 && hour < 21 ? 'Evening' : 'Night';
  
  let detail = '';
  const distanceKm = (activityData.distance ?? activityData.total_distance ?? 0) / 1000;
  const durationMin = (activityData.elapsed_time ?? activityData.total_elapsed_time ?? 0) / 60;
  
  if (['running', 'cycling', 'swimming'].includes(mappedType)) {
    if (distanceKm > 0.05) detail = `${distanceKm.toFixed(1)}km`
    else if (durationMin > 0) detail = `${Math.round(durationMin)}min`
  }
  
  let name = `${timeOfDay} ${mappedType.charAt(0).toUpperCase() + mappedType.slice(1)}`;
  if (detail) name += ` (${detail})`;
  if (activityData.subSport && activityData.subSport !== 'generic') {
    name += ` - ${activityData.subSport.replace(/_/g, ' ')}`;
  }
  name += ` - ${formattedDate}`;
  
  return name;
}

// Function to generate comprehensive notes for AI queries
export function generateActivityNotes(activityData: any, startTime: Date, fileName: string): string {
  const stravaId = extractStravaIdFromFilename(fileName);
  const stravaLink = stravaId ? `https://www.strava.com/activities/${stravaId}` : undefined;
  let notes = "";
  if (stravaLink) notes += `View on Strava: ${stravaLink}`;
  const description = activityData?.description || activityData?.notes;
  if (description) {
    notes += notes ? `\n\n${description}` : description;
  }
  return notes;
}

// Function to extract Strava ID from filename
export function extractStravaIdFromFilename(filename: string): string | undefined {
  if (!filename) return undefined;
  const normalizedFilename = filename.replace(/\\/g, '/');
  const patterns = [
    /activities\/(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)/i,
    /\/(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)$/i,
    /(?:^|\/|\\)(\d{5,})\.(?:fit\.gz|gpx|fit|tcx)$/i,
    /activity[_-]?(\d{5,})/i,
    /export[_-](\d{5,})/i,
    /(\d{8,})/ // Longer number as last resort
  ];
  for (const pattern of patterns) {
    const match = normalizedFilename.match(pattern);
    if (match && match[1]) return match[1];
  }
  return undefined;
}

// Define interface for processed activity data structure returned by parsers
interface RecordData {
  timestamp: Date;
  heart_rate?: number;
  distance?: number;
  speed?: number;
  altitude?: number;
  latitude?: number;
  longitude?: number;
  cadence?: number;
  power?: number;
}

export interface ProcessedActivityData {
  id: string;
  name: string;
  type: string;
  start_date: string; // ISO string
  elapsed_time: number; // seconds
  distance: number; // meters
  total_elevation_gain?: number; // meters
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number; // m/s
  max_speed?: number; // m/s
  average_cadence?: number;
  max_cadence?: number;
  average_power?: number;
  max_power?: number;
  records?: Array<RecordData>; // Array of record objects
  notes?: string;
  sport?: string;
  subSport?: string;
}

export async function processFitFile(content: Buffer, fileName: string): Promise<ProcessedActivityData | null> {
  try {
    console.log(`Processing FIT file: ${fileName}, size: ${content.length} bytes`);
    
    const FitParserConstructor = FitFileParser.default;
    if (typeof FitParserConstructor !== 'function') {
      throw new Error('Failed to load FitParser constructor.');
    }
    const fitParser = new FitParserConstructor({ 
      force: true, speedUnit: 'm/s', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'list'
    });

    const data = await new Promise<any>((resolve, reject) => {
      fitParser.parse(content, (error: any, parsedData: any) => {
        if (error) reject(new Error(`FIT parse error: ${error.message || error}`)); else resolve(parsedData);
      });
    });
    
    const rawRecords = data.records || [];
    const sessions = data.sessions || [];
    if (rawRecords.length === 0 && sessions.length === 0) {
      console.warn(`No record or session data in ${fileName}`);
      return null;
    }
    
    // Prefer session data if available, otherwise calculate from records
    let activitySummary: any;
    let recordsToUse = rawRecords;
    let isSessionData = false;

    if (sessions.length > 0) {
        activitySummary = sessions[0];
        // Sometimes session has records, sometimes top-level has records
        if (activitySummary.laps && activitySummary.laps.length > 0 && activitySummary.laps[0].records) {
             recordsToUse = activitySummary.laps.flatMap((lap: any) => lap.records || []);
             console.log(`Using ${recordsToUse.length} records from session laps.`);
        }
         isSessionData = true;
         console.log(`Using primary data from session object.`);
    } else {
        activitySummary = {}; // Create empty object to populate from records
         console.log(`No session object found, calculating summary from records.`);
    }
    
    // --- Calculate Core Metrics --- 
    const firstRecord = recordsToUse[0];
    const lastRecord = recordsToUse[recordsToUse.length - 1];
    const startTime = new Date(activitySummary.start_time || firstRecord?.timestamp || Date.now());
    const endTime = new Date(lastRecord?.timestamp || startTime.getTime()); // Fallback to start time if no end
    const totalElapsedTime = activitySummary.total_timer_time || activitySummary.total_elapsed_time || Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000);

    let totalDistance = 0, sport = 'other', subSport: string | undefined = undefined, totalElevationGain = 0;
    let avgHeartRate = activitySummary.avg_heart_rate;
    let maxHeartRate = activitySummary.max_heart_rate;
    let avgSpeed = activitySummary.avg_speed || activitySummary.enhanced_avg_speed || 0;
    let maxSpeed = activitySummary.max_speed || activitySummary.enhanced_max_speed || 0;
    let avgCadence = activitySummary.avg_cadence;
    let maxCadence = activitySummary.max_cadence;
    let avgPower = activitySummary.avg_power;
    let maxPower = activitySummary.max_power;

    // Calculate from records if session data is missing specific fields
    if (!isSessionData || totalElevationGain === 0 || !avgHeartRate || avgSpeed === 0) {
        console.log("Calculating missing summary fields from records...");
        if (totalElevationGain === 0) {
            const altitudes = recordsToUse.map((r: any) => r.altitude).filter((a: any): a is number => a !== undefined && a !== null);
            if (altitudes.length > 1) totalElevationGain = altitudes.reduce((gain: number, current: number, i: number, arr: number[]) => gain + (i > 0 && current > arr[i - 1] ? current - arr[i - 1] : 0), 0);
        }
        if (!avgHeartRate) {
            const heartRates = recordsToUse.map((r: any) => r.heart_rate).filter((hr: any): hr is number => hr !== undefined && hr !== null && hr > 0);
            if (heartRates.length > 0) { avgHeartRate = Math.round(heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length); maxHeartRate = Math.max(...heartRates); }
        }
        if (avgSpeed === 0) {
             const speeds = recordsToUse.map((r: any) => r.speed).filter((s: any): s is number => s !== undefined && s !== null && s >= 0);
             if (speeds.length > 0) { avgSpeed = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length; maxSpeed = Math.max(...speeds); }
             else if (totalElapsedTime > 0) { avgSpeed = totalDistance / totalElapsedTime; } // Fallback
        }
        // Add calculations for cadence/power if needed
    }
     
    if (sessions.length > 0 && sessions[0].total_distance) {
        const session = sessions[0];
        totalDistance = session.total_distance || 0;
        sport = session.sport || 'other'; 
        subSport = session.sub_sport;
        // ... (rest of session assignments)
    } else {
        // ... (record calculation)
        // Note: Records usually don't contain sub_sport directly
        sport = firstRecord.sport || 'other';
        subSport = undefined; // Ensure subSport is undefined if calculated from records
        // ... (rest of record calculations)
    }
      
    const mappedType = mapStravaType(sport, subSport);
    const currentDate = new Date();
    let adjustedStartTime = startTime > currentDate ? currentDate : startTime;

    const detailedRecords = recordsToUse.map((rec: any) => ({
        timestamp: new Date(rec.timestamp), heart_rate: rec.heart_rate, distance: rec.distance, speed: rec.speed,
        altitude: rec.altitude, latitude: rec.position_lat, longitude: rec.position_long, cadence: rec.cadence, power: rec.power
    }));
     
    const stravaId = extractStravaIdFromFilename(fileName);
    let activityName = generateActivityName({ distance: totalDistance, elapsed_time: totalElapsedTime, sport, subSport }, adjustedStartTime, mappedType);
    activityName += (stravaId ? ` (Strava: ${stravaId})` : '');
     
    const transformedActivity: ProcessedActivityData = {
        id: stravaId || `fit_${Date.now()}`, // Prefer stravaId if available
        name: activityName, type: mappedType, start_date: adjustedStartTime.toISOString(),
        elapsed_time: totalElapsedTime, distance: totalDistance, total_elevation_gain: totalElevationGain,
        has_heartrate: !!avgHeartRate, average_heartrate: avgHeartRate, max_heartrate: maxHeartRate,
        average_speed: avgSpeed, max_speed: maxSpeed, average_cadence: avgCadence, max_cadence: maxCadence,
        average_power: avgPower, max_power: maxPower,
        records: detailedRecords,
        notes: generateActivityNotes(sessions[0] || {}, adjustedStartTime, fileName), // Pass session for description
        sport: sport,
        subSport: subSport
    };
     
    console.log(`Processed FIT file ${fileName}, returning data for ${transformedActivity.id}`);
    return transformedActivity; 

  } catch (error) {
    console.error(`Error processing FIT file ${fileName}:`, error);
    throw error; // Re-throw the error to be caught by the worker handler
  }
}

export async function processGpxFile(content: Buffer, fileName: string): Promise<ProcessedActivityData | null> {
  try {
    const gpxString = content.toString('utf-8');
    console.log(`Parsing GPX file: ${fileName}`);
    const fallbackDate = new Date(); // Use current date as fallback if no time found

    // Parse XML
    const gpxData = await parseStringPromise(gpxString, { explicitArray: false, ignoreAttrs: false, mergeAttrs: true });
    
    // Basic validation
    if (!gpxData || !gpxData.gpx) {
        console.warn(`Invalid GPX structure in ${fileName}: Missing <gpx> root`);
        return null;
    }

    const gpxRoot = gpxData.gpx;
    const metadata = gpxRoot.metadata || {};
    let trackPoints: any[] = [];
    let trackName = 'GPX Track'; // Default track name
    
    // Find track points (can be under <trk> or <rte>)
    if (gpxRoot.trk) {
        const track = Array.isArray(gpxRoot.trk) ? gpxRoot.trk[0] : gpxRoot.trk;
        trackName = track.name || trackName;
        if (track.trkseg?.trkpt) {
            trackPoints = Array.isArray(track.trkseg.trkpt) ? track.trkseg.trkpt : [track.trkseg.trkpt];
        } else if (track.trkpt) { // Sometimes points are directly under <trk>
            trackPoints = Array.isArray(track.trkpt) ? track.trkpt : [track.trkpt];
        }
    } else if (gpxRoot.rte?.rtept) {
        trackPoints = Array.isArray(gpxRoot.rte.rtept) ? gpxRoot.rte.rtept : [gpxRoot.rte.rtept];
    } else if (gpxRoot.wpt) { // Handle files with only waypoints as a fallback
        trackPoints = Array.isArray(gpxRoot.wpt) ? gpxRoot.wpt : [gpxRoot.wpt];
    }
    
    if (trackPoints.length === 0) {
      console.warn(`No track points found in GPX file: ${fileName}`);
      return null;
    }
    
    // Determine start/end time from points if available
    let startTime: Date = fallbackDate;
    let endTime: Date = new Date(fallbackDate.getTime()); // Init end time same as start
    let validTimeCount = 0;
    let earliestTime = Infinity;
    let latestTime = -Infinity;

    trackPoints.forEach(p => {
        try {
            if (p.time) {
                const pointTime = new Date(p.time).getTime();
                if (!isNaN(pointTime)) {
                    validTimeCount++;
                    if(pointTime < earliestTime) earliestTime = pointTime;
                    if(pointTime > latestTime) latestTime = pointTime;
                }
            }
        } catch {}
    });
    
    if(validTimeCount > 0) {
        startTime = new Date(earliestTime);
        endTime = new Date(latestTime);
    } else {
        console.log(`No valid time points in GPX, using fallback start date: ${startTime.toISOString()}`);
        endTime = new Date(startTime.getTime() + 3600 * 1000); // Estimate 1 hour duration
    }
    
    let totalDistance = 0; // meters
    let totalElevationGain = 0; // meters
    let sport = 'other';
    let heartRates: number[] = [];
    const detailedRecords: RecordData[] = [];
    
    // Calculate distance, elevation, HR from points
    if (trackPoints.length > 1) {
      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i-1], curr = trackPoints[i];
        if (prev.$ && curr.$ && prev.$.lat && prev.$.lon && curr.$.lat && curr.$.lon) {
            // Use the imported calculateDistance
            totalDistance += calculateDistance(parseFloat(prev.$.lat), parseFloat(prev.$.lon), parseFloat(curr.$.lat), parseFloat(curr.$.lon));
        }
        if (prev.ele && curr.ele) {
            try {
                 const prevEle = parseFloat(prev.ele), currEle = parseFloat(curr.ele);
                 if (!isNaN(prevEle) && !isNaN(currEle) && currEle > prevEle) totalElevationGain += (currEle - prevEle);
            } catch {}
        }
        // Extract HR from common GPX extensions
        if (curr.extensions) {
            try {
                const ext = curr.extensions;
                let hrStr: string | undefined;
                if (ext['gpxtpx:TrackPointExtension']?.['gpxtpx:hr']) hrStr = ext['gpxtpx:TrackPointExtension']['gpxtpx:hr'];
                else if (ext.TrackPointExtension?.hr) hrStr = ext.TrackPointExtension.hr;
                if (hrStr) {
                    const hr = parseInt(hrStr, 10);
                    if (!isNaN(hr) && hr > 0 && hr < 300) heartRates.push(hr); // Basic validation
                }
            } catch {}
        }
        // Add point to detailed records (populate with available data)
        let hrForRecord: number | undefined;
        try { 
            const ext = curr.extensions;
            let hrStr: string | undefined;
            if (ext && ext['gpxtpx:TrackPointExtension'] && ext['gpxtpx:TrackPointExtension']['gpxtpx:hr']) {
                hrStr = ext['gpxtpx:TrackPointExtension']['gpxtpx:hr'];
            }
            if (hrStr) {
                const parsedHr = parseInt(hrStr, 10);
                if (!isNaN(parsedHr) && parsedHr > 0 && parsedHr < 300) hrForRecord = parsedHr;
            }
        } catch {}

        detailedRecords.push({
            timestamp: curr.time ? new Date(curr.time) : new Date(startTime.getTime() + (i * (endTime.getTime() - startTime.getTime()) / trackPoints.length)), // Estimate time if missing
            latitude: curr.$?.lat ? parseFloat(curr.$.lat) : undefined,
            longitude: curr.$?.lon ? parseFloat(curr.$.lon) : undefined,
            altitude: curr.ele ? parseFloat(curr.ele) : undefined,
            heart_rate: hrForRecord
        });
      }
      // Determine sport type
      const checkName = (fileName + ' ' + trackName).toLowerCase();
      if (checkName.includes('run')) sport = 'running';
      else if (checkName.includes('ride') || checkName.includes('cycling')) sport = 'cycling';
      else if (checkName.includes('walk')) sport = 'walking';
      else if (checkName.includes('hike')) sport = 'hiking';
      else if (checkName.includes('swim')) sport = 'swimming';
    }
    
    const totalElapsedTime = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000);
    const avgSpeed = totalDistance > 0 && totalElapsedTime > 0 ? (totalDistance / totalElapsedTime) : 0; // m/s
    let avgHeartRate: number | undefined, maxHeartRate: number | undefined;
    if (heartRates.length > 0) { avgHeartRate = Math.round(heartRates.reduce((s, hr) => s + hr, 0) / heartRates.length); maxHeartRate = Math.max(...heartRates); }
    
    const stravaIdMatch = extractStravaIdFromFilename(fileName);
    const id = stravaIdMatch || `gpx_${Date.now()}`;
    
    // Add the first point to detailed records if not added in loop
    if (detailedRecords.length === 0 && trackPoints.length > 0) {
        const firstPoint = trackPoints[0];
         detailedRecords.push({
             timestamp: startTime,
             latitude: firstPoint.$?.lat ? parseFloat(firstPoint.$.lat) : undefined,
             longitude: firstPoint.$?.lon ? parseFloat(firstPoint.$.lon) : undefined,
             altitude: firstPoint.ele ? parseFloat(firstPoint.ele) : undefined,
             // HR for first point might be missing
         });
    }

    let activityName = generateActivityName({ distance: totalDistance, elapsed_time: totalElapsedTime, sport: sport }, startTime, sport);
    activityName += (stravaIdMatch ? ` (Strava: ${stravaIdMatch})` : '');
    
    const transformedActivity: ProcessedActivityData = {
      id: id, name: activityName, type: sport, start_date: startTime.toISOString(),
      elapsed_time: totalElapsedTime, distance: totalDistance, total_elevation_gain: totalElevationGain > 0 ? totalElevationGain : undefined,
      has_heartrate: heartRates.length > 0, average_heartrate: avgHeartRate, max_heartrate: maxHeartRate,
      average_speed: avgSpeed,
      records: detailedRecords,
      notes: generateActivityNotes(metadata, startTime, fileName),
      sport: sport
    };
    
    console.log(`Processed GPX file ${fileName}, returning data for ${transformedActivity.id}`);
    return transformedActivity;

  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    throw error; // Re-throw the error
  }
}

// --- NEW TCX PROCESSING FUNCTION ---
export async function processTcxFile(content: Buffer, fileName: string): Promise<ProcessedActivityData | null> {
  try {
    // tcx-js expects a file path, not a buffer. We need to write to a temporary file or find another way.
    // Let's try parsing the buffer directly if possible, otherwise, we might need a workaround.
    // Since tcx-js is based on xml2js or similar, it might accept a string.
    const tcxString = content.toString('utf-8');
    
    // Re-check tcx-js docs/source. It seems the JuanIrache fork might still rely on fs.
    // Okay, the constructor `new Parser(infile)` suggests it needs a path.
    // Workaround: Use xml2js directly to parse the string, mimicking tcx-js structure if needed.
    
    console.log(`Parsing TCX file: ${fileName}`);
    const xmlData = await parseStringPromise(tcxString, { explicitArray: false, ignoreAttrs: false, mergeAttrs: true });

    if (!xmlData?.TrainingCenterDatabase?.Activities?.Activity) {
        console.warn(`Invalid TCX structure in ${fileName}: Missing Activity`);
        return null;
    }

    const activity = xmlData.TrainingCenterDatabase.Activities.Activity;
    const sport = activity?.$?.Sport || 'other';
    const startTime = new Date(activity?.Id || Date.now()); // Use activity ID as start time if available

    let allTrackpoints: any[] = [];
    const laps = Array.isArray(activity.Lap) ? activity.Lap : (activity.Lap ? [activity.Lap] : []);

    for (const lap of laps) {
        if (lap.Track?.Trackpoint) {
            const points = Array.isArray(lap.Track.Trackpoint) ? lap.Track.Trackpoint : [lap.Track.Trackpoint];
            allTrackpoints = allTrackpoints.concat(points);
        }
    }

    if (allTrackpoints.length === 0) {
        console.warn(`No trackpoints found in TCX file: ${fileName}`);
        return null;
    }

    // Sort trackpoints by time just in case
    allTrackpoints.sort((a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime());

    const firstPoint = allTrackpoints[0];
    const lastPoint = allTrackpoints[allTrackpoints.length - 1];
    const actualStartTime = new Date(firstPoint.Time);
    const endTime = new Date(lastPoint.Time);
    const totalElapsedTime = Math.max(1, (endTime.getTime() - actualStartTime.getTime()) / 1000);
    
    let totalDistance = 0;
    let totalElevationGain = 0;
    const heartRates: number[] = [];
    const speeds: number[] = [];
    const cadences: number[] = [];
    const powers: number[] = [];
    const detailedRecords: RecordData[] = [];

    for (let i = 0; i < allTrackpoints.length; i++) {
        const point = allTrackpoints[i];
        const record: RecordData = {
            timestamp: new Date(point.Time),
            latitude: point.Position?.LatitudeDegrees ? parseFloat(point.Position.LatitudeDegrees) : undefined,
            longitude: point.Position?.LongitudeDegrees ? parseFloat(point.Position.LongitudeDegrees) : undefined,
            altitude: point.AltitudeMeters ? parseFloat(point.AltitudeMeters) : undefined,
            distance: point.DistanceMeters ? parseFloat(point.DistanceMeters) : undefined,
            heart_rate: point.HeartRateBpm?.Value ? parseInt(point.HeartRateBpm.Value, 10) : undefined,
            cadence: point.Cadence ? parseInt(point.Cadence, 10) : undefined,
            // Speed might be in Extensions/TPX
            // Power might be in Extensions/TPX
        };

        // Check for extensions (commonly TPX for speed/cadence/power)
        const extensions = point.Extensions?.['ns3:TPX'] || point.Extensions?.TPX;
        if (extensions) {
            if (extensions['ns3:Speed']) record.speed = parseFloat(extensions['ns3:Speed']);
            else if (extensions.Speed) record.speed = parseFloat(extensions.Speed);
            
            if (extensions['ns3:RunCadence'] && !record.cadence) record.cadence = parseInt(extensions['ns3:RunCadence'], 10);
            else if (extensions.RunCadence && !record.cadence) record.cadence = parseInt(extensions.RunCadence, 10);

            if (extensions['ns3:Watts']) record.power = parseInt(extensions['ns3:Watts'], 10);
            else if (extensions.Watts) record.power = parseInt(extensions.Watts, 10);
        }
        
        // Calculate distance delta and elevation gain if position exists
        if (i > 0 && record.latitude && record.longitude) {
            const prevPoint = detailedRecords[detailedRecords.length - 1]; // Get previous processed record
            if (prevPoint.latitude && prevPoint.longitude) {
                const distDelta = calculateDistance(prevPoint.latitude, prevPoint.longitude, record.latitude, record.longitude);
                // Use cumulative distance from file if available and seems valid, otherwise sum deltas
                if (record.distance !== undefined && record.distance > (totalDistance || 0)) {
                    totalDistance = record.distance; // Trust file's cumulative distance
                } else {
                    totalDistance += distDelta;
                }
            }
            if (record.altitude && prevPoint.altitude && record.altitude > prevPoint.altitude) {
                totalElevationGain += (record.altitude - prevPoint.altitude);
            }
        }
        
        detailedRecords.push(record);

        // Collect stats
        if (record.heart_rate && record.heart_rate > 0) heartRates.push(record.heart_rate);
        if (record.speed && record.speed > 0) speeds.push(record.speed);
        if (record.cadence && record.cadence > 0) cadences.push(record.cadence);
        if (record.power && record.power > 0) powers.push(record.power);
    }
    
    // Calculate averages/max
    const avgHeartRate = heartRates.length > 0 ? Math.round(heartRates.reduce((s, v) => s + v, 0) / heartRates.length) : undefined;
    const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : undefined;
    const avgSpeed = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : (totalDistance / totalElapsedTime);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : avgSpeed * 1.2; // Estimate max if not available
    const avgCadence = cadences.length > 0 ? Math.round(cadences.reduce((s, v) => s + v, 0) / cadences.length) : undefined;
    const maxCadence = cadences.length > 0 ? Math.max(...cadences) : undefined;
    const avgPower = powers.length > 0 ? Math.round(powers.reduce((s, v) => s + v, 0) / powers.length) : undefined;
    const maxPower = powers.length > 0 ? Math.max(...powers) : undefined;

    const mappedType = mapStravaType(sport);
    const stravaId = extractStravaIdFromFilename(fileName);
    let activityName = generateActivityName({ distance: totalDistance, elapsed_time: totalElapsedTime, sport: sport }, actualStartTime, mappedType);
    activityName += (stravaId ? ` (Strava: ${stravaId})` : '');

    const transformedActivity: ProcessedActivityData = {
        id: stravaId || `tcx_${Date.now()}`,
        name: activityName,
        type: mappedType,
        start_date: actualStartTime.toISOString(),
        elapsed_time: totalElapsedTime,
        distance: totalDistance,
        total_elevation_gain: totalElevationGain > 0 ? totalElevationGain : undefined,
        has_heartrate: !!avgHeartRate,
        average_heartrate: avgHeartRate,
        max_heartrate: maxHeartRate,
        average_speed: avgSpeed,
        max_speed: maxSpeed,
        average_cadence: avgCadence,
        max_cadence: maxCadence,
        average_power: avgPower,
        max_power: maxPower,
        records: detailedRecords,
        notes: generateActivityNotes({}, actualStartTime, fileName), // TCX doesn't usually have a top-level description
        sport: sport,
    };

    console.log(`Processed TCX file ${fileName}, returning data for ${transformedActivity.id}`);
    return transformedActivity;

  } catch (error) {
    console.error(`Error processing TCX file ${fileName}:`, error);
    throw error; // Re-throw to be caught by the worker
  }
} 