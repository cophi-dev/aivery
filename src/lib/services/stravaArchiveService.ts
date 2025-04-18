import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';
import { Buffer } from 'buffer';
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
interface ProcessedActivityData {
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
  records?: Array<{ timestamp: Date, [key: string]: any }>; // Array of record objects
  notes?: string;
  sport?: string;
  subSport?: string;
}

export async function processFitFile(content: Buffer, fileName: string): Promise<ProcessedActivityData | null> {
  try {
    console.log(`Processing FIT file: ${fileName}, size: ${content.length} bytes`);
    
    const fitFileParserModule = await import('fit-file-parser');
    const FitParserConstructor = fitFileParserModule.default;
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
    console.log(`Processing GPX file: ${fileName}, size: ${content.length} bytes`);
    const xml2js = await import('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    const gpxData = await parser.parseStringPromise(content.toString('utf-8'));
    
    if (!gpxData.gpx || !gpxData.gpx.trk) {
      console.warn(`No track data found in GPX file: ${fileName}`);
      return null;
    }
    
    const track = gpxData.gpx.trk;
    const trackName = track.name || '';
    let trackPoints: any[] = [];
    // Correctly extract track points from potentially nested segments
    if (track.trkseg) {
        if (Array.isArray(track.trkseg)) {
            trackPoints = track.trkseg.reduce((p: any[], seg: any) => p.concat(Array.isArray(seg.trkpt) ? seg.trkpt : (seg.trkpt ? [seg.trkpt] : [])), []);
        } else if (track.trkseg.trkpt) {
            trackPoints = Array.isArray(track.trkseg.trkpt) ? track.trkseg.trkpt : [track.trkseg.trkpt];
        }
    }

    if (trackPoints.length === 0) {
      console.warn(`No track points found in GPX file: ${fileName}`);
      return null;
    }
    
    // --- Calculate Core Metrics --
    const currentTime = new Date();
    let fallbackDate = new Date(); // Default to now
    // Try to get a better fallback date from filename ID
    const idMatchFile = fileName.match(/(\d{10,})/); // Look for timestamp-like ID
    if (idMatchFile) {
        try {
            const potentialTs = parseInt(idMatchFile[1]);
            const potentialDate = new Date(potentialTs * 1000);
            if (potentialDate < currentTime && potentialDate > new Date('2005-01-01')) {
                fallbackDate = potentialDate;
            }
        } catch {}
    }

    let startTime: Date = fallbackDate;
    let endTime: Date = new Date(fallbackDate.getTime()); // Init end time same as start
    let validTimeCount = 0;
    let earliestTime = Infinity;
    let latestTime = -Infinity;

    // Determine start/end time from points if available
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
        // Estimate end time if no valid points (e.g., assume 1 hour, or calculate later if distance exists)
        endTime = new Date(startTime.getTime() + 3600 * 1000); 
    }
    
    let totalDistance = 0; // meters
    let totalElevationGain = 0; // meters
    let sport = 'other';
    let heartRates: number[] = [];
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
        const R = 6371e3; const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    
    // Calculate distance, elevation, HR from points
    if (trackPoints.length > 1) {
      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i-1], curr = trackPoints[i];
        if (prev.$ && curr.$ && prev.$.lat && prev.$.lon && curr.$.lat && curr.$.lon) {
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
    
    // Create detailed records (timestamp is crucial)
    const detailedRecords = trackPoints.map((p: any, i: number) => {
        let ts = startTime; // Default to start time
        try { 
            if (p.time) { 
                const pt = new Date(p.time); 
                // Check if date is valid and within a reasonable range (e.g., not 1970)
                if(!isNaN(pt.getTime()) && pt.getFullYear() > 1980) ts = pt; 
            } else if (validTimeCount === 0 && totalElapsedTime > 0 && trackPoints.length > 1) {
                 // If no time data at all, distribute points linearly over estimated duration
                 ts = new Date(startTime.getTime() + Math.round(i * (totalElapsedTime * 1000 / (trackPoints.length -1))));
            }
        } catch {}
        
        let hr: number | undefined;
        try { 
            const ext = p.extensions;
            let hrStr: string | undefined;
            if (ext && ext['gpxtpx:TrackPointExtension'] && ext['gpxtpx:TrackPointExtension']['gpxtpx:hr']) {
                 hrStr = ext['gpxtpx:TrackPointExtension']['gpxtpx:hr'];
            }
            if (hrStr) {
                const parsedHr = parseInt(hrStr, 10);
                if (!isNaN(parsedHr) && parsedHr > 0 && parsedHr < 300) hr = parsedHr;
            }
        } catch {}

        return {
             timestamp: ts,
             heart_rate: hr,
             latitude: p.$?.lat ? parseFloat(p.$.lat) : undefined,
             longitude: p.$?.lon ? parseFloat(p.$.lon) : undefined,
             altitude: p.ele ? parseFloat(p.ele) : undefined
         };
    }).filter(r => r.latitude !== undefined && r.longitude !== undefined); // Filter out records without coordinates

    let activityName = generateActivityName({ distance: totalDistance, elapsed_time: totalElapsedTime, sport: sport }, startTime, sport);
    activityName += (stravaIdMatch ? ` (Strava: ${stravaIdMatch})` : '');
    
    const transformedActivity: ProcessedActivityData = {
      id: id, name: activityName, type: sport, start_date: startTime.toISOString(),
      elapsed_time: totalElapsedTime, distance: totalDistance, total_elevation_gain: totalElevationGain,
      has_heartrate: heartRates.length > 0, average_heartrate: avgHeartRate, max_heartrate: maxHeartRate,
      average_speed: avgSpeed,
      records: detailedRecords,
      notes: generateActivityNotes(gpxData.gpx.metadata, startTime, fileName),
      sport: sport
    };
    
    console.log(`Processed GPX file ${fileName}, returning data for ${transformedActivity.id}`);
    return transformedActivity;

  } catch (error) {
    console.error(`Error processing GPX file ${fileName}:`, error);
    throw error; // Re-throw the error
  }
}

// --- Unused/Out of Place Functions (commented out) ---

// function calculateIntensityFromSession(session: any): "Low" | "Medium" | "High" { ... }
// interface FitActivity { ... } // Defined ProcessedActivityData instead
// function extractActivityFromRecords(data: any): FitActivity | null { ... }
// async function createBaseExerciseForType(type: string): Promise<void> { ... }
// async function parseGPX(gpxString: string): Promise<any> { ... } 