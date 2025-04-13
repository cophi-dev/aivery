import { Parser as XmlParser } from 'xml2js';

export interface GpxPoint {
  timestamp: Date;
  latitude: number;
  longitude: number;
  elevation?: number;
  heart_rate?: number;
  cadence?: number;
  speed?: number;
  power?: number;
}

export interface GpxActivityData {
  // Core timing data
  start_time: Date;
  end_time: Date;
  total_time: number;  // In seconds

  // Distance and elevation
  total_distance: number;  // In meters
  total_elevation_gain?: number;  // In meters

  // Speed
  average_speed?: number;  // In m/s
  max_speed?: number;  // In m/s

  // Heart rate
  average_heart_rate?: number;
  max_heart_rate?: number;

  // Additional metrics
  average_cadence?: number;
  max_cadence?: number;
  average_power?: number;
  max_power?: number;

  // Track points for detailed analysis
  points: GpxPoint[];

  // Metadata
  name?: string;
  description?: string;
  type?: string;
}

export class GpxFileParser {
  private xmlParser: XmlParser;

  constructor() {
    this.xmlParser = new XmlParser({
      explicitArray: false,
      mergeAttrs: true
    });
  }

  private validateCoordinate(coord: number): boolean {
    return !isNaN(coord) && Math.abs(coord) <= 180;
  }

  private validateTimestamp(timestamp: string | number | Date): Date {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    return date;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private extractHeartRate(extensions: any): number | undefined {
    try {
      if (extensions.TrackPointExtension?.hr) {
        return parseInt(extensions.TrackPointExtension.hr, 10);
      }
      if (extensions['gpxtpx:TrackPointExtension']?.['gpxtpx:hr']) {
        return parseInt(extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'], 10);
      }
      if (extensions.heart_rate) {
        return parseInt(extensions.heart_rate, 10);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async parseGpxString(gpxString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.xmlParser.parseString(gpxString, (error: Error | null, result: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  public async parse(buffer: Buffer): Promise<GpxActivityData> {
    try {
      const gpxString = buffer.toString('utf-8');
      const gpxData = await this.parseGpxString(gpxString);

      if (!gpxData?.gpx?.trk) {
        throw new Error('No track data found in GPX file');
      }

      const track = gpxData.gpx.trk;
      const points: GpxPoint[] = [];
      let totalDistance = 0;
      let totalElevationGain = 0;
      let maxSpeed = 0;
      let heartRates: number[] = [];
      let cadences: number[] = [];
      let powers: number[] = [];

      // Process track segments
      const segments = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg];
      for (const segment of segments) {
        if (!segment?.trkpt) continue;

        const trackPoints = Array.isArray(segment.trkpt) ? segment.trkpt : [segment.trkpt];
        let prevPoint: GpxPoint | null = null;

        for (const point of trackPoints) {
          if (!point.lat || !point.lon || !this.validateCoordinate(point.lat) || !this.validateCoordinate(point.lon)) {
            continue;
          }

          const gpxPoint: GpxPoint = {
            timestamp: this.validateTimestamp(point.time),
            latitude: parseFloat(point.lat),
            longitude: parseFloat(point.lon),
            elevation: point.ele ? parseFloat(point.ele) : undefined
          };

          // Extract extension data
          if (point.extensions) {
            gpxPoint.heart_rate = this.extractHeartRate(point.extensions);
            if (gpxPoint.heart_rate) heartRates.push(gpxPoint.heart_rate);

            // Extract other extension data if available
            if (point.extensions.TrackPointExtension) {
              const ext = point.extensions.TrackPointExtension;
              gpxPoint.cadence = ext.cad ? parseInt(ext.cad, 10) : undefined;
              if (gpxPoint.cadence) cadences.push(gpxPoint.cadence);

              gpxPoint.power = ext.power ? parseInt(ext.power, 10) : undefined;
              if (gpxPoint.power) powers.push(gpxPoint.power);
            }
          }

          // Calculate distance and speed between points
          if (prevPoint) {
            const segmentDistance = this.calculateDistance(
              prevPoint.latitude, prevPoint.longitude,
              gpxPoint.latitude, gpxPoint.longitude
            );

            const timeDiff = (gpxPoint.timestamp.getTime() - prevPoint.timestamp.getTime()) / 1000;
            if (timeDiff > 0) {
              const speed = segmentDistance / timeDiff;
              gpxPoint.speed = speed;
              maxSpeed = Math.max(maxSpeed, speed);
            }

            totalDistance += segmentDistance;

            // Calculate elevation gain
            if (gpxPoint.elevation !== undefined && prevPoint.elevation !== undefined) {
              const elevationDiff = gpxPoint.elevation - prevPoint.elevation;
              if (elevationDiff > 0) totalElevationGain += elevationDiff;
            }
          }

          points.push(gpxPoint);
          prevPoint = gpxPoint;
        }
      }

      if (points.length < 2) {
        throw new Error('Insufficient track points in GPX file');
      }

      // Calculate aggregate metrics
      const startTime = points[0].timestamp;
      const endTime = points[points.length - 1].timestamp;
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000;
      const averageSpeed = totalDistance / totalTime;

      const averageHeartRate = heartRates.length > 0 
        ? Math.round(heartRates.reduce((a, b) => a + b) / heartRates.length) 
        : undefined;
      const maxHeartRate = heartRates.length > 0 
        ? Math.max(...heartRates) 
        : undefined;

      const averageCadence = cadences.length > 0
        ? Math.round(cadences.reduce((a, b) => a + b) / cadences.length)
        : undefined;
      const maxCadence = cadences.length > 0
        ? Math.max(...cadences)
        : undefined;

      const averagePower = powers.length > 0
        ? Math.round(powers.reduce((a, b) => a + b) / powers.length)
        : undefined;
      const maxPower = powers.length > 0
        ? Math.max(...powers)
        : undefined;

      // Determine activity type from metadata if available
      let type = 'other';
      const fullPath = track.name?.toLowerCase() || '';
      if (fullPath.includes('run')) type = 'running';
      else if (fullPath.includes('ride') || fullPath.includes('cycling')) type = 'cycling';
      else if (fullPath.includes('swim')) type = 'swimming';
      else if (fullPath.includes('walk')) type = 'walking';
      else if (fullPath.includes('hike')) type = 'hiking';

      return {
        start_time: startTime,
        end_time: endTime,
        total_time: totalTime,
        total_distance: totalDistance,
        total_elevation_gain: totalElevationGain,
        average_speed: averageSpeed,
        max_speed: maxSpeed,
        average_heart_rate: averageHeartRate,
        max_heart_rate: maxHeartRate,
        average_cadence: averageCadence,
        max_cadence: maxCadence,
        average_power: averagePower,
        max_power: maxPower,
        points: points,
        name: track.name,
        description: track.desc,
        type: type
      };
    } catch (error) {
      throw new Error(`GPX file parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 