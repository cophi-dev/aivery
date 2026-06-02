import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiveryDashboardPrompt, type UserStats } from "@/lib/ai/aiveryPrompt";
import { getWeeklyStats } from "@/lib/dashboard-logic";
import { callLLM } from "@/lib/services/llm";
import { getCurrentUser } from "@/lib/auth";
import User, { IUser } from "@/lib/db/models/user";
import dbConnect from "@/lib/db/mongodb";
import { startOfDay } from "date-fns";

// Force dynamic rendering and prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Allow responses up to 30 seconds
export const maxDuration = 30;

// Define the daily token limit
const DAILY_GROK_TOKEN_LIMIT = 500000;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { input } = await req.json();
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    await dbConnect();
    const userId = session.user.id;

    // Rate limiting check (similar to chat route)
    const userDoc = await User.findById(userId)
      .select("dailyGrokTokenUsage lastGrokUsageReset")
      .lean() as Pick<IUser, 'dailyGrokTokenUsage' | 'lastGrokUsageReset'> | null;

    if (userDoc) {
      const dailyUsage = userDoc.dailyGrokTokenUsage || 0;
      const lastReset = userDoc.lastGrokUsageReset || null;
      const todayStart = startOfDay(new Date());

      // Check if reset is needed
      if (!lastReset || lastReset < todayStart) {
        console.log(`[ASK_AIVERY] Resetting token usage for user ${userId}.`);
        await User.updateOne(
          { _id: userId },
          { $set: { dailyGrokTokenUsage: 0, lastGrokUsageReset: todayStart } }
        );
      } else if (dailyUsage >= DAILY_GROK_TOKEN_LIMIT) {
        console.log(`[ASK_AIVERY] User ${userId} EXCEEDED limit (${dailyUsage}/${DAILY_GROK_TOKEN_LIMIT}). Blocking AI call.`);
        return NextResponse.json(
          { error: "Daily AI usage limit reached. Please contact hi@aivery.com for assistance." },
          { status: 429 }
        );
      }
    }

    // Get user weekly stats
    const weeklyStatsData = await getWeeklyStats();
    const userStats: UserStats = {
      workouts: weeklyStatsData.current.workouts,
      distance: weeklyStatsData.current.distance,
      duration: weeklyStatsData.current.duration,
      volume: weeklyStatsData.current.volume,
    };

    // Generate the prompt
    const prompt = aiveryDashboardPrompt(input, userStats);

    // Call Grok API with correct model name
    const response = await callLLM({
      task: 'chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
      fallbackResponse: "I'm here to help with your fitness journey! Due to a technical issue, I can't provide detailed insights right now, but feel free to ask me about your workouts, progress, or any fitness questions."
    });

    // Extract the answer from the response
    const answer = response.choices?.[0]?.message?.content || "I apologize, but I couldn't process your question at the moment. Please try again.";

    // Update token usage (fire-and-forget)
    if (response.usage?.total_tokens) {
      User.updateOne(
        { _id: userId },
        { $inc: { dailyGrokTokenUsage: response.usage.total_tokens } }
      ).catch(err => console.error("[ASK_AIVERY] Failed to update token usage:", err));
    }

    return NextResponse.json({ answer });

  } catch (error) {
    console.error("[ASK_AIVERY] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 