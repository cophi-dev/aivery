"use client";

import Link from "next/link"
import Image from "next/image" 
import { Button } from "@/components/ui/button"
import { BarChart3, Activity, LineChart, MessageSquare, Calendar, Zap, Brain, Dumbbell, AreaChart, ArrowRightCircle, Trophy, Check, ClipboardList } from "lucide-react"
import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { AiveryHero } from "../blocks/aivery-hero";
import { ThemeSwitch } from "@/components/ui/theme-switch-button";
import { PricingSectionBasic } from "@/components/blocks/PricingSectionBasic";
import { SvgPatternBackground, LogoWavyBackground } from "@/components/ui/svg-pattern-background";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";

// Updated features array with new descriptions
const features = [
    { title: 'Personalized Workout Insights', description: 'Every workout gets an AI-generated highlight that makes your achievements tangible. Run 5K? That\'s "the distance from Central Park to Times Square!"', icon: <Brain /> },
    { title: 'Advanced Muscle Group Analysis', description: 'Identify training imbalances with interactive visualizations that show muscle group coverage and detect potentially neglected areas.', icon: <AreaChart /> },
    { title: 'Smart Performance Tracking', description: 'Track personal records automatically across all your exercises. Our system identifies PRs in weight, reps, volume, distance, and pace.', icon: <LineChart /> },
    { title: 'AI Coaching Conversations', description: 'Ask questions about your progress, get workout suggestions, or request training plans tailored to your actual performance data.', icon: <MessageSquare /> },
    { title: 'Seamless Strava Integration', description: 'Import workouts effortlessly from Strava with proper data normalization and enhancement. Your existing data becomes immediately insightful.', icon: <Activity /> },
    { title: 'Weekly Performance Reviews', description: 'Receive comprehensive weekly analysis with actionable feedback and performance patterns. Understand what\'s working and what needs adjustment.', icon: <Calendar /> },
];

// How It Works steps
const howItWorks = [
  {
    step: 1,
    title: "Connect & Import",
    description: "Sync with Strava or log workouts manually",
    subtitle: "Seamless Data Integration"
  },
  {
    step: 2,
    title: "Get Instant Analysis",
    description: "Receive AI-generated insights on every activity",
    subtitle: "Smart Feedback Loop"
  },
  {
    step: 3,
    title: "Track Progress",
    description: "Watch your personal records and achievements accumulate",
    subtitle: "Performance Visibility"
  },
  {
    step: 4,
    title: "Receive Guidance",
    description: "Get personalized coaching based on your actual data",
    subtitle: "Intelligent Coaching"
  },
];

// New feature highlights with images
const featureHighlights = [
  {
    title: "Monthly Challenges",
    description: "Personalized fitness goals dynamically generated based on your workout history. Each challenge adapts to your performance, pushing you to achieve new milestones.",
    imageLight: "/uploads/challenges light.png",
    imageDark: "/uploads/challenges dark.png",
    icon: <Trophy className="h-5 w-5" />,
    alt: "Aivery monthly challenges interface showing various workout goals"
  },
  {
    title: "Weekly Performance Reviews",
    description: "Comprehensive weekly analysis of your workouts with actionable insights. Understand your patterns, achievements, and get recommendations for improvement.",
    image: "/uploads/weekly review.png",
    icon: <Calendar className="h-5 w-5" />,
    alt: "Weekly workout review showing performance stats and AI analysis"
  },
  {
    title: "AI Coaching Conversations",
    description: "Chat with Aivery about your workouts, ask questions, get personalized advice or discuss your progress - all informed by your actual workout data.",
    image: "/uploads/chat.png",
    icon: <MessageSquare className="h-5 w-5" />,
    alt: "AI chat interface providing personalized workout guidance"
  },
  {
    title: "Smart Workout Logging",
    description: "Log your workouts with AI assistance. Quick logging features help you track exercises efficiently with smart suggestions based on your history.",
    image: "/uploads/logging.png",
    icon: <ClipboardList className="h-5 w-5" />,
    alt: "Workout logging interface with AI-powered exercise tracking"
  }
];

