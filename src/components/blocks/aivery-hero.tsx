"use client";

import { HeroSection } from "@/components/blocks/hero-section";
import { Icons } from "@/components/ui/icons";

export function AiveryHero() {
  // Handler to prevent default behavior
  const handleStravaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Could add a notification here if desired
  };

  return (
    <HeroSection
      badge={{
        text: "AI-Powered Fitness Analytics",
        action: {
          text: "Learn more",
          href: "#features",
        },
      }}
      title="Elevate Your Training with AI-Powered Insights"
      description="Aivery transforms workout data into actionable intelligence. Track, analyze, and improve with personalized AI coaching."
      actions={[
        {
          text: "Start Your Journey",
          href: "/register",
          variant: "default",
        },
        {
          text: "Connect Strava",
          href: "#",
          variant: "glow",
          icon: <Icons.strava className="h-5 w-5" />,
          onClick: handleStravaClick,
        },
      ]}
      image={{
        light: "/uploads/light.png",
        dark: "/uploads/dark.png",
        alt: "Aivery App Dashboard",
      }}
    />
  );
} 