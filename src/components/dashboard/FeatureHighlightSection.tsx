"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DumbbellIcon, Timer, HeartPulseIcon, BrainIcon, TrendingUpIcon, CalendarIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  linkUrl: string;
  linkText: string;
};

interface FeatureHighlightSectionProps {
  className?: string;
}

export function FeatureHighlightSection({ className }: FeatureHighlightSectionProps) {
  const features: FeatureItem[] = [
    {
      title: "AI Coach",
      description: "Get personalized workout suggestions based on your training history.",
      icon: <BrainIcon className="h-6 w-6 text-primary" />,
      linkUrl: "/chat/ai",
      linkText: "Ask AI Coach"
    },
    {
      title: "Muscle Analysis",
      description: "Check your muscle group coverage and identify any imbalances.",
      icon: <DumbbellIcon className="h-6 w-6 text-primary" />,
      linkUrl: "/analytics",
      linkText: "View Analysis" 
    },
    {
      title: "Calendar",
      description: "See your training schedule and plan future workouts.",
      icon: <CalendarIcon className="h-6 w-6 text-primary" />,
      linkUrl: "/calendar",
      linkText: "Open Calendar"
    },
  ];

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              Quick Access
            </h2>
            <Badge variant="outline" className="px-2 py-0.5 text-xs">New</Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="flex flex-col p-4 rounded-lg border bg-card shadow-sm"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-md p-1.5 bg-muted">
                    {feature.icon}
                  </div>
                  <h3 className="font-medium">{feature.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {feature.description}
                </p>
                <Link href={feature.linkUrl} className="mt-auto">
                  <Button size="sm" variant="outline" className="w-full">
                    {feature.linkText}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 