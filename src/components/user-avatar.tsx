import { LucideUser } from "lucide-react";
import { useEffect, useState } from "react";

interface UserAvatarProps {
  imageData?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function UserAvatar({ imageData, name, size = "md", loading = false }: UserAvatarProps) {
  const [error, setError] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  
  // Reset error state if image changes
  useEffect(() => {
    setError(false);
    if (imageData) {
      const info = `${imageData.substring(0, 30)}... (${Math.round(imageData.length / 1024)}KB)`;
      setDebugInfo(info);
      console.log("UserAvatar received image data:", info);
    } else {
      setDebugInfo("No image data");
      console.log("UserAvatar: No image data received");
    }
  }, [imageData]);
  
  // Set size classes
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-20 h-20"
  };
  
  // Show loading indicator
  if (loading) {
    return (
      <div className={`rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <div className={`animate-spin rounded-full border-b-2 border-white ${size === "lg" ? "h-6 w-6" : "h-4 w-4"}`}></div>
        </div>
      </div>
    );
  }
  
  // If no image or error loading, show fallback with first letter of name
  if (!imageData || error) {
    const initial = name?.charAt(0)?.toUpperCase() || "";
    return (
      <div className={`rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ${sizeClasses[size]}`}>
        {initial ? (
          <span className={`font-semibold text-primary ${size === "lg" ? "text-2xl" : "text-base"}`}>
            {initial}
          </span>
        ) : (
          <LucideUser className={size === "lg" ? "h-10 w-10 text-primary" : "h-5 w-5 text-primary"} />
        )}
      </div>
    );
  }
  
  // Otherwise show the image
  return (
    <div className={`rounded-full overflow-hidden bg-primary/10 ${sizeClasses[size]}`} style={{ aspectRatio: "1/1" }}>
      <img
        src={imageData}
        alt={name || "User"}
        className="w-full h-full object-cover rounded-full"
        onLoad={() => console.log("Avatar image loaded successfully")}
        onError={(e) => {
          console.error("Error loading image:", e);
          setError(true);
        }}
      />
    </div>
  );
} 