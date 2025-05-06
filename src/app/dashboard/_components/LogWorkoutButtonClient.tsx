'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function LogWorkoutButton() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25, 
        delay: 0.2 
      }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
    >
      <Button 
        size="lg" 
        asChild 
        className={cn(
          "w-full py-6 rounded-xl",
          "bg-[#58a3ff] hover:bg-[#58a3ff]/90 text-white dark:bg-[#58a3ff] dark:hover:bg-[#58a3ff]/90",
          "border border-[#58a3ff20]", 
          "transition-all duration-300",
          "shadow-sm hover:shadow-md hover:shadow-[#58a3ff10]"
        )}
      >
        <Link href="/workouts/new" className="flex items-center justify-center w-full h-full gap-2">
          <PlusCircle className="h-5 w-5" />
          <span className="font-medium tracking-wide">Log New Workout</span>
        </Link>
      </Button>
    </motion.div>
  );
} 