'use client'; // <-- Make this a Client Component

import { redirect } from "next/navigation";
// import { headers } from 'next/headers'; // headers() only works in Server Components
import { useSession } from "next-auth/react"; // <-- Import useSession
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components
import Link from "next/link"; // Import Link
import { ArrowRight, Upload, Edit3, Sparkles, Activity } from "lucide-react"; // Import icons
import { cn } from '@/lib/utils';

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
import { FeatureHighlightClient } from "./_components/FeatureHighlightClient";
import { RecentExerciseCardClient } from './_components/RecentExerciseCardClient';

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

// Simple animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" }
    }
};

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
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <DashboardHeader 
                        displayName={<UserNicknameDisplay fallback={displayName} />} 
                        userImage={userImage} 
                    />

                    {/* Feature Highlights */}
                    {!isLoadingMetrics && metrics && metrics.workoutCount > 0 && (
                        <FeatureHighlightClient />
                    )}

                    {/* Main Action Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <LogWorkoutButton />
                        </div>
                        <div>
                            <SubscriptionStatus />
                        </div>
                    </div>
                    
                    {/* AI Preferences Prompt */}
                    {!isLoadingMetrics && metrics && !metrics.hasAiPreferences && metrics.workoutCount > 0 && (
                        <Card className="border border-primary/20 bg-primary/5">
                            <CardHeader className="flex flex-row items-center justify-between pb-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-primary" />
                                        Unlock Your Full Potential
                                    </CardTitle>
                                    <CardDescription>
                                        Set your fitness goals and preferences to receive personalized AI insights.
                                    </CardDescription>
                                </div>
                                <Link href="/settings?tab=ai">
                                    <Button>
                                        Get Started <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </CardHeader>
                        </Card>
                    )}
                    
                    {/* Main Content */}
                    {isLoadingMetrics ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="text-center space-y-4">
                                <LoadingIndicator />
                                <p className="text-muted-foreground">Loading your fitness insights...</p>
                            </div>
                        </div>
                    ) : errorMetrics ? (
                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardContent className="text-center py-12">
                                <p className="text-destructive font-medium">Error loading metrics: {errorMetrics}</p>
                                <Button 
                                    variant="outline" 
                                    className="mt-4"
                                    onClick={() => window.location.reload()}
                                >
                                    Try Again
                                </Button>
                            </CardContent>
                        </Card>
                    ) : metrics && metrics.workoutCount === 0 ? (
                        // Getting Started Experience
                        <Card className="border-2 border-dashed border-muted-foreground/20">
                            <CardHeader className="text-center pb-6">
                                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Activity className="w-8 h-8 text-primary" />
                                </div>
                                <CardTitle className="text-2xl">Welcome to Your Fitness Journey</CardTitle>
                                <CardDescription className="text-lg">
                                    Ready to track your progress and get AI-powered insights?
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                                    <Link href="/workouts/new">
                                        <Card className="h-full border hover:border-primary/40 transition-colors duration-200 hover:shadow-sm">
                                            <CardContent className="p-6 text-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                                    <Edit3 className="w-6 h-6 text-primary" />
                                                </div>
                                                <h3 className="font-semibold mb-2">Log First Workout</h3>
                                                <p className="text-sm text-muted-foreground">Manual entry for any activity</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                    <Link href="/integrations">
                                        <Card className="h-full border hover:border-accent/40 transition-colors duration-200 hover:shadow-sm">
                                            <CardContent className="p-6 text-center">
                                                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                                                    <Upload className="w-6 h-6 text-accent" />
                                                </div>
                                                <h3 className="font-semibold mb-2">Connect Strava</h3>
                                                <p className="text-sm text-muted-foreground">Import existing activities</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ) : metrics ? (
                        // Metrics Dashboard
                        <div className="space-y-8">
                            <ProgressCards 
                                strengthVolume={metrics.strengthVolumeLast7Days}
                                cardioDuration={metrics.cardioDurationLast7Days}
                                cardioDistance={metrics.cardioDistanceLast7Days}
                                strengthVolumePrevious={metrics.strengthVolumePrevious7Days}
                                cardioDurationPrevious={metrics.cardioDurationPrevious7Days}
                                cardioDistancePrevious={metrics.cardioDistancePrevious7Days}
                                runningDistance={metrics.runningDistanceLast7Days}
                                swimmingDistance={metrics.swimmingDistanceLast7Days}
                                bikingDistance={metrics.bikingDistanceLast7Days}
                                runningDistancePrevious={metrics.runningDistancePrevious7Days}
                                swimmingDistancePrevious={metrics.swimmingDistancePrevious7Days}
                                bikingDistancePrevious={metrics.bikingDistancePrevious7Days}
                            />

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                <div className="xl:col-span-2">
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
                                </div>

                                <div className="space-y-6">
                                    <SpotlightCards />
                                    <QuickActionsCard sendAiMessage={handleSendAiMessage} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <RecentExerciseCardClient />
                            </div>
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="text-center py-12">
                                <p className="text-muted-foreground">Metrics data not available.</p>
                            </CardContent>
                        </Card>
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