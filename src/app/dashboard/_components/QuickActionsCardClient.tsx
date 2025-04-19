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

    // Handler for generating the next week's plan
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

    // Handler for reviewing this week's workouts
    const handleReviewWeek = () => {
        // Check if the function is available before calling
        if (typeof sendAiMessage === 'function') {
            console.log("Triggering weekly review...");
            const context = {
                requestType: 'generate_weekly_review'
            };
            const userQuery = "Can you review my performance and progress from the last completed week?"; // Slightly different query for dashboard context
            sendAiMessage(userQuery, context);
        } else {
            console.error('sendAiMessage function was not provided or is not a function.');
            alert('Error: Could not trigger weekly review.');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col space-y-3">
                <Button
                    variant="outline"
                    onClick={handleGeneratePlan}
                >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Create Next Week's Plan
                </Button>
                <Button
                    variant="outline"
                    onClick={handleReviewWeek}
                >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Review This Week's Workouts
                </Button>
            </CardContent>
        </Card>
    );
}