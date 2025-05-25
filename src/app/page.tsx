// Server component imports
import type { Metadata } from 'next'
import { generateMetadata } from '@/lib/utils/metadata'

// Import the dedicated client component
import LandingPageClient from "@/components/landing/landing-page-client";

// --- Metadata Definition ---
export const metadata: Metadata = generateMetadata({
  title: "Aivery | AI-Powered Fitness Training Intelligence",
  description: "Transform your workout data into actionable intelligence with personalized AI coaching that understands your training journey. Track, analyze, and improve your fitness with AI-powered insights.",
  path: "/",
  keywords: ["AI fitness coach", "workout analytics", "fitness tracking", "personalized training"],
  type: "website"
});

// --- Server Component (Default Export) ---
export default function Page() {
  // This server component simply renders the client component
  return <LandingPageClient />;
}


