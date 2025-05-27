import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository";
import { isValidObjectId } from 'mongoose'; // Import ObjectId validation
import { NextRequest, NextResponse } from "next/server"; // Ensure NextResponse is imported
import { getServerSession } from "next-auth"; // Ensure getServerSession is imported
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';
import { formatDistance as formatDistanceUtil } from "@/lib/utils"; // Use existing formatter
import { estimateBodyweightForExercise } from '@/lib/utils/estimateBodyweightForExercise';
// --- Enhanced Helper Functions ---

// Helper function to generate distance comparison text
function generateDistanceComparisonText(distanceKm: number): string | null {
  // Famous landmarks and their approximate distances
  const landmarks = [
    { name: "Golden Gate Bridge", distance: 2.7, emoji: "🌉" },
    { name: "Central Park loop", distance: 10.0, emoji: "🏞️" },
    { name: "Brooklyn Bridge", distance: 1.8, emoji: "🌁" },
    { name: "London Bridge", distance: 0.3, emoji: "🏰" },
    { name: "Manhattan Bridge", distance: 2.0, emoji: "🌉" },
    { name: "5K race", distance: 5.0, emoji: "🏃" },
    { name: "10K race", distance: 10.0, emoji: "🏃‍♀️" },
    { name: "half marathon", distance: 21.1, emoji: "🏃‍♂️" },
    { name: "marathon", distance: 42.2, emoji: "🏃‍♀️" },
    { name: "Empire State Building height (if vertical)", distance: 0.44, emoji: "🏢" },
    { name: "Eiffel Tower height (if vertical)", distance: 0.33, emoji: "🗼" }
  ];

  // Find the closest landmark
  let closestLandmark = null;
  let smallestDifference = Infinity;

  for (const landmark of landmarks) {
    const difference = Math.abs(distanceKm - landmark.distance);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestLandmark = landmark;
    }
  }

  if (!closestLandmark) return null;

  const percentDifference = (smallestDifference / closestLandmark.distance) * 100;
  
  // Only use comparison if it's reasonably close (within 30%)
  if (percentDifference > 30) return null;

  if (smallestDifference < 0.1) {
    return `That's almost exactly the distance of ${closestLandmark.name}! ${closestLandmark.emoji}`;
  } else if (distanceKm > closestLandmark.distance) {
    const extra = distanceKm - closestLandmark.distance;
    return `That's like running ${closestLandmark.name} plus an extra ${extra.toFixed(1)}km! ${closestLandmark.emoji}`;
  } else {
    const percentage = ((distanceKm / closestLandmark.distance) * 100).toFixed(0);
    return `That's about ${percentage}% of ${closestLandmark.name}! ${closestLandmark.emoji}`;
  }
}

// Enhanced volume comparison function
function getVolumeComparison(volumeKg: number): string | null {
  const comparisons = [
    { threshold: 500, text: "That's like lifting a small motorcycle!" },
    { threshold: 1000, text: "That's equivalent to lifting a small car!" },
    { threshold: 2000, text: "That's like lifting a compact car!" },
    { threshold: 3000, text: "That's equivalent to lifting a mid-size SUV!" },
    { threshold: 5000, text: "That's like lifting a large truck!" },
    { threshold: 8000, text: "That's equivalent to lifting an elephant!" },
    { threshold: 12000, text: "That's like lifting a school bus!" },
    { threshold: 20000, text: "That's equivalent to lifting a fire truck!" },
    { threshold: 30000, text: "That's like lifting a semi-truck!" },
    { threshold: 50000, text: "That's equivalent to lifting a blue whale!" }
  ];

  for (const comparison of comparisons) {
    if (volumeKg <= comparison.threshold) {
      return comparison.text;
    }
  }

  return "That's an incredible amount of weight moved!";
}

