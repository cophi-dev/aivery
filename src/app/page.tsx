// Server component imports
import type { Metadata } from 'next'

// Import the dedicated client component
import LandingPageClient from "@/components/landing/landing-page-client";

// --- Metadata Definition ---
export const metadata: Metadata = {
  title: "Aivery | Your AI-Powered Fitness Companion", // More descriptive title
  description: "Aivery helps you understand your workouts – not just track them. Train smarter, see patterns, and improve with purpose.",
  // Add Open Graph metadata specifically for the landing/dashboard page
  openGraph: {
    title: "Aivery | Your AI-Powered Fitness Companion",
    description: "Understand your training data, see progress, and get AI coaching.",
    // TODO: Replace with your actual deployed URL base
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://aivery.app', // Use env variable or default
    siteName: 'Aivery',
    // TODO: Create and use a specific OG image for the landing page
    images: [
      {
        url: '/images/og-home.png', // Path relative to /public
        width: 1200,
        height: 630,
        alt: 'Aivery App Interface Preview',
      },
      // Optional: Add a second image or fallback if needed
    ],
    locale: 'en_US',
    type: 'website',
  },
  // Optional: Add Twitter specific card metadata if desired
  // twitter: {
  //   card: 'summary_large_image',
  //   title: "Aivery | Your AI-Powered Fitness Companion",
  //   description: "Understand your training data, see progress, and get AI coaching.",
  //   images: ['/images/og-home.png'], // Use the same image or a different one
  // },
  // Optional: Add other relevant meta tags
  // themeColor: '#ffffff',
};

// --- Server Component (Default Export) ---
export default function Page() {
  // This server component simply renders the client component
  return <LandingPageClient />;
}


