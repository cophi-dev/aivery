'use client'; // <-- Make this a Client Component

import { redirect } from "next/navigation";
// import { headers } from 'next/headers'; // headers() only works in Server Components
import { useSession } from "next-auth/react"; // <-- Import useSession
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter

// Import Client Components
import { SubscriptionStatus } from "./_components/SubscriptionStatusClient"; 
import { DashboardHeader } from "./_components/DashboardHeaderClient"; 
import { LogWorkoutButton } from "./_components/LogWorkoutButtonClient"; 
import { ProgressCards } from "./_components/ProgressCardsClient"; 
import { SpotlightCards } from "./_components/SpotlightCardsClient"; 
import { PersonalRecordsCard } from "./_components/PersonalRecordsCardClient"; 
import { QuickActionsCard } from "./_components/QuickActionsCardClient";
import { LoadingIndicator } from "@/components/ui/loading-indicator"; // Assuming a loading indicator component
// Import the type for exercise PRs
import type { DashboardPREntry } from "@/lib/workout-actions";

// Define a type for the metrics data (adjust based on actual structure)
interface DashboardMetrics {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number;
    cardioDistanceLast7Days: number;
    strengthVolumePrevious7Days: number;
    cardioDurationPrevious7Days: number;
    cardioDistancePrevious7Days: number;
    topPRs: any[]; // Old PRs, can be removed if not used by PersonalRecordsCardClient anymore
    exercisePRs: DashboardPREntry[]; // <-- Add new field
}

// Placeholder type/interface for a chat message
interface ChatMessage {
    id: string; // Or number
    role: 'user' | 'assistant';
    content: string;
}

// Placeholder declaration for the chat update function
// TODO: Replace this with your actual chat context/state management hook/import
declare function addMessageToChat(message: ChatMessage): void;

// --- Main Dashboard Page Component (Client Component) ---
export default function DashboardPage() {
    const { data: session, status } = useSession({
        required: true, // Require authentication
        onUnauthenticated() {
            // Redirect to login if not authenticated
            redirect("/login?callbackUrl=/dashboard");
        },
    });
    const router = useRouter(); // Initialize router
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [errorMetrics, setErrorMetrics] = useState<string | null>(null);

    // Fetch metrics when session is loaded
    useEffect(() => {
        if (status === "authenticated") {
            const fetchMetrics = async () => {
                setIsLoadingMetrics(true);
                setErrorMetrics(null);
                try {
                    console.log("[Dashboard Page] Fetching metrics from API...");
                    const response = await fetch('/api/dashboard/metrics');
                    if (!response.ok) {
                        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
                    }
                    const data: DashboardMetrics = await response.json();
                    console.log("[Dashboard Page] Metrics fetched successfully:", data);
                    setMetrics(data);
                } catch (error: any) {
                    console.error("[Dashboard Page] Error fetching metrics:", error);
                    setErrorMetrics(error.message || "Failed to load dashboard metrics.");
                    setMetrics(null); // Reset metrics on error
                } finally {
                    setIsLoadingMetrics(false);
                }
            };
            fetchMetrics();
        }
    }, [status]); // Rerun effect when session status changes

    // --- Updated AI message sender ---
    // Now redirects immediately to chat, passing the query and context type.
    // The API call will be handled by the chat page.
    const handleSendAiMessage = (query: string, context: any) => {
        console.log("--- Triggering AI Action (Redirecting to Chat) ---");
        console.log("Query:", query);
        console.log("Context:", context);

        // Encode query and context to pass in URL
        const encodedQuery = encodeURIComponent(query);
        // We only need the requestType from context for the chat page to know what to do
        const requestType = context?.requestType;

        if (!requestType) {
            console.error("handleSendAiMessage called without a requestType in context!");
            alert("Cannot start action: Missing context type.");
            return;
        }

        const encodedRequestType = encodeURIComponent(requestType);

        // Redirect immediately
        router.push(`/chat?initialQuery=${encodedQuery}&requestType=${encodedRequestType}`);
    };

    // Handle loading state for session
    if (status === "loading") {
        return (
            <div className="flex justify-center items-center h-screen">
                <LoadingIndicator />
            </div>
        );
    }
    
    // Session is definitely authenticated here due to `required: true`
    const displayName = session?.user?.nickname || session?.user?.name || "User";
    const userImage = session?.user?.image || null;

    return (
        <div className="container mx-auto px-4 py-8 flex flex-col items-center space-y-6 md:space-y-8">
            <DashboardHeader 
                displayName={displayName} 
                userImage={userImage} 
            />

            <div className="flex flex-col gap-6 w-full max-w-4xl">
                <LogWorkoutButton />
                <SubscriptionStatus /> 
                
                {/* Conditional rendering for Progress & Records based on loading/error state */} 
                {isLoadingMetrics ? (
                    <div className="flex justify-center items-center h-24"><LoadingIndicator /></div>
                ) : errorMetrics ? (
                     <p className="text-center text-destructive">Error loading metrics: {errorMetrics}</p>
                ) : metrics ? (
                    <>
                        <ProgressCards 
                            strengthVolume={metrics.strengthVolumeLast7Days}
                            cardioDuration={metrics.cardioDurationLast7Days}
                            cardioDistance={metrics.cardioDistanceLast7Days}
                            strengthVolumePrevious={metrics.strengthVolumePrevious7Days}
                            cardioDurationPrevious={metrics.cardioDurationPrevious7Days}
                            cardioDistancePrevious={metrics.cardioDistancePrevious7Days}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SpotlightCards />
                            {/* Pass the actual function as a prop */}
                            <QuickActionsCard sendAiMessage={handleSendAiMessage} /> 
                        </div>

                        {/* Pass exercisePRs to the component */}
                        <PersonalRecordsCard 
                            topPRs={metrics.topPRs} // Keep passing old data for now if needed
                            exercisePRs={metrics.exercisePRs} // <-- Pass new data
                        />
                    </>
                ) : (
                    <p className="text-center text-muted-foreground">Metrics data not available.</p>
                )}
                
                {/* Render Spotlight/QuickActions even if metrics fail? Or hide them too? 
                    Keeping them visible for now, but QuickActionsCard needs handleSendAiMessage.
                    Let's move QuickActionsCard outside the conditional metric rendering. */}
                {/* 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SpotlightCards />
                    <QuickActionsCard sendAiMessage={handleSendAiMessage} /> 
                </div> 
                */}
                
            </div>
            {/* Remove AI Loading indicator from dashboard */}
            {/* {isAiLoading && (
                 <div className="fixed bottom-4 right-4 z-50">
                     <LoadingIndicator /> 
                 </div>
            )} */}
        </div>
    );
}

// NOTE: This structure requires:
// 1. Moving the original client code into separate files within a subfolder like `src/app/dashboard/_components/`
//    (e.g., `_components/SubscriptionStatusClient.tsx`, `_components/DashboardHeaderClient.tsx`, etc.)
// 2. Creating the `calculateDashboardMetrics` function in `src/lib/dashboard-metrics.ts`.
// 3. Implementing the actual server-side data fetching logic in `getDashboardWorkouts`.
// 4. Ensuring all necessary UI components (`Card`, `Button`, etc.) are imported correctly within the client components. 