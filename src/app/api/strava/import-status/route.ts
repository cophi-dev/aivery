import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db/mongodb";
import { ObjectId } from 'mongodb'; // Import ObjectId if using it for userId

export const dynamic = 'force-dynamic'; // Mark as dynamic

export async function GET(req: NextRequest) {
    console.log("--- Strava Import Status Request Received ---");

    try {
        // 1. Authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;
        console.log(`Status request for user: ${userId}`);

        // 2. Get processingId from query parameters
        const { searchParams } = new URL(req.url);
        const processingId = searchParams.get('processingId');

        if (!processingId) {
            return NextResponse.json({ error: "Missing processingId parameter" }, { status: 400 });
        }
        console.log(`Fetching status for processingId: ${processingId}`);

        // 3. Fetch state from MongoDB
        const db = await getDatabase();
        // Ensure we only fetch the state for the authenticated user
        const importState = await db.collection('strava_import_state').findOne({ 
            processingId: processingId, 
            userId: userId // Match user ID for security
            // Consider adding projection if needed to limit returned fields
        });

        // 4. Handle Not Found
        if (!importState) {
            console.log(`Import state not found for ID: ${processingId} and user: ${userId}`);
            return NextResponse.json({ error: "Import process not found or access denied." }, { status: 404 });
        }

        // 5. Return relevant status information
        // Calculate counts safely, defaulting to 0 if arrays are null/undefined
        const processedCount = importState.processedFiles?.length ?? 0;
        const importedCount = importState.importedFiles?.length ?? 0;
        const errorCount = importState.errorFiles?.length ?? 0;

        const statusResponse = {
            processingId: importState.processingId,
            status: importState.status,
            totalFiles: importState.totalFiles ?? 0,
            processedFilesCount: processedCount,
            importedFilesCount: importedCount,
            errorFilesCount: errorCount,
            currentlyProcessingFile: importState.currentlyProcessingFile ?? null,
            // Optionally include the list of error files if needed by frontend
            errorFiles: importState.errorFiles ?? [], 
            createdAt: importState.createdAt,
            lastUpdated: importState.lastUpdated,
            originalFilename: importState.originalFilename,
        };

        console.log(`Returning status: ${importState.status}, Current: ${statusResponse.currentlyProcessingFile}, Processed: ${processedCount}/${importState.totalFiles}`);
        return NextResponse.json(statusResponse);

    } catch (error) {
        console.error("Error fetching import status:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: "Failed to fetch import status.", details: errorMessage }, { status: 500 });
    }
} 