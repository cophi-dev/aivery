'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { repairWorkoutDistances } from '@/app/actions/workout-actions';
import { InlineSpinner } from "@/components/ui/inline-spinner";

export default function RepairStravaDataButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRepair = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await repairWorkoutDistances();
      setResult(response);
      
      if (response.success) {
        toast({
          title: "Success",
          description: response.message || 'Workout distance data repaired successfully'
        });
      } else {
        toast({
          title: "Error",
          description: response.message || 'Failed to repair workout data',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error repairing workout data:', error);
      toast({
        title: "Error",
        description: 'An error occurred while repairing workout data',
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
          onClick={handleRepair} 
          disabled={isLoading}
          variant="secondary"
        >
          {isLoading ? (
            <InlineSpinner size={16} className="mr-2" />
          ) : null}
          Repair Distance Data
        </Button>
        {result && (
          <span className="text-sm text-muted-foreground">
            {result.updatedCount} records updated
          </span>
        )}
      </div>
    </div>
  );
} 