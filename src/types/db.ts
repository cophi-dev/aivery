export interface WorkoutData {
  _id: string;
  userId: string;
  type: string;
  date: string;
  duration: number;
  distance?: number;
  calories?: number;
  notes?: string;
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