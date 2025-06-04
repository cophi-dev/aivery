'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import UserNicknameDisplay from '@/components/UserNicknameDisplay';

interface PersonalizedCheckInProps {
  workoutCount?: number;
  cardioDistance?: number; // in km
  strengthVolume?: number; // in kg
  cardioDuration?: number; // in minutes
  runningDistance?: number; // in km
  className?: string;
}

interface CheckInMessage {
  message: string;
  emoji: string;
  tone: 'celebration' | 'motivation' | 'encouragement' | 'welcome';
}

// Vibrant color pool for random combinations
const vibrantColors = [
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#EC4899', // Pink
  '#0EA5E9', // Sky
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#DC2626', // Red-600
  '#EA580C', // Orange
  '#059669', // Emerald-600
  '#0D9488', // Teal
  '#22C55E', // Green
  '#8B5CF6', // Purple
  '#A855F7', // Purple-500
  '#D946EF', // Fuchsia
  '#3B82F6', // Blue
  '#6366F1', // Indigo-500
  '#84CC16', // Lime
  '#F97316', // Orange-500
];

// Generate random 2-color combination
const generateRandomGradient = () => {
  const shuffled = [...vibrantColors].sort(() => 0.5 - Math.random());
  const color1 = shuffled[0];
  const color2 = shuffled[1];
  
  return {
    id: `random-${Date.now()}`,
    colors: [color1, color2]
  };
};

