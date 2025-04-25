'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Search } from "lucide-react";
import { ConceptSlideshow } from '@/components/features/ConceptSlideshow';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useSession } from 'next-auth/react';

// --- Keyword & Question Lists (defined locally) ---
const fitnessKeywords = [
  "Plyometrics", "Progressive Overload", "Zone 2 Training", "HIIT", "Tabata",
  "Compound Exercises", "Isolation Exercises", "Supersets", "Drop Sets",
  "Periodization", "Active Recovery", "Foam Rolling", "Dynamic Stretching",
  "Static Stretching", "Mind-Muscle Connection", "Time Under Tension",
  "Macronutrients", "Micronutrients", "Caloric Deficit", "Caloric Surplus",
  "Intermittent Fasting", "Nasal Breathing", "VO2 Max", "Lactate Threshold",
  "Heart Rate Variability (HRV)", "DOMS (Delayed Onset Muscle Soreness)",
  "Functional Training", "Circuit Training", "Bodyweight Training", "Kettlebell Swings"
];

const dataInsightQuestions = [
  "How far did I run last month?",
  "What was my longest run ever?",
  "How much total weight did I lift this week?",
  "What was my average pace last week?",
  "How many workouts did I log in July 2024?",
  "Did I do any cycling last week?",
  "Show my strength workouts from the last 7 days.",
  "What's my best bench press record?",
  "Compare my running distance this month to last month."
];
// -----------------------------------------------

export function SpotlightCards() {
  const { data: session } = useSession();
  const [spotlightKeyword, setSpotlightKeyword] = useState<string | null>(null);
  const [dataInsightQuestion, setDataInsightQuestion] = useState<string | null>(null);

  // State for the slideshow modal
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [slideshowKeyword, setSlideshowKeyword] = useState<string | null>(null);
  const [slideshowContent, setSlideshowContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Select random items on mount
  useEffect(() => {
    if (fitnessKeywords.length > 0) {
      const keywordIndex = Math.floor(Math.random() * fitnessKeywords.length);
      setSpotlightKeyword(fitnessKeywords[keywordIndex]);
    }
    if (dataInsightQuestions.length > 0) {
      const questionIndex = Math.floor(Math.random() * dataInsightQuestions.length);
      setDataInsightQuestion(dataInsightQuestions[questionIndex]);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Function to fetch concept explanation content
  const fetchConceptContent = useCallback(async (keyword: string) => {
    if (!keyword) return;
    
    console.log(`[SpotlightCards] Fetching content for keyword: ${keyword}`);
    setIsLoadingContent(true);
    setContentError(null);
    setSlideshowContent(null); // Clear previous content

    try {
      // Simulate the "What is [keyword]?" query to the existing API endpoint
      const response = await fetch('/api/ai/coach', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `What is ${keyword}?`,
          // History might be needed if the API relies on it, pass empty for now
          history: [], 
          // Context is not strictly needed for this specific query pattern, but pass empty object
          context: {} 
        }),
      });

      if (!response.ok) {
        let errorBody = "Failed to fetch concept details.";
        try { 
          const errorData = await response.json();
          errorBody = errorData.error || errorData.response || errorBody; 
        } catch { /* Ignore parsing error */ }
        throw new Error(errorBody);
      }

      const result = await response.json();
      
      if (result.response) {
        console.log("[SpotlightCards] Content fetched successfully.");
        setSlideshowContent(result.response);
      } else {
        throw new Error("Received empty response from AI.");
      }

    } catch (error: any) {
      console.error("[SpotlightCards] Error fetching concept content:", error);
      setContentError(error.message || "An unknown error occurred.");
      setSlideshowContent("Error loading content. Please try again."); // Set error message for display
    } finally {
      setIsLoadingContent(false);
    }
  }, []); // No dependencies needed if fetch URL/method is static

  // Handler to open the slideshow and trigger fetch
  const handleConceptClick = (keyword: string) => {
    setSlideshowKeyword(keyword);
    setShowSlideshow(true);
    fetchConceptContent(keyword); // Fetch content when modal opens
  };

  // Handler to close the slideshow
  const handleCloseSlideshow = () => {
    setShowSlideshow(false);
    // Reset state when closing
    setSlideshowKeyword(null);
    setSlideshowContent(null);
    setIsLoadingContent(false);
    setContentError(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6">
        {/* Concept Spotlight Card - Now triggers modal */}
        {spotlightKeyword && (
          <Card 
            className="hover:bg-muted/50 transition-colors rounded-xl shadow-sm cursor-pointer" 
            onClick={() => handleConceptClick(spotlightKeyword)} 
            title={`Learn about ${spotlightKeyword}`}
            role="button" // Improve accessibility
            tabIndex={0} // Make it focusable
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleConceptClick(spotlightKeyword)} // Keyboard accessible
          >
            <div className="p-4"> {/* Inner div for padding, Link removed */}
              <div className="flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Concept Spotlight</p>
                  <p className="text-base font-medium text-foreground">
                    What is {spotlightKeyword}?
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Data Insights Card (remains a Link) */}
        {dataInsightQuestion && (
          <Card className="hover:bg-muted/50 transition-colors rounded-xl shadow-sm">
             {/* Keep this as a direct link for now */}
            <a 
              href={`/chat?dataQuery=${encodeURIComponent(dataInsightQuestion)}`} 
              className="block p-4"
              title={`Ask: ${dataInsightQuestion}`}
            >
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Explore Your Data</p>
                  <p className="text-base font-medium text-foreground">
                    {dataInsightQuestion}
                  </p>
                </div>
              </div>
            </a>
          </Card>
        )}
      </div>

      {/* Render the Slideshow Modal */}
      {showSlideshow && slideshowKeyword && (
        <ConceptSlideshow
          keyword={slideshowKeyword}
          // Pass loading/error message or fetched content
          markdownContent={isLoadingContent ? "Loading..." : contentError ? `Error: ${contentError}` : slideshowContent || "No content available."}
          isOpen={showSlideshow}
          onClose={handleCloseSlideshow}
        />
      )}
    </>
  );
} 