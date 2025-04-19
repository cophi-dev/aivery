'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button"; // Assuming shadcn Button
import { LucidePlusCircle } from "lucide-react";

export function LogWorkoutButton() {
  return (
    <Button size="lg" variant="default" asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
      <Link href="/workouts/new" className="flex items-center justify-center w-full h-full">
        <LucidePlusCircle className="mr-2 h-5 w-5" /> Log New Workout
      </Link>
    </Button>
  );
} 