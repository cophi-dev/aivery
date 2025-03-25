export interface WorkoutData {
  _id: string;
  userId: string;
  type: string;
  name?: string;
  date: string;
  duration: number;
  distance?: number;
  calories?: number;
  notes?: string;
  intensity?: string;
  cardioDetails?: {
    pace?: number;
    elevation?: number;
    heartRate?: number;
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