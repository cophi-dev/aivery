import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchWorkouts } from "@/lib/workout-actions"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db/mongodb"

// This endpoint will be used by the AI to fetch workout data dynamically
export const dynamic = 'force-dynamic'

// Helper function to get workouts by type
async function getWorkoutsByType(userId: string, type: string, limit = 10) {
  const workouts = await fetchWorkouts();
  return workouts
    .filter(workout => workout.type === type)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

// Helper function to get workouts by date range
async function getWorkoutsByDateRange(userId: string, startDate: Date, endDate: Date) {
  const workouts = await fetchWorkouts();
  return workouts
    .filter(workout => {
      const workoutDate = new Date(workout.date);
      return workoutDate >= startDate && workoutDate <= endDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Helper function to get running workouts
async function getRunningWorkouts(userId: string, limit = 10) {
  return getWorkoutsByType(userId, 'running', limit);
}

// Helper function to get strength workouts
async function getStrengthWorkouts(userId: string, limit = 10) {
  return getWorkoutsByType(userId, 'strength', limit);
}

// Helper function to get recent workouts
async function getRecentWorkouts(userId: string, limit = 10) {
  const workouts = await fetchWorkouts();
  return workouts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

// Helper function for calculating workout stats
async function calculateWorkoutStats(userId: string) {
  try {
    const workouts = await fetchWorkouts();
    
    // Calculate general stats
    const totalWorkouts = workouts.length;
    const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
    
    // Group workouts by type
    const workoutsByType = workouts.reduce((acc, workout) => {
      const type = workout.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(workout);
      return acc;
    }, {} as Record<string, any[]>);
    
    // Calculate stats by type
    const statsByType = Object.entries(workoutsByType).map(([type, typeWorkouts]) => {
      const count = typeWorkouts.length;
      const totalDuration = typeWorkouts.reduce((sum, w) => sum + w.duration, 0);
      const avgDuration = Math.round(totalDuration / count);
      
      // Additional stats based on workout type
      let additionalStats = {};
      
      if (type === 'running' || type === 'cycling' || type === 'swimming') {
        const totalDistance = typeWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0);
        const avgDistance = totalDistance / count;
        additionalStats = {
          totalDistance,
          avgDistance,
          avgPace: totalDistance > 0 ? totalDuration / totalDistance : 0
        };
      } else if (type === 'strength') {
        const totalVolume = typeWorkouts.reduce((sum, w) => sum + (w.volume || 0), 0);
        additionalStats = {
          totalVolume,
          avgVolume: totalVolume / count
        };
      }
      
      return {
        type,
        count,
        totalDuration,
        avgDuration,
        ...additionalStats
      };
    });
    
    return {
      totalWorkouts,
      totalDuration,
      avgDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
      statsByType,
      firstWorkoutDate: workouts.length > 0 ? 
        new Date(Math.min(...workouts.map(w => new Date(w.date).getTime()))) : null,
      lastWorkoutDate: workouts.length > 0 ? 
        new Date(Math.max(...workouts.map(w => new Date(w.date).getTime()))) : null
    };
  } catch (error) {
    console.error("Error calculating workout stats:", error);
    throw new Error("Failed to calculate workout stats");
  }
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { query, type, limit = 10, timeframe } = await req.json()

    // Parse query to determine what kind of data to fetch
    let workouts = []
    let stats = null
    let insights = null
    let metaData = {}
    
    // Process different query types
    if (type === "stats") {
      // General workout statistics
      stats = await calculateWorkoutStats(userId)
      return NextResponse.json({ stats })
    } 
    else if (type === "recent") {
      // Get recent workouts
      workouts = await getRecentWorkouts(userId, limit)
    }
    else if (type === "by_type") {
      // Get workouts by specific type
      const workoutType = query.type || "running"
      workouts = await getWorkoutsByType(userId, workoutType, limit)
      metaData = { type: workoutType }
    }
    else if (type === "by_date_range") {
      // Get workouts in a date range
      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const endDate = query.endDate ? new Date(query.endDate) : new Date()
      workouts = await getWorkoutsByDateRange(userId, startDate, endDate)
      metaData = { startDate, endDate }
    }
    else if (type === "running") {
      // Specialized running data
      workouts = await getRunningWorkouts(userId, limit)
      
      // Calculate running-specific metrics
      if (workouts.length > 0) {
        const totalDistance = workouts.reduce((sum, w) => sum + (w.distance || 0), 0)
        const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0)
        const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0
        
        insights = {
          totalDistance,
          totalDuration,
          avgPace,
          workoutCount: workouts.length,
          longestRun: Math.max(...workouts.map(w => w.distance || 0)),
          fastestPace: Math.min(...workouts
            .filter(w => w.cardioDetails?.pace && w.cardioDetails.pace > 0)
            .map(w => w.cardioDetails?.pace || Infinity))
        }
      }
    }
    else if (type === "strength") {
      // Specialized strength data
      workouts = await getStrengthWorkouts(userId, limit)
      
      // Calculate strength-specific metrics
      if (workouts.length > 0) {
        const exerciseFrequency: Record<string, number> = {}
        let totalVolume = 0
        
        workouts.forEach(workout => {
          if (workout.volume) {
            totalVolume += workout.volume
          }
          
          workout.exercises?.forEach(exercise => {
            if (exercise && exercise.name) {
              const exerciseName = exercise.name
              if (!exerciseFrequency[exerciseName]) {
                exerciseFrequency[exerciseName] = 0
              }
              exerciseFrequency[exerciseName]++
            }
          })
        })
        
        insights = {
          totalVolume,
          workoutCount: workouts.length,
          avgVolumePerWorkout: totalVolume / workouts.length,
          mostFrequentExercises: Object.entries(exerciseFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }))
        }
      }
    }
    else if (type === "custom_query") {
      // Handle custom database queries
      const collection = await getCollection("workouts")
      
      // Start with user ID filter
      let dbQuery: any = { userId: new ObjectId(userId) }
      
      // Add filters based on query parameters
      if (query && typeof query === 'object') {
        if (query.type) {
          dbQuery.type = query.type
        }
        
        if (query.intensity) {
          dbQuery.intensity = query.intensity
        }
        
        if (query.minDistance) {
          dbQuery.distance = { $gte: parseFloat(String(query.minDistance)) }
        }
        
        if (query.after) {
          const afterDate = new Date(String(query.after))
          dbQuery.date = { ...dbQuery.date, $gte: afterDate }
        }
        
        if (query.before) {
          const beforeDate = new Date(String(query.before))
          dbQuery.date = { ...dbQuery.date, $lte: beforeDate }
        }
      }
      
      // Execute query
      workouts = await collection
        .find(dbQuery)
        .sort({ date: -1 })
        .limit(limit)
        .toArray()
        
      // Format the response
      workouts = workouts.map(workout => ({
        _id: workout._id.toString(),
        userId: workout.userId.toString(),
        name: workout.name,
        date: workout.date,
        duration: workout.duration,
        intensity: workout.intensity,
        type: workout.type,
        volume: workout.volume,
        distance: workout.distance,
        exercises: workout.exercises,
        cardioDetails: workout.cardioDetails,
        notes: workout.notes,
        stravaLink: workout.stravaLink,
        sourceId: workout.sourceId,
        source: workout.source,
        importedFrom: workout.importedFrom,
        importId: workout.importId,
        createdAt: workout.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: workout.updatedAt?.toISOString() || new Date().toISOString(),
      }))
    }
    else {
      // Default: fetch recent workouts
      workouts = await getRecentWorkouts(userId, limit)
    }

    // Return the compiled data
    return NextResponse.json({
      workouts,
      count: workouts.length,
      insights,
      metaData,
      timeframe,
      query
    })
  } catch (error) {
    console.error("Error fetching workout data:", error)
    return NextResponse.json({ error: "Failed to fetch workout data" }, { status: 500 })
  }
}

// GET endpoint for simple stats
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const stats = await calculateWorkoutStats(userId)
    
    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Error fetching workout stats:", error)
    return NextResponse.json({ error: "Failed to fetch workout stats" }, { status: 500 })
  }
}

