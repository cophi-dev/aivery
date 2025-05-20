"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DumbbellIcon, Timer, HeartPulseIcon, BrainIcon, TrendingUpIcon, CalendarIcon } from "lucide-react";

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

interface FeatureHighlightSectionProps {
  className?: string;
}

export function FeatureHighlightSection({ className }: FeatureHighlightSectionProps) {
  const features: FeatureItem[] = [
    {
      title: "AI-Powered Insights",
      description: "Get personalized workout suggestions and performance analysis based on your training history.",
      icon: <BrainIcon className="h-8 w-8 text-primary" />,
    },
    {
      title: "Muscle Group Analysis",
      description: "Visualize your training patterns and identify potentially neglected muscle groups.",
      icon: <DumbbellIcon className="h-8 w-8 text-primary" />,
    },
    {
      title: "Real-World Comparisons",
      description: "See how your running and cycling distances compare to real-world landmarks.",
      icon: <Timer className="h-8 w-8 text-primary" />,
    },
    {
      title: "Strava Integration",
      description: "Seamlessly import your workouts from Strava with proper data conversion.",
      icon: <TrendingUpIcon className="h-8 w-8 text-primary" />,
    },
    {
      title: "Health Tracking",
      description: "Monitor your key health metrics and see progress over time with intuitive visualizations.",
      icon: <HeartPulseIcon className="h-8 w-8 text-primary" />,
    },
    {
      title: "Weekly Reviews",
      description: "Get comprehensive summaries of your training with actionable feedback to improve.",
      icon: <CalendarIcon className="h-8 w-8 text-primary" />,
    },
  ];

  return (
    <div className={cn("w-full py-8 md:py-12", className)}>
      <div className="container mx-auto">
        <div className="flex flex-col gap-8">
          <div className="flex gap-3 flex-col items-start">
            <Badge variant="outline" className="px-3 py-1 font-medium">New Features</Badge>
            <div className="flex gap-2 flex-col">
              <h2 className="text-2xl md:text-3xl tracking-tight font-medium">
                Elevate Your Fitness Journey
              </h2>
              <p className="text-base max-w-xl leading-relaxed text-muted-foreground">
                Discover the latest tools and features designed to help you train smarter, track better, and achieve more.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="flex flex-col gap-3 p-5 rounded-lg border bg-card hover:shadow-md transition-shadow"
              >
                <div className="rounded-md p-2 w-fit bg-muted">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium tracking-tight">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 