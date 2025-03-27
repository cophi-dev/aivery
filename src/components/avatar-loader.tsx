'use client';

import { useEffect, useState } from "react";
import { UserAvatar } from "./user-avatar";
import { useSession } from "next-auth/react";

interface AvatarLoaderProps {
  userId?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  refreshKey?: string; // Add a key to force refresh
}

export function AvatarLoader({ userId, name, size = "md", refreshKey }: AvatarLoaderProps) {
  const { data: session } = useSession();
  const [avatarData, setAvatarData] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset states
    setLoading(true);
    setError(false);

    async function loadAvatar() {
      try {
        // If we have a userId, use it, otherwise use the current user's avatar
        const response = await fetch(`/api/user/avatar${userId ? `?userId=${userId}` : ''}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load avatar: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.image) {
          console.log(`Avatar loaded successfully: ${data.image.substring(0, 30)}... (${Math.round(data.image.length / 1024)}KB)`);
          setAvatarData(data.image);
        } else {
          console.log("No avatar found in response");
          setAvatarData(undefined);
        }
      } catch (err) {
        console.error("Error loading avatar:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    
    loadAvatar();
  }, [userId, refreshKey]); // Refresh when userId or refreshKey changes

  // Use session name as backup if no name is provided
  const displayName = name || session?.user?.name || "";
  
  return (
    <UserAvatar 
      imageData={avatarData} 
      name={displayName} 
      size={size} 
      loading={loading}
    />
  );
} 