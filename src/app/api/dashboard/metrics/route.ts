import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { calculateDashboardMetrics } from "@/lib/dashboard-metrics";

// Force dynamic execution and disable caching for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 1. Authenticate the request
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Calculate metrics using the existing server-side function
        console.log(`[API /dashboard/metrics] Calculating metrics for user: ${session.user.id}`);
        const metrics = await calculateDashboardMetrics(); // Assumes this function implicitly uses the authenticated user ID
        console.log("[API /dashboard/metrics] Metrics calculated successfully");

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