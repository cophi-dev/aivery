import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth"; // Use getServerSession
import { authOptions } from "@/lib/auth"; // Import authOptions
import { dailyContentConfig, daysOfWeek, DailyContent } from '@/lib/config/daily-insight'; // Correct import path
import { getUserWorkoutsByDateRange, getLatestWorkoutTimestampForUser, findLatestTimestampInWorkouts } from '@/lib/db/repositories/workoutRepository'; // Import the new function
import { findLatestInsightForUserAndDate, createOrUpdateInsight } from '@/lib/db/repositories/dailyInsightRepository'; // Import daily insight repo functions
import type { WorkoutData, DailyInsightData } from '@/types/db'; // Import WorkoutData type
import { getUserById } from '@/lib/db/repositories/userRepository';
import { getToken } from "next-auth/jwt";
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';

// Ensure the route is always dynamic and not cached
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Force Node.js environment for server-side fetch API

/*
 * Helper function to get the start of day in UTC for a given date
 */
const getStartOfDayUTC = (date: Date): Date => {
  const startOfDayUTC = new Date(date);
  startOfDayUTC.setUTCHours(0, 0, 0, 0);
  return startOfDayUTC;
};

function calculateDateRangeForDay(dayName: string): { startDate: Date; endDate: Date, description: string } {
  const today = new Date();
  let endDate = new Date(today); // Default end date is today
  let startDate = new Date(today);
  let description = ""; // Description of the date range
  
  const startOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  };

  // Calculate different start dates based on day
  switch(dayName) {
    case 'Monday':
      // Use date-fns to get last week's Monday and Sunday
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      startDate = lastWeekStart;
      endDate = lastWeekEnd;
      description = "last week (Mon-Sun)";
      break;
    case 'Tuesday':
    case 'Wednesday':
      // Last 7 days for Tuesday and Wednesday
      startDate.setDate(today.getDate() - 7); // Go back 7 days
      description = "last 7 days";
      break;
    case 'Thursday':
      // Current week Mon-Thu
      startDate.setDate(today.getDate() - today.getDay() + 1); // Go back to Monday of this week
      description = "this week (Mon-Thu)";
      break;
    case 'Friday':
      // Last 3 weeks (including the current one)
      startDate.setDate(today.getDate() - 21); // Go back 3 weeks
      description = "last 3 weeks";
      break;
    case 'Saturday':
      // Current week progress
      startDate.setDate(today.getDate() - today.getDay() + 1); // Go back to Monday of this week
      description = "this week's progress";
      break;
    case 'Sunday':
      // Full current week (Mon-Sun)
      startDate.setDate(today.getDate() - 6); // Go back to Monday of current week
      description = "this week's complete performance";
      break;
    default:
      // Default to last 7 days if dayName is unexpected
      startDate.setDate(today.getDate() - 7);
      description = "last 7 days";
  }

  return { startDate: startOfDay(startDate), endDate, description };
}
// --- End Date Range Calculation Helper ---