// The actual client component
export default function LandingPageClient() {
  const logoRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setIsClient(true);
    // Check if we're in dark mode
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDarkMode ? 'dark' : 'light');

    // Listen for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // --- Event Logic Helper (Refined) ---
  const updateElementPositions = (deltaX: number, deltaY: number) => {
    // ... (keep existing implementation) ...
  };
  const resetElementPositions = () => {
     // ... (keep existing implementation) ...
  };
  // --- End Event Logic Helper ---

  // --- Combined Event Effect (Adapted from MainHeader - Mouse only) ---
   useEffect(() => {
     // ... (keep existing implementation) ...
   }, [isClient]);
  // --- End Combined Event Effect ---

  // Return the JSX from the original LandingPage component
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
       {/* Main Content */}
       <main className="flex-1">
         {/* Modern Hero Section */}
         <AiveryHero />

         {/* Value Proposition */}
         <section className="w-full py-12 md:py-16 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
           {/* Add SVG pattern background */}
           <SvgPatternBackground 
             opacity={0.03} 
             iconSize={48} 
             color="var(--brand-accent, #0066FF)"
           />
           <div className="container px-4 md:px-6 max-w-4xl mx-auto relative z-10">
             <div className="text-center max-w-3xl mx-auto">
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-6">Beyond Simple Tracking — Training Intelligence</h2>
               <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg">
                 While others count steps, we reveal patterns. While they track calories, we deliver personalized insights. Aivery doesn't just log your workouts—it understands them.
               </p>
             </div>
           </div>
         </section>

         {/* NEW Features Section with Images */}
         <section id="features" className="w-full py-16 md:py-24 relative">
           <div className="container px-4 md:px-6 mx-auto">
             <div className="text-center max-w-3xl mx-auto mb-16">
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-4">Key Features</h2>
               <p className="text-gray-600 dark:text-gray-400 text-base">
                 Discover how Aivery transforms your fitness journey with intelligent features designed for real results
               </p>
             </div>
             
             <div className="space-y-24 md:space-y-32">
               {/* Challenges Feature */}
               <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                 <div className="order-2 md:order-1">
                   <div className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-300 mb-4">
                     <Trophy className="mr-1 h-4 w-4" />
                     <span>Monthly Challenges</span>
                   </div>
                   <h3 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4">Personalized Fitness Challenges</h3>
                   <p className="text-gray-600 dark:text-gray-400 mb-6">
                     Your personalized fitness goals, dynamically generated based on your workout history and progress. Each challenge adapts to your performance, pushing you to achieve new milestones.
                   </p>
                   <ul className="space-y-2 mb-6">
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Adaptive difficulty based on your performance</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Mix of strength, cardio, and consistency goals</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Visual progress tracking and achievement celebration</span>
                     </li>
                   </ul>
                 </div>
                 <div className="order-1 md:order-2 rounded-xl overflow-hidden shadow-xl">
                   <Image 
                     src={theme === 'dark' ? "/uploads/challenges dark.png" : "/uploads/challenges light.png"}
                     alt="Aivery monthly challenges interface showing various workout goals"
                     width={800}
                     height={600}
                     className="w-full h-auto rounded-xl shadow-lg"
                   />
                 </div>
               </div>

               {/* Weekly Review Feature */}
               <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                 <div className="order-2 md:order-2">
                   <div className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-300 mb-4">
                     <Calendar className="mr-1 h-4 w-4" />
                     <span>Weekly Review</span>
                   </div>
                   <h3 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4">Comprehensive Performance Reviews</h3>
                   <p className="text-gray-600 dark:text-gray-400 mb-6">
                     Every week, Aivery analyzes your workouts and provides insights on your progress, patterns, and areas for improvement. Get a clear picture of your fitness journey with AI-powered analysis.
                   </p>
                   <ul className="space-y-2 mb-6">
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Detailed workout summaries and statistics</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Personalized insights and trend analysis</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Recovery recommendations and training balance advice</span>
                     </li>
                   </ul>
                 </div>
                 <div className="order-1 md:order-1 rounded-xl overflow-hidden shadow-xl">
                   <Image 
                     src="/uploads/weekly review.png"
                     alt="Weekly workout review showing performance stats and AI analysis"
                     width={800}
                     height={600}
                     className="w-full h-auto rounded-xl shadow-lg"
                   />
                 </div>
               </div>

               {/* Chat Feature */}
               <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                 <div className="order-2 md:order-1">
                   <div className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-300 mb-4">
                     <MessageSquare className="mr-1 h-4 w-4" />
                     <span>AI Coaching</span>
                   </div>
                   <h3 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4">Intelligent Workout Conversations</h3>
                   <p className="text-gray-600 dark:text-gray-400 mb-6">
                     Chat with Aivery about your fitness goals, ask questions about your workouts, or get personalized advice - all informed by your actual training data and progress.
                   </p>
                   <ul className="space-y-2 mb-6">
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Context-aware responses based on your workout history</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Training plan suggestions and adjustments</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Exercise technique guidance and form advice</span>
                     </li>
                   </ul>
                 </div>
                 <div className="order-1 md:order-2 rounded-xl overflow-hidden shadow-xl">
                   <Image 
                     src="/uploads/chat.png"
                     alt="AI chat interface providing personalized workout guidance"
                     width={800}
                     height={600}
                     className="w-full h-auto rounded-xl shadow-lg"
                   />
                 </div>
               </div>

               {/* Workout Logging Feature */}
               <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                 <div className="order-2 md:order-2">
                   <div className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-300 mb-4">
                     <ClipboardList className="mr-1 h-4 w-4" />
                     <span>Smart Logging</span>
                   </div>
                   <h3 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4">AI-Powered Workout Tracking</h3>
                   <p className="text-gray-600 dark:text-gray-400 mb-6">
                     Record your workouts effortlessly with smart AI assistance. Simply paste your workout log or use the guided entry system to track exercises, sets, and reps with minimal effort.
                   </p>
                   <ul className="space-y-2 mb-6">
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>"Quick Log with AI" for rapid workout entry</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Smart suggestions based on your workout history</span>
                     </li>
                     <li className="flex items-start">
                       <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800">
                         <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                       </div>
                       <span>Personalized exercise recommendations and PR tracking</span>
                     </li>
                   </ul>
                 </div>
                 <div className="order-1 md:order-1 rounded-xl overflow-hidden shadow-xl">
                   <Image 
                     src="/uploads/logging.png"
                     alt="Workout logging interface with AI-powered exercise tracking"
                     width={800}
                     height={600}
                     className="w-full h-auto rounded-xl shadow-lg"
                   />
                 </div>
               </div>
             </div>
           </div>
         </section>

         {/* How It Works Section */}
         <section className="w-full py-20 md:py-28 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
           {/* Add wavy logo background */}
           <LogoWavyBackground 
             opacity={0.02} 
             color="var(--brand-accent, #0066FF)"
           />
           <div className="container px-4 md:px-6 max-w-5xl mx-auto relative z-10">
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-16 text-center">How It Works</h2>
             <div className="max-w-[850px] mx-auto">
               {/* Top Steps */}
               <Stepper 
                 value={activeStep} 
                 onValueChange={setActiveStep}
                 className="grid grid-cols-4 gap-6 mb-20"
               >
                 {howItWorks.map((item, index) => (
                   <StepperItem
                     key={index}
                     step={index + 1}
                     className={`flex flex-col items-center ${index === activeStep - 1 ? 'opacity-100' : 'opacity-60'}`}
                   >
                     <StepperTrigger className="flex flex-col items-center w-full">
                       <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 
                         ${index < activeStep ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
                         ${index === activeStep - 1 ? 'ring-4 ring-blue-200 dark:ring-blue-900' : ''}`}>
                         {index < activeStep ? (
                           <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                           </svg>
                         ) : (
                           <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">{index + 1}</span>
                         )}
                       </div>
                       <div className="text-center">
                         <span className="block text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">
                           {item.subtitle}
                         </span>
                         <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                           {item.title}
                         </h3>
                         <p className="text-sm text-gray-500 dark:text-gray-400">
                           {item.description}
                         </p>
                       </div>
                     </StepperTrigger>
                   </StepperItem>
                 ))}
               </Stepper>

               {/* Bottom Progress Bar */}
               <div className="relative h-16">
                 {/* Background Line */}
                 <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                   <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700"></div>
                 </div>

                 {/* Progress Line */}
                 <div className="absolute inset-y-0 left-0" style={{ width: `${(activeStep - 1) * 33.33}%` }}>
                   <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                     <div className="h-0.5 w-full bg-blue-500"></div>
                   </div>
                 </div>

                 {/* Progress Dots */}
                 {[1, 2, 3, 4].map((step, i) => (
                   <div
                     key={i}
                     className="absolute top-1/2 -translate-y-1/2"
                     style={{ left: `${i * 33.33}%` }}
                   >
                     <div className={`w-3 h-3 rounded-full transition-all duration-200
                       ${step <= activeStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                       ${step === activeStep ? 'ring-4 ring-blue-200 dark:ring-blue-900' : ''}`}
                     />
                   </div>
                 ))}
               </div>
             </div>
           </div>
         </section>

         {/* Testimonial Section - REPLACED with Aivery Icon Showcase */}
         <section className="w-full py-16 md:py-20 bg-white dark:bg-gray-950">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <div className="bg-blue-50 dark:bg-gray-900 rounded-2xl p-8 md:p-10 relative overflow-hidden flex flex-col items-center">
               {/* Decorative background icons */}
               <div className="absolute inset-0 opacity-[0.03] overflow-hidden">
                 <div className="absolute -top-10 -left-10 rotate-12">
                   <svg width="140" height="140" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <defs>
                       <radialGradient id="logoGlowBg1" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                         <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                         <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                         <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                       </radialGradient>
                     </defs>
                     <circle cx="256" cy="256" r="200" fill="url(#logoGlowBg1)" />
                     <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                     <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                     <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
                   </svg>
                 </div>
                 <div className="absolute -bottom-10 -right-10 rotate-45">
                   <svg width="120" height="120" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <defs>
                       <radialGradient id="logoGlowBg2" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                         <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                         <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                         <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                       </radialGradient>
                     </defs>
                     <circle cx="256" cy="256" r="200" fill="url(#logoGlowBg2)" />
                     <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                     <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                     <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
                   </svg>
                 </div>
               </div>
               
               {/* Center icon */}
               <div className="mb-8 relative z-10">
                 <svg width="96" height="96" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-float">
                   <defs>
                     <radialGradient id="logoGlow" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                       <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                       <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                       <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                     </radialGradient>
                   </defs>
                   <circle cx="256" cy="256" r="200" fill="url(#logoGlow)" />
                   <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                   <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                   <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
                 </svg>
               </div>
               
               {/* Text content */}
               <div className="text-center relative z-10 max-w-2xl">
                 <h3 className="text-xl md:text-2xl font-medium text-gray-900 dark:text-gray-100 mb-4">
                   Experience Smarter Fitness Tracking
                 </h3>
                 <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">
                   Aivery combines powerful AI models with your workout data to deliver meaningful, personalized insights that help optimize your fitness journey.
                 </p>
                 <div className="mt-8 flex justify-center">
                   <Button
                     asChild
                     className="rounded-md px-6 py-2 text-white bg-brand-accent hover:bg-brand-accent-hover shadow-md transition-colors duration-200"
                   >
                     <Link href="/register">Try it yourself</Link>
                   </Button>
                 </div>
               </div>
             </div>
           </div>
         </section>


         {/* Pricing Section */}
         <PricingSectionBasic />

         {/* CTA Section */}
         <section className="w-full py-16 md:py-20 bg-white dark:bg-gray-950 relative overflow-hidden">
           {/* Add small animated SVG logos in the background */}
           <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.015]">
             <div className="aivery-floating-icon absolute top-1/4 left-1/4 animate-float-slow">
               <svg width="40" height="40" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <defs>
                   <radialGradient id="logoGlowCta1" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                     <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                     <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                     <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                   </radialGradient>
                 </defs>
                 <circle cx="256" cy="256" r="200" fill="url(#logoGlowCta1)" />
                 <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                 <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                 <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
               </svg>
             </div>
             <div className="aivery-floating-icon absolute top-1/3 right-1/4 animate-float-medium">
               <svg width="60" height="60" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <defs>
                   <radialGradient id="logoGlowCta2" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                     <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                     <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                     <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                   </radialGradient>
                 </defs>
                 <circle cx="256" cy="256" r="200" fill="url(#logoGlowCta2)" />
                 <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                 <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                 <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
               </svg>
             </div>
             <div className="aivery-floating-icon absolute bottom-1/4 right-1/3 animate-float-fast">
               <svg width="50" height="50" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <defs>
                   <radialGradient id="logoGlowCta3" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                     <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
                     <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
                     <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                   </radialGradient>
                 </defs>
                 <circle cx="256" cy="256" r="200" fill="url(#logoGlowCta3)" />
                 <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
                 <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
                 <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
               </svg>
             </div>
           </div>
           <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center relative z-10">
             <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-6">Start Training Smarter Today</h2>
             <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
               Free trial available. Premium features unlock unlimited insights and advanced coaching.
             </p>
             <Button
               asChild
               className="rounded-md px-8 py-3 text-white bg-brand-accent hover:bg-brand-accent-hover shadow-md transition-colors duration-200"
             >
               <Link href="/register">Get Started</Link>
             </Button>
           </div>
         </section>
       </main>
    </div>
  );
} 