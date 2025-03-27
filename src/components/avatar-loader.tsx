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
    
    let retryCount = 0;
    const maxRetries = 2;
    
    // Always load the avatar through the API now, since we're not storing it in the session
    async function loadAvatar() {
      try {
        // If we're on the login page, don't attempt to load avatar
        if (typeof window !== 'undefined' && 
            (window.location.pathname === '/login' || 
             window.location.pathname === '/register')) {
          console.log('Skip avatar loading on auth pages');
          setLoading(false);
          return;
        }
        
        // If we have a userId, use it, otherwise use the current user's avatar
        const response = await fetch(`/api/user/avatar${userId ? `?userId=${userId}` : ''}`);
        
        if (response.status === 401) {
          // User is not authenticated - this is normal, just don't show an avatar
          console.log('User not authenticated, skip avatar loading');
          setLoading(false);
          return;
        }
        
        if (!response.ok) {
          console.error(`Avatar API responded with status: ${response.status}`);
          
          // Only retry for server errors, not for client errors (4xx)
          if (response.status >= 500 && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying avatar load (${retryCount}/${maxRetries})...`);
            // Wait 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadAvatar();
            return;
          }
          
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