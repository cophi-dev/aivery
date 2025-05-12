'use client';

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarPlus, ClipboardCheck } from 'lucide-react'; // Or your preferred icons
import { InfoDisplayModal } from '@/components/features/InfoDisplayModal';

// Define the props for the component, including the function to send messages
interface QuickActionsCardProps {
  sendAiMessage: (query: string, context: any) => void;
}

export function QuickActionsCard({ sendAiMessage }: QuickActionsCardProps) {

    // State for the review modal
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewContent, setReviewContent] = useState<string | null>(null);
    const [isLoadingReview, setIsLoadingReview] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewModalTitle, setReviewModalTitle] = useState("");

    // Get current day of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Determine if we should review 'this_week' (Thursday-Sunday) or 'last_week' (Monday-Wednesday)
    // Days: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    const reviewPeriod = (dayOfWeek >= 4 || dayOfWeek === 0) ? 'this_week' : 'last_week';
    const reviewButtonText = reviewPeriod === 'this_week' ? "Review This Week's Workouts" : "Review Last Week's Workouts";
    // Updated query with specific structuring instructions
    const reviewUserQuery = `Please review my performance and progress from ${reviewPeriod === 'this_week' ? 'this current week' : 'the last completed week'}. Structure your response using the following Markdown headings exactly:
#### Overall Summary
#### Strength Insights
#### Cardio Insights
#### Consistency & Volume

After the sections, conclude *only* with an engaging question asking for my feedback, formatted like this: ***How does this sound to you?***`;

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

    // Function to fetch review content
    const fetchReviewContent = useCallback(async (period: string, query: string) => {
      setIsLoadingReview(true);
      setReviewContent(null);
      setReviewError(null);
      console.log(`[QuickActions] Fetching review content for: ${period}`);

      try {
        const response = await fetch('/api/ai/coach', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: query,
            // Provide context expected by the backend
            context: { 
              requestType: 'generate_weekly_review',
              reviewPeriod: period 
            },
            history: [], // Include empty history just in case
          }),
        });

        if (!response.ok) {
          let errorBody = "Failed to fetch review details.";
          try { 
            const errorData = await response.json();
            errorBody = errorData.error || errorData.message || errorBody; 
          } catch { /* Ignore parsing error */ }
          throw new Error(errorBody);
        }

        const result = await response.json();
        
        if (result.response) {
          console.log("[QuickActions] Review content fetched successfully.");
          setReviewContent(result.response);
        } else {
          throw new Error("Received empty response from AI for review.");
        }

      } catch (error: any) {
        console.error("[QuickActions] Error fetching review content:", error);
        setReviewError(error.message || "An unknown error occurred while fetching the review.");
        setReviewContent(null); 
      } finally {
        setIsLoadingReview(false);
      }
    }, []); // Empty dependency array, function doesn't depend on component state directly

    // MODIFIED handler for reviewing workouts - Opens modal
    const handleReviewWeek = () => {
        console.log(`Triggering weekly review modal for: ${reviewPeriod}`);
        setReviewModalTitle(reviewButtonText); // Set title for the modal
        setShowReviewModal(true); // Open the modal
        fetchReviewContent(reviewPeriod, reviewUserQuery); // Fetch content
        // --- REMOVED call to sendAiMessage --- 
    };
    
    // Handler to close the modal
    const handleCloseReviewModal = () => {
        setShowReviewModal(false);
        // Optionally reset state on close, or let it reset on next open
        // setReviewContent(null);
        // setIsLoadingReview(false);
        // setReviewError(null);
        // setReviewModalTitle("");
    };

    return (
        <>
            <Card className="rounded-xl shadow-sm border border-border bg-card">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                        Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-0">
                    <Button
                        variant="secondary"
                        onClick={handleGeneratePlan}
                        className="w-full"
                    >
                        <CalendarPlus className="h-5 w-5 mr-2" />
                        Create Next Week's Plan
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleReviewWeek}
                        className="w-full"
                    >
                        <ClipboardCheck className="h-5 w-5 mr-2" />
                        {reviewButtonText}
                    </Button>
                </CardContent>
            </Card>

            {/* Render the Info Display Modal */}
            <InfoDisplayModal
                isOpen={showReviewModal}
                onClose={handleCloseReviewModal}
                title={reviewModalTitle}
                contextIdentifier={reviewButtonText}
                content={reviewContent}
                isLoading={isLoadingReview}
                error={reviewError}
                // Custom loading text based on period
                loadingText={`Aivery is analyzing ${reviewPeriod === 'this_week' ? 'this week\'s' : 'last week\'s'} workouts...`}
            />
        </>
    );
}