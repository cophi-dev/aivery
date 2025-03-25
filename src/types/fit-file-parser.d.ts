declare module 'fit-file-parser' {
  export interface FitSession {
    start_time: string | number
    total_elapsed_time: number
    total_distance: number
    total_calories?: number
    sport?: string
    avg_heart_rate?: number
    max_heart_rate?: number
    enhanced_avg_speed?: number
    enhanced_max_speed?: number
    avg_speed?: number
    max_speed?: number
    total_ascent?: number
    avg_power?: number
    max_power?: number
  }

  export interface FitData {
    sessions?: FitSession[]
  }

  export interface FitParserOptions {
    force?: boolean
    speedUnit?: string
    lengthUnit?: string
    temperatureUnit?: string
    elapsedRecordField?: boolean
    mode?: string
  }

  export class FitParser {
    constructor(options?: FitParserOptions)
    parse(content: Buffer, callback: (error: Error | null, data: FitData) => void): void
  }
} 