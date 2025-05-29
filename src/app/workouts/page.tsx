'use client'; // Make this a client component to manage state

import { useState } from 'react'; // Import useState
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-background ai-gradient dark:ai-gradient-dark transition-colors duration-300">
      {/* Enhanced Header Spacer */}
      <div className="h-20 md:h-24"></div>
      
      {/* Sophisticated Editorial Main Content */}
      <main className="editorial-container">
        <motion.div 
          className="space-y-16 md:space-y-20 pb-32 md:pb-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Header Section */}
          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Title and Subtitle */}
            <div className="space-y-4">
              <motion.h1 
                className="text-4xl md:text-5xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                Activity Overview
              </motion.h1>
              <motion.p 
                className="text-sm text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
              >
                Your training journey, beautifully organized
              </motion.p>
            </div>

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.7, ease: "easeOut" }}
            >
              <Link href="/workouts/new" prefetch={false}>
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 dark:from-neutral-100 dark:to-neutral-200 dark:hover:from-neutral-200 dark:hover:to-neutral-300 text-white dark:text-neutral-900 font-medium tracking-tight transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  <LucidePlus className="h-4 w-4 mr-2" />
                  New Workout
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Tabs Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.7, ease: "easeOut" }}
          >
            <Tabs value={selectedView} onValueChange={setSelectedView} className="w-full">
              {/* Enhanced Tab List */}
              <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl h-12">
                <TabsTrigger 
                  value="daily" 
                  className="font-medium tracking-tight text-neutral-600 dark:text-neutral-400 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-neutral-100 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm rounded-lg transition-all duration-300"
                >
                  Daily
                </TabsTrigger>
                <TabsTrigger 
                  value="weekly"
                  className="font-medium tracking-tight text-neutral-600 dark:text-neutral-400 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-neutral-100 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm rounded-lg transition-all duration-300"
                >
                  Weekly
                </TabsTrigger>
                <TabsTrigger 
                  value="monthly"
                  className="font-medium tracking-tight text-neutral-600 dark:text-neutral-400 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-neutral-100 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm rounded-lg transition-all duration-300"
                >
                  Monthly
                </TabsTrigger>
              </TabsList>

              {/* Tab Content */}
              <TabsContent value="daily" className="mt-0">
                <WorkoutDailyView />
              </TabsContent>
              <TabsContent value="weekly" className="mt-0">
                <WorkoutWeeklyView />
              </TabsContent>
              <TabsContent value="monthly" className="mt-0">
                <WorkoutMonthlyView />
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}