// Helper to format workouts for the prompt
function formatWorkoutsForPrompt(workouts: WorkoutData[], todayDate: Date, userPersonalRecords?: any, periodStart?: Date, periodEnd?: Date): string {
  if (!workouts || workouts.length === 0) {
    return "No workouts recorded in this period.";
  }

  const todayStart = new Date(todayDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayDate);
  todayEnd.setHours(23, 59, 59, 999);

  const todaysWorkouts = workouts.filter(w => {
      const workoutDate = new Date(w.date);
      return workoutDate >= todayStart && workoutDate <= todayEnd;
  });

  const pastWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date);
    return workoutDate < todayStart;
  });

  const formatSummary = (arr: WorkoutData[]): string => {
    if (arr.length === 0) return "None";
    const total = arr.length;
    const types: Record<string, number> = {};
    let duration = 0;
    let distance = 0;
    let volume = 0;

    arr.forEach(w => {
      types[w.type] = (types[w.type] || 0) + 1;
      duration += w.duration || 0;
      distance += w.cardioDetails?.distance ?? w.distance ?? 0;
      volume += w.calculatedVolume || 0;
    });

    const typeStr = Object.entries(types).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ');
    let summary = `${total} workout${total > 1 ? 's' : ''} (${typeStr})\n`;
    summary += `  - Total Duration: ${Math.round(duration / 60)} min\n`;
    if (distance > 0) summary += `  - Total Distance: ${distance.toFixed(2)} km\n`;
    if (volume > 0) summary += `  - Total Volume: ${Math.round(volume).toLocaleString()} kg`;
    
    // Add volume in tons for better readability if more than 1000kg
    if (volume >= 1000) {
      const tons = volume / 1000;
      summary += ` (${tons.toFixed(2)} tons)`;
    }
    
    return summary;
  };

  let finalString = "Overall Period Summary:\n" + formatSummary(workouts) + "\n";

  if (todaysWorkouts.length > 0) {
    finalString += "\nToday's Activities So Far:\n";
    todaysWorkouts.forEach(w => {
        finalString += `- ${w.type} (${w.name || 'Untitled'}) - Duration: ${Math.round((w.duration || 0) / 60)} min`;
        const dist = w.cardioDetails?.distance ?? w.distance;
        if (dist && dist > 0) finalString += `, Distance: ${dist.toFixed(2)} km`;
        const vol = w.calculatedVolume;
        if (vol && vol > 0) finalString += `, Volume: ${Math.round(vol).toLocaleString()} kg`;
        finalString += "\n";
    });
  }
  
  // Add Personal Records section if data is available
  if (userPersonalRecords && periodStart && periodEnd) {
    // Only include PRs from userPersonalRecords if their date is within the period
    let hasPeriodPR = false;
    finalString += "\nPersonal Records (this period):\n";
    // Max Strength Volume PR
    if (
      userPersonalRecords.maxStrengthVolume?.value > 0 &&
      userPersonalRecords.maxStrengthVolume.date &&
      new Date(userPersonalRecords.maxStrengthVolume.date) >= periodStart &&
      new Date(userPersonalRecords.maxStrengthVolume.date) <= periodEnd
    ) {
      hasPeriodPR = true;
      const maxVolume = userPersonalRecords.maxStrengthVolume.value;
      const maxVolumeDate = new Date(userPersonalRecords.maxStrengthVolume.date);
      finalString += `  - Max Strength Volume: ${Math.round(maxVolume).toLocaleString()} kg`;
      if (maxVolume >= 1000) {
        const tons = maxVolume / 1000;
        finalString += ` (${tons.toFixed(2)} tons)`;
      }
      finalString += ` on ${maxVolumeDate.toLocaleDateString()}\n`;
    }
    // Longest Run PR
    if (
      userPersonalRecords.longestRun?.value > 0 &&
      userPersonalRecords.longestRun.date &&
      new Date(userPersonalRecords.longestRun.date) >= periodStart &&
      new Date(userPersonalRecords.longestRun.date) <= periodEnd
    ) {
      hasPeriodPR = true;
      const longestRun = userPersonalRecords.longestRun.value;
      const longestRunDate = new Date(userPersonalRecords.longestRun.date);
      finalString += `  - Longest Run: ${longestRun.toFixed(2)} km on ${longestRunDate.toLocaleDateString()}\n`;
    }
    // Fastest 5k Pace PR
    if (
      userPersonalRecords.fastest5kPace?.value > 0 &&
      userPersonalRecords.fastest5kPace.date &&
      new Date(userPersonalRecords.fastest5kPace.date) >= periodStart &&
      new Date(userPersonalRecords.fastest5kPace.date) <= periodEnd
    ) {
      hasPeriodPR = true;
      const paceSecs = userPersonalRecords.fastest5kPace.value;
      const paceMinutes = Math.floor(paceSecs / 60);
      const paceSeconds = Math.round(paceSecs % 60);
      const paceDate = new Date(userPersonalRecords.fastest5kPace.date);
      finalString += `  - Fastest 5K Pace: ${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km on ${paceDate.toLocaleDateString()}\n`;
    }
    if (!hasPeriodPR) {
      finalString += "  - No new PRs set during this period.\n";
    }
  }

  // Add a type definition for PR items
  type PRRecord = {
    description: string;
    date: Date;
    workoutName: string;
  };

  // Add a special section for PRs in the workout data that are within the period
  const periodPRs: PRRecord[] = [];
  if (workouts && workouts.length > 0 && periodStart && periodEnd) {
    workouts.forEach(workout => {
      if (workout.records && workout.records.length > 0) {
        workout.records.forEach(record => {
          const recordDate = new Date(record.createdAt || record.date || workout.date);
          if (recordDate >= periodStart && recordDate <= periodEnd) {
            // Create a user-friendly description (same as before)
            let prDescription = '';
            if (record.type === 'longestRun' && record.value) {
              prDescription = `Longest Run: ${record.value.toFixed(2)} km`;
            } else if (record.type === 'fastest5kPace' && record.value) {
              const paceMinutes = Math.floor(record.value / 60);
              const paceSeconds = Math.round(record.value % 60);
              prDescription = `Fastest 5K Pace: ${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`;
            } else if (record.type === 'maxStrengthVolume' && record.value) {
              const tons = record.value / 1000;
              prDescription = `Max Strength Volume: ${tons.toFixed(2)} tons`;
            } else if (record.type === 'explicit_pr' && record.exerciseName) {
              if (record.unit === 'reps') {
                prDescription = `New PR in ${record.exerciseName}: ${record.value} reps`;
              } else if (record.unit) {
                prDescription = `New PR in ${record.exerciseName}: ${record.value} ${record.unit}`;
              } else {
                prDescription = `New PR in ${record.exerciseName}: ${record.value}`;
              }
            } else if (record.exerciseName) {
              if (record.weight) {
                prDescription = `New PR in ${record.exerciseName}: ${record.weight}kg`;
              } else if (record.value && record.unit === 'reps') {
                prDescription = `New PR in ${record.exerciseName}: ${record.value} reps`;
              } else if (record.value) {
                prDescription = `New PR in ${record.exerciseName}: ${record.value} ${record.unit || ''}`;
              } else if (record.reps) {
                prDescription = `New PR in ${record.exerciseName}: ${record.reps} reps`;
              }
            }
            if (prDescription) {
              periodPRs.push({
                description: prDescription,
                date: recordDate,
                workoutName: workout.name || 'Workout'
              });
            }
          }
        });
      }
    });
  }

  // Add the period PRs to the summary
  if (periodPRs.length > 0) {
    finalString += `\nPERSONAL RECORDS (this period):\n`;
    periodPRs.forEach(pr => {
      finalString += `  - ${pr.description} set on ${pr.date.toLocaleDateString()} during "${pr.workoutName}"\n`;
    });
    finalString += "\nPlease highlight these PRs prominently in your response!";
  }

  return finalString.trim();
}

