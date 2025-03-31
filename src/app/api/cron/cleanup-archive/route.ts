import { NextRequest, NextResponse } from 'next/server';
import WorkoutModel from '@/lib/db/models/workout';
import dbConnect from '@/lib/db/mongoose';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup-archive
 * 
 * Permanently deletes workouts that have been archived (soft-deleted) for more than 30 days
 * This route is meant to be called by a cron job once per day
 * 
 * Security: In production, this should be secured with an API key or other authentication
 */
export async function GET(req: NextRequest) {
  try {
    // Check for authorization header (simple API key approach)
    // In production, use a more secure approach
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secret-api-key';
    
    if (apiKey !== expectedApiKey) {
      console.warn('[CRON] Unauthorized attempt to access cleanup-archive');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Connect to database
    await dbConnect();
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Find and permanently delete workouts that have been in archive for over 30 days
    const deleteResult = await WorkoutModel.deleteMany({
      deletedAt: { $lt: thirtyDaysAgo },
      deletedAt: { $ne: null } // Only delete items that have been soft-deleted
    });
    
    console.log(`[CRON] Permanently deleted ${deleteResult.deletedCount} workouts from archive`);
    
    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      message: `Permanently deleted ${deleteResult.deletedCount} workouts that were archived over 30 days ago`
    });
  } catch (error) {
    console.error('[CRON] Error cleaning up workout archive:', error);
    
    return NextResponse.json(
      { error: 'Failed to clean up workout archive' },
      { status: 500 }
    );
  }
} 