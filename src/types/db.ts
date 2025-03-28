export interface Set {
  weight: number;
  reps: number;
  notes?: string;
}

export interface Exercise {
  name: string;
  sets: Set[];
  notes?: string;
}

export interface WorkoutData {
  _id: string;
  userId: string;
  type: string;
  name?: string;
  date: Date;
  duration: number;
  distance?: number;
  calories?: number;
  notes?: string;
  intensity?: string;
  volume?: number;
  exercises?: Exercise[];
  cardioDetails?: {
    distance?: number;
    duration?: number;
    pace?: number;
    speed?: number;
    maxSpeed?: number;
    elevationGain?: number;
    heartRate?: {
      average?: number;
      max?: number;
      zones?: {
        thresholds: {
          easy: number;
          moderate: number;
          hard: number;
          peak: number;
        };
        distribution: {
          easy: number;
          moderate: number;
          hard: number;
          peak: number;
        };
      };
    };
    laps?: Array<{
      number?: number;
      time?: number;
      distance?: number;
      pace?: number;
      duration?: number;
    }>;
    poolLength?: number;
    strokeType?: string;
    bikeType?: string;
    power?: {
      average?: number;
      max?: number;
    };
  };
  source?: string;
  sourceId?: string;
  importedFrom?: string;
  importId?: string;
  stravaLink?: string;
  createdAt: string;
  updatedAt: string;
  progressMetrics?: {
    durationChange?: number;
    durationChangePercent?: number;
    distanceChange?: number;
    distanceChangePercent?: number;
    paceChange?: number;
    paceChangePercent?: number;
  };
}

export interface UserData {
  _id: string;
  email: string;
  name?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  userId: string;
  content: string;
  role: "user" | "assistant";
  workoutId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseData {
  _id: string;
  name: string;
  description?: string;
  muscleGroups: string[];
  category: "strength" | "cardio" | "flexibility";
  equipment?: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExerciseData {
  _id: string;
  workoutId: string;
  exerciseId: string;
  exercise?: ExerciseData;
  sets: Set[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
} 