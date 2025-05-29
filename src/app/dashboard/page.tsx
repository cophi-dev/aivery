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

// Import New Minimal Dashboard Components
import DashboardWrapper from "@/components/dashboard/DashboardWrapper";
import DailyInsight from "@/components/dashboard/DailyInsight";
import LastWorkout from "@/components/dashboard/LastWorkout";
import ProgressPulse from "@/components/dashboard/ProgressPulse";
import AskAivery from "@/components/dashboard/AskAivery";
import SmartNudges from "@/components/dashboard/SmartNudges";

// 🎯 DESIGN MODE TOGGLE
const MINIMAL_MODE = true;

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
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <LoadingIndicator />
                    <p className="text-body-sm text-neutral-500">Loading your dashboard</p>
                </div>
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
            {MINIMAL_MODE ? (
                // 🎨 NEW MINIMAL DESIGN
                <DashboardWrapper>
                    <DailyInsight />
                    <LastWorkout />
                    <ProgressPulse />
                    <SmartNudges mode="multiple" maxNudges={2} title="Weekly Insights" />
                    <AskAivery />
                </DashboardWrapper>
            ) : (
                // 🏛️ LEGACY LAYOUT (SAFELY COLLAPSED)
                <>
                    {/* LEGACY_BLOCK_START */}
                    <div className="legacy-dashboard">
                        {/* Header */}
                        <DashboardHeader 
                            displayName={<UserNicknameDisplay fallback={displayName} />} 
                            userImage={userImage} 
                        />

                        {/* Main Content Container */}
                        <main className="max-w-6xl mx-auto px-6 pb-20">
                            {/* AI Preferences Prompt */}
                            {!isLoadingMetrics && metrics && !metrics.hasAiPreferences && metrics.workoutCount > 0 && (
                                <div className="mb-12 p-6 border border-primary/20 rounded-minimal bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-5 h-5 text-primary" />
                                                <h3 className="text-heading-sm font-medium">Unlock Your Full Potential</h3>
                                            </div>
                                            <p className="text-body-sm text-neutral-600">
                                                Set your fitness goals and preferences to receive personalized AI insights.
                                            </p>
                                        </div>
                                        <Link href="/settings?tab=ai">
                                            <Button variant="default" size="sm" className="font-medium">
                                                Get Started <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Content Sections */}
                            {isLoadingMetrics ? (
                                <div className="flex justify-center items-center py-32">
                                    <div className="text-center space-y-6">
                                        <LoadingIndicator />
                                        <p className="text-body-sm text-neutral-500">Loading your fitness insights...</p>
                                    </div>
                                </div>
                            ) : errorMetrics ? (
                                <div className="text-center py-32 space-y-6">
                                    <p className="text-heading-md text-destructive font-medium">Error loading metrics</p>
                                    <p className="text-body-sm text-neutral-600">{errorMetrics}</p>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => window.location.reload()}
                                        className="font-medium"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            ) : metrics && metrics.workoutCount === 0 ? (
                                // Getting Started Experience
                                <div className="text-center py-20 space-y-8">
                                    <div className="space-y-4">
                                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
                                            <Activity className="w-8 h-8 text-primary" />
                                        </div>
                                        <h2 className="text-display-sm font-display">Welcome to Your Fitness Journey</h2>
                                        <p className="text-body-lg text-neutral-600 max-w-lg mx-auto">
                                            Ready to track your progress and get AI-powered insights?
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                                        <Link href="/workouts/new">
                                            <Button variant="default" size="lg" className="w-full sm:w-auto font-medium">
                                                <Edit3 className="w-5 h-5 mr-2" />
                                                Log First Workout
                                            </Button>
                                        </Link>
                                        <Link href="/integrations">
                                            <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium">
                                                <Upload className="w-5 h-5 mr-2" />
                                                Connect Strava
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ) : metrics ? (
                                // Dashboard with Data
                                <div className="space-y-16">
                                    {/* Quick Actions Row */}
                                    <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                        <div className="lg:col-span-3">
                                            <LogWorkoutButton />
                                        </div>
                                        <div>
                                            <SubscriptionStatus />
                                        </div>
                                    </section>

                                    {/* Feature Highlights */}
                                    {metrics.workoutCount > 0 && (
                                        <section>
                                            <FeatureHighlightClient />
                                        </section>
                                    )}

                                    {/* Progress Overview */}
                                    <section className="space-y-6">
                                        <h2 className="text-heading-lg font-medium">Progress Overview</h2>
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
                                    </section>

                                    {/* Personal Records & AI Actions */}
                                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <div className="xl:col-span-2 space-y-6">
                                            <h2 className="text-heading-lg font-medium">Personal Records</h2>
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

                                        <div className="space-y-8">
                                            <div className="space-y-6">
                                                <h2 className="text-heading-lg font-medium">AI Insights</h2>
                                                <SpotlightCards />
                                            </div>
                                            <QuickActionsCard sendAiMessage={handleSendAiMessage} />
                                        </div>
                                    </section>

                                    {/* Recent Activity */}
                                    <section className="space-y-6">
                                        <h2 className="text-heading-lg font-medium">Recent Activity</h2>
                                        <RecentExerciseCardClient />
                                    </section>
                                </div>
                            ) : (
                                <div className="text-center py-32">
                                    <p className="text-body-sm text-neutral-500">Metrics data not available.</p>
                                </div>
                            )}
                        </main>
                    </div>
                    {/* LEGACY_BLOCK_END */}
                </>
            )}
        </div>
    );
}

// NOTE: This structure requires:
// 1. Moving the original client code into separate files within a subfolder like `src/app/dashboard/_components/`
//    (e.g., `_components/SubscriptionStatusClient.tsx`, `_components/DashboardHeaderClient.tsx`, etc.)
// 2. Creating the `calculateDashboardMetrics` function in `src/lib/dashboard-metrics.ts`.
// 3. Implementing the actual server-side data fetching logic in `getDashboardWorkouts`.
// 4. Ensuring all necessary UI components (`Card`, `Button`, etc.) are imported correctly within the client components. 