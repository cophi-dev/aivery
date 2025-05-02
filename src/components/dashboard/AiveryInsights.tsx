"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2, TrendingUp, TrendingDown, Trophy, CheckCircle, AlertTriangle, Award, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Helper component for rendering an insight list item
const InsightItem = ({ text, icon: Icon, colorClass }: { text: string; icon: React.ElementType; colorClass: string }) => (
  <li className="flex items-start gap-3">
    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", colorClass)} />
    <span className="text-sm text-muted-foreground">{text}</span>
  </li>
);

export default function AiveryInsights({ dateRange }: AiveryInsightsProps) {
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = `/api/ai/overview-insights?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch insights (${response.status})`);
        }
        const data: InsightResponse = await response.json();
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        console.error("Error fetching Aivery Insights:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInsights();
  }, [dateRange]);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center">
          <Lightbulb className="mr-2 h-4 w-4 text-yellow-500" />
          Aivery Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center p-6 text-muted-foreground text-sm">
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
          <div className="space-y-5">
            {insights.highlight && (
                <p className="text-base font-semibold text-foreground leading-relaxed"> 
                   {insights.highlight}
                </p>
            )}
            
            <div className="space-y-4">
                {insights.milestones && insights.milestones.length > 0 && (
                  <div>
                    <h4 className="flex items-center font-semibold text-sm mb-2">
                        <Trophy className="h-4 w-4 mr-2 text-amber-500"/> 
                        Milestones Achieved
                    </h4>
                    <ul className="space-y-2">
                      {insights.milestones.map((m, i) => 
                        <InsightItem key={`milestone-${i}`} text={m} icon={Award} colorClass="text-amber-500" />
                      )}
                    </ul>
                  </div>
                )}

                {insights.positiveTrends && insights.positiveTrends.length > 0 && (
                  <div>
                     <h4 className="flex items-center font-semibold text-sm mb-2">
                        <TrendingUp className="h-4 w-4 mr-2 text-green-500"/> 
                        Positive Trends
                    </h4>
                    <ul className="space-y-2">
                      {insights.positiveTrends.map((t, i) => 
                        <InsightItem key={`pos-trend-${i}`} text={t} icon={CheckCircle} colorClass="text-green-500" />
                      )}
                    </ul>
                  </div>
                )}

                {insights.negativeTrends && insights.negativeTrends.length > 0 && (
                   <div>
                     <h4 className="flex items-center font-semibold text-sm mb-2">
                        <Eye className="h-4 w-4 mr-2 text-orange-500"/> 
                        Areas to Watch
                    </h4>
                    <ul className="space-y-2">
                      {insights.negativeTrends.map((t, i) => 
                        <InsightItem key={`neg-trend-${i}`} text={t} icon={AlertTriangle} colorClass="text-orange-500" />
                      )}
                    </ul>
                  </div>
                )}
            </div>
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