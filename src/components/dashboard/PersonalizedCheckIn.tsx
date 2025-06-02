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
      const dayOfWeek = format(new Date(), 'EEEE');
      
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
          emoji: '🌟',
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
          message: `${randomEncouragement} ${workoutCount} sessions — you're building something amazing 🔥`,
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
          message: `${randomMotivation} ${workoutCount} sessions this week — keep the fire burning!`,
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
          message: `${randomNudge} ${workoutCount > 0 ? `${workoutCount} session${workoutCount === 1 ? '' : 's'} down` : 'Ready for your first session'} — let's build on this!`,
          emoji: '💪',
          tone: 'motivation' as const
        };
      }
    };

    setCheckInMessage(generateMessage());
  }, [workoutCount]);

  const getGradientColors = () => {
    switch (checkInMessage.tone) {
      case 'celebration':
        return 'from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/10';
      case 'encouragement':
        return 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/10';
      case 'motivation':
        return 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/10';
      default:
        return 'from-blue-50 to-white dark:from-blue-950/20 dark:to-background';
    }
  };

  const getBorderColors = () => {
    switch (checkInMessage.tone) {
      case 'celebration':
        return 'border-yellow-200/50 dark:border-yellow-800/30';
      case 'encouragement':
        return 'border-green-200/50 dark:border-green-800/30';
      case 'motivation':
        return 'border-blue-200/50 dark:border-blue-800/30';
      default:
        return 'border-blue-200/50 dark:border-blue-800/30';
    }
  };

  return (
    <motion.section 
      className={`mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className={`p-6 rounded-2xl bg-gradient-to-r ${getGradientColors()} border ${getBorderColors()} shadow-sm`}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-start gap-4"
        >
          {/* Dynamic emoji */}
          <motion.div 
            className="text-3xl"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            {checkInMessage.emoji}
          </motion.div>
          
          <div className="flex-1">
            {/* Aivery says label */}
            <motion.p 
              className="text-sm text-muted-foreground mb-2 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              Aivery says:
            </motion.p>
            
            {/* Personalized message with user name */}
            <motion.h2 
              className="text-xl font-semibold text-foreground mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <UserNicknameDisplay fallback="champion" />, {checkInMessage.message.toLowerCase()}
            </motion.h2>
          </div>
        </motion.div>
      </Card>
    </motion.section>
  );
} 