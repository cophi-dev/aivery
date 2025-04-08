'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { format } from "date-fns"; // For formatting the date

// Define the structure of a PR entry passed from the server
interface PersonalRecord {
  exerciseName: string;
  weight: number;
  date: string; // Date string (ISO format expected from server)
}

interface PersonalRecordsCardProps {
  topPRs: PersonalRecord[]; // Array of top PRs
}

export function PersonalRecordsCard({ topPRs }: PersonalRecordsCardProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-lg flex items-center justify-center">
          <Zap className="mr-2 h-5 w-5 text-yellow-500" /> Personal Records
        </CardTitle>
        <CardDescription>Your best recent lifts</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-center">
        {topPRs.length > 0 ? (
          topPRs.map((pr) => (
            <div key={pr.exerciseName} className="text-sm border-b border-border/50 pb-2 last:border-b-0 sm:last:border-b-0">
              <p className="font-medium truncate">{pr.exerciseName}</p>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{pr.weight} kg</span>
                {pr.date && (
                    <span className="text-xs"> on {format(new Date(pr.date), 'MMM d, yyyy')}</span>
                )}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">No PRs recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
} 