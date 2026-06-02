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
        text: "Less noise. More signal.",
        action: {
          text: "How it works",
          href: "#features",
        },
      }}
      title="Your workouts, translated into calm, useful insight"
      description="Connect Strava, log training, and get short AI coaching that respects your data — no dashboard clutter, no hype."
      actions={[
        {
          text: "Get started free",
          href: "/register",
          variant: "default",
        },
        {
          text: "Connect Strava",
          href: "/register",
          variant: "glow",
          icon: <Icons.strava className="h-5 w-5" />,
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