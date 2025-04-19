import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { calculateDashboardMetrics } from "@/lib/dashboard-metrics";

// Force dynamic execution and disable caching for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log("[API /dashboard/metrics] Request received."); // Log request start
    try {
        // 1. Authenticate the request
        console.log("[API /dashboard/metrics] Attempting to get session...");
        const session = await getServerSession(authOptions);
        console.log("[API /dashboard/metrics] getServerSession result:", JSON.stringify(session, null, 2)); // Log the full session object
        
        if (!session?.user?.id) {
            console.error("[API /dashboard/metrics] Unauthorized - No session or user ID found.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id; // Get userId after checking it exists
        console.log(`[API /dashboard/metrics] User authenticated: ${userId}`);

        // 2. Calculate metrics using the existing server-side function
        console.log(`[API /dashboard/metrics] Calculating metrics for user: ${userId}`);
        const metrics = await calculateDashboardMetrics(); // Assumes this function implicitly uses the authenticated user ID
        console.log("[API /dashboard/metrics] Metrics calculated successfully");

        // --- Add Log Before Return --- 
        console.log("[API /dashboard/metrics] Returning metrics:", JSON.stringify(metrics, null, 2));
        // --- End Log --- 

        // 3. Return the metrics
        return NextResponse.json(metrics);

    } catch (error) {
        console.error("[API /dashboard/metrics] Error fetching dashboard metrics:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard metrics" }, 
            { status: 500 }
        );
    }
} 