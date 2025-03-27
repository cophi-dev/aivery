export interface WorkoutData {
  id: string
  userId: string
  name: string
  date: Date
  duration: number // in minutes
  intensity: "Low" | "Medium" | "High"
  type: WorkoutType
  volume?: number // total weight lifted (for strength workouts)
  distance?: number // in kilometers/miles (for cardio workouts)
  calories?: number // estimated calories burned
  exercises?: Exercise[] // for strength workouts
  cardioDetails?: CardioDetails // for cardio workouts
  notes?: string
  completed?: boolean
  completedAt?: Date
  source?: "manual" | "garmin" | "coros" | "strava" | "apple" | "ai"
  sourceId?: string
  importedFrom?: string
  importId?: string
  stravaLink?: string
}

export type WorkoutType = "strength" | "running" | "swimming" | "cycling" | "hiit" | "flexibility" | "other"

export interface Exercise {
  name: string
  sets: Set[]
}

export interface Set {
  weight: number
  reps: number
}

export interface CardioDetails {
  distance: number // in kilometers/miles
  duration: number // in minutes
  pace?: number // minutes per km/mile
  elevationGain?: number // in meters/feet (for running/cycling)
  heartRate?: HeartRateData
  laps?: Lap[] // for swimming or track workouts
  route?: GeoPoint[] // for GPS tracked workouts
}

export interface HeartRateData {
  average: number // in bpm
  max: number // in bpm
  zones?: {
    thresholds: {
      easy: number
      moderate: number
      hard: number
      peak: number
    }
    distribution: {
      easy: number // percentage of time in zone
      moderate: number
      hard: number
      peak: number
    }
  }
}

export interface Lap {
  number: number
  distance: number
  duration: number // in seconds
  pace?: number // minutes per km/mile
}

export interface GeoPoint {
  latitude: number
  longitude: number
  elevation?: number
  timestamp: Date
}

export interface ChatMessage {
  id: string
  userId: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

export interface UserProfile {
  id: string
  name: string
  email: string
  height?: number
  weight?: number
  age?: number
  gender?: string
  activityLevel?: string
  goals?: string[]
  connectedApps?: ConnectedApp[]
}

export interface ConnectedApp {
  id: string
  name: string // e.g., "Strava", "Garmin", "Apple Health"
  connected: boolean
  lastSynced?: Date
  permissions: string[] // e.g., ["read_workouts", "write_workouts"]
}

