export interface Set {
  _id?: string;
  workoutExerciseId?: string;
  order?: number;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  notes?: string;
}

export interface SetData {
  _id: string;
  workoutExerciseId: string;
  order: number;
  weight: number;
  reps: number;
  duration?: number;
  distance?: number;
  notes?: string;
}

export interface WorkoutData {
  _id: string;
  userId: string;
  name: string;
  date: string | Date;
  duration: number;
  distance?: number;
  intensity?: string;
  type: string;
  calculatedVolume?: number;
  calories?: number;
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
    };
    laps?: any[];
  };
  notes?: string;
  source?: 'manual' | 'garmin' | 'coros' | 'strava' | 'apple' | 'ai' | '';
  sourceId?: string;
  importedFrom?: string;
  importId?: string;
  stravaLink?: string;
  createdAt: string;
  updatedAt: string;
  workoutExercises?: WorkoutExerciseData[];
  completed?: boolean;
  completedAt?: string | Date;
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
  aliases?: string[];
  description?: string;
  muscleGroups: string[];
  secondaryMuscles?: string[];
  category: "strength" | "cardio" | "flexibility" | "other";
  level?: "beginner" | "intermediate" | "advanced";
  equipment?: string[];
  instructions: string[];
  tips?: string[];
  images?: string[];
  videos?: string[];
  tags?: string[];
  userId?: string;
  createdAt: string;
  updatedAt: string;
  trackMaxReps?: boolean;
}

export interface WorkoutExerciseData {
  _id: string;
  workoutId: string;
  exerciseId: {
    _id: string;
    name: string;
    category: string;
  };
  sets?: SetData[];
  notes?: string;
  order?: number;
  duration?: number;
  distance?: number;
  pace?: number;
  speed?: number;
  elevationGain?: number;
  calories?: number;
  createdAt: string;
  updatedAt: string;
}

// --- Activity Insight Types ---
export interface ActivityInsightData {
  _id?: string; // Optional _id for frontend use
  userId: string; // Link to user
  periodType: 'weekly' | 'monthly';
  periodStartDate: Date;
  insightData: {
    highlight?: string;
    positiveTrends?: string[];
    negativeTrends?: string[];
    milestones?: string[];
  };
  generatedAt?: Date;
  lastWorkoutTimestamp?: Date | null; // Nullable for older records
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Daily Insight Types ---
export interface DailyInsightData {
  _id?: string;
  userId: string;
  date: Date; // The specific date the insight applies to
  title: string; // Title from dailyContentConfig
  description: string; // Description from dailyContentConfig
  insightText: string; // Generated AI insight
  generatedAt?: Date;
  lastWorkoutTimestamp?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Subscription & Plan Types ---
export interface SubscriptionPlan {
  // ... (existing subscription plan type)
} 