import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWeeklyStats } from '@/lib/dashboard-logic';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const progressData = await getWeeklyStats();
    return NextResponse.json({ progress: progressData });
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress data' }, 
      { status: 500 }
    );
  }
} 