// Helper function to calculate workout intensity
function calculateWorkoutIntensity(workout: IWorkout): {
  score: number;
  level: string;
  description: string;
} {
  let score = 0;
  
  if (workout.type === 'strength') {
    const volume = workout.calculatedVolume || 0;
    const duration = workout.duration || 0;
    
    // Base score on volume and duration
    score = Math.min(100, (volume / 100) + (duration / 60));
    
    // Adjust for workout density (volume per minute)
    if (duration > 0) {
      const density = volume / (duration / 60);
      score += Math.min(20, density / 50);
    }
  } else {
    // For cardio workouts
    const distance = workout.cardioDetails?.distance || workout.distance || 0;
    const duration = workout.duration || 0;
    
    if (distance > 0 && duration > 0) {
      const pace = (duration / 60) / distance; // minutes per km
      
      // Lower pace = higher intensity for running
      if (workout.type === 'running') {
        if (pace < 4) score = 90;
        else if (pace < 5) score = 80;
        else if (pace < 6) score = 70;
        else if (pace < 7) score = 60;
        else score = 50;
      } else {
        // For other cardio, base on duration and distance
        score = Math.min(100, (distance * 10) + (duration / 60));
      }
    }
  }
  
  let level = 'Light';
  let description = 'A gentle session to keep you moving.';
  
  if (score >= 80) {
    level = 'Beast Mode';
    description = 'You absolutely crushed it today! 🔥';
  } else if (score >= 65) {
    level = 'High';
    description = 'Serious work! You pushed yourself hard.';
  } else if (score >= 45) {
    level = 'Moderate';
    description = 'Solid effort with good intensity.';
  } else if (score >= 25) {
    level = 'Light';
    description = 'A good active recovery session.';
  }
  
  return { score: Math.round(score), level, description };
}

// --- API Route ---

