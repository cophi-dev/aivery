import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/db/models/user';
import ExercisePRModel from '@/lib/db/models/exercisePR';
import { getRecentWorkouts } from '@/lib/db/repositories/workoutRepository';
import { callLLM, LLMProvider } from '@/lib/services/llm';
import { format } from "date-fns";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  // 5. Fetch recent workouts
  let recentWorkouts: any[] = [];
  try {
    recentWorkouts = await getRecentWorkouts(userId, 5);
  } catch {}

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
    workoutSummary = "Recent Workouts:\n" + recentWorkouts.map(w => `- ${format(new Date(w.date), 'yyyy-MM-dd')}: ${w.name || w.type} (${w.duration ? Math.round(w.duration/60) + 'min' : ''}${w.distance ? ', ' + w.distance.toFixed(2) + 'km' : ''})`).join('\n');
  }
  let prefSummary = "";
  if (userPreferences) {
    if (userPreferences.fitnessGoals) prefSummary += `Goals: ${userPreferences.fitnessGoals}\n`;
    if (userPreferences.trainingPreferences) prefSummary += `Preferences: ${userPreferences.trainingPreferences}\n`;
  }

  // 7. Personal fitness buddy system prompt
  let systemPrompt = `You're Aivery, ${userName}'s fitness buddy who knows their workout history inside and out. You're like that friend who remembers their PRs, notices when they're crushing it, and gives them real talk when they need it.

WHO YOU ARE:
- Their inner voice during workouts and planning
- Someone who spots patterns they might miss
- Supportive but honest - no sugar-coating when they need a reality check
- Emotionally aware of how they're feeling about their fitness journey

THEIR CURRENT SITUATION:
${workoutSummary}${prSummary ? '\n' + prSummary : ''}${prefSummary ? '\n' + prefSummary : ''}

WHAT THEY'RE ASKING FOR:
"${query}"

YOUR RESPONSE STYLE:
- Reference their specific workouts and data - show you know their journey
- If you see patterns or progress (or lack thereof), call it out specifically
- Explain the "why" behind your advice based on what you see in their history
- Be encouraging but real - acknowledge struggles if you see them
- Use their name and make it personal
- Keep it conversational but informative

FORMAT YOUR RESPONSE:
- Use bullet points and short sections for easy reading
- If it's a plan, give a quick summary up top
- Use **bold** for key points they shouldn't miss
- Keep it scannable - they might be reading this between sets!`;

  // 8. If the query is ambiguous, ask for clarification
  if (/plan|advice|help|suggest/i.test(query) && query.trim().split(' ').length < 5) {
    return NextResponse.json({ response: "Can you clarify what kind of plan or advice you want? (e.g., running, strength, flexibility, etc.)" });
  }

  // 9. Call the LLM
  const provider = process.env.LLM_PROVIDER || 'grok';
  const model = process.env.LLM_MODEL_PLAN || 'grok-3-mini';
  const data = await callLLM({
    provider: provider as LLMProvider,
    model,
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                      ],
                      max_tokens: 2048,
    temperature: 0.7,
    stream: false,
  });
  let responseText = data.choices?.[0]?.message?.content?.trim() || 'Sorry, no response generated.';

  // 10. Return the response
  return NextResponse.json({ response: responseText });
    }