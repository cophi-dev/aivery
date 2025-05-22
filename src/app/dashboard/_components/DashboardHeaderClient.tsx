'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserAvatar } from "@/components/user-avatar";
import { getQuote } from "@/lib/client-utils";
import UserNicknameDisplay from "@/components/UserNicknameDisplay";
import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkle } from 'lucide-react';

interface DashboardHeaderProps {
  displayName: ReactNode;
  userImage: string | null;
}

export function DashboardHeader({ displayName, userImage }: DashboardHeaderProps) {
  const [quote, setQuote] = useState("Loading quote...");
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuoteData = useCallback(async (forceFresh = false) => {
    try {
      const quoteText = await getQuote(location?.lat, location?.lon, forceFresh);
      setQuote(quoteText);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setQuote("Your fitness journey begins with a single step.");
    }
  }, [location]);

  useEffect(() => {
    let isMounted = true;
    fetchQuoteData(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQuoteData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const quoteInterval = setInterval(() => {
      fetchQuoteData(true);
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQuoteData]);

  useEffect(() => {
    async function fetchInsight() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/daily-insight?fresh=${Math.random()}`);
        if (!response.ok) throw new Error('Failed to fetch daily insight');
        const data = await response.json();
        setInsight(data.insight || '');
      } catch (err: any) {
        setError('Could not load daily insight.');
      } finally {
        setLoading(false);
      }
    }
    fetchInsight();
  }, []);

  // Animation variants
  const containerVariants = {
    initial: { y: -20, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const childVariants = {
    initial: { y: -10, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 400, damping: 20 }
    }
  };

  const quoteVariants = {
    initial: { opacity: 0, y: 5 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { delay: 0.3, duration: 0.5 }
    }
  };

  const sparkleVariants = {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.6, 1, 0.6],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  };

  return (
    <motion.section 
      className={cn(
        "relative overflow-hidden p-6 md:p-8 rounded-2xl w-full",
        "bg-white dark:bg-[#1a1a1a]",
        "border border-[#c0daff40] dark:border-[#58a3ff30] shadow-sm",
        "hover:border-[#58a3ff] dark:hover:border-[#58a3ff]",
        "transition-all duration-300"
      )}
      variants={containerVariants}
      initial="initial"
      animate="animate"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Extremely subtle background effect instead of gradient */}
      <motion.div 
        className="absolute inset-0 bg-[#58a3ff05] dark:bg-[#58a3ff08]"
        animate={{ 
          opacity: isHovered ? 0.8 : 0.2,
          transition: { duration: 0.5 }
        }}
      />
      
      {/* Single subtle sparkle element */}
      <motion.div 
        className="absolute top-6 right-8 text-[#58a3ff30] dark:text-[#58a3ff30]" 
        variants={sparkleVariants}
        animate="animate"
      >
        <Sparkle size={20} />
      </motion.div>
      
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 md:gap-6">
        <motion.div variants={childVariants}>
          <UserAvatar 
            imageUrl={userImage}
            size="lg"
            className="shadow-sm border-2 border-white dark:border-[#2a2a2a]"
          />
        </motion.div>
        
        <div className="flex-1 text-center sm:text-left">
          <motion.h1 
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#333333] dark:text-white"
            variants={childVariants}
          >
            Hey <span className="text-[#58a3ff] dark:text-[#58a3ff]">{displayName}</span>!
          </motion.h1>
          
          <motion.p 
            className="text-sm md:text-base text-slate-600 dark:text-[#c0daff] mt-2 italic font-light"
            variants={quoteVariants}
          >
            {loading ? 'Loading your daily insight...' : error ? error : insight}
          </motion.p> 
        </div>
      </div>
    </motion.section>
  );
} 