export async function GET(
  req: NextRequest,
  { params }: { params: { workoutId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    // --- Get User's Display Name ---
    const userName = session.user.nickname || session.user.name || "Fitness Pro"; // Use nickname, fallback to name, then generic
    const userWeight = session.user.weight && typeof session.user.weight === 'number' && session.user.weight > 0 ? session.user.weight : 75;
    // --- End Get User's Display Name ---
    const workoutId = params.workoutId;

    if (!workoutId || !ObjectId.isValid(workoutId)) {
        return NextResponse.json({ error: "Valid Workout ID is required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch the workout with populated exercise data
    const workout = await WorkoutModel.findOne({
        _id: new ObjectId(workoutId),
        userId: new ObjectId(userId)
    }).populate({
      path: 'workoutExercises',
      populate: {
        path: 'exerciseId',
        model: 'Exercise'
      }
    }).lean() as any; // Use any type since we're populating additional fields

    if (!workout) {
        return NextResponse.json({ error: "Workout not found or not authorized" }, { status: 404 });
    }

    // Calculate workout intensity
    const intensity = calculateWorkoutIntensity(workout);

    // Array to hold potential insights
    const insights: string[] = [];
    
    // Default insight
    let insightStatement = `Great ${workout.type} session, ${userName}! ${intensity.description}`;

    // 1. Distance-based insights for cardio workouts
    if (['running', 'cycling', 'walking', 'hiking', 'swimming'].includes(workout.type) && 
        workout.cardioDetails?.distance && workout.cardioDetails.distance > 0) {
        
        const distance = workout.cardioDetails.distance;
        const duration = workout.duration || 0;
        const formattedDist = formatDistanceUtil(distance);

        // Generate landmark comparison
        const landmarkComparison = generateDistanceComparisonText(distance);
        if (landmarkComparison) {
            insights.push(`${userName}, you covered ${formattedDist} - ${landmarkComparison}`);
        }

        // Pace insights
        if (duration > 0 && workout.type === 'running') {
            const paceMinPerKm = (duration / 60) / distance;
            let paceInsight = '';
            
            if (paceMinPerKm < 4) {
                paceInsight = `Lightning fast pace of ${paceMinPerKm.toFixed(1)} min/km! You're flying! ⚡`;
            } else if (paceMinPerKm < 5) {
                paceInsight = `Impressive ${paceMinPerKm.toFixed(1)} min/km pace! That's competitive running! 🏃‍♂️`;
            } else if (paceMinPerKm < 6) {
                paceInsight = `Strong ${paceMinPerKm.toFixed(1)} min/km pace! Great endurance work! 💪`;
            } else if (paceMinPerKm < 7) {
                paceInsight = `Solid ${paceMinPerKm.toFixed(1)} min/km pace! Perfect for building your base! 👍`;
            } else {
                paceInsight = `Steady ${paceMinPerKm.toFixed(1)} min/km pace! Consistency is key! 🎯`;
            }
            
            insights.push(`${userName}, ${paceInsight}`);
        }

        // Distance milestones
        if (distance >= 21.1 && distance < 25) {
            insights.push(`${userName}, you just completed a half marathon distance! That's a major achievement! 🏅`);
        } else if (distance >= 42.2) {
            insights.push(`${userName}, you went the full marathon distance! Absolutely incredible! 🏆`);
        } else if (distance >= 10 && distance < 15) {
            insights.push(`${userName}, that's a solid 10K+ distance! Your endurance is building! 🔥`);
        } else if (distance >= 5 && distance < 7) {
            insights.push(`${userName}, you nailed a 5K distance! Perfect for fitness building! ✨`);
        }
    }

    // 2. Volume-based insights for strength workouts
    if (workout.type === 'strength') {
        let calculatedVolume = workout.calculatedVolume || 0;
        
        // If no calculated volume, try to calculate from exercises
        if (calculatedVolume === 0 && workout.workoutExercises) {
            calculatedVolume = workout.workoutExercises.reduce((totalVol: number, ex: any) => {
                const exerciseSets = Array.isArray(ex.sets) ? ex.sets : [];
                const exerciseName = ex.exerciseId?.name || '';
                const exerciseVol = exerciseSets.reduce((setVol: number, set: any) => {
                    let weight = set.weight ?? 0;
                    const reps = set.reps ?? 0;
                    
                    // Handle bodyweight exercises
                    if (weight === 0) {
                        weight = estimateBodyweightForExercise(exerciseName, userWeight);
                    }
                    
                    return setVol + (weight * reps);
                }, 0);
                return totalVol + exerciseVol;
            }, 0);
        }

        if (calculatedVolume > 0) {
            const volumeComparison = getVolumeComparison(calculatedVolume);
            if (volumeComparison) {
                insights.push(`${userName}, you moved ${calculatedVolume.toLocaleString()}kg total! ${volumeComparison} 💪`);
            }

            // Volume milestones
            if (calculatedVolume >= 10000) {
                insights.push(`${userName}, you hit the 10-ton club! That's elite-level volume! 🏆`);
            } else if (calculatedVolume >= 5000) {
                insights.push(`${userName}, over 5 tons moved! You're getting seriously strong! 🔥`);
            } else if (calculatedVolume >= 2000) {
                insights.push(`${userName}, 2+ tons moved! Your strength is building fast! 💪`);
            } else if (calculatedVolume >= 1000) {
                insights.push(`${userName}, you moved over a ton! That's a solid strength session! 👍`);
            }
        }

        // Exercise count insights
        const exerciseCount = workout.workoutExercises?.length || 0;
        const totalSets = workout.workoutExercises?.reduce((total: number, ex: any) => 
            total + (ex.sets?.length || 0), 0) || 0;
        const totalReps = workout.workoutExercises?.reduce((total: number, ex: any) => 
            total + (ex.sets?.reduce((setTotal: number, set: any) => setTotal + (set.reps || 0), 0) || 0), 0) || 0;

        if (exerciseCount >= 8) {
            insights.push(`${userName}, ${exerciseCount} exercises! That's a comprehensive full-body session! 🎯`);
        } else if (exerciseCount >= 5) {
            insights.push(`${userName}, ${exerciseCount} exercises with ${totalSets} sets! Great workout variety! ✨`);
        }

        if (totalReps >= 200) {
            insights.push(`${userName}, ${totalReps} total reps! Your work capacity is impressive! 🔥`);
        } else if (totalReps >= 100) {
            insights.push(`${userName}, ${totalReps} reps completed! Solid volume work! 💪`);
        }
    }

    // 3. Duration insights
    const durationMinutes = Math.round((workout.duration || 0) / 60);
    if (durationMinutes >= 120) {
        insights.push(`${userName}, ${durationMinutes} minutes! That's serious dedication and endurance! 🏆`);
    } else if (durationMinutes >= 90) {
        insights.push(`${userName}, ${durationMinutes} minutes of pure effort! Your commitment is inspiring! 🔥`);
    } else if (durationMinutes >= 60) {
        insights.push(`${userName}, a full hour of training! That's what consistency looks like! ⏰`);
    } else if (durationMinutes >= 45) {
        insights.push(`${userName}, ${durationMinutes} minutes well spent! Perfect session length! ✨`);
    }

    // 4. Personal Records insights
    if (workout.records && workout.records.length > 0) {
        const prCount = workout.records.length;
        if (prCount === 1) {
            insights.push(`${userName}, you set a new personal record today! Progress in action! 🏅`);
        } else {
            insights.push(`${userName}, ${prCount} new personal records! You're on fire! 🔥🏆`);
        }
    }

    // 5. Intensity-based insights
    if (intensity.score >= 80) {
        insights.push(`${userName}, intensity level: ${intensity.level}! You left everything on the floor today! 🔥`);
    } else if (intensity.score >= 65) {
        insights.push(`${userName}, high-intensity session! You pushed your limits today! 💪`);
    } else if (intensity.score >= 45) {
        insights.push(`${userName}, perfect moderate intensity! Building that solid foundation! 🎯`);
    }

    // 6. Motivational insights based on workout type
    const motivationalInsights = {
        strength: [
            `${userName}, every rep builds the stronger version of you! 💪`,
            `${userName}, iron sharpens iron - and you're getting sharper! ⚡`,
            `${userName}, strength isn't just physical - you're building mental toughness too! 🧠`
        ],
        running: [
            `${userName}, every step forward is progress! Keep moving! 🏃‍♂️`,
            `${userName}, you're not just running - you're chasing your best self! ✨`,
            `${userName}, the road doesn't care about your excuses - and neither do you! 🛣️`
        ],
        cycling: [
            `${userName}, pedaling towards your goals one revolution at a time! 🚴‍♂️`,
            `${userName}, the bike doesn't lie - your effort shows! 🔥`,
            `${userName}, spinning your way to better fitness! 🌟`
        ]
    };

    const typeInsights = motivationalInsights[workout.type as keyof typeof motivationalInsights];
    if (typeInsights) {
        insights.push(typeInsights[Math.floor(Math.random() * typeInsights.length)]);
    }

    // Select the best insight
    if (insights.length > 0) {
        // Prioritize specific achievements over generic motivation
        const achievementInsights = insights.filter(insight => 
            insight.includes('record') || 
            insight.includes('ton') || 
            insight.includes('marathon') || 
            insight.includes('like') ||
            insight.includes('equivalent')
        );
        
        if (achievementInsights.length > 0) {
            insightStatement = achievementInsights[0];
        } else {
            insightStatement = insights[0];
        }
    }

    console.log(`Generated enhanced insight for workout ${workoutId} for ${userName}: "${insightStatement}"`);
    return NextResponse.json({ insight: insightStatement });

  } catch (error) {
    console.error(`API Insight Error for workout ${params?.workoutId}:`, error);
    // Attempt to get user name for error message too, if possible within catch scope limitations
    const session = await getServerSession(authOptions);
    const userName = session?.user?.nickname || session?.user?.name || "there";
    return NextResponse.json(
      // Keep a positive fallback even on error, personalized
      { insight: `Awesome effort on that workout, ${userName}! Every session counts towards your goals! 💪` },
      { status: 500 }
    );
  }
} 