import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

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
async function getDashboardWorkouts(userId: string) {
    console.log("[Dashboard Page] Fetching workouts for user:", userId);
    // Fetch workouts for the logged-in user (fetchWorkouts handles getting the userId internally)
    const workouts = await fetchWorkouts(); 
    console.log("[Dashboard Page] Finished fetching workouts.");
    // Return only workouts now
    return { workouts }; 
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
        // Fetch only workout data now
        workoutData = await getDashboardWorkouts(userId);
        metrics = calculateDashboardMetrics(workoutData.workouts || []);
        console.log("[Dashboard Page] Calculated metrics:", metrics);
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