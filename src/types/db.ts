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
    elevationGain?: number;
    heartRate?: {
      average?: number;
      max?: number;
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
  createdAt: string;
  updatedAt: string;
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