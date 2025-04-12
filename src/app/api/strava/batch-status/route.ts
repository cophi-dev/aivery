import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getDatabase } from "@/lib/db/mongodb"

export async function GET(request: NextRequest) {
  try {
    console.log('=== Getting batch processing status ===')
    
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.error('No authenticated session')
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    console.log('User authenticated:', userId)
    
    // Get processing ID from query parameters
    const processingId = request.nextUrl.searchParams.get('processingId')
    
    if (!processingId) {
      return NextResponse.json({ success: false, error: "Missing processingId parameter" }, { status: 400 })
    }
    
    // Get state from MongoDB
    const db = await getDatabase()
    const state = await db.collection('strava_import_state').findOne({ processingId })
    
    if (!state) {
      return NextResponse.json({ success: false, error: "Processing state not found" }, { status: 404 })
    }
    
    // Verify this is the user's import
    if (state.userId !== userId) {
      console.error('User ID mismatch:', { stateUserId: state.userId, userId })
      return NextResponse.json({ success: false, error: "Unauthorized access to import" }, { status: 403 })
    }
    
    // Calculate statistics
    const activityTypes: Record<string, number> = {}
    const importedWorkouts = await db.collection('workouts').find({
      userId,
      source: "strava",
      createdAt: { $gt: state.createdAt }
    }).toArray()
    
    // Count by type
    importedWorkouts.forEach(workout => {
      const type = workout.type || 'unknown'
      activityTypes[type] = (activityTypes[type] || 0) + 1
    })
    
    // Return status
    return NextResponse.json({
      success: true,
      status: state.status || 'unknown',
      stats: {
        total: state.totalFiles || state.activityFiles?.length || 0,
        processed: state.processedFiles?.length || 0,
        imported: state.importedFiles?.length || 0,
        errors: state.errorFiles?.length || 0,
        activityTypes
      },
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated
    })
  } catch (error) {
    console.error('Error getting batch status:', error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
} 