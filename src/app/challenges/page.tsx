export const dynamic = "force-dynamic";

// Remove "use client"; directive

import React from 'react'; // Keep React import

// Server-side imports
import { PrismaClient, ChallengeType, ChallengeStatus, ChallengeMetric } from '@prisma/client';
import type { Challenge } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth'; // Assuming server-side auth helper
import { getChallengesForUser } from '@/lib/challenge-actions'; // Import the new fetch/generate action
import { refreshChallengesAction } from '@/lib/challenge-actions'; // Keep the refresh action import

// Client component import
import { ChallengeListClient } from './challenge-list-client'; // Import the client component

// --- Server Component --- 
export default async function ChallengesPage() {
  // Authentication check (keep)
  const user = await getCurrentUser();
  if (!user?.id) {
    return <div className="p-4 text-center">Please log in to view challenges.</div>;
  }
  
  let challenges: Challenge[] = [];
  let error: string | null = null;

  try {
    // Call the single action to fetch or generate challenges
    console.log("[Challenges Page] Calling getChallengesForUser...");
    challenges = await getChallengesForUser(); 
    console.log(`[Challenges Page] Received ${challenges.length} challenges.`);
  } catch (e: any) {
    console.error("[Challenges Page] Error calling getChallengesForUser:", e);
    error = e.message || "Failed to load challenges.";
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-[100%] opacity-50 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
      </div>
      
      {/* Main content */}
      <div className="relative container max-w-7xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200/30 bg-red-50/10 backdrop-blur-xl p-4 text-red-700">
            <p className="font-semibold">Error Loading Challenges</p>
            <p>{error}</p>
          </div>
        )}
       
        <ChallengeListClient 
          initialChallenges={challenges}
          onRefreshChallenges={refreshChallengesAction}
        />
      </div>
    </div>
  );
} 