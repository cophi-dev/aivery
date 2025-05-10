"use client";

import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PRBadgeProps {
  className?: string;
  size?: "sm" | "default";
  isNew?: boolean;
}

export function PRBadge({ className, size = "default", isNew = false }: PRBadgeProps) {
  const [showAnimation, setShowAnimation] = useState(isNew);
  
  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isNew]);
  
  if (isNew) {
    return (
      <motion.div
        className="relative"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      >
        <Badge 
          variant="outline" 
          className={cn(
            "bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-amber-500 hover:from-amber-600 hover:to-yellow-500 font-bold shadow-md",
            size === "sm" ? "text-xs py-0 h-5" : "text-sm py-1",
            className
          )}
        >
          <Trophy className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
          NEW PR!
        </Badge>
        <AnimatePresence>
          {showAnimation && (
            <motion.div 
              className="absolute inset-0 rounded-full"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{
                scale: [1, 1.5, 1.8],
                opacity: [0.7, 0.5, 0],
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 1
              }}
              style={{ 
                background: "radial-gradient(circle, rgba(245,158,11,0.5) 0%, rgba(245,158,11,0) 70%)",
                zIndex: -1 
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20 transition-colors",
        size === "sm" ? "text-xs py-0 h-5" : "text-sm py-1",
        className
      )}
    >
      <Trophy className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      PR
    </Badge>
  );
} 