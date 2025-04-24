'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarPlus, ClipboardCheck } from 'lucide-react'; // Or your preferred icons

// Define the props for the component, including the function to send messages
interface QuickActionsCardProps {
  sendAiMessage: (query: string, context: any) => void;
}

export function QuickActionsCard({ sendAiMessage }: QuickActionsCardProps) {

    // Get current day of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Determine if we should review 'this_week' (Thursday-Sunday) or 'last_week' (Monday-Wednesday)
    // Days: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    const reviewPeriod = (dayOfWeek >= 4 || dayOfWeek === 0) ? 'this_week' : 'last_week';
    const reviewButtonText = reviewPeriod === 'this_week' ? "Review This Week's Workouts" : "Review Last Week's Workouts";
    const reviewUserQuery = reviewPeriod === 'this_week' 
        ? "Can you review my performance and progress from this current week?"
        : "Can you review my performance and progress from the last completed week?";

    // Handler for generating the next week\'s plan
    const handleGeneratePlan = () => {
        console.log("Triggering plan generation...");
        // System prompt construction is handled by the backend for this request type.
        // Backend will fetch history and goals.
        const context = {
            requestType: 'generate_plan',
            // No need to send systemPrompt from client
        };
        const userQuery = "Create my workout plan for next week based on my goals.";

        // Check if the function is available before calling
        if (typeof sendAiMessage === 'function') {
            sendAiMessage(userQuery, context);
        } else {
            console.error('sendAiMessage function was not provided or is not a function.');
            alert('Error: Could not trigger plan generation.');
        }
    };

    // Updated handler for reviewing workouts
    const handleReviewWeek = () => {
        // Check if the function is available before calling
        if (typeof sendAiMessage === 'function') {
            console.log(`Triggering weekly review for: ${reviewPeriod}`);
            const context = {
                requestType: 'generate_weekly_review',
                reviewPeriod: reviewPeriod // Pass the calculated period
            };
            // Use the dynamically generated query
            sendAiMessage(reviewUserQuery, context); 
        } else {
            console.error('sendAiMessage function was not provided or is not a function.');
            alert('Error: Could not trigger weekly review.');
        }
    };

    return (
        <Card className="rounded-xl">
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col space-y-3">
                <Button
                    variant="secondary"
                    onClick={handleGeneratePlan}
                >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Create Next Week's Plan
                </Button>
                <Button
                    variant="secondary"
                    onClick={handleReviewWeek}
                >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {/* Use the dynamic button text */}
                    {reviewButtonText}
                </Button>
            </CardContent>
        </Card>
    );
}