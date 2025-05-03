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

  // Render the page layout and client component
  return (
    <div className="container mx-auto px-4 py-8"> 
        <h1 className="text-3xl font-bold tracking-tight mb-6">Monthly Challenges</h1>
        
        {error && (
           <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Error Loading Challenges</p>
              <p>{error}</p>
           </div>
        )}
       
       <ChallengeListClient 
          initialChallenges={challenges} // Pass fetched/generated challenges
          onRefreshChallenges={refreshChallengesAction} // Pass the refresh action
       />
    </div>
  );
} 