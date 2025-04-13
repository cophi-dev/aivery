import type { FitData, FitSession, FitRecord } from 'fit-file-parser';
import FitParser from 'fit-file-parser';

export interface FitActivityData {
  // Core timing data
  start_time: Date;
  total_timer_time?: number;  // Moving time in seconds
  total_elapsed_time?: number;  // Total time including stops in seconds
  total_moving_time?: number;  // Alternative moving time field

  // Distance and speed
  total_distance?: number;  // In meters
  enhanced_avg_speed?: number;  // In m/s
  enhanced_max_speed?: number;  // In m/s
  avg_speed?: number;  // Fallback speed in m/s
  max_speed?: number;  // Fallback max speed in m/s

  // Heart rate
  avg_heart_rate?: number;
  max_heart_rate?: number;

  // Power data
  avg_power?: number;
  max_power?: number;

  // Elevation
  total_ascent?: number;  // In meters
  total_descent?: number;  // In meters

  // Activity type
  sport?: string;
  sub_sport?: string;

  // Additional metrics
  total_calories?: number;
  avg_cadence?: number;
  max_cadence?: number;

  // Raw data for advanced processing
  records?: Array<{
    timestamp: Date;
    position_lat?: number;
    position_long?: number;
    distance?: number;
    speed?: number;
    heart_rate?: number;
    altitude?: number;
    power?: number;
    cadence?: number;
  }>;
}

export class FitFileParser {
  private parser: FitParser | null = null;
  private parserInitialized: boolean = false;

  constructor() {
    this.parserInitialized = false;
  }

  private async initializeParser() {
    if (!this.parserInitialized) {
      try {
        // Dynamic import for Next.js compatibility
        const { default: FitParserModule } = await import('fit-file-parser');
        
        this.parser = new FitParserModule({
          force: true,
          speedUnit: 'm/s',
          lengthUnit: 'm',
          temperatureUnit: 'celsius',
          elapsedRecordField: true,
          mode: 'list'
        });

        this.parserInitialized = true;
      } catch (error) {
        console.error('Error initializing FIT parser:', error);
        throw new Error(`Failed to initialize FIT parser: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private validateTimestamp(timestamp: number | Date | string): Date {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    return date;
  }

  private validateSpeed(speed: number): number | undefined {
    // Validate speed is reasonable (0-100 m/s = 0-360 km/h)
    return (speed >= 0 && speed <= 100) ? speed : undefined;
  }

  private validateHeartRate(hr: number): number | undefined {
    // Validate heart rate is in reasonable range (30-250 bpm)
    return (hr >= 30 && hr <= 250) ? hr : undefined;
  }

  private validateDistance(distance: number): number | undefined {
    // Validate distance is reasonable (0-1000 km)
    return (distance >= 0 && distance <= 1000000) ? distance : undefined;
  }

  private async parseFitBuffer(buffer: Buffer): Promise<FitData> {
    await this.initializeParser();
    
    if (!this.parser) {
      throw new Error('Parser not initialized');
    }

    return new Promise((resolve, reject) => {
      this.parser!.parse(buffer, (error: Error | null, data: FitData) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  public async parse(buffer: Buffer): Promise<FitActivityData> {
    try {
      const rawData = await this.parseFitBuffer(buffer);
      const session = rawData.sessions?.[0];

      if (!session) {
        throw new Error('No session data found in FIT file');
      }

      // Extract and validate core data
      const activity: FitActivityData = {
        start_time: this.validateTimestamp(session.start_time),
        total_timer_time: session.total_timer_time,
        total_elapsed_time: session.total_elapsed_time,
        total_moving_time: session.total_moving_time,
        sport: session.sport?.toLowerCase(),
        sub_sport: session.sub_sport?.toLowerCase()
      };

      // Validate and assign optional fields
      if (session.total_distance !== undefined) {
        activity.total_distance = this.validateDistance(session.total_distance);
      }

      if (session.enhanced_avg_speed !== undefined) {
        activity.enhanced_avg_speed = this.validateSpeed(session.enhanced_avg_speed);
      }

      if (session.enhanced_max_speed !== undefined) {
        activity.enhanced_max_speed = this.validateSpeed(session.enhanced_max_speed);
      }

      // Heart rate data
      if (session.avg_heart_rate !== undefined) {
        activity.avg_heart_rate = this.validateHeartRate(session.avg_heart_rate);
      }

      if (session.max_heart_rate !== undefined) {
        activity.max_heart_rate = this.validateHeartRate(session.max_heart_rate);
      }

      // Additional metrics
      activity.total_ascent = session.total_ascent;
      activity.total_descent = session.total_descent;
      activity.total_calories = session.total_calories;
      activity.avg_power = session.avg_power;
      activity.max_power = session.max_power;
      activity.avg_cadence = session.avg_cadence;
      activity.max_cadence = session.max_cadence;

      // Process records if available
      const records = rawData.records ?? [];
      if (records.length > 0) {
        const processedRecords = records.map((record: FitRecord) => ({
          timestamp: this.validateTimestamp(record.timestamp),
          position_lat: record.position_lat,
          position_long: record.position_long,
          distance: record.distance !== undefined ? this.validateDistance(record.distance) : undefined,
          speed: record.speed !== undefined ? this.validateSpeed(record.speed) : undefined,
          heart_rate: record.heart_rate !== undefined ? this.validateHeartRate(record.heart_rate) : undefined,
          altitude: record.altitude,
          power: record.power,
          cadence: record.cadence
        }));

        activity.records = processedRecords;

        // Calculate missing metrics from records if needed
        if (!activity.total_distance && processedRecords.length > 1) {
          const lastRecord = processedRecords[processedRecords.length - 1];
          if (lastRecord.distance) {
            activity.total_distance = this.validateDistance(lastRecord.distance);
          }
        }

        if (!activity.total_timer_time && processedRecords.length > 1) {
          const firstRecord = processedRecords[0];
          const lastRecord = processedRecords[processedRecords.length - 1];
          activity.total_timer_time = 
            (lastRecord.timestamp.getTime() - firstRecord.timestamp.getTime()) / 1000;
        }
      }

      // Ensure we have at least basic timing data
      if (!activity.total_timer_time && !activity.total_elapsed_time && !activity.total_moving_time) {
        throw new Error('No valid timing data found in FIT file');
      }

      return activity;
    } catch (error) {
      console.error('FIT file parsing error:', error);
      throw new Error(`FIT file parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 