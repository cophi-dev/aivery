import React from 'react';
import { Badge } from "@/components/ui/badge"; // Needed?
import { Dumbbell, Ruler, Activity } from 'lucide-react';

// Copied from utils.ts
export const getWorkoutTypeStyle = (type: string): { icon: React.ReactNode; colorClasses: string } => {
    const lowerType = type?.toLowerCase() || 'other';
    switch (lowerType) {
      case 'running':
      case 'run':
        return { icon: <Ruler className="h-3 w-3" />, colorClasses: "border-orange-400/50 bg-orange-500/10 text-orange-600 dark:text-orange-400" };
      case 'cycling':
      case 'bike':
      case 'ride':
        return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-blue-400/50 bg-blue-500/10 text-blue-600 dark:text-blue-400" };
      case 'swimming':
      case 'swim':
        return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-cyan-400/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
      case 'strength':
      case 'workout':
        return { icon: <Dumbbell className="h-3 w-3" />, colorClasses: "border-green-400/50 bg-green-500/10 text-green-600 dark:text-green-400" };
      case 'hiit':
        return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-400" };
      case 'flexibility':
      case 'stretch':
      case 'yoga':
        return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-purple-400/50 bg-purple-500/10 text-purple-600 dark:text-purple-400" };
      default:
        return { icon: <Activity className="h-3 w-3" />, colorClasses: "border-gray-400/50 bg-gray-500/10 text-gray-600 dark:text-gray-400" };
    }
  } 