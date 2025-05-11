'use client'

import React, { useState, useEffect, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
import type { WorkoutData } from '@/types/db';
import { saveDailyJournalEntry } from '@/app/actions/journalActions';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ClipboardList, BarChart2, Clock, Ruler, Award, CalendarDays, PenLine } from 'lucide-react';

// Temporary placeholder for the server action
/*
const saveDailyJournalEntry = async (workoutIds: string[], entry: string): Promise<{success: boolean, error?: string}> => {
    console.warn("saveDailyJournalEntry action not implemented yet.", workoutIds, entry);
    // Simulate success for UI testing
    await new Promise(resolve => setTimeout(resolve, 500)); 
    // return { success: false, error: "Action not implemented." };
    return { success: true };
};
*/

export default function TodaysSummaryCard() {
  const { data: session } = useSession();
  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutData[]>([]);
  const [journalEntry, setJournalEntry] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchTodaysWorkouts() {
      if (!session?.user?.id) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/dashboard/today');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch today\'s workouts');
        }
        const data: WorkoutData[] = await response.json();
        setTodaysWorkouts(data);
      } catch (err) {
        console.error("Error fetching today's workouts:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTodaysWorkouts();
  }, [session]);

  const handleSaveJournal = () => {
    if (!journalEntry.trim()) {
      toast({
        title: "Journal empty",
        description: "Please write something before saving.",
        variant: "destructive",
      });
      return;
    }

    if (todaysWorkouts.length === 0) {
        toast({
          title: "No workouts found",
          description: "Cannot save journal entry as no workouts were logged today.",
          variant: "destructive",
        });
        return;
    }

    const workoutIds = todaysWorkouts.map(w => w._id);

    startTransition(async () => {
      try {
        const result = await saveDailyJournalEntry(workoutIds, journalEntry);
        if (result.success) {
          toast({
            title: "Journal Saved!",
            description: "Your thoughts have been added to today's workout(s).",
          });
          setJournalEntry(''); // Clear textarea after successful save
        } else {
          throw new Error(result.error || 'Failed to save journal entry.');
        }
      } catch (err) {
        console.error("Error saving journal entry:", err);
        toast({
          title: "Error Saving Journal",
          description: err instanceof Error ? err.message : 'An unknown error occurred',
          variant: "destructive",
        });
      }
    });
  };

  // Animation variants
  const cardVariants = {
    initial: { 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
    },
    hover: { 
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.06), 0 0 8px rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(88, 163, 255, 0.4)',
      transition: {
        duration: 0.2,
        ease: 'easeOut'
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: (custom: number) => ({ 
      opacity: 1, 
      y: 0,
      transition: {
        delay: custom * 0.05,
        duration: 0.3,
        ease: "easeOut"
      }
    })
  };

  const renderWorkoutItem = (workout: WorkoutData, index: number) => {
    const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
    const durationMinutes = Math.round((workout.duration || 0) / 60);
    const distanceKm = workout.cardioDetails?.distance ?? workout.distance;
    const volumeKg = workout.calculatedVolume;

    return (
      <motion.div 
        key={workout._id} 
        className="flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 
                  dark:border-slate-700/40 group"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        whileHover={{ 
          backgroundColor: '#c0daff20',
          transition: { duration: 0.2 }
        }}
      >
        <div className={`p-2 rounded-full ${colorClasses} shadow-sm transform 
                        transition-transform duration-200 group-hover:scale-110`}> 
          {icon}
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium truncate text-slate-800 dark:text-slate-200">{workout.name || workout.type}</p>
          <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 opacity-70" />
              {durationMinutes} min
            </span>
            {distanceKm && distanceKm > 0 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3 opacity-70" />
                {distanceKm.toFixed(2)} km
              </span>
            )}
            {volumeKg && volumeKg > 0 && (
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3 opacity-70" />
                {Math.round(volumeKg).toLocaleString()} kg
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const today = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full"
      >
        <motion.div
          variants={cardVariants}
          initial="initial"
          whileHover="hover"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <Card className={cn(
            "relative overflow-hidden bg-white dark:bg-[#1a1a1a]",
            "h-full rounded-xl transition-all duration-300",
            "border-[#c0daff40] dark:border-[#58a3ff30] shadow-sm",
            "hover:border-[#58a3ff] dark:hover:border-[#58a3ff]",
          )}>
            {/* Background effect */}
            <motion.div 
              className="absolute inset-0 bg-[#58a3ff05] dark:bg-[#58a3ff08]"
              animate={{
                opacity: isHovered ? 0.8 : 0.2,
                transition: { duration: 0.3 }
              }}
            />
            
            <div className="relative z-10 flex flex-col h-full">
              <CardHeader className="pb-2">
                <motion.div 
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="p-2 rounded-full bg-[#58a3ff] dark:bg-[#58a3ff] text-white shadow-sm"
                    whileHover={{ scale: 1.05 }}
                    animate={{
                      y: [0, -3, 0],
                      transition: { repeat: Infinity, duration: 3, ease: "easeInOut" }
                    }}
                  >
                    <ClipboardList size={18} />
                  </motion.div>
                  <div className="flex-1">
                    <CardTitle className="text-lg tracking-tight font-semibold text-[#333333] dark:text-white">Today's Summary</CardTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <CalendarDays className="h-3.5 w-3.5 text-[#58a3ff]" />
                      <p className="text-sm font-medium text-[#58a3ff] dark:text-[#c0daff]">
                        {formattedDate}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </CardHeader>
              
              <CardContent className="flex-grow flex flex-col gap-4 pt-2">
                <div className="flex-grow">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                  ) : error ? (
                    <Alert variant="destructive" className="bg-red-50/60 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : todaysWorkouts.length === 0 ? (
                    <motion.div 
                      className="flex flex-col items-center justify-center py-8 px-4 text-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <BarChart2 className="h-12 w-12 mb-3 text-[#c0daff] dark:text-[#58a3ff]" />
                      <p className="text-sm font-medium text-slate-700 dark:text-[#c0daff]">
                        No Workouts Today {isWeekend ? '(Rest Day?)' : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#c0daff80] mt-2 max-w-[250px]">
                        {isWeekend 
                          ? "It's the weekend! Take time to rest and recover if needed."
                          : "Ready to start your workout? Your completed sessions will appear here."}
                      </p>
                    </motion.div>
                  ) : (
                    <ScrollArea className="h-[180px] pr-1 -mx-1 px-1">
                      <div className="py-1">
                        {todaysWorkouts.map(renderWorkoutItem)}
                      </div>
                    </ScrollArea>
                  )}
                </div>
                
                {/* Journal Entry Section - Only show if not loading and no error */} 
                {!isLoading && !error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3"
                  > 
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine className="h-4 w-4 text-[#58a3ff]" />
                      <label htmlFor="journalEntry" className="text-sm font-medium text-slate-700 dark:text-[#c0daff]">
                        Today's Reflection
                      </label>
                    </div>
                    <Textarea
                      id="journalEntry"
                      placeholder={todaysWorkouts.length > 0 
                        ? "How did today's session(s) feel? Any achievements or challenges?"
                        : "How are you feeling today? Planning any workouts?"}
                      value={journalEntry}
                      onChange={(e) => setJournalEntry(e.target.value)}
                      rows={3}
                      className="resize-none bg-white dark:bg-[#2a2a2a] border-[#c0daff50] dark:border-[#58a3ff20] 
                              focus:border-[#58a3ff] dark:focus:border-[#58a3ff] focus:ring focus:ring-[#58a3ff20] dark:focus:ring-[#58a3ff20]
                              transition-all duration-200"
                    />
                  </motion.div>
                )}
              </CardContent>
              
              {!isLoading && !error && (
                <CardFooter className="pt-1">
                  <Button 
                    onClick={handleSaveJournal} 
                    disabled={isPending || !journalEntry.trim()} 
                    className="w-full bg-[#58a3ff] hover:bg-[#58a3ff]/90 dark:bg-[#58a3ff] dark:hover:bg-[#58a3ff]/90
                              text-white
                              transition-all duration-200 font-medium shadow-sm hover:shadow
                              disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400"
                  >
                    {isPending ? (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> 
                    ) : (
                      <Icons.Save className="mr-2 h-4 w-4" />
                    )}
                    Save Journal
                  </Button>
                </CardFooter>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 