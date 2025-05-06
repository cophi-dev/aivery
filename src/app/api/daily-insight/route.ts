import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth"; // Use getServerSession
import { authOptions } from "@/lib/auth"; // Import authOptions
import { dailyContentConfig, daysOfWeek, DailyContent } from '@/lib/config/daily-insight'; // Correct import path
import { getUserWorkoutsByDateRange, getLatestWorkoutTimestampForUser, findLatestTimestampInWorkouts } from '@/lib/db/repositories/workoutRepository'; // Import the new function
import { findLatestInsightForUserAndDate, createOrUpdateInsight } from '@/lib/db/repositories/dailyInsightRepository'; // Import daily insight repo functions
import type { WorkoutData, DailyInsightData } from '@/types/db'; // Import WorkoutData type
import { getUserById } from '@/lib/db/repositories/userRepository';
import { getToken } from "next-auth/jwt";
import {
  calculateFullWeekAggregates,
  calculateCurrentWeekToDateAggregates,
  getFormattedNewRepPRsForPeriod,
  WeeklyAggregates,
  FormattedRepPREntry
} from '@/lib/user-period-metrics';

// Ensure the route is always dynamic and not cached
export const dynamic = 'force-dynamic';

// TODO: Move the config from the component to a shared lib file

// Helper function to get start of day in UTC
const getStartOfDayUTC = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// --- Date Range Calculation Helper (Week starts Monday) ---
function calculateDateRangeForDay(dayName: string): { startDate: Date; endDate: Date, description: string } {
  const today = new Date();
  // Set time to end of day for endDate calculations involving today
  const endOfDayToday = new Date(today);
  endOfDayToday.setHours(23, 59, 59, 999);

  // Set time to start of day for startDate calculations
  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  let startDate = startOfDay(today);
  let endDate = endOfDayToday;
  let description = "";

  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Adjust Sunday to be 7 for easier Monday-start week calculation
  const dayIndex = dayOfWeek === 0 ? 7 : dayOfWeek;

  switch (dayName) {
    case "Monday":
    case "Tuesday":
    case "Saturday":
      // Last 7 days (including today)
      startDate.setDate(today.getDate() - 7);
      description = "last 7 days";
      break;
    case "Wednesday":
    case "Thursday":
      // This week (from Monday to Today)
      const diffToMonday = dayIndex - 1;
      startDate.setDate(today.getDate() - diffToMonday);
      description = "this week so far";
      break;
    case "Friday":
      // Last 21 days (including today)
      startDate.setDate(today.getDate() - 21);
      description = "last 3 weeks";
      break;
    case "Sunday":
      // Previous Full Week (Mon-Sun)
      const diffToLastSunday = dayIndex; // Days since last Sunday
      const diffToPreviousMonday = dayIndex + 6; // Days since the Monday before that
      endDate = startOfDay(today); // Start of today is the end boundary (exclusive)
      endDate.setDate(today.getDate() - diffToLastSunday);
      endDate.setHours(23, 59, 59, 999); // End of previous Sunday
      startDate = startOfDay(today);
      startDate.setDate(today.getDate() - diffToPreviousMonday);
      startDate.setHours(0, 0, 0, 0); // Start of previous Monday
      description = "last complete week (Mon-Sun)";
      break;
    default:
      // Default to last 7 days if dayName is unexpected
      startDate.setDate(today.getDate() - 7);
      description = "last 7 days";
  }

  return { startDate: startOfDay(startDate), endDate, description };
}
// --- End Date Range Calculation Helper ---

// Helper to format workouts for the prompt (GENERAL USE)
function formatWorkoutsForPrompt(workouts: WorkoutData[], todayDate: Date): string {
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

  // Optionally add summary of past workouts if needed, but focus might be better
  // finalString += "\nPast Workouts in Period:\n" + formatSummary(pastWorkouts);

  return finalString.trim();
}

