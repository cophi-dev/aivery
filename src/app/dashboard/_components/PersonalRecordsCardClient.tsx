'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ChevronRight } from "lucide-react";
import { format } from "date-fns"; // For formatting the date
import Link from "next/link"; // Import Link for navigation
// Import the new PR type
import type { DashboardPREntry } from "@/lib/workout-actions";

// Remove or update the old PersonalRecord interface if topPRs is removed
/*
interface PersonalRecord {
  exerciseName: string;
  weight: number;
  date: string; // Date string (ISO format expected from server)
}
*/

interface PersonalRecordsCardProps {
  // topPRs: PersonalRecord[]; // Keep or remove based on final decision
  exercisePRs?: DashboardPREntry[]; // <-- Add new prop (make optional initially)
}

export function PersonalRecordsCard({ exercisePRs = [] }: PersonalRecordsCardProps) { // Use exercisePRs, default to empty array
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-lg flex items-center justify-center">
          <Zap className="mr-2 h-5 w-5 text-yellow-500" /> Personal Records
        </CardTitle>
        <CardDescription>Your best recent lifts</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-center">
        {exercisePRs.length > 0 ? (
          exercisePRs.map((pr) => {
            const prContent = (
              <>
                <p className="font-medium truncate">{pr.exerciseName}</p>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{pr.value} {pr.unit}</span>
                  {pr.date && (
                      <span className="text-xs"> on {format(new Date(pr.date), 'MMM d, yyyy')}</span>
                  )}
                </p>
              </>
            );

            return (
              <div key={pr._id} className="text-sm border-b border-border/50 pb-2 last:border-b-0 sm:last:border-b-0">
                {pr.workoutId ? (
                  // Change href to use /workouts/ (plural)
                  <Link href={`/workouts/${pr.workoutId}`} className="block group hover:text-primary transition-colors">
                    {prContent}
                    <ChevronRight className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ) : (
                  // Render content without Link if no workoutId
                  prContent
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">No specific PRs recorded recently.</p>
        )}
      </CardContent>
    </Card>
  );
}