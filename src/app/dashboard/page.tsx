'use client'; // <-- Make this a Client Component

import { redirect } from "next/navigation";
// import { headers } from 'next/headers'; // headers() only works in Server Components
import { useSession } from "next-auth/react"; // <-- Import useSession
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components
import Link from "next/link"; // Import Link
import { ArrowRight, Upload, Edit3, Sparkles } from "lucide-react"; // Import icons

// Import Client Components
import { SubscriptionStatus } from "./_components/SubscriptionStatusClient"; 
import { DashboardHeader } from "./_components/DashboardHeaderClient"; 
import { LogWorkoutButton } from "./_components/LogWorkoutButtonClient"; 
import { ProgressCards } from "./_components/ProgressCardsClient"; 
import { SpotlightCards } from "./_components/SpotlightCardsClient"; 
import { PersonalRecordsCard } from "./_components/PersonalRecordsCardClient";
import { QuickActionsCard } from "./_components/QuickActionsCardClient";
import { LoadingIndicator } from "@/components/ui/loading-indicator"; // Assuming a loading indicator component
// Replace DailyInsightCard with AiveryInsights
// import AiveryInsights from "@/components/dashboard/AiveryInsights"; // <-- Updated import
// Import the type for exercise PRs and IUser for overall PRs
import type { DashboardPREntry } from "@/lib/workout-actions";
import type { IUser } from '@/lib/db/models/user';
import { Button } from "@/components/ui/button"; // Import Button
import UserNicknameDisplay from "@/components/UserNicknameDisplay";
import type { ObjectId } from 'mongoose'; // Import ObjectId for type checking

