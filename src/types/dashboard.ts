import type { DashboardPREntry } from "@/lib/workout-actions";
import type { IUser } from '@/lib/db/models/user';

export interface DashboardMetrics {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number;
    cardioDistanceLast7Days: number;
    strengthVolumePrevious7Days: number;
    cardioDurationPrevious7Days: number;
    cardioDistancePrevious7Days: number;
    exercisePRs: DashboardPREntry[];
    randomPRs: DashboardPREntry[];
    overallPRs?: Partial<IUser['personalRecords']>;
    workoutCount: number;
    previousWorkoutCount: number;
    hasAiPreferences?: boolean; 
    runningDistanceLast7Days: number;
    swimmingDistanceLast7Days: number;
    bikingDistanceLast7Days: number;
    runningDistancePrevious7Days: number;
    swimmingDistancePrevious7Days: number;
    bikingDistancePrevious7Days: number;
} 