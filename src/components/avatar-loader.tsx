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
    
    // Check if we have an image in the session
    if (session?.user && !session.user.image) {
      console.log('No image in session, will attempt to refresh session data');
      // Try to refresh the session to get the latest user data
      fetch('/api/auth/refresh-session')
        .then(res => {
          if (res.ok) {
            console.log('Session refreshed successfully');
          }
        })
        .catch(err => {
          console.error('Failed to refresh session:', err);
        });
    }

    async function loadAvatar() {
      try {
        // If we have a userId, use it, otherwise use the current user's avatar
        const response = await fetch(`/api/user/avatar${userId ? `?userId=${userId}` : ''}`);
        
        if (!response.ok) {
          console.error(`Avatar API responded with status: ${response.status}`);
          throw new Error(`Failed to load avatar: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Better debugging of response data
        console.log('Avatar API response:', {
          hasImage: !!data.image,
          imageSize: data.image ? Math.round(data.image.length / 1024) + 'KB' : 'N/A',
          name: data.name,
          error: data.error || 'none'
        });
        
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