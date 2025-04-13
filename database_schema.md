# Database Schema Documentation

This document outlines the structure of the database collections based on the TypeScript interfaces defined in `src/types/db.ts`.

## `Set`

Represents a single set within a workout exercise.

```typescript
export interface Set {
  _id?: string; // Unique identifier for the set
  workoutExerciseId?: string; // Reference to the parent WorkoutExerciseData
  order?: number; // Order of the set within the exercise
  weight?: number; // Weight used (e.g., in kg or lbs)
  reps?: number; // Number of repetitions performed
  duration?: number; // Duration of the set (e.g., in seconds for time-based sets)
  distance?: number; // Distance covered (e.g., in meters for cardio intervals)
  notes?: string; // Any specific notes for this set
}
```

## `WorkoutData`

Represents a single workout session recorded by a user.

```typescript
export interface WorkoutData {
  _id: string; // Unique identifier for the workout
  userId: string; // Reference to the UserData (_id) who performed the workout
  type: string; // Type of workout (e.g., "strength", "run", "cycle", "swim")
  name?: string; // Optional custom name for the workout
  date: Date | string; // Date and time the workout was performed
  duration: number; // Total duration of the workout in seconds
  distance?: number; // Total distance covered (e.g., in meters)
  calories?: number; // Estimated calories burned
  notes?: string; // General notes about the workout
  intensity?: string; // Perceived intensity (e.g., "easy", "moderate", "hard")
  workoutExercises?: WorkoutExerciseData[]; // Array of exercises performed during the workout
  cardioDetails?: { // Specific details for cardio workouts
    distance?: number; // Cardio-specific distance (may differ from main distance)
    duration?: number; // Cardio-specific duration
    pace?: number; // Average pace (e.g., min/km or min/mile)
    speed?: number; // Average speed (e.g., km/h or mph)
    maxSpeed?: number; // Maximum speed reached
    elevationGain?: number; // Total elevation gain (e.g., in meters)
    heartRate?: {
      average?: number; // Average heart rate (bpm)
      max?: number; // Maximum heart rate (bpm)
      zones?: { // Heart rate zone distribution
        thresholds: {
          easy: number;
          moderate: number;
          hard: number;
          peak: number;
        };
        distribution: { // Time or percentage spent in each zone
          easy: number;
          moderate: number;
          hard: number;
          peak: number;
        };
      };
    };
    laps?: Array<{ // Data for individual laps or splits
      number?: number;
      time?: number;
      distance?: number;
      pace?: number;
      duration?: number;
    }>;
    poolLength?: number; // Length of the pool for swim workouts
    strokeType?: string; // Dominant stroke type for swim workouts
    bikeType?: string; // Type of bike used for cycling workouts
    power?: { // Power data (e.g., from a power meter)
      average?: number; // Average power (watts)
      max?: number; // Maximum power (watts)
    };
    sportDetails?: { // More specific sport categorization
      sport?: string;
      subSport?: string;
    };
    gearInfo?: { // Information about equipment used
      id?: string;
      name?: string;
      distance?: number; // Distance covered with specific gear
    };
    weather?: { // Weather conditions during the workout
      temperature?: number;
      humidity?: number;
      windSpeed?: number;
      conditions?: string;
    };
    stravaSpecific?: { // Data specific to Strava imports
      segmentEfforts?: number;
      achievementCount?: number;
      kudosCount?: number;
      athleteWeight?: number;
      commute?: boolean;
      deviceName?: string;
    };
  };
  source?: string; // Source of the workout data (e.g., "manual", "strava", "garmin")
  sourceId?: string; // Original ID from the source system
  importedFrom?: string; // Deprecated/Alternative source tracking?
  importId?: string; // Deprecated/Alternative source ID tracking?
  stravaLink?: string; // Direct link to the activity on Strava
  createdAt: string; // Timestamp when the record was created
  updatedAt: string; // Timestamp when the record was last updated
  progressMetrics?: { // Metrics comparing this workout to previous similar ones
    durationChange?: number;
    durationChangePercent?: number;
    distanceChange?: number;
    distanceChangePercent?: number;
    paceChange?: number;
    paceChangePercent?: number;
  };
  pace?: number; // Overall calculated pace (redundant with cardioDetails?)
  calculatedVolume?: number; // Total volume for strength workouts (sum of weight * reps)
  records?: Array<{ // Time-series data points recorded during the workout
    timestamp: Date | string;
    heart_rate?: number;
    distance?: number; // Cumulative distance at this timestamp
    speed?: number;
    altitude?: number;
    latitude?: number;
    longitude?: number;
    cadence?: number; // Steps or revolutions per minute
    power?: number; // Instantaneous power (watts)
  }>;
}
```

## `UserData`

Represents a user of the application.

```typescript
export interface UserData {
  _id: string; // Unique identifier for the user
  email: string; // User's email address (likely used for login)
  name?: string; // User's display name
  image?: string; // URL to the user's profile picture
  createdAt: string; // Timestamp when the user account was created
  updatedAt: string; // Timestamp when the user account was last updated
}
```

## `ChatMessage`

Represents a single message in the AI chat interface.

```typescript
export interface ChatMessage {
  _id: string; // Unique identifier for the message
  userId: string; // Reference to the UserData (_id) who sent/received the message
  content: string; // The text content of the message
  role: "user" | "assistant"; // Who sent the message
  workoutId?: string; // Optional reference to a specific WorkoutData (_id) discussed
  createdAt: string; // Timestamp when the message was created
  updatedAt: string; // Timestamp when the message was last updated
}
```

## `ExerciseData`

Represents a specific type of exercise available in the application's library.

```typescript
export interface ExerciseData {
  _id: string; // Unique identifier for the exercise type
  name: string; // Name of the exercise (e.g., "Bench Press", "Running")
  description?: string; // Detailed description of the exercise
  muscleGroups: string[]; // Primary muscle groups targeted
  category: "strength" | "cardio" | "flexibility"; // General category of the exercise
  equipment?: string; // Equipment typically required
  instructions?: string; // How to perform the exercise
  createdAt: string; // Timestamp when the exercise was added
  updatedAt: string; // Timestamp when the exercise was last updated
}
```

## `WorkoutExerciseData`

Links a specific `ExerciseData` to a `WorkoutData`, detailing how that exercise was performed during that workout session, including its sets.

```typescript
export interface WorkoutExerciseData {
  _id: string; // Unique identifier for this specific instance of an exercise within a workout
  workoutId: string; // Reference to the parent WorkoutData (_id)
  exerciseId: { // Embedded reference to the ExerciseData
    _id: string; // ID of the exercise type
    name: string; // Name of the exercise type (denormalized for convenience)
    category?: string; // Category of the exercise type (denormalized)
  };
  sets: Set[]; // Array of sets performed for this exercise in this workout
  notes?: string; // Notes specific to this exercise within the workout
  order?: number; // Order in which this exercise was performed in the workout
  duration?: number; // Total duration spent on this exercise (e.g., for cardio segments)
  distance?: number; // Total distance covered during this exercise (e.g., for cardio segments)
  createdAt: string; // Timestamp when this record was created
  updatedAt: string; // Timestamp when this record was last updated
} 