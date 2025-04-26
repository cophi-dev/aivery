'use client'; // Make this a client component to manage state

import { useState } from 'react'; // Import useState
import { Button } from "@/components/ui/button"
import { LucidePlus } from "lucide-react"
import Link from "next/link"
import WorkoutDailyView from '@/components/workout-daily-view';
import WorkoutWeeklyView from '@/components/workout-weekly-view';
import WorkoutMonthlyView from '@/components/workout-monthly-view';
import { VERSION } from "../version"

// Import Tabs component from Shadcn UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Caching behaviour is now handled by the client component
// export const dynamic = 'force-dynamic'
// export const revalidate = 0
// export const fetchCache = 'force-no-store'

export default function WorkoutsPage() {
  // State for selected view
  const [selectedView, setSelectedView] = useState('daily');

  // NOTE: Authentication check might need to be handled differently now
  // depending on how/where data is fetched for each view.
  // For simplicity, we'll assume the user is authenticated for now.

  // Removed the initial server-side auth check and try/catch block
  // as this is now a client component.
  // Proper auth handling (e.g., using useSession hook) should be implemented.

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Activity Overview</h1>
        <div className="space-x-2">
          <Link href="/workouts/new" prefetch={false}>
            <Button>
              <LucidePlus className="h-4 w-4 mr-2" />
              New Workout
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs for view selection */}
      <Tabs value={selectedView} onValueChange={setSelectedView} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          {/* Render Daily View Component */}
          <WorkoutDailyView />
        </TabsContent>
        <TabsContent value="weekly">
          {/* Render Weekly View Component */}
          <WorkoutWeeklyView />
        </TabsContent>
        <TabsContent value="monthly">
          {/* Render Monthly View Component */}
          <WorkoutMonthlyView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

