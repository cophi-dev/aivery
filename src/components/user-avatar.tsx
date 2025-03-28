'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideUser } from "lucide-react";
import { useEffect, useState } from "react";

interface UserAvatarProps {
  name?: string | null | undefined | object;
  imageUrl?: string | null | undefined | object;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, imageUrl, size = "md", className }: UserAvatarProps) {
  // Safely convert name to string
  const displayName = 
    typeof name === 'string' ? name : 
    name === null || name === undefined ? '' : 
    typeof name === 'object' ? '' : 
    String(name);
  
  // Safely convert imageUrl to string
  const displayImageUrl = 
    typeof imageUrl === 'string' ? imageUrl : 
    imageUrl === null || imageUrl === undefined ? null : 
    null;
  
  // Set size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-20 w-20"
  };
  
  // Get initial from name
  const initial = displayName.charAt(0)?.toUpperCase() || "";

  // Track if image failed to load
  const [imageFailed, setImageFailed] = useState(false);
  
  return (
    <Avatar className={`${sizeClasses[size]} ${className || ''}`}>
      {displayImageUrl && !imageFailed && (
        <AvatarImage 
          src={displayImageUrl} 
          alt={displayName || "User avatar"} 
          onError={() => setImageFailed(true)}
        />
      )}
      <AvatarFallback className="bg-primary/10">
        {initial || <LucideUser className="h-5 w-5 text-primary" />}
      </AvatarFallback>
    </Avatar>
  );
} 