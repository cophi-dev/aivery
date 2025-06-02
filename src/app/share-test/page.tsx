'use client';

import { XOptimizedShareInterface } from '@/components/share/XOptimizedShareInterface';

export default function ShareTestPage() {
  // Sample workout data
  const sampleWorkout = {
    id: 'test-123',
    type: 'strength',
    date: new Date(),
    duration: 2940, // 49 minutes in seconds
    distance: 0,
    calculatedVolume: 12600, // 12.6t
    name: 'Test Strength Session'
  };

  // Sample PRs
  const samplePRs = [
    {
      type: 'weight' as const,
      exercise: 'Bench Press',
      value: 100,
      unit: 'kg',
      isNew: true
    },
    {
      type: 'volume' as const,
      exercise: 'Total Volume',
      value: 12600,
      unit: 'kg',
      isNew: true
    }
  ];

  // Sample daily workouts (today)
  const sampleDailyWorkouts = [
    {
      id: 'daily-1',
      type: 'strength',
      date: new Date(),
      duration: 2940,
      distance: 0,
      calculatedVolume: 12600
    }
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">X-Optimized Share Cards Test</h1>
          <p className="text-muted-foreground">
            Test the new X-optimized share cards with sample data
          </p>
        </div>

        <XOptimizedShareInterface
          workout={sampleWorkout}
          dailyWorkouts={sampleDailyWorkouts}
          personalRecords={samplePRs}
          insight="Amazing strength session! You lifted a total volume of 12,600 kg!"
        />
      </div>
    </div>
  );
} 