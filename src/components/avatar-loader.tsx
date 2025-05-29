'use client';

import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface AvatarLoaderProps {
  userId?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  refreshKey?: string; // Add a key to force refresh
  skipLoad?: boolean; // Add option to skip loading the avatar
}

export function AvatarLoader({ 
  userId, 
  name, 
  size = "md", 
  refreshKey,
  skipLoad = false
}: AvatarLoaderProps) {
  const { data: session } = useSession();
  const [avatarData, setAvatarData] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pathname = usePathname();
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  // Don't even try to load on auth pages
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/register' || 
    pathname === '/forgot-password';
  
  useEffect(() => {
    // Skip avatar loading on auth pages
    if (isAuthPage) {
      return;
    }

    // Skip loading if explicitly requested
    if (skipLoad) {
      return;
    }

    // Don't load avatar if no session exists
    if (!session?.user) {
      return;
    }

    // Reset states
    setLoading(true);
    setError(false);

    let aborted = false;
    const timeoutId = setTimeout(() => {
      if (!aborted) {
        setLoading(false);
        setError(true);
        aborted = true;
      }
    }, 3000); // 3 second timeout

    async function loadAvatar() {
      try {
        // Always use authenticated user's avatar, ignore userId param for security
        const response = await fetch('/api/user/avatar', {
          credentials: 'include',
          cache: 'no-store', // Prevent caching to avoid cross-user contamination
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (aborted) return;
        
        if (!response.ok) {
          throw new Error(`Failed to load avatar: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (aborted) return;
        
        if (data.image) {
          setAvatarData(data.image);
        } else {
          setAvatarData(undefined);
        }
      } catch (err) {
        if (!aborted) {
          setError(true);
        }
      } finally {
        if (!aborted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    }
    
    loadAvatar();
    
    return () => {
      clearTimeout(timeoutId);
      aborted = true;
    };
  }, [refreshKey, session, isAuthPage, skipLoad]); // Removed userId dependency for security

  // Use session name as backup if no name is provided
  const displayName = name || session?.user?.name || "";
  
  return (
    <UserAvatar 
      imageUrl={typeof avatarData === 'string' ? avatarData : null} 
      name={typeof displayName === 'string' ? displayName : ''} 
      size={size} 
    />
  );
} 