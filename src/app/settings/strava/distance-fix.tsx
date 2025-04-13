'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { repairWorkoutDistances } from '@/app/actions/workout-actions';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function DistanceRepairPage() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRepair = async () => {
    try {
      if (!confirm('This will update your workout data to fix distance issues. Continue?')) {
        return;
      }
      
      setIsRepairing(true);
      setResult(null);
      
      const data = await repairWorkoutDistances();
      console.log('Repair result:', data);
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Success!",
          description: `Fixed ${data.updatedCount} workout records. Please refresh the page to see updates.`
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to repair workout distances",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error repairing distances:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Fix Workout Distance Data</CardTitle>
        <CardDescription>
          Repair workout distance data that may be missing or incorrect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 p-4 rounded-md border border-amber-200 mb-6">
          <h3 className="text-amber-800 font-medium mb-2">About This Fix</h3>
          <p className="text-amber-700 text-sm mb-2">
            This tool fixes issues with distance data in your workouts:
          </p>
          <ul className="list-disc text-sm text-amber-700 pl-5 space-y-1">
            <li>Extracts distances from workout names (e.g., "Untitled Activity (4.35km)")</li> 
            <li>Ensures distances are properly stored in both workout and exercise records</li>
            <li>Updates dashboard summaries to show correct total distances</li>
          </ul>
        </div>
        
        <div className="flex flex-col gap-4">
          <Button 
            onClick={handleRepair} 
            disabled={isRepairing}
            className="w-fit"
          >
            {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fix Workout Distances
          </Button>
          
          {result && (
            <div className="mt-4 p-4 bg-slate-50 rounded-md border">
              <h4 className="font-medium mb-2">Repair Results</h4>
              <p className="text-sm">
                {result.success 
                  ? `Successfully updated ${result.updatedCount} records with correct distance data.` 
                  : `Error: ${result.message}`}
              </p>
              {result.success && (
                <p className="text-sm mt-2 italic">
                  Please refresh your dashboard and workout pages to see the updates.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 