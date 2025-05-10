"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Star, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface PRAchievementProps {
  prType: string;
  value: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function PRAchievement({ prType, value, isOpen, onClose, className }: PRAchievementProps) {
  // Launch confetti when PR is shown
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      const end = Date.now() + 1500;
      
      const colors = ['#F59E0B', '#FBBF24', '#FCD34D', '#FFFFFF'];
      
      (function frame() {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: colors,
        });
        
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: colors,
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
      
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);
  
  // Format the PR type for display
  const formatPRType = (type: string): string => {
    // Convert camelCase or snake_case to spaces
    const spaced = type
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim();
    
    // Capitalize first letter of each word
    return spaced.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          className={cn(
            "fixed top-5 left-1/2 -translate-x-1/2 z-50 md:max-w-md w-11/12 shadow-lg",
            className
          )}
        >
          <div className="relative bg-gradient-to-r from-amber-500 to-yellow-500 rounded-lg p-5 shadow-xl border-2 border-yellow-300">
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 text-white hover:text-yellow-100 transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-4">
                <motion.div
                  animate={{ 
                    rotate: [0, 10, -10, 10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Trophy className="h-12 w-12 text-white" />
                </motion.div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Star className="h-5 w-5 text-white mr-1 inline-block" />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl font-bold text-white"
                  >
                    New Personal Record!
                  </motion.h3>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Star className="h-5 w-5 text-white ml-1 inline-block" />
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-white text-sm mt-1">{formatPRType(prType)}</p>
                  <p className="text-yellow-100 font-bold text-2xl mt-1">{value}</p>
                </motion.div>
              </div>
            </div>
            
            <motion.div
              className="mt-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-yellow-100 text-sm font-medium">
                Keep pushing your limits!
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 