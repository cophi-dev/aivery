'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideUser } from "lucide-react";
import { useEffect, useState } from "react";

interface UserAvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ name, imageUrl, size = "md" }: UserAvatarProps) {
  // Set size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-20 w-20"
  };
  
  // Get initial from name
  const initial = name?.charAt(0)?.toUpperCase() || "";

  // Track if image failed to load
  const [imageFailed, setImageFailed] = useState(false);
  
  // Check if it's a base64 image
  const isBase64Image = imageUrl?.startsWith('data:image/');
  
  return (
    <Avatar className={sizeClasses[size]}>
      {imageUrl && !imageFailed && (
        <AvatarImage 
          src={imageUrl} 
          alt={name || "User avatar"} 
          onError={() => setImageFailed(true)}
        />
      )}
      <AvatarFallback className="bg-primary/10">
        {initial || <LucideUser className="h-5 w-5 text-primary" />}
      </AvatarFallback>
    </Avatar>
  );
} 