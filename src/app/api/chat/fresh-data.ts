import { ObjectId } from "mongodb";
import dbConnect from "@/lib/db/mongodb";
import { getCollection } from "@/lib/db/mongodb";

/**
 * Helper function to get fresh workout data by forcing a new connection
 * This helps prevent caching issues in the chat API
 */
export async function getFreshWorkouts(userId: string) {
  console.log(`[FRESH-DATA] Getting workouts for user ${userId}`);
  
  // Force reconnection to the database
  (global as any).mongoose = { conn: null, promise: null };
  await dbConnect();
  
  // Get a fresh reference to the collection
  const workoutsCollection = await getCollection('workouts');
  
  // Get recent workouts
  const recentWorkouts = await workoutsCollection
    .find({ userId: new ObjectId(userId) })
    .sort({ date: -1 })
    .limit(10)
    .toArray();
    
  console.log(`[FRESH-DATA] Found ${recentWorkouts?.length || 0} recent workouts`);
  
  // Get total workout count
  const totalWorkoutCount = await workoutsCollection.countDocuments({ 
    userId: new ObjectId(userId) 
  });
  
  console.log(`[FRESH-DATA] Total workout count: ${totalWorkoutCount}`);
  
  // Get this week's workouts
  const now = new Date();
  
  // Calculate the start of the week (Monday)
  const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const daysFromMonday = day === 0 ? 6 : day - 1; // Convert to Monday=0, Sunday=6
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  console.log(`[FRESH-DATA] Getting workouts from week start: ${startOfWeek.toISOString()}`);
  
  const thisWeeksWorkouts = await workoutsCollection.find({
    userId: new ObjectId(userId),
    date: { $gte: startOfWeek }
  }).toArray();
  
  console.log(`[FRESH-DATA] Workouts this week: ${thisWeeksWorkouts.length}`);
  
  return {
    recentWorkouts,
    totalWorkoutCount,
    thisWeeksWorkouts,
    hasWorkouts: recentWorkouts.length > 0
  };
}

/**
 * Get fresh workout data for data queries with specific filtering
 */
export async function getFreshFilteredWorkouts(userId: string, timeframe?: string, workoutType?: string) {
  console.log(`[FRESH-DATA] Getting filtered workouts for user ${userId}`);
  
  // Force reconnection to the database
  (global as any).mongoose = { conn: null, promise: null };
  await dbConnect();
  
  // Get a fresh reference to the collection
  const workoutsCollection = await getCollection('workouts');
  
  // Build filter
  const filter: any = { userId: new ObjectId(userId) };
  
  // Add date filtering if timeframe is specified
  if (timeframe) {
    const now = new Date();
    
    if (timeframe === 'week') {
      // Calculate the start of the week (Monday)
      const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const daysFromMonday = day === 0 ? 6 : day - 1; // Convert to Monday=0, Sunday=6
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - daysFromMonday);
      startDate.setHours(0, 0, 0, 0);
      filter.date = { $gte: startDate };
      console.log(`[FRESH-DATA] Setting week start date to: ${startDate.toISOString()}`);
    } 
    else if (timeframe === 'month') {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      filter.date = { $gte: startDate };
    }
    else if (timeframe === 'year') {
      const startDate = new Date(now.getFullYear(), 0, 1);
      filter.date = { $gte: startDate };
    }
  }
  
  // Add workout type filter
  if (workoutType) {
    const typeRegex = new RegExp(workoutType, 'i');
    filter.type = { $regex: typeRegex };
  }
  
  // Get workouts
  const workouts = await workoutsCollection
    .find(filter)
    .sort({ date: -1 })
    .limit(10)
    .toArray();
  
  // Count total workouts with this filter
  const count = await workoutsCollection.countDocuments(filter);
  
  console.log(`[FRESH-DATA] Found ${count} filtered workouts`);
  
  // Generate workout type summaries
  const summaries = generateWorkoutTypeSummaries(workouts);
  
  return {
    workouts,
    count,
    timeframe,
    workoutType,
    summaries
  };
}

/**
 * Generate consistent workout summaries by type
 * This normalizes workout types and ensures consistent units
 */
