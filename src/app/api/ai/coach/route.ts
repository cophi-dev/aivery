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
  try {
    exercisePRs = await ExercisePRModel.find({ userId }).sort({ date: -1 }).limit(5).lean();
  } catch {}

  // 5. Fetch recent workouts
  let recentWorkouts: any[] = [];
  try {
    recentWorkouts = await getRecentWorkouts(userId, 5);
  } catch {}

  // 6. Build context strings
  let prSummary = "";
  if (exercisePRs.length > 0) {
    prSummary = "Recent PRs:\n" + exercisePRs.map(pr => `- ${pr.exerciseName}: ${pr.value} ${pr.unit} (${format(new Date(pr.date), 'yyyy-MM-dd')})`).join('\n');
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

  // 7. Minimal system prompt
  let systemPrompt = `You are an expert fitness coach. The user's request is below. Here is their recent workout history, PRs, and preferences (if available). Generate a plan or advice that best addresses the user's request.

Keep your response concise and easy to read.
Use bullet points or short sections, not long tables.
If the plan is long, provide a brief summary at the top.
Avoid repeating information.

USER REQUEST:
${query}

${workoutSummary}${prSummary ? '\n' + prSummary : ''}${prefSummary ? '\n' + prefSummary : ''}`;

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