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
// import { fetchWorkouts } from "@/lib/workout-actions"; // Placeholder for real workout fetching
// import { getUserData } from "@/lib/user-actions"; // Placeholder for real user data fetching

// --- Placeholder Server-Side Data Fetching ---
// Replace with your actual database calls
async function getServerSideDashboardData(userId: string) {
    console.log("[Dashboard Page] Fetching server-side data for user:", userId);
    // const [userData, workouts] = await Promise.all([
    //     getUserData(userId), // Fetch user details if needed server-side
    //     fetchWorkouts(userId) // Fetch workouts from DB
    // ]);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay

    // Placeholder data - Replace with real data structure
    const userData = { 
        _id: userId, 
        name: 'Cophi', // Example name
        nickname: null,
        image: null, // User avatar URL
    };
    const workouts: any[] = [
         { _id: '1', date: new Date(Date.now() - 86400000 * 2).toISOString(), type: 'strength', exercises: [{ name: 'Bench Press', sets: [{weight: 100, reps: 5}, {weight: 100, reps: 5}] }] },
         { _id: '2', date: new Date(Date.now() - 86400000 * 1).toISOString(), type: 'run', distance: 5.2, duration: 30 },
         { _id: '3', date: new Date(Date.now() - 86400000 * 4).toISOString(), type: 'strength', exercises: [{ name: 'Squat', sets: [{weight: 120, reps: 5}] }, { name: 'Deadlift', sets: [{weight: 150, reps: 3}]}] },
    ]; 
    console.log("[Dashboard Page] Finished fetching server-side data.");
    return { userData, workouts };
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
    let dashboardData;
    let metrics = null;
    try {
        dashboardData = await getServerSideDashboardData(userId);
        metrics = calculateDashboardMetrics(dashboardData.workouts || []);
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

    const displayName = dashboardData.userData?.nickname || dashboardData.userData?.name || "User";
    const userImage = dashboardData.userData?.image || null;

    return (
        <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-6 md:space-y-8">
            {/* Header - Client Component (handles quote) */}
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
                    cardioDistance={metrics?.runningDistanceLast7Days ?? 0} 
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
// 3. Implementing the actual server-side data fetching logic in `getServerSideDashboardData`.
// 4. Ensuring all necessary UI components (`Card`, `Button`, etc.) are imported correctly within the client components. 