export function generateWorkoutTypeSummaries(workouts: any[]) {
  // If no workouts, return an empty structure
  if (!workouts || workouts.length === 0) {
    return {
      byType: {},
      dateRange: null,
      totalWorkouts: 0,
      hasWorkouts: false
    };
  }
  
  // Extract date range from workouts for context
  let oldestDate = new Date();
  let newestDate = new Date(0);
  
  workouts.forEach(workout => {
    const workoutDate = new Date(workout.date);
    if (workoutDate < oldestDate) oldestDate = workoutDate;
    if (workoutDate > newestDate) newestDate = workoutDate;
  });
  
  // Normalize workout types - map display names to standardized types
  const normalizeWorkoutType = (type: string) => {
    type = (type || '').toLowerCase();
    if (type.includes('run') || type.includes('running')) return 'running';
    if (type.includes('swim') || type.includes('swimming')) return 'swimming';
    if (type.includes('strength') || type.includes('weight')) return 'strength training';
    if (type.includes('cycl') || type.includes('bike')) return 'cycling';
    if (type.includes('cardio')) return 'cardio';
    return type || 'other';
  };

  // Group workouts by normalized type
  const workoutsByType: Record<string, any[]> = {};
  const allWorkoutTypes = new Set<string>();
  
  // First, collect all possible workout types from the data
  workouts.forEach(workout => {
    const normalizedType = normalizeWorkoutType(workout.type || 'other');
    allWorkoutTypes.add(normalizedType);
    
    if (!workoutsByType[normalizedType]) {
      workoutsByType[normalizedType] = [];
    }
    workoutsByType[normalizedType].push(workout);
  });

  // Calculate summaries for each type
  const summaries: Record<string, any> = {};
  
  Object.entries(workoutsByType).forEach(([type, typeWorkouts]) => {
    // Skip if no workouts of this type
    if (!typeWorkouts || typeWorkouts.length === 0) {
      summaries[type] = {
        count: 0,
        hasWorkouts: false
      };
      return;
    }
    
    const totalDuration = typeWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const workoutsWithDistance = typeWorkouts.filter(w => w.distance && w.distance > 0);
    
    // Ensure consistent distance units (convert to km for swimming if needed)
    const totalDistance = workoutsWithDistance.reduce((sum, w) => {
      let distance = parseFloat(w.distance) || 0;
      // Handle unit conversions if needed
      if (w.distanceUnit === 'miles') {
        distance *= 1.60934; // Convert miles to km
      }
      return sum + distance;
    }, 0);
    
    // Round to 2 decimal places
    const roundedDistance = Math.round(totalDistance * 100) / 100;
    
    // Get all workout dates for this type
    const workoutDates = typeWorkouts.map(w => new Date(w.date)).sort((a, b) => a.getTime() - b.getTime());
    const typeOldestDate = workoutDates[0];
    const typeNewestDate = workoutDates[workoutDates.length - 1];
    
    summaries[type] = {
      count: typeWorkouts.length,
      hasWorkouts: typeWorkouts.length > 0,
      totalDuration,
      averageDuration: totalDuration / typeWorkouts.length,
      totalDistance: roundedDistance,
      hasDistance: workoutsWithDistance.length > 0,
      // Calculate average intensity
      averageIntensity: typeWorkouts.some(w => w.intensity) 
        ? typeWorkouts.map(w => {
            const intensity = (w.intensity || '').toLowerCase();
            if (intensity.includes('high')) return 3;
            if (intensity.includes('medium')) return 2;
            if (intensity.includes('low')) return 1;
            return 0;
          }).reduce((sum: number, val: number) => sum + val, 0) / typeWorkouts.filter(w => w.intensity).length
        : null,
      // Store dates for easy reference
      dates: workoutDates,
      dateRange: {
        oldest: typeOldestDate,
        newest: typeNewestDate,
        formatted: `${typeOldestDate.toLocaleDateString()} to ${typeNewestDate.toLocaleDateString()}`
      },
      // If applicable (future metrics)
      totalCalories: typeWorkouts.reduce((sum, w) => sum + (parseInt(w.calories) || 0), 0),
      // Detailed info for each workout
      workouts: typeWorkouts.map(w => ({
        ...w,
        normalizedDate: new Date(w.date),
        formattedDate: new Date(w.date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      }))
    };
  });

  // Create a list of all workout types in the dataset, including those with zero workouts
  const allTypes: Record<string, any> = {};
  allWorkoutTypes.forEach(type => {
    if (summaries[type]) {
      allTypes[type] = summaries[type];
    } else {
      allTypes[type] = {
        count: 0,
        hasWorkouts: false
      };
    }
  });

  // Add global date information
  return {
    byType: summaries,
    allTypes,
    dateRange: {
      oldest: oldestDate,
      newest: newestDate,
      formatted: `${oldestDate.toLocaleDateString()} to ${newestDate.toLocaleDateString()}`
    },
    hasWorkouts: workouts.length > 0,
    totalWorkouts: workouts.length
  };
} 