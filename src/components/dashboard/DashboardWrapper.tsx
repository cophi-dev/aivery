import React from 'react';
import { motion } from 'framer-motion';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background ai-gradient dark:ai-gradient-dark transition-colors duration-300">
      {/* Enhanced Header Spacer with better proportions */}
      <div className="h-20 md:h-24"></div>
      
      {/* Sophisticated Editorial Main Content */}
      <main className="editorial-container">
        <motion.div 
          className="space-y-16 md:space-y-20 pb-32 md:pb-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Enhanced connecting elements with sophisticated dark theme */}
          <div className="relative">
            {/* Refined connecting line with better dark mode support */}
            <div className="absolute left-4 top-8 bottom-0 w-px bg-gradient-to-b from-blue-200/40 via-indigo-200/50 to-blue-200/30 dark:from-blue-400/20 dark:via-indigo-400/25 dark:to-blue-400/15 -z-10" />
            
            {/* Enhanced ambient background glow for dark mode */}
            <div className="absolute left-0 top-0 w-24 h-24 bg-gradient-radial from-blue-500/5 to-transparent dark:from-blue-400/10 dark:to-transparent rounded-full blur-2xl -z-20" />
            
            {/* Content with enhanced spacing and visual rhythm */}
            <div className="space-y-20 md:space-y-24">
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
                  {/* Enhanced section indicator dots with sophisticated dark styling */}
                  <div className="absolute -left-2 top-8 w-3 h-3 rounded-full bg-gradient-to-br from-blue-200/80 to-indigo-200/80 dark:from-blue-400/40 dark:to-indigo-400/40 border-2 border-background shadow-sm backdrop-blur-sm" />
                  
                  {/* Subtle glow effect for each section in dark mode */}
                  <div className="absolute -left-4 top-6 w-7 h-7 bg-blue-400/5 dark:bg-blue-400/10 rounded-full blur-lg -z-10" />
                  
                  {/* Content wrapper with enhanced backdrop for better readability */}
                  <div className="relative backdrop-blur-[0.5px]">
                    {child}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Enhanced ambient lighting for sophisticated dark mode */}
          <div className="fixed inset-0 pointer-events-none -z-30">
            {/* Sophisticated dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/98 dark:from-background dark:via-background/98 dark:to-background" />
            
            {/* Subtle ambient lighting effects for dark mode */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/[0.02] dark:bg-blue-400/[0.08] rounded-full blur-3xl" />
            <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/[0.02] dark:bg-indigo-400/[0.06] rounded-full blur-3xl" />
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default DashboardWrapper; 