import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { headers } from 'next/headers';
import { authOptions } from "@/lib/auth";

// Force dynamic rendering to disable data caching for this page
export const dynamic = 'force-dynamic';

// Import Client Components (assuming they exist in separate files)
import { SubscriptionStatus } from "./_components/SubscriptionStatusClient"; 
import { DashboardHeader } from "./_components/DashboardHeaderClient"; 
import { LogWorkoutButton } from "./_components/LogWorkoutButtonClient"; 
import { ProgressCards } from "./_components/ProgressCardsClient"; 
import { SpotlightCards } from "./_components/SpotlightCardsClient"; 
import { PersonalRecordsCard } from "./_components/PersonalRecordsCardClient"; 
// import { LoadingIndicator } from "@/components/LoadingIndicator"; // If needed

// Import Server-side helpers (assuming they exist)
import { calculateDashboardMetrics } from "@/lib/dashboard-metrics"; 
import { fetchWorkouts } from "@/lib/workout-actions"; // Use actual workout fetching

// --- Actual Server-Side Data Fetching ---
// Refactored to use fetch API against our new route
async function getDashboardWorkouts(userId: string) {
    console.log("[Dashboard Page] Fetching workouts via API for user:", userId);
    try {
        // Construct the full URL for the API route
        // Ensure NEXT_PUBLIC_APP_URL is set in your environment variables
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 
        const apiUrl = `${baseUrl}/api/dashboard-workouts`;
        console.log(`[Dashboard Page] Fetching from URL: ${apiUrl}`);
        
        // Get incoming request headers
        const requestHeaders = headers();
        const cookieHeader = requestHeaders.get('cookie') || '';
        
        const response = await fetch(apiUrl, { 
            cache: 'no-store', // Explicitly disable caching for this fetch
            // Forward necessary headers (especially cookies for authentication)
            headers: { 
                'Cookie': cookieHeader
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Dashboard Page] API fetch failed with status ${response.status}: ${errorText}`);
            throw new Error(`Failed to fetch dashboard workouts. Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("[Dashboard Page] Finished fetching workouts via API.");
        
        // Additional validation and diagnostics
        if (!data || !data.workouts || !Array.isArray(data.workouts)) {
            console.error('[Dashboard Page] API returned invalid data structure:', JSON.stringify(data).substring(0, 100) + '...');
            return { workouts: [] }; // Return empty array to prevent errors
        }
        
        // Simple validation on the workout items
        const validWorkouts = data.workouts.filter((w: any) => w && w.date && typeof w.date === 'string');
        if (validWorkouts.length !== data.workouts.length) {
            console.warn(`[Dashboard Page] Some workouts (${data.workouts.length - validWorkouts.length}) were filtered out due to missing/invalid date`);
            data.workouts = validWorkouts;
        }
        
        return data; // Assuming the API returns { workouts: [...] }
    } catch (error) {
        console.error("[Dashboard Page] Error in getDashboardWorkouts (API fetch):");
        if (error instanceof Error) {
            console.error(error.message);
            throw new Error(`Network or fetch error fetching dashboard workouts: ${error.message}`);
        } else {
            console.error("Unknown error:", error);
            throw new Error('An unknown error occurred while fetching dashboard workouts.');
        }
    }
}
// ----------------------------------------------

// --- Main Dashboard Page Component (Server Component) ---
export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    // Redirect to login if no session
    if (!session?.user?.id) {
        console.warn("[Dashboard Page] No session found, redirecting to login.");
        redirect("/login?callbackUrl=/dashboard");
    }
    const userId = session.user.id;

    // Fetch primary data server-side
    let workoutData;
    let metrics = null;
    try {
        // Fetch only workout data now using the new fetch-based function
        // The function now returns { workouts: [...] }
        workoutData = await getDashboardWorkouts(userId);
        
        // Enhanced logging to debug workout data
        console.log(`[Dashboard Page] Fetched ${workoutData?.workouts?.length || 0} workouts`);
        if (workoutData?.workouts?.length > 0) {
            console.log('[Dashboard Page] First workout date:', workoutData.workouts[0].date);
            console.log('[Dashboard Page] Last workout date:', workoutData.workouts[workoutData.workouts.length - 1].date);
        }
        
        // Add debug object comparison to detect data corruption
        const workouts = workoutData.workouts || [];
        console.log(`[Dashboard Page] Before metrics calculation: workouts array length = ${workouts.length}`);
        
        metrics = calculateDashboardMetrics(workouts);
        console.log("[Dashboard Page] Calculated metrics:", JSON.stringify(metrics, null, 2));

        // More detailed logging for cardio metrics
        console.log(`[Dashboard Page] Cardio metrics - Duration: ${metrics?.cardioDurationLast7Days} seconds, Distance: ${metrics?.cardioDistanceLast7Days} meters`);
        console.log(`[Dashboard Page] Cardio duration type: ${typeof metrics?.cardioDurationLast7Days}, Distance type: ${typeof metrics?.cardioDistanceLast7Days}`);
    } catch (error) {
        console.error("[Dashboard Page] Failed to fetch server-side data or calculate metrics:", error);
        // Basic error display
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold mb-4 text-destructive">Dashboard Error</h1>
                <p>Failed to load dashboard data. Please refresh or try again later.</p>
            </div>
        );
    }

    // Get user details directly from the session
    const displayName = session.user.nickname || session.user.name || "User";
    const userImage = session.user.image || null;

    return (
        <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-6 md:space-y-8">
            {/* Header - Use session data directly */}
            <DashboardHeader 
                displayName={displayName} 
                userImage={userImage} 
            />

            {/* Main Content Grid/Column */}
            <div className="flex flex-col gap-6 w-full max-w-4xl">

                {/* Log Workout Button - Client Component */}
                <LogWorkoutButton />

                {/* Subscription Status - Client Component (fetches its own data) */}
                <SubscriptionStatus /> 

                {/* Progress Cards - Client Component (receives metrics) */}
                <ProgressCards 
                    strengthVolume={metrics?.strengthVolumeLast7Days ?? 0} 
                    cardioDuration={metrics?.cardioDurationLast7Days ?? 0}
                    cardioDistance={metrics?.cardioDistanceLast7Days ?? 0}
                    // Note: All values are based only on actual data from the database, no assumptions
                />

                {/* Spotlight Cards - Client Component */}
                <SpotlightCards />

                {/* Personal Records - Client Component (receives metrics) */}
                <PersonalRecordsCard 
                    topPRs={metrics?.topPRs ?? []} 
                />

                 {/* TODO: Add Recent Workouts List (pass workouts data) */}

            </div>

        </div>
    );
}

// NOTE: This structure requires:
// 1. Moving the original client code into separate files within a subfolder like `src/app/dashboard/_components/`
//    (e.g., `_components/SubscriptionStatusClient.tsx`, `_components/DashboardHeaderClient.tsx`, etc.)
// 2. Creating the `calculateDashboardMetrics` function in `src/lib/dashboard-metrics.ts`.
// 3. Implementing the actual server-side data fetching logic in `getDashboardWorkouts`.
// 4. Ensuring all necessary UI components (`Card`, `Button`, etc.) are imported correctly within the client components. 