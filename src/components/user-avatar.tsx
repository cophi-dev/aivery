import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideUser } from "lucide-react";

interface UserAvatarProps {
  name?: string;
  imageUrl?: string;
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
  
  return (
    <Avatar className={sizeClasses[size]}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name || "User avatar"} />}
      <AvatarFallback className="bg-primary/10">
        {initial || <LucideUser className="h-5 w-5 text-primary" />}
      </AvatarFallback>
    </Avatar>
  );
} 