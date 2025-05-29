import React from 'react';
import { motion } from 'framer-motion';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 ai-gradient dark:ai-gradient-dark">
      {/* Minimal Header Spacer - More generous for breathing room */}
      <div className="h-24"></div>
      
      {/* Editorial Main Content */}
      <main className="editorial-container">
        <motion.div 
          className="space-y-12 pb-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Add subtle connecting lines between sections */}
          <div className="relative">
            {/* Connecting line that flows through sections */}
            <div className="absolute left-4 top-8 bottom-0 w-px bg-gradient-to-b from-blue-200/50 via-emerald-200/50 to-amber-200/50 dark:from-blue-800/30 dark:via-emerald-800/30 dark:to-amber-800/30 -z-10" />
            
            {/* Content with better spacing and visual rhythm */}
            <div className="space-y-16">
              {React.Children.map(children, (child, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.1,
                    ease: "easeOut" 
                  }}
                  className="relative"
                >
                  {/* Section indicator dots */}
                  <div className="absolute -left-2 top-8 w-3 h-3 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 border-2 border-white dark:border-neutral-950 shadow-sm" />
                  {child}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default DashboardWrapper; 