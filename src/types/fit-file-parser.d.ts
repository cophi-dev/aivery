declare module 'fit-file-parser' {
  export interface FitRecord {
    timestamp: number | string;
    position_lat?: number;
    position_long?: number;
    distance?: number;
    speed?: number;
    heart_rate?: number;
    altitude?: number;
    power?: number;
    cadence?: number;
  }

  export interface FitSession {
    start_time: string | number;
    total_timer_time?: number;
    total_elapsed_time?: number;
    total_moving_time?: number;
    total_distance?: number;
    enhanced_avg_speed?: number;
    enhanced_max_speed?: number;
    avg_speed?: number;
    max_speed?: number;
    avg_heart_rate?: number;
    max_heart_rate?: number;
    total_ascent?: number;
    total_descent?: number;
    avg_power?: number;
    max_power?: number;
    total_calories?: number;
    avg_cadence?: number;
    max_cadence?: number;
    sport?: string;
    sub_sport?: string;
  }

  export interface FitData {
    sessions?: FitSession[];
    records?: FitRecord[];
  }

  interface FitParserOptions {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
    mode?: string;
  }

  class FitParser {
    constructor(options?: FitParserOptions);
    parse(content: Buffer, callback: (error: Error | null, data: FitData) => void): void;
  }

  export = FitParser;
} 