"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2 } from "lucide-react";

// Placeholder type for API response - adapt as needed
type InsightResponse = {
  highlight: string;
  positiveTrends?: string[];
  negativeTrends?: string[];
  milestones?: string[];
};

// Update props interface to accept dateRange
interface AiveryInsightsProps {
  dateRange: { start: Date; end: Date };
}

export default function AiveryInsights({ dateRange }: AiveryInsightsProps) {
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Construct API URL with date range parameters
        const apiUrl = `/api/ai/overview-insights?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`;
        
        console.log(`Fetching insights from: ${apiUrl}`); // Debug log
        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})); // Try to parse error body
          console.error("API Error Response:", errorData);
          throw new Error(errorData.error || `Failed to fetch insights (${response.status})`);
        }

        const data: InsightResponse = await response.json();
        console.log("Received insights data:", data); // Debug log

        // --- Placeholder Data Removed ---
        // await new Promise(resolve => setTimeout(resolve, 1500)); 
        // const data: InsightResponse = { ... }; 
        // --- End Placeholder Data ---

        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        console.error("Error fetching Aivery Insights:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
    // Add dependencies based on props used in fetch (e.g., dateRange)
  }, [dateRange]); // Add dateRange as a dependency

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
          Aivery Insights
        </CardTitle>
        {/* Add controls or actions if needed */}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing your performance...
          </div>
        )}
        {error && (
          <div className="text-destructive text-sm p-4">
            Error loading insights: {error}
          </div>
        )}
        {!isLoading && !error && insights && (
          <div className="space-y-4">
            <p className="text-base font-medium">{insights.highlight}</p>
            {/* Render Trends and Milestones */}
            {/* TODO: Add better styling for trends/milestones */}
            {insights.milestones && insights.milestones.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Milestones Achieved:</h4>
                <ul className="list-disc list-inside text-sm text-green-600 dark:text-green-400 space-y-1">
                  {insights.milestones.map((m, i) => <li key={`milestone-${i}`}>{m}</li>)}
                </ul>
              </div>
            )}
            {insights.positiveTrends && insights.positiveTrends.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Positive Trends:</h4>
                <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-400 space-y-1">
                  {insights.positiveTrends.map((t, i) => <li key={`pos-trend-${i}`}>{t}</li>)}
                </ul>
              </div>
            )}
            {insights.negativeTrends && insights.negativeTrends.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Areas to Watch:</h4>
                <ul className="list-disc list-inside text-sm text-orange-600 dark:text-orange-400 space-y-1">
                  {insights.negativeTrends.map((t, i) => <li key={`neg-trend-${i}`}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        {!isLoading && !error && !insights && (
          <div className="text-muted-foreground text-sm p-4 text-center">
            No insights available for this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 