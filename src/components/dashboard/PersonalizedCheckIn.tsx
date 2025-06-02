'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import UserNicknameDisplay from '@/components/UserNicknameDisplay';

interface PersonalizedCheckInProps {
  workoutCount?: number;
  className?: string;
}

interface CheckInMessage {
  message: string;
  emoji: string;
  tone: 'celebration' | 'motivation' | 'encouragement' | 'welcome';
}

export default function PersonalizedCheckIn({ workoutCount = 0, className }: PersonalizedCheckInProps) {
  const [checkInMessage, setCheckInMessage] = useState<CheckInMessage>({
    message: 'Starting your journey...',
    emoji: '✨',
    tone: 'welcome'
  });

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
        const encouragements = [
          `You're absolutely crushing it this week!`,
          `Your dedication is paying off beautifully!`,
          `This momentum is unstoppable!`
        ];
        const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
        
        return {
          message: `${randomEncouragement} ${workoutCount} sessions — you're building something amazing`,
          emoji: '🎉',
          tone: 'celebration' as const
        };
      } else if (workoutCount >= 3) {
        const motivations = [
          `Great momentum building!`,
          `You're finding your rhythm!`,
          `Consistency is your superpower!`
        ];
        const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)];
        
        return {
          message: `${randomMotivation} ${workoutCount} sessions this week — keep the fire burning`,
          emoji: '🔥',
          tone: 'encouragement' as const
        };
      } else {
        const nudges = [
          `Every step counts on your journey!`,
          `Your next breakthrough is waiting!`,
          `Small steps, big progress!`
        ];
        const randomNudge = nudges[Math.floor(Math.random() * nudges.length)];
        
        return {
          message: `${randomNudge} ${workoutCount > 0 ? `${workoutCount} session${workoutCount === 1 ? '' : 's'} down` : 'Ready for your first session'} — let's build on this`,
          emoji: '💪',
          tone: 'motivation' as const
        };
      }
    };

    setCheckInMessage(generateMessage());
  }, [workoutCount]);

  return (
    <motion.section 
      className={`mb-8 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="apple-card p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex items-start gap-6"
        >
          {/* Subtle emoji */}
          <motion.div 
            className="text-2xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.2 }}
          >
            {checkInMessage.emoji}
          </motion.div>
          
          <div className="flex-1">
            {/* Clean label */}
            <motion.p 
              className="apple-caption text-muted-foreground/60 mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              Aivery
            </motion.p>
            
            {/* Personalized message with clean typography */}
            <motion.h2 
              className="apple-heading-lg text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <UserNicknameDisplay fallback="champion" />, {checkInMessage.message.toLowerCase()}
            </motion.h2>
          </div>
        </motion.div>
      </Card>
    </motion.section>
  );
} 