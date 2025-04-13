import { FitFileParser, FitActivityData } from './fitFileService';
import { GpxFileParser, GpxActivityData } from './gpxFileService';

export interface ProcessedActivity {
  // Core data
  id?: string;
  type: string;
  name: string;
  date: Date;
  duration: number;  // In seconds
  distance: number;  // In meters
  
  // Timing details
  moving_time: number;  // In seconds
  elapsed_time: number;  // In seconds
  
  // Performance metrics
  average_speed?: number;  // In m/s
  max_speed?: number;  // In m/s
  average_heart_rate?: number;
  max_heart_rate?: number;
  total_elevation_gain?: number;
  
  // Additional metrics
  calories?: number;
  average_cadence?: number;
  max_cadence?: number;
  average_power?: number;
  max_power?: number;
  
  // Source information
  source?: string;
  source_id?: string;
  description?: string;
  
  // Detailed data
  records?: Array<{
    timestamp: Date;
    heart_rate?: number;
    distance?: number;
    speed?: number;
    altitude?: number;
    latitude?: number;
    longitude?: number;
    cadence?: number;
    power?: number;
  }>;
}

export class ActivityProcessor {
  private fitParser: FitFileParser;
  private gpxParser: GpxFileParser;

  constructor() {
    this.fitParser = new FitFileParser();
    this.gpxParser = new GpxFileParser();
  }

  private calculateCalories(duration: number, type: string): number {
    // Basic MET (Metabolic Equivalent of Task) values
    const metValues: { [key: string]: number } = {
      running: 8.0,
      cycling: 6.0,
      swimming: 7.0,
      walking: 3.5,
      hiking: 5.0,
      other: 5.0
    };

    // Assume 70kg person if no weight data available
    const weight = 70;
    const met = metValues[type] || metValues.other;
    
    // Calories = MET * weight in kg * duration in hours
    return Math.round(met * weight * (duration / 3600));
  }

  private determineActivityType(
    sourceType: string | undefined,
    avgSpeed: number | undefined,
    fileName: string
  ): string {
    // If we have a valid source type, use it
    if (sourceType && ['running', 'cycling', 'swimming', 'walking', 'hiking'].includes(sourceType)) {
      return sourceType;
    }

    // Check filename for clues
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.includes('run')) return 'running';
    if (lowerFileName.includes('ride') || lowerFileName.includes('cycling')) return 'cycling';
    if (lowerFileName.includes('swim')) return 'swimming';
    if (lowerFileName.includes('walk')) return 'walking';
    if (lowerFileName.includes('hike')) return 'hiking';

    // Use speed to guess activity type if available
    if (avgSpeed !== undefined) {
      const speedKmh = avgSpeed * 3.6;
      if (speedKmh > 20) return 'cycling';
      if (speedKmh > 8) return 'running';
      return 'walking';
    }

    return 'other';
  }

  private processFitActivity(activity: FitActivityData, fileName: string): ProcessedActivity {
    const movingTime = activity.total_timer_time || activity.total_moving_time || activity.total_elapsed_time || 0;
    const elapsedTime = activity.total_elapsed_time || movingTime;
    
    const type = this.determineActivityType(
      activity.sport,
      activity.enhanced_avg_speed || activity.avg_speed,
      fileName
    );

    return {
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} on ${activity.start_time.toLocaleDateString()}`,
      date: activity.start_time,
      duration: movingTime,
      moving_time: movingTime,
      elapsed_time: elapsedTime,
      distance: activity.total_distance || 0,
      average_speed: activity.enhanced_avg_speed || activity.avg_speed,
      max_speed: activity.enhanced_max_speed || activity.max_speed,
      average_heart_rate: activity.avg_heart_rate,
      max_heart_rate: activity.max_heart_rate,
      total_elevation_gain: activity.total_ascent,
      calories: activity.total_calories || this.calculateCalories(movingTime, type),
      average_cadence: activity.avg_cadence,
      max_cadence: activity.max_cadence,
      average_power: activity.avg_power,
      max_power: activity.max_power,
      records: activity.records?.map(r => ({
        timestamp: r.timestamp,
        heart_rate: r.heart_rate,
        distance: r.distance,
        speed: r.speed,
        altitude: r.altitude,
        latitude: r.position_lat,
        longitude: r.position_long,
        cadence: r.cadence,
        power: r.power
      }))
    };
  }

  private processGpxActivity(activity: GpxActivityData, fileName: string): ProcessedActivity {
    const type = this.determineActivityType(
      activity.type,
      activity.average_speed,
      fileName
    );

    return {
      type,
      name: activity.name || `${type.charAt(0).toUpperCase() + type.slice(1)} on ${activity.start_time.toLocaleDateString()}`,
      date: activity.start_time,
      duration: activity.total_time,
      moving_time: activity.total_time,
      elapsed_time: activity.total_time,
      distance: activity.total_distance,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heart_rate: activity.average_heart_rate,
      max_heart_rate: activity.max_heart_rate,
      total_elevation_gain: activity.total_elevation_gain,
      calories: this.calculateCalories(activity.total_time, type),
      average_cadence: activity.average_cadence,
      max_cadence: activity.max_cadence,
      average_power: activity.average_power,
      max_power: activity.max_power,
      description: activity.description,
      records: activity.points.map(p => ({
        timestamp: p.timestamp,
        heart_rate: p.heart_rate,
        speed: p.speed,
        altitude: p.elevation,
        latitude: p.latitude,
        longitude: p.longitude,
        cadence: p.cadence,
        power: p.power
      }))
    };
  }

  public async processActivityFile(
    buffer: Buffer,
    fileName: string,
    fileType: 'fit' | 'gpx'
  ): Promise<ProcessedActivity> {
    try {
      if (fileType === 'fit') {
        const fitActivity = await this.fitParser.parse(buffer);
        return this.processFitActivity(fitActivity, fileName);
      } else {
        const gpxActivity = await this.gpxParser.parse(buffer);
        return this.processGpxActivity(gpxActivity, fileName);
      }
    } catch (error) {
      throw new Error(`Activity processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 