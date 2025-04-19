import { NextResponse } from 'next/server'
import { seedExercises } from '@/lib/db/seed/exercises'
import { getCurrentUser } from '@/lib/auth'
import { getServerSession } from 'next-auth/next'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      )
    }

    await seedExercises()
    
    return NextResponse.json({ success: true, message: 'Exercises seeded successfully' })
  } catch (error) {
    console.error('Error seeding exercises:', error)
    return NextResponse.json(
      { error: 'Failed to seed exercises' },
      { status: 500 }
    )
  }
} 