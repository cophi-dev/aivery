'use client';

import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function StravaConnectButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
      const redirectUri = `${window.location.origin}/api/strava/callback`;
      
      const scope = 'read,activity:read_all,activity:write';
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=force`;
      
      // Redirect to Strava authorization page
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleConnect} 
      disabled={isLoading}
      className="bg-[#FC4C02] hover:bg-[#E34000] text-white"
    >
      {isLoading ? 'Connecting...' : 'Connect with Strava'}
    </Button>
  );
} 