// NEW Helper to format data specifically for Tuesday's "Tiny Triumph" insight
function formatTuesdayInsightDataForPrompt(
  currentWeek: WeeklyAggregates,
  previousWeek: WeeklyAggregates | null, // Previous week might not have data
  newRepPRs: FormattedRepPREntry[],
  displayName: string // For personalization if needed in the string, though prompt handles it
): string {
  let summary = "This Week's Progress So Far:\n";
  summary += `- Total Volume: ${(currentWeek.totalVolumeKg / 1000).toFixed(2)} tons\n`;
  summary += `- Total Cardio: ${currentWeek.totalCardioMinutes} minutes\n`;
  summary += `- Workouts Logged: ${currentWeek.workoutCount}\n`;

  if (previousWeek && previousWeek.workoutCount > 0) {
    summary += "\nComparison to Last Full Week:\n";
    
    // Volume Change
    if (previousWeek.totalVolumeKg > 0) {
      const volumeChangePercent = ((currentWeek.totalVolumeKg - previousWeek.totalVolumeKg) / previousWeek.totalVolumeKg) * 100;
      summary += `- Volume Change: ${volumeChangePercent >= 0 ? '+' : ''}${volumeChangePercent.toFixed(1)}%\n`;
    } else if (currentWeek.totalVolumeKg > 0) {
      summary += "- Volume: Up from no volume last week!\n";
    } else {
      summary += "- Volume: Consistent with no volume last week.\n";
    }

    // Cardio Minutes Change
    if (previousWeek.totalCardioMinutes > 0) {
      const cardioChangePercent = ((currentWeek.totalCardioMinutes - previousWeek.totalCardioMinutes) / previousWeek.totalCardioMinutes) * 100;
      summary += `- Cardio Minutes Change: ${cardioChangePercent >= 0 ? '+' : ''}${cardioChangePercent.toFixed(1)}%\n`;
    } else if (currentWeek.totalCardioMinutes > 0) {
      summary += "- Cardio Minutes: Up from zero last week!\n";
    } else {
      summary += "- Cardio Minutes: Consistent with zero last week.\n";
    }
  } else {
    summary += "\nNo comparable data from last full week to show trends.\n";
  }

  summary += "\nNew Rep PRs This Week (Last 7 Days):\n";
  if (newRepPRs.length > 0) {
    newRepPRs.forEach(pr => {
      summary += `- ${pr.exerciseName}: ${pr.reps} reps (on ${new Date(pr.date).toLocaleDateString()})\n`;
    });
  } else {
    summary += "- No new rep PRs logged in the last 7 days.\n";
  }

  return summary.trim();
}

