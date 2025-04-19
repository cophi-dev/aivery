import { NextResponse } from 'next/server'
import { seedExercises } from '@/lib/db/seed/exercises'
import { getCurrentUser } from '@/lib/auth'

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

    // Seed exercises
    await seedExercises()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully' 
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    )
  }
} 