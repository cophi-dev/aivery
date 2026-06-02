import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/db/models/user';
import ExercisePRModel from '@/lib/db/models/exercisePR';
import { getRecentWorkouts, getUserWorkoutsByDateRange } from '@/lib/db/repositories/workoutRepository';
import { callLLM } from '@/lib/services/llm';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subWeeks, subDays } from "date-fns";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper function to detect time periods in user queries and return appropriate date ranges
function detectTimePeriodInQuery(query: string): { startDate: Date; endDate: Date; description: string } | null {
  const today = new Date();
  const queryLower = query.toLowerCase();
  
  // Current month patterns
  if (queryLower.includes('this month') || queryLower.includes('current month')) {
    return {
      startDate: startOfMonth(today),
      endDate: endOfMonth(today),
      description: 'this month'
    };
  }
  
  // Last month patterns
  if (queryLower.includes('last month') || queryLower.includes('previous month')) {
    const lastMonth = subMonths(today, 1);
    return {
      startDate: startOfMonth(lastMonth),
      endDate: endOfMonth(lastMonth),
      description: 'last month'
    };
  }
  
  // Specific month patterns (e.g., "May", "in May", "during May")
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthAbbrevs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  for (let i = 0; i < monthNames.length; i++) {
    const fullMonth = monthNames[i];
    const abbrevMonth = monthAbbrevs[i];
    
    if (queryLower.includes(fullMonth) || queryLower.includes(abbrevMonth)) {
      // Assume current year unless specified otherwise
      const targetYear = today.getFullYear();
      const monthDate = new Date(targetYear, i, 1);
      
      // If the month is in the future, assume previous year
      if (monthDate > today) {
        monthDate.setFullYear(targetYear - 1);
      }
      
      return {
        startDate: startOfMonth(monthDate),
        endDate: endOfMonth(monthDate),
        description: `${fullMonth} ${monthDate.getFullYear()}`
      };
    }
  }
  
  // Last X weeks patterns
  const weekMatches = queryLower.match(/(?:last|past|previous)\s+(\d+)\s+weeks?/);
  if (weekMatches) {
    const weeks = parseInt(weekMatches[1]);
    return {
      startDate: subWeeks(today, weeks),
      endDate: today,
      description: `last ${weeks} weeks`
    };
  }
  
  // Last X days patterns
  const dayMatches = queryLower.match(/(?:last|past|previous)\s+(\d+)\s+days?/);
  if (dayMatches) {
    const days = parseInt(dayMatches[1]);
    return {
      startDate: subDays(today, days),
      endDate: today,
      description: `last ${days} days`
    };
  }
  
  // This year patterns
  if (queryLower.includes('this year') || queryLower.includes('current year')) {
    return {
      startDate: startOfYear(today),
      endDate: endOfYear(today),
      description: 'this year'
    };
  }
  
  // Last year patterns
  if (queryLower.includes('last year') || queryLower.includes('previous year')) {
    const lastYear = new Date(today.getFullYear() - 1, 0, 1);
    return {
      startDate: startOfYear(lastYear),
      endDate: endOfYear(lastYear),
      description: 'last year'
    };
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  // 1. Authenticate user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse request body
  const body = await req.json();
  const { query, history = [] } = body;
  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: "Invalid query provided" }, { status: 400 });
  }

  // 3. Fetch user data
  await dbConnect();
  const user: any = await User.findById(userId).select('name aiPreferences').lean();
  const userName = user?.name || 'User';
  const userPreferences = user?.aiPreferences || null;

  // 4. Fetch recent PRs
  let exercisePRs: any[] = [];
  let allPRs: any[] = [];
  try {
    exercisePRs = await ExercisePRModel.find({ userId }).sort({ date: -1 }).limit(5).lean();
    allPRs = await ExercisePRModel.find({ userId }).lean();
  } catch {}

  // 5. Intelligently fetch workouts based on query context
  let recentWorkouts: any[] = [];
  let workoutContext = "recent workouts";
  
  try {
    // Detect if the query mentions a specific time period
    const timePeriod = detectTimePeriodInQuery(query);
    
    if (timePeriod) {
      // Fetch workouts for the specific time period
      console.log(`[AI Chat Minimal] Detected time period query: ${timePeriod.description}`);
      recentWorkouts = await getUserWorkoutsByDateRange(userId, timePeriod.startDate, timePeriod.endDate);
      workoutContext = `workouts from ${timePeriod.description}`;
      console.log(`[AI Chat Minimal] Found ${recentWorkouts.length} workouts for ${timePeriod.description}`);
    } else {
      // Default to recent workouts but increase the limit for better context
      recentWorkouts = await getRecentWorkouts(userId, 15); // Increased from 5 to 15
      console.log(`[AI Chat Minimal] Using recent workouts (${recentWorkouts.length} found)`);
    }
  } catch (error) {
    console.error('[AI Chat Minimal] Error fetching workouts:', error);
    // Fallback to empty array
    recentWorkouts = [];
  }

  // 6. Build context strings
  let prSummary = "";
  if (exercisePRs.length > 0) {
    // Group PRs by exerciseName
    const grouped: Record<string, any[]> = {};
    for (const pr of exercisePRs) {
      if (!grouped[pr.exerciseName]) grouped[pr.exerciseName] = [];
      grouped[pr.exerciseName].push(pr);
    }
    // Group all PRs for stats
    const allGrouped: Record<string, Record<string, any[]>> = {};
    for (const pr of allPRs) {
      if (!allGrouped[pr.exerciseName]) allGrouped[pr.exerciseName] = {};
      if (!allGrouped[pr.exerciseName][pr.type]) allGrouped[pr.exerciseName][pr.type] = [];
      allGrouped[pr.exerciseName][pr.type].push(pr);
    }
    prSummary = "Recent PRs (single set vs daily, with all-time/avg):\n" +
      Object.entries(grouped).map(([name, prs]) => {
        const lines: string[] = [];
        for (const type of ['reps', 'daily_reps']) {
          const label = type === 'reps' ? 'single set' : 'in a day';
          const recent = prs.find(p => p.type === type);
          const all = (allGrouped[name] && allGrouped[name][type]) || [];
          if (recent) {
            // All-time best
            const best = all.reduce((max, p) => p.value > max.value ? p : max, all[0] || recent);
            // Rolling avg (last 30d)
            const cutoff = Date.now() - 30*24*60*60*1000;
            const last30d = all.filter(p => new Date(p.date).getTime() >= cutoff);
            const avg = last30d.length ? (last30d.reduce((sum, p) => sum + p.value, 0) / last30d.length) : null;
            let line = `- ${name} (${label}): ${recent.value} reps (${format(new Date(recent.date), 'yyyy-MM-dd')})`;
            if (best && best.value !== recent.value) line += ` | All-time best: ${best.value} (${format(new Date(best.date), 'yyyy-MM-dd')})`;
            if (avg && Math.round(avg) !== recent.value) line += ` | 30d avg: ${Math.round(avg)}`;
            lines.push(line);
          }
        }
        return lines.join('\n');
      }).filter(Boolean).join('\n');
  }
  
  let workoutSummary = "";
  if (recentWorkouts.length > 0) {
    // Group workouts by type for better analysis
    const workoutsByType: Record<string, any[]> = {};
    recentWorkouts.forEach(w => {
      if (!workoutsByType[w.type]) workoutsByType[w.type] = [];
      workoutsByType[w.type].push(w);
    });
    
    workoutSummary = `Workout History (${workoutContext}):\n`;
    
    // Add summary stats by type
    Object.entries(workoutsByType).forEach(([type, workouts]) => {
      workoutSummary += `\n${type.toUpperCase()} (${workouts.length} sessions):\n`;
      workouts.slice(0, 10).forEach(w => { // Show up to 10 per type
        const dateStr = format(new Date(w.date), 'yyyy-MM-dd');
        const duration = w.duration ? Math.round(w.duration/60) + 'min' : '';
        const distance = w.distance ? w.distance.toFixed(2) + 'km' : '';
        const name = w.name || w.type;
        const details = [duration, distance].filter(Boolean).join(', ');
        workoutSummary += `- ${dateStr}: ${name}${details ? ` (${details})` : ''}\n`;
      });
      if (workouts.length > 10) {
        workoutSummary += `... and ${workouts.length - 10} more ${type} sessions\n`;
      }
    });
  } else {
    workoutSummary = `No workouts found for the requested time period.`;
  }
  
  let prefSummary = "";
  if (userPreferences) {
    if (userPreferences.fitnessGoals) prefSummary += `Goals: ${userPreferences.fitnessGoals}\n`;
    if (userPreferences.trainingPreferences) prefSummary += `Preferences: ${userPreferences.trainingPreferences}\n`;
  }

  // 7. Personal fitness buddy system prompt  
  let systemPrompt = `You're Aivery, ${userName}'s fitness buddy and inner voice. You know their workout history, celebrate their wins, and give them the honest advice they need.

WHAT THEY'RE ASKING:
"${query}"

THEIR FITNESS JOURNEY SO FAR:
${workoutSummary}${prSummary ? '\n' + prSummary : ''}${prefSummary ? '\n' + prefSummary : ''}

BE THEIR FITNESS BUDDY:
- Reference specific workouts or data you see
- Notice patterns and point them out
- Be encouraging but real - no fluff
- Explain the "why" behind your advice
- Keep it conversational and personal
- Use their name (${userName}) to make it feel personal
- When analyzing time periods, provide specific counts and insights (e.g., "You had 4 runs in May totaling 23.5km")`;

  // 8. If the query is ambiguous, ask for clarification
  if (/plan|advice|help|suggest/i.test(query) && query.trim().split(' ').length < 5) {
    return NextResponse.json({ response: "Can you clarify what kind of plan or advice you want? (e.g., running, strength, flexibility, etc.)" });
  }

  // 9. Call the LLM
  const data = await callLLM({
    task: 'plan',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    max_tokens: 2048,
    temperature: 0.7,
    stream: false,
  });

  return NextResponse.json({ response: data.choices[0].message.content });
} 