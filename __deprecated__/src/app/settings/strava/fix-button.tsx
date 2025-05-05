'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { InlineSpinner } from "@/components/ui/inline-spinner";

export default function FixStravaDataButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fixStravaData = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await fetch('/api/workouts/fix-strava-data');
      const data = await response.json();
      
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Success",
          description: data.message || 'Strava data fixed successfully'
        });
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to fix Strava data',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fixing Strava data:', error);
      toast({
        title: "Error",
        description: 'An error occurred while fixing Strava data',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button 
          onClick={fixStravaData} 
          disabled={isLoading}
          variant="secondary"
        >
          {isLoading && <InlineSpinner size={16} className="mr-2" />}
          Fix Strava Workout Data
        </Button>
        {result && (
          <span className="text-sm text-muted-foreground">
            Fixed {result.results?.updated || 0} out of {result.results?.total || 0} workouts
          </span>
        )}
      </div>
      
      {result && result.results && (
        <div className="text-xs border rounded-md p-3 bg-secondary/50">
          <h4 className="font-medium mb-1">Results:</h4>
          <ul className="space-y-1 list-disc pl-4">
            <li>Total workouts checked: {result.results.total}</li>
            <li>Workouts updated: {result.results.updated}</li>
            <li>Workouts without source data: {result.results.noSourceData}</li>
            <li>Workouts with no distance found: {result.results.noDistanceFound}</li>
            <li>Errors: {result.results.errors}</li>
          </ul>
          {result.results.errorDetails && result.results.errorDetails.length > 0 && (
            <div className="mt-2">
              <h5 className="font-medium mb-1">Error details:</h5>
              <ul className="space-y-1 list-disc pl-4 text-xs text-destructive">
                {result.results.errorDetails.slice(0, 5).map((error: string, i: number) => (
                  <li key={i}>{error}</li>
                ))}
                {result.results.errorDetails.length > 5 && (
                  <li>...and {result.results.errorDetails.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 