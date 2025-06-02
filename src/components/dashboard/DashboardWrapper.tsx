import React from 'react';
import { motion } from 'framer-motion';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background apple-gradient transition-colors duration-300">
      {/* Clean header spacer with refined proportions */}
      <div className="h-16 md:h-20"></div>
      
      {/* Apple-inspired main content container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="space-y-12 md:space-y-16 pb-24 md:pb-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Clean, minimal content layout */}
          <div className="space-y-12 md:space-y-16">
            {React.Children.map(children, (child, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.05,
                  ease: "easeOut" 
                }}
                className="relative"
              >
                {child}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default DashboardWrapper; 