export async function GET() {
  console.log(`[Daily Insight API] Received GET request at ${new Date().toISOString()}`);
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
  try {
    const user = await getUserById(userId);
    if (user?.nickname) {
      displayName = user.nickname; // Use nickname if available
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
            return NextResponse.json({
              title: storedInsight.title,
              description: storedInsight.description,
              insight: storedInsight.insightText,
              error: null
            });
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
    const { startDate: generalStartDate, endDate: generalEndDate, description: dateRangeDescription } = calculateDateRangeForDay(dayName);

    let workoutDataString: string = "No workout data processed.";
    let dataFetchError: string | null = null;
    let latestWorkoutTsInData: Date | null = null; 

    if (dayName === 'Tuesday') {
      try {
        console.log(`[Daily Insight - Tuesday] Calculating specific metrics for ${displayName} (${userId})`);
        const todayForMetrics = new Date(); 

        const dateInPreviousWeek = new Date(todayForMetrics);
        dateInPreviousWeek.setDate(todayForMetrics.getDate() - 7); // Date within the previous week
        const previousWeekAggregates = await calculateFullWeekAggregates(userId, dateInPreviousWeek);

        const currentWeekAggregates = await calculateCurrentWeekToDateAggregates(userId, todayForMetrics);
        
        // PRs are fetched for the general "last 7 days" window for Tuesday
        const newRepPRs = await getFormattedNewRepPRsForPeriod(userId, generalStartDate, generalEndDate);

        workoutDataString = formatTuesdayInsightDataForPrompt(
          currentWeekAggregates, 
          previousWeekAggregates, 
          newRepPRs, 
          displayName
        );
        
        // Determine latestWorkoutTsInData for staleness. This should be the latest timestamp 
        // from ANY data that went into the insight (current week workouts, previous week workouts, or PR dates).
        // For simplicity now, we will use the latest of current week workouts or PRs.
        let latestActivityDate: Date | null = null;
        if (currentWeekAggregates.workoutCount > 0) {
            // Assuming calculateCurrentWeekToDateAggregates could return workouts or their timestamps
            // For now, we need to re-fetch or have the aggregate function return the latest timestamp
            // Let's re-fetch for simplicity to ensure we have individual workout dates if needed
            const currentWeekWorkouts = await getUserWorkoutsByDateRange(userId, 
                new Date(new Date(todayForMetrics).setDate(todayForMetrics.getDate() - (todayForMetrics.getDay() === 0 ? 6 : todayForMetrics.getDay() -1))),
                todayForMetrics
            );
            latestActivityDate = findLatestTimestampInWorkouts(currentWeekWorkouts);
        }

        if (newRepPRs.length > 0) {
            const latestPRDate = newRepPRs.reduce((latest, pr) => 
                new Date(pr.date) > latest ? new Date(pr.date) : latest, 
            new Date(0));
            if (!latestActivityDate || latestPRDate > latestActivityDate) {
                latestActivityDate = latestPRDate;
            }
        }
        latestWorkoutTsInData = latestActivityDate;

        // If no specific activity, fall back to general latest workout for the user for staleness
        if (!latestWorkoutTsInData) {
            latestWorkoutTsInData = await getLatestWorkoutTimestampForUser(userId);
        }

      } catch (tuesdayError) {
        console.error("[Daily Insight - Tuesday] Error calculating specific metrics:", tuesdayError);
        dataFetchError = tuesdayError instanceof Error ? tuesdayError.message : "Failed to load specific Tuesday metrics.";
        let fallbackWorkouts: WorkoutData[] = [];
        try {
            fallbackWorkouts = await getUserWorkoutsByDateRange(userId, generalStartDate, generalEndDate);
            latestWorkoutTsInData = findLatestTimestampInWorkouts(fallbackWorkouts);
            workoutDataString = formatWorkoutsForPrompt(fallbackWorkouts, today);
        } catch (fallbackFetchError) {
            console.error("[Daily Insight - Tuesday Fallback] Error fetching workout data:", fallbackFetchError);
            dataFetchError = fallbackFetchError instanceof Error ? fallbackFetchError.message : "Failed to load workout data on fallback.";
        }
      }
    } else {
        let fetchedWorkouts: WorkoutData[] = [];
        try {
          console.log(`[Daily Insight] Fetching workouts for ${displayName} (${userId}) period: ${dateRangeDescription} (${generalStartDate.toISOString()} to ${generalEndDate.toISOString()})`);
          fetchedWorkouts = await getUserWorkoutsByDateRange(userId, generalStartDate, generalEndDate);
          latestWorkoutTsInData = findLatestTimestampInWorkouts(fetchedWorkouts); 
          console.log(`[Daily Insight] Fetched ${fetchedWorkouts.length} workouts. Latest timestamp in data: ${latestWorkoutTsInData?.toISOString()}`);
          workoutDataString = formatWorkoutsForPrompt(fetchedWorkouts, today);
        } catch (fetchError) {
           console.error("[Daily Insight] Error fetching workout data:", fetchError);
           dataFetchError = fetchError instanceof Error ? fetchError.message : "Failed to load workout data.";
           workoutDataString = `Could not load workout data for period: ${dateRangeDescription}.`; 
        }
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
            const systemPrompt = `\
You are Aivery, a friendly and insightful AI fitness coach providing a daily insight for ${displayName}.

Today is ${dayName}. Your task is to generate a response based *only* on the following instructions and data:

**Instructions for ${dayName} (${content.title}):**
${content.prompt}

**User Data Summary (${dateRangeDescription}):**
${workoutDataString}
${dataFetchError ? `\n(Note: Error fetching workout data: ${dataFetchError})` : ''}

Follow the instructions precisely. Address the user by name (${displayName}). Keep the response concise and aligned with the specified tone for the day.\
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
                max_tokens: 2048,
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
    const responseBody = {
      title: content.title,
      description: content.description,
      insight: generatedInsight,
      error: aiError || dataFetchError ? {
        message: aiError || dataFetchError || "An unspecified error occurred.",
        type: aiError ? (aiError.includes('save') ? 'save_error' : 'ai_generation') : 'data_fetch'
      } : null
    };

    return NextResponse.json(responseBody);

  } catch (error) {
    console.error("Error processing daily insight request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process daily insight request', details: errorMessage }, { status: 500 });
  }
} 