// Define a type for the metrics data
interface DashboardMetrics {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number;
    cardioDistanceLast7Days: number;
    strengthVolumePrevious7Days: number;
    cardioDurationPrevious7Days: number;
    cardioDistancePrevious7Days: number;
    // topPRs: any[]; // Keep commented out
    exercisePRs: DashboardPREntry[];
    overallPRs?: Partial<IUser['personalRecords']>; // <-- Add overall PRs
    workoutCount: number;
    // Added this field from the backend API 
    hasAiPreferences?: boolean; 
    runningDistanceLast7Days: number;
    swimmingDistanceLast7Days: number;
    bikingDistanceLast7Days: number;
    runningDistancePrevious7Days: number;
    swimmingDistancePrevious7Days: number;
    bikingDistancePrevious7Days: number;
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
                console.log("[Dashboard Page] useEffect triggered. Status authenticated. Fetching metrics..."); // Log start
                try {
                    // console.log("[Dashboard Page] Fetching metrics from API..."); // Original log
                    const response = await fetch('/api/dashboard/metrics');
                    console.log(`[Dashboard Page] API Response Status: ${response.status}`); // Log status
                    if (!response.ok) {
                        const errorText = await response.text(); // Try to get error text
                        console.error("[Dashboard Page] API Response Error Text:", errorText);
                        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
                    }
                    const data: DashboardMetrics = await response.json();
                    console.log("[Dashboard Page] Metrics data received:", JSON.stringify(data, null, 2)); // Log full received data
                    setMetrics(data);
                } catch (error: any) {
                    console.error("[Dashboard Page] Error fetching metrics:", error);
                    setErrorMetrics(error.message || "Failed to load dashboard metrics.");
                    setMetrics(null); // Reset metrics on error
                } finally {
                    setIsLoadingMetrics(false);
                    console.log("[Dashboard Page] Fetch metrics finished."); // Log end
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
        console.log("Context Received:", context); // Log received context

        // Encode query and context to pass in URL
        const encodedQuery = encodeURIComponent(query);
        // Extract required requestType and optional reviewPeriod
        const requestType = context?.requestType;
        const reviewPeriod = context?.reviewPeriod; // Get reviewPeriod if present

        if (!requestType) {
            console.error("handleSendAiMessage called without a requestType in context!");
            alert("Cannot start action: Missing context type.");
            return;
        }

        const encodedRequestType = encodeURIComponent(requestType);
        
        // Build the URL with query parameters
        let redirectUrl = `/chat?initialQuery=${encodedQuery}&requestType=${encodedRequestType}`;
        
        // Add reviewPeriod to URL if it exists
        if (reviewPeriod) {
            const encodedReviewPeriod = encodeURIComponent(reviewPeriod);
            redirectUrl += `&reviewPeriod=${encodedReviewPeriod}`;
            console.log(`Adding reviewPeriod to redirect URL: ${reviewPeriod}`);
        }

        // Redirect immediately
        console.log("Redirecting to:", redirectUrl);
        router.push(redirectUrl);
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
    const displayName = session?.user?.name || "User";
    const userImage = session?.user?.image || null;

    // Log metrics state right before rendering
    console.log(`[Dashboard Page] Rendering. isLoadingMetrics: ${isLoadingMetrics}, metrics: ${JSON.stringify(metrics, null, 2)}, workoutCount: ${metrics?.workoutCount}`);

    return (
        <div className="container mx-auto px-4 sm:px-6 md:py-10 py-6 flex flex-col items-center bg-background">
            <div className="w-full max-w-5xl space-y-6 md:space-y-8 lg:space-y-10">
                <DashboardHeader 
                    displayName={<UserNicknameDisplay fallback={displayName} />} 
                    userImage={userImage} 
                />

                <div className="space-y-6 md:space-y-8">
                    <LogWorkoutButton />
                    <SubscriptionStatus />
                    
                    {/* AI Preferences Card */}
                    {!isLoadingMetrics && metrics && !metrics.hasAiPreferences && metrics.workoutCount > 0 && (
                        <Card className="border-secondary/70 dark:border-secondary/80 bg-secondary/50 dark:bg-secondary/30 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl">
                             <CardHeader className="flex flex-row items-center justify-between pb-3">
                                 <div className="space-y-1">
                                    <CardTitle className="text-base font-semibold text-secondary-foreground dark:text-secondary-foreground flex items-center">
                                         <Sparkles className="w-5 h-5 mr-2 text-primary dark:text-primary" />
                                         Unlock Deeper Insights!
                                     </CardTitle>
                                    <CardDescription className="text-sm text-secondary-foreground/80 dark:text-secondary-foreground/80">
                                         Tell Aivery about your goals and preferences for a truly personalized experience.
                                     </CardDescription>
                                 </div>
                                <Link href="/settings?tab=ai">
                                     <Button variant="outline" size="sm" className="bg-background dark:bg-card border-border dark:border-border text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-muted/50">
                                         Set Preferences <ArrowRight className="w-4 h-4 ml-1.5" />
                                     </Button>
                                 </Link>
                             </CardHeader>
                        </Card>
                    )}
                    
                    {/* Conditional rendering for Getting Started / Progress & Records */} 
                    {isLoadingMetrics ? (
                        <div className="flex justify-center items-center h-24"><LoadingIndicator /></div>
                    ) : errorMetrics ? (
                         <p className="text-center text-destructive">Error loading metrics: {errorMetrics}</p>
                    ) : metrics && metrics.workoutCount === 0 ? (
                        // --- Getting Started Card ---
                        <Card className="border-dashed border-primary/50 dark:border-primary/30 bg-primary/5 dark:bg-primary/10 text-primary-foreground dark:text-primary/90 shadow-sm rounded-xl">
                            <CardHeader>
                                <CardTitle className="text-primary dark:text-primary text-xl font-semibold">🚀 Let's Get Started!</CardTitle>
                                <CardDescription className="text-primary/80 dark:text-primary/70">Your Aivery journey begins now. How do you want to add your first workout?</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col sm:flex-row gap-5">
                                    {/* Option 1: Import */}
                                    <div className="flex-1 p-4 border dark:border-border/50 rounded-lg bg-background/50 dark:bg-card/60 hover:bg-background/70 dark:hover:bg-card/80 transition-colors">
                                        <div className="flex items-center mb-2">
                                            <Upload className="w-5 h-5 mr-2 text-primary dark:text-primary" />
                                            <h4 className="font-medium text-primary/90 dark:text-foreground">Import History</h4>
                                        </div>
                                        <p className="text-sm text-primary/70 dark:text-muted-foreground mb-3">Got data on Strava? Bring it over to fill your timeline.</p>
                                        <Link href="/integrations">
                                            <Button variant="outline" size="sm" className="w-full bg-white dark:bg-background text-primary dark:text-foreground border-primary/30 dark:border-border hover:bg-primary/10 dark:hover:bg-accent">
                                                Go to Integrations <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </Link>
                                    </div>
                                    
                                    {/* Option 2: Manual Log / Auto-Sync */}
                                    <div className="flex-1 p-4 border dark:border-border/50 rounded-lg bg-background/50 dark:bg-card/60 hover:bg-background/70 dark:hover:bg-card/80 transition-colors">
                                         <div className="flex items-center mb-2">
                                            <Edit3 className="w-5 h-5 mr-2 text-primary dark:text-primary" />
                                            <h4 className="font-medium text-primary/90 dark:text-foreground">Start Fresh</h4>
                                        </div>
                                        <p className="text-sm text-primary/70 dark:text-muted-foreground mb-3">Log workouts manually or connect Strava for auto-syncing new ones.</p>
                                        <Link href="/log-workout">
                                            <Button variant="outline" size="sm" className="w-full mb-2 bg-white dark:bg-background text-primary dark:text-foreground border-primary/30 dark:border-border hover:bg-primary/10 dark:hover:bg-accent">
                                                Log First Workout <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </Link>
                                        <Link href="/integrations">
                                            <Button variant="link" size="sm" className="text-primary/70 dark:text-muted-foreground hover:text-primary dark:hover:text-foreground w-full text-xs p-0 h-auto">
                                                Setup Auto-Sync
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        // --- End Getting Started Card ---
                    ) : metrics ? (
                        // --- Regular Metrics Cards ---
                        <>
                            <ProgressCards 
                                strengthVolume={metrics.strengthVolumeLast7Days}
                                cardioDuration={metrics.cardioDurationLast7Days}
                                cardioDistance={metrics.cardioDistanceLast7Days}
                                strengthVolumePrevious={metrics.strengthVolumePrevious7Days}
                                cardioDurationPrevious={metrics.cardioDurationPrevious7Days}
                                cardioDistancePrevious={metrics.cardioDistancePrevious7Days}
                                // Add new exercise-specific values
                                runningDistance={metrics.runningDistanceLast7Days}
                                swimmingDistance={metrics.swimmingDistanceLast7Days}
                                bikingDistance={metrics.bikingDistanceLast7Days}
                                runningDistancePrevious={metrics.runningDistancePrevious7Days}
                                swimmingDistancePrevious={metrics.swimmingDistancePrevious7Days}
                                bikingDistancePrevious={metrics.bikingDistancePrevious7Days}
                            />
                            {/* Add Personal Records and Spotlight cards in a grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <PersonalRecordsCard 
                                    exercisePRs={metrics.exercisePRs || []}
                                    overallPRs={{
                                        longestRun: metrics.overallPRs?.longestRun ? {
                                            ...metrics.overallPRs.longestRun,
                                            workoutId: metrics.overallPRs.longestRun.workoutId?.toString()
                                        } : undefined,
                                        fastest5kPace: metrics.overallPRs?.fastest5kPace ? {
                                            ...metrics.overallPRs.fastest5kPace,
                                            workoutId: metrics.overallPRs.fastest5kPace.workoutId?.toString()
                                        } : undefined,
                                        maxStrengthVolume: metrics.overallPRs?.maxStrengthVolume ? {
                                            ...metrics.overallPRs.maxStrengthVolume,
                                            workoutId: metrics.overallPRs.maxStrengthVolume.workoutId?.toString()
                                        } : undefined
                                    }}
                                />
                                <SpotlightCards />
                            </div>
                            {/* Quick Actions Card - Correct prop name */}
                            <QuickActionsCard sendAiMessage={handleSendAiMessage} />
                        </>
                        // --- End Regular Metrics Cards ---
                    ) : (
                        <p className="text-center text-muted-foreground">Metrics data not available.</p>
                    )}
                    
                </div>
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