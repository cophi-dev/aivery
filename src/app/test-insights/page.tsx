'use client';

import { useState } from 'react';
import { InsightCard, MultiInsightCard } from '@/components/ui/insight-card';
import { getSmartNudges, getBestNudge, type SmartNudge } from '@/lib/insights';
import type { WeeklyStats } from '@/lib/stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const testScenarios: { name: string; current: WeeklyStats; previous?: WeeklyStats }[] = [
  {
    name: "Beginner (First Week)",
    current: { workouts: 2, duration: 45, distance: 0, volume: 0 }
  },
  {
    name: "Consistent Performer",
    current: { workouts: 5, duration: 300, distance: 12, volume: 25 },
    previous: { workouts: 4, duration: 250, distance: 8, volume: 20 }
  },
  {
    name: "High Achiever",
    current: { workouts: 7, duration: 420, distance: 20, volume: 35 },
    previous: { workouts: 5, duration: 300, distance: 15, volume: 25 }
  },
  {
    name: "Getting Started",
    current: { workouts: 1, duration: 30, distance: 3, volume: 5 }
  },
  {
    name: "Strength Focused",
    current: { workouts: 4, duration: 200, distance: 0, volume: 45 },
    previous: { workouts: 3, duration: 180, distance: 0, volume: 35 }
  },
  {
    name: "Cardio Enthusiast", 
    current: { workouts: 6, duration: 360, distance: 25, volume: 0 },
    previous: { workouts: 5, duration: 300, distance: 20, volume: 0 }
  },
  {
    name: "No Activity",
    current: { workouts: 0, duration: 0, distance: 0, volume: 0 }
  }
];

export default function TestInsightsPage() {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const scenario = testScenarios[selectedScenario];
  const nudges = getSmartNudges(scenario.current, scenario.previous);
  const bestNudge = getBestNudge(scenario.current, scenario.previous);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Smart Insights Test</h1>
          <p className="text-muted-foreground">
            Testing the smart nudges system with different user scenarios
          </p>
        </div>

        {/* Scenario Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Test Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {testScenarios.map((scenario, index) => (
                <Button
                  key={index}
                  variant={selectedScenario === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedScenario(index)}
                  className="text-xs"
                >
                  {scenario.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Scenario Details */}
        <Card>
          <CardHeader>
            <CardTitle>{scenario.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Workouts:</span> {scenario.current.workouts}
              </div>
              <div>
                <span className="font-medium">Duration:</span> {scenario.current.duration}m
              </div>
              <div>
                <span className="font-medium">Distance:</span> {scenario.current.distance}km
              </div>
              <div>
                <span className="font-medium">Volume:</span> {scenario.current.volume}kg
              </div>
            </div>
            
            {scenario.previous && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Previous Week:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                  <div>Workouts: {scenario.previous.workouts}</div>
                  <div>Duration: {scenario.previous.duration}m</div>
                  <div>Distance: {scenario.previous.distance}km</div>
                  <div>Volume: {scenario.previous.volume}kg</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Nudge (Single Mode) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Best Nudge (Single Mode)</h2>
          <InsightCard nudge={bestNudge} />
        </div>

        {/* All Nudges (Multiple Mode) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Generated Nudges</h2>
          {nudges.length > 0 ? (
            <div className="space-y-3">
              {nudges.map((nudge, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Priority {nudge.priority} • {nudge.type}
                  </div>
                  <InsightCard nudge={nudge} animate={false} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No nudges generated for this scenario.</p>
          )}
        </div>

        {/* Multiple Card Demo */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Multi-Insight Card Demo</h2>
          <MultiInsightCard 
            nudges={nudges} 
            title="Weekly Insights" 
            maxDisplay={3}
          />
        </div>
      </div>
    </div>
  );
} 