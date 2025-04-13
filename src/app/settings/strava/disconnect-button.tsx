'use client';

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export default function StravaDisconnectButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Strava account? This will not delete any imported workouts.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/strava/disconnect', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Your Strava account has been disconnected"
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to disconnect Strava account",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error disconnecting from Strava:', error);
      toast({
        title: "Error",
        description: "An error occurred while disconnecting your Strava account",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleDisconnect} 
      disabled={isLoading}
      variant="outline"
    >
      {isLoading ? 'Disconnecting...' : 'Disconnect Strava'}
    </Button>
  );
} 