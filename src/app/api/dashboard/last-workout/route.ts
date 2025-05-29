import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLastWorkout } from '@/lib/dashboard-logic';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const lastWorkout = await getLastWorkout();
    return NextResponse.json({ workout: lastWorkout });
  } catch (error) {
    console.error('Error fetching last workout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch last workout' }, 
      { status: 500 }
    );
  }
} 