export default function PersonalizedCheckIn({ 
  workoutCount = 0, 
  cardioDistance = 0,
  strengthVolume = 0,
  cardioDuration = 0,
  runningDistance = 0,
  className 
}: PersonalizedCheckInProps) {
  const [checkInMessage, setCheckInMessage] = useState<CheckInMessage>({
    message: 'Starting your journey...',
    emoji: '✨',
    tone: 'welcome'
  });
  const [selectedGradient, setSelectedGradient] = useState(generateRandomGradient());
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateMessage = () => {
      const hour = new Date().getHours();
      
      // Time-based greeting
      let greeting = '';
      if (hour < 12) {
        greeting = 'Good morning';
      } else if (hour < 17) {
        greeting = 'Good afternoon';  
      } else {
        greeting = 'Good evening';
      }

      // Generate message based on workout count and time
      if (workoutCount === 0) {
        return {
          message: `${greeting}! Ready to start your fitness journey?`,
          emoji: '✨',
          tone: 'welcome' as const
        };
      } else if (workoutCount >= 5) {
        // High activity - create variety in celebrations
        const celebrationTypes = [];
        
        // Always include session-based celebration
        celebrationTypes.push({
          message: `You're absolutely crushing it! ${workoutCount} sessions in the last 7 days — you're building something amazing`,
          emoji: '🎉'
        });
        
        // Add distance-based celebrations if significant
        if (cardioDistance >= 20) {
          celebrationTypes.push({
            message: `Your dedication is paying off beautifully! ${cardioDistance.toFixed(1)}km conquered in the last 7 days`,
            emoji: '🏃‍♂️'
          });
        }
        
        if (runningDistance >= 15) {
          celebrationTypes.push({
            message: `This momentum is unstoppable! ${runningDistance.toFixed(1)}km of running — you're on fire`,
            emoji: '🔥'
          });
        }
        
        // Add strength-based celebrations if significant
        if (strengthVolume >= 5000) {
          const volumeTons = (strengthVolume / 1000).toFixed(1);
          celebrationTypes.push({
            message: `Incredible strength gains! ${volumeTons} tons moved in the last 7 days — absolute beast mode`,
            emoji: '💪'
          });
        }
        
        // Add duration-based celebrations if significant
        if (cardioDuration >= 300) { // 5+ hours
          const hours = Math.floor(cardioDuration / 60);
          celebrationTypes.push({
            message: `Amazing dedication! ${hours}+ hours of cardio work — your consistency is legendary`,
            emoji: '⏱️'
          });
        }
        
        const randomCelebration = celebrationTypes[Math.floor(Math.random() * celebrationTypes.length)];
        
        return {
          message: randomCelebration.message,
          emoji: randomCelebration.emoji,
          tone: 'celebration' as const
        };
      } else if (workoutCount >= 3) {
        // Moderate activity - mix of session and achievement highlights
        const encouragementTypes = [];
        
        // Session-based encouragement
        encouragementTypes.push({
          message: `Great momentum building! ${workoutCount} sessions in the last 7 days — keep the fire burning`,
          emoji: '🔥'
        });
        
        // Distance achievements
        if (cardioDistance >= 10) {
          encouragementTypes.push({
            message: `You're finding your rhythm! ${cardioDistance.toFixed(1)}km covered — every step counts`,
            emoji: '🎯'
          });
        }
        
        // Strength achievements
        if (strengthVolume >= 2000) {
          const volumeTons = (strengthVolume / 1000).toFixed(1);
          encouragementTypes.push({
            message: `Consistency is your superpower! ${volumeTons} tons lifted — strength is building`,
            emoji: '💪'
          });
        }
        
        const randomEncouragement = encouragementTypes[Math.floor(Math.random() * encouragementTypes.length)];
        
        return {
          message: randomEncouragement.message,
          emoji: randomEncouragement.emoji,
          tone: 'encouragement' as const
        };
      } else {
        // Low activity - focus on any positive achievements
        const motivationTypes = [];
        
        // Default session-based motivation
        if (workoutCount > 0) {
          motivationTypes.push({
            message: `Every step counts on your journey! ${workoutCount} session${workoutCount === 1 ? '' : 's'} in the last 7 days — let's build on this`,
            emoji: '💪'
          });
        } else {
          motivationTypes.push({
            message: `Your next breakthrough is waiting! Ready for your first session — let's build on this`,
            emoji: '💪'
          });
        }
        
        // Highlight any distance achievements
        if (cardioDistance >= 5) {
          motivationTypes.push({
            message: `Small steps, big progress! ${cardioDistance.toFixed(1)}km moved — momentum is building`,
            emoji: '🚀'
          });
        }
        
        // Highlight any strength work
        if (strengthVolume >= 500) {
          const volumeTons = (strengthVolume / 1000).toFixed(2);
          motivationTypes.push({
            message: `Your next breakthrough is waiting! ${volumeTons} tons moved — every rep builds strength`,
            emoji: '💪'
          });
        }
        
        const randomMotivation = motivationTypes[Math.floor(Math.random() * motivationTypes.length)];
        
        return {
          message: randomMotivation.message,
          emoji: randomMotivation.emoji,
          tone: 'motivation' as const
        };
      }
    };

    setCheckInMessage(generateMessage());
  }, [workoutCount, cardioDistance, strengthVolume, cardioDuration, runningDistance]);



  return (
    <motion.section 
      ref={componentRef}
      className={`mb-12 relative py-16 bg-background border border-border/20 rounded-lg overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Dynamic Colored Aura Circle Background - Bigger */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          {/* Aivery Circle - Two colors with complete fade-out - Responsive */}
          <svg 
            className="w-96 h-96 sm:w-[450px] sm:h-[450px] md:w-[550px] md:h-[550px] lg:w-[650px] lg:h-[650px] opacity-40 dark:opacity-45" 
            viewBox="0 0 512 512" 
          >
            <defs>
              <radialGradient id={`aura-${selectedGradient.id}`} cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                <stop offset="0%" stopColor={selectedGradient.colors[0]}/>
                <stop offset="30%" stopColor={selectedGradient.colors[0]}/>
                <stop offset="50%" stopColor={selectedGradient.colors[0]} stopOpacity="0.7"/>
                <stop offset="70%" stopColor={selectedGradient.colors[1]} stopOpacity="0.4"/>
                <stop offset="85%" stopColor={selectedGradient.colors[1]} stopOpacity="0.25"/>
                <stop offset="95%" stopColor={selectedGradient.colors[1]} stopOpacity="0.1"/>
                <stop offset="100%" stopColor={selectedGradient.colors[1]} stopOpacity="0"/>
              </radialGradient>
            </defs>
            {/* Single circle with two colors and fade-out effect */}
            <circle cx="256" cy="256" r="200" fill={`url(#aura-${selectedGradient.id})`} />
          </svg>
        </motion.div>
      </div>

      {/* Content Overlay - No card wrapper, wider than circle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-10 max-w-4xl mx-auto text-center px-8 py-12"
      >
        {/* Clean label */}
        <motion.p 
          className="text-sm font-serif text-muted-foreground/80 mb-8 tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          aivery
        </motion.p>
        
        {/* Personalized message with bold typography - wider than the circle */}
        <motion.h1 
          className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground leading-relaxed px-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ 
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            lineHeight: '1.4',
            fontSize: 'clamp(1.5rem, 4vw, 3rem)' // Responsive but consistent
          }}
        >
          <UserNicknameDisplay fallback="Champion" />, {checkInMessage.message.toLowerCase()}
        </motion.h1>

        {/* Subtle emoji positioned elegantly */}
        <motion.div 
          className="text-5xl md:text-6xl mt-6 opacity-80"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.8 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        >
          {checkInMessage.emoji}
        </motion.div>
      </motion.div>
    </motion.section>
  );
} 