// Helper to format insight response consistently
function formatInsightResponse(insightData: any, errorData: any = null) {
  // Ensure we have valid data or defaults
  const baseResponse = {
    title: insightData?.title || "Daily Insight",
    description: insightData?.description || "Your personalized daily fitness insight",
    insight: insightData?.insightText || insightData?.insight || "",
    highlight: insightData?.highlight || null,
    positiveTrends: Array.isArray(insightData?.positiveTrends) ? insightData.positiveTrends : [],
    negativeTrends: Array.isArray(insightData?.negativeTrends) ? insightData.negativeTrends : [],
    milestones: Array.isArray(insightData?.milestones) ? insightData.milestones : [],
    isFinal: true,
    timestamp: Date.now(),
  };

  // If there's an error, add it to the response
  if (errorData) {
    return {
      ...baseResponse,
      error: {
        message: typeof errorData === 'string' ? errorData : errorData.message || 'An unknown error occurred',
        type: errorData.type || 'unknown'
      }
    };
  }

  return baseResponse;
}

export async function GET(req: Request) {
  console.log(`[Daily Insight API] Received GET request at ${new Date().toISOString()}`);
  
  // Parse URL to extract query parameters
  const url = new URL(req.url);
  const requestId = url.searchParams.get('t') || `default-${Date.now()}`;
  console.log(`[Daily Insight API] Processing request with ID: ${requestId}`);
  
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();
  const todayStartUTC = getStartOfDayUTC(today);
  const dayName = daysOfWeek[today.getDay()];
  const content = dailyContentConfig.find((item: DailyContent) => item.day === dayName);

  if (!content) {
    console.warn(`[Daily Insight] No content config found for day: ${dayName}`);
    return NextResponse.json({ insight: "No insight configuration available for today." }, { status: 404 });
  }
  
  // --- Fetch User Details for Nickname ---
  let displayName = session.user.name || 'User'; // Start with session name
  let personalRecords = null;
  try {
    const user = await getUserById(userId);
    if (user?.nickname) {
      displayName = user.nickname; // Use nickname if available
    }
    if (user?.personalRecords) {
      personalRecords = user.personalRecords; // Get personal records if available
    }
    console.log(`[Daily Insight] Using display name: ${displayName}`);
  } catch (userError) {
    console.error(`[Daily Insight] Error fetching user details for nickname:`, userError);
    // Continue with the session name if fetching fails
  }
  // --- End Fetch User Details ---

  try {
    // --- Check for Existing Insight & Staleness ---
    const actualLatestWorkoutTimestamp = await getLatestWorkoutTimestampForUser(userId);
    const storedInsight = await findLatestInsightForUserAndDate(userId, todayStartUTC);

    if (storedInsight) {
      // Check if storedInsight.date is valid before using it
      if (storedInsight.date && !isNaN(new Date(storedInsight.date).getTime())) {
        const storedDate = new Date(storedInsight.date);
        console.log(`[Daily Insight] Found stored insight with valid date: ${storedDate.toISOString()}`);
        
        // Check 1: Is the stored insight actually for today's date?
        const storedDateUTC = getStartOfDayUTC(storedDate); // Use already created Date object
        const isForToday = storedDateUTC.getTime() === todayStartUTC.getTime();

        if (isForToday) {
          console.log(`[Daily Insight] Stored insight date matches today's date.`);
          // Check 2: Is it stale based on workout timestamps?
          const storedTimestamp = storedInsight.lastWorkoutTimestamp ? new Date(storedInsight.lastWorkoutTimestamp) : null;
          const isStale = actualLatestWorkoutTimestamp && (!storedTimestamp || actualLatestWorkoutTimestamp > storedTimestamp);

          if (!isStale) {
            console.log(`[Daily Insight] Stored insight is fresh (date match & no newer workouts). Returning cached insight.`);
            return NextResponse.json(formatInsightResponse(storedInsight));
          } else {
            console.log(`[Daily Insight] Stored insight is stale (Newer workout found: ${actualLatestWorkoutTimestamp?.toISOString()} vs Stored: ${storedTimestamp?.toISOString()}). Regenerating...`);
          }
        } else {
           console.log(`[Daily Insight] Stored insight is for a previous date (${storedDateUTC.toISOString()} vs ${todayStartUTC.toISOString()}). Regenerating...`);
        }
      } else {
        // Handle case where stored insight exists but has an invalid date
        console.log(`[Daily Insight] Found stored insight but its date is invalid/missing: ${storedInsight.date}. Regenerating...`);
      }
    } else {
      console.log(`[Daily Insight] No stored insight found for today. Generating new insight...`);
    }
    // --- End Check --- 

    // --- Calculate Date Range for Data Fetching --- 
    const { startDate, endDate, description: dateRangeDescription } = calculateDateRangeForDay(dayName);

    // --- Fetch Workout Data --- 
    let fetchedWorkouts: WorkoutData[] = [];
    let dataFetchError: string | null = null;
    let latestWorkoutTsInData: Date | null = null;
    try {
      console.log(`[Daily Insight] Fetching workouts for ${displayName} (${userId}) period: ${dateRangeDescription} (${startDate.toISOString()} to ${endDate.toISOString()})`);
      fetchedWorkouts = await getUserWorkoutsByDateRange(userId, startDate, endDate);
      latestWorkoutTsInData = findLatestTimestampInWorkouts(fetchedWorkouts); // Find the latest timestamp within the fetched data
      console.log(`[Daily Insight] Fetched ${fetchedWorkouts.length} workouts. Latest timestamp in data: ${latestWorkoutTsInData?.toISOString()}`);
    } catch (fetchError) {
       console.error("[Daily Insight] Error fetching workout data:", fetchError);
       dataFetchError = fetchError instanceof Error ? fetchError.message : "Failed to load workout data.";
    }

    // --- Generate Insight using AI --- 
    let generatedInsight = "";
    let aiError: string | null = null;
    const grokApiKey = process.env.GROK_API_KEY;

    if (!grokApiKey) {
        console.error("[Daily Insight] GROK_API_KEY not configured.");
        aiError = "AI service is unavailable due to configuration issues.";
        generatedInsight = `Placeholder insight for ${dayName}. Data fetch error: ${dataFetchError || 'None'}`;
    } else {
        try {
            // Pass today's date to the formatting function
            const workoutDataString = formatWorkoutsForPrompt(fetchedWorkouts, today, personalRecords, startDate, endDate);
            const systemPrompt = `\
You are Aivery, a friendly and insightful AI fitness coach providing a daily insight for ${displayName}.

Today is ${dayName}. Your task is to generate a response based *only* on the following instructions and data:

**Instructions for ${dayName} (${content.title}):**
${content.prompt}

**User Data Summary (${dateRangeDescription}):**
${workoutDataString}
${dataFetchError ? `\n(Note: Error fetching workout data: ${dataFetchError})` : ''}

Follow the instructions precisely. Address the user by name (${displayName}). Keep the response concise and aligned with the specified tone for the day.

IMPORTANT PERSONAL RECORD FORMATTING INSTRUCTIONS:
If any Personal Records (PRs) were achieved:
- Use the exact phrase "new PR" or "Personal Record" when referring to them
- Format them as "PR in [exercise]: [value] [unit]" or "New PR: [value] [unit] in [exercise]"
- Include specific numbers and units when mentioning PRs
- Look for "New PR in" text in the RECENT PERSONAL RECORDS section and make these the central focus of your response
- FOR BODYWEIGHT EXERCISES: Especially celebrate PRs involving reps, such as "New PR in Pull-up: 14 reps"
- If you see rep-based PRs (like "14 reps"), emphasize the strength and endurance achievement
`;

            console.log("[Daily Insight] Sending request to Grok API...");
            
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`
              },
              body: JSON.stringify({
                model: 'grok-3-mini-latest',
                messages: [
                  { role: 'system', content: systemPrompt },
                ],
                max_tokens: 1024, // Already increased
                temperature: 0.7,
                stream: false,
              })
            });

            if (!response.ok) {
              const errorBody = await response.text();
              console.error(`[Daily Insight] Grok API error: ${response.status} ${response.statusText}`, errorBody);
              throw new Error(`AI API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("[Daily Insight] Grok Raw Response:", data);

            if (data.choices && data.choices[0]?.message?.content) {
              generatedInsight = data.choices[0].message.content.trim();
            } else {
              throw new Error("Unexpected response structure from AI API.");
            }

        } catch (error) {
            console.error("[Daily Insight] Error during AI insight generation:", error);
            aiError = error instanceof Error ? error.message : "Failed to generate insight.";
            generatedInsight = `Could not generate insight for ${dayName}. ${aiError}`; 
        }
    }

    // --- Save the Generated Insight (if no AI error) --- 
    if (!aiError) {
        try {
            const insightToSave: Omit<DailyInsightData, '_id' | 'createdAt' | 'updatedAt' | 'generatedAt'> = {
                userId: userId,
                date: todayStartUTC, // Use the normalized UTC date
                title: content.title,
                description: content.description,
                insightText: generatedInsight,
                lastWorkoutTimestamp: latestWorkoutTsInData, // Store timestamp of latest workout *used* for this insight
            };
            await createOrUpdateInsight(insightToSave);
            console.log(`[Daily Insight] Successfully saved generated insight for ${todayStartUTC.toISOString()}`);
        } catch (saveError) {
            console.error("[Daily Insight] Error saving generated insight:", saveError);
            // Log the error but don't overwrite the AI error if one already exists
            if (!aiError) {
                aiError = "Failed to save the generated insight.";
            }
        }
    }
    // --- End Save Insight --- 

    // Construct the final response body
    const responseBody = formatInsightResponse(
      {
        title: content.title,
        description: content.description,
        insightText: generatedInsight
      },
      aiError || dataFetchError ? {
        message: aiError || dataFetchError || "An unspecified error occurred.",
        type: aiError ? (aiError.includes('save') ? 'save_error' : 'ai_generation') : 'data_fetch'
      } : null
    );

    return NextResponse.json(responseBody);

  } catch (error) {
    console.error("Error processing daily insight request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process daily insight request', details: errorMessage }, { status: 500 });
  }
} 