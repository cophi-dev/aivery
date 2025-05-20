"use client";

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3, Activity, LineChart, MessageSquare, Calendar, Zap, Brain, Dumbbell, AreaChart, ArrowRightCircle } from "lucide-react"
import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { AiveryHero } from "../blocks/aivery-hero";
import { ThemeSwitch } from "@/components/ui/theme-switch-button";
import { PricingSectionBasic } from "@/components/blocks/PricingSectionBasic";
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

// The actual client component
export default function LandingPageClient() {
  const logoRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

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
         <section className="w-full py-12 md:py-16 bg-gray-50 dark:bg-gray-900">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <div className="text-center max-w-3xl mx-auto">
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-6">Beyond Simple Tracking — Training Intelligence</h2>
               <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg">
                 While others count steps, we reveal patterns. While they track calories, we deliver personalized insights. Aivery doesn't just log your workouts—it understands them.
               </p>
             </div>
           </div>
         </section>

         {/* Features Section */}
         <section id="features" className="w-full py-16 md:py-20 relative">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 text-center">Feature Highlights</h2> 
             <p className="text-gray-600 dark:text-gray-400 text-center mb-10 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
               Discover how Aivery transforms your fitness experience
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
               {features.map((feature, index) => (
                 <div key={index} className="group flex items-start space-x-4 p-4 sm:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ease-out">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center flex-shrink-0 group-hover:from-blue-200 group-hover:to-blue-400 dark:group-hover:from-blue-800 dark:group-hover:to-blue-600 transition-colors duration-300">
                     {feature.icon && React.cloneElement(feature.icon as React.ReactElement, { className: `h-5 w-5 sm:h-6 sm:w-6 text-black dark:text-white` })}
                   </div>
                   <div>
                     <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2">{feature.title}</h3>
                     <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{feature.description}</p>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </section>

         {/* How It Works Section */}
         <section className="w-full py-20 md:py-28 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
           <div className="container px-4 md:px-6 max-w-5xl mx-auto">
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

         {/* Testimonial Section */}
         <section className="w-full py-16 md:py-20 bg-white dark:bg-gray-950">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <div className="bg-blue-50 dark:bg-gray-900 rounded-2xl p-8 md:p-10 relative">
               <div className="text-4xl text-blue-300 absolute top-6 left-6">"</div>
               <div className="text-4xl text-blue-300 absolute bottom-6 right-6">"</div>
               <blockquote className="text-center relative z-10">
                 <p className="text-gray-700 dark:text-gray-300 text-lg md:text-xl italic mb-6">
                   Aivery turned my workout data into meaningful insights. The AI coach feels like having a personal trainer who knows my entire fitness history.
                 </p>
                 <footer className="font-medium text-gray-900 dark:text-gray-100">- Alex M.</footer>
               </blockquote>
             </div>
           </div>
         </section>

         {/* Technical Excellence */}
         <section className="w-full py-12 md:py-16 bg-gray-50 dark:bg-gray-900">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <div className="text-center max-w-3xl mx-auto">
               <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4">Technical Excellence</h2>
               <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                 Built with state-of-the-art AI models configurable to your preference. Your data drives personalized insights with landmark comparisons, volume analysis, and progressive training plans. Enterprise-grade database ensures your fitness journey is securely documented.
               </p>
             </div>
           </div>
         </section>

         {/* Pricing Section */}
         <PricingSectionBasic />

         {/* CTA Section */}
         <section className="w-full py-16 md:py-20 bg-white dark:bg-gray-950">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center">
             <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-6">Start Training Smarter Today</h2>
             <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
               Free plan available. Premium features unlock unlimited insights and advanced coaching.
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

       {/* Footer */}
       <footer className="py-8 border-t border-gray-100 dark:border-gray-800">
         <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center text-gray-500 dark:text-gray-400 text-sm">
           <p>© {new Date().getFullYear()} Aivery. All rights reserved.</p>
         </div>
       </footer>
    </div>
  );
} 