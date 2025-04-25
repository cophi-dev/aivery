"use client";

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3, Activity, LineChart, MessageSquare, Calendar, Zap } from "lucide-react"
import { useState, useEffect, useRef } from 'react';
import React from 'react';

// Define features array here or import if needed
const features = [
    { title: 'Activity Tracking', description: 'Automatically import and analyze your workouts from Garmin, Coros, Strava and Apple Health.', icon: <Activity /> },
    { title: 'Performance Insights', description: 'Understand your progress with clear metrics and trends.', icon: <LineChart /> },
    { title: 'AI Coach', description: 'Ask questions about your data and get personalized feedback.', icon: <MessageSquare /> },
    { title: 'Workout Planning', description: 'Structure your training and plan future sessions.', icon: <Calendar /> },
    { title: 'Effort Score', description: 'Quantify your training load across different activities.', icon: <Zap /> },
    { title: 'Data Visualization', description: 'See your training patterns with intuitive charts.', icon: <BarChart3 /> },
];

// The actual client component
export default function LandingPageClient() {
  const logoRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const [isClient, setIsClient] = useState(false);

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
    <div className="flex flex-col min-h-screen bg-white">
       {/* Gradient background element */}
       <div className="absolute top-0 left-0 w-full h-[70vh] overflow-hidden -z-10">
         <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-transparent"></div>
         <div className="absolute top-[10%] right-[10%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-gradient-to-br from-blue-100/40 to-blue-200/40 rounded-full blur-3xl"></div>
         <div className="absolute top-[20%] left-[5%] w-[30vw] h-[30vw] max-w-[500px] max-h-[500px] bg-gradient-to-tr from-blue-200/30 to-blue-100/30 rounded-full blur-3xl"></div>
       </div>

       {/* Main Content */}
       <main className="flex-1">
         {/* Clean Hero Section */}
         <section className="w-full py-16 sm:py-20 md:py-24 relative">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center">
             <div className="flex flex-col items-center justify-center">
               {/* Logo */}
               <div className="w-24 h-24 md:w-32 md:h-32 mb-8">
                 <img
                   src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/aivery.jpg-MAo6jTy6pBDE5u4EvmYJZJ9TWxI0cb.jpeg"
                   alt="Aivery Logo"
                   className="w-full h-full object-contain"
                 />
               </div>
               {/* Headline */}
               <h1 className="font-dm-serif text-3xl sm:text-4xl md:text-6xl font-medium tracking-tight mb-6 md:mb-8">
                 Train smarter. See the patterns.
                 <br />
                 Improve with purpose.
               </h1>
               {/* Subheading */}
               <p className="font-poppins text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-8 md:mb-10 max-w-2xl">
                 Aivery helps you understand your workouts – not just track them.
               </p>
               {/* CTA Button */}
               <div className="flex justify-center">
                 <Button
                   asChild
                   className="rounded-md px-6 sm:px-8 text-white bg-brand-accent hover:bg-brand-accent-hover shadow-sm transition-colors duration-200"
                 >
                   <Link href="/register">Start using Aivery now</Link>
                 </Button>
               </div>
             </div>
             {/* Mockup Image */}
             <div className="mt-12 md:mt-20 px-4 sm:px-0">
               <img 
                 src="/mock.png" 
                 alt="Aivery App Mockup" 
                 className="max-w-full lg:max-w-4xl mx-auto rounded-lg shadow-xl border border-gray-200"
                 width={1200} 
                 height={750} 
               />
             </div>
           </div>
         </section>

         {/* Features Section */}
         <section className="w-full py-16 md:py-20 relative">
           <div className="container px-4 md:px-6 max-w-4xl mx-auto">
             <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 text-center">What you can already do with Aivery</h2> 
             <p className="text-gray-600 text-center mb-10 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
               Powerful features that help you understand your training journey
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
               {features.map((feature, index) => (
                 <div key={index} className="group flex items-start space-x-4 p-4 sm:p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ease-out">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 group-hover:from-blue-200 group-hover:to-blue-400 transition-colors duration-300">
                     {feature.icon && React.cloneElement(feature.icon as React.ReactElement, { className: `h-5 w-5 sm:h-6 sm:w-6 ${feature.title === 'Fun Facts' ? 'text-orange-400' : 'text-black'}` })}
                   </div>
                   <div>
                     <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2">{feature.title}</h3>
                     <p className="text-gray-600 text-xs sm:text-sm">{feature.description}</p>
                   </div>
                 </div>
               ))}
             </div>
             <div className="mt-16 text-center text-gray-600 max-w-2xl mx-auto p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl">
               <p>It's all about understanding your data – and your journey. We're not here to throw charts at you. Aivery helps you make sense of what you're doing – so you can train with more clarity and motivation.</p>
             </div>
           </div>
         </section>

         {/* Epic Achievement Facts Section */}
         <section className="w-full py-16 md:py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
           {/* ... (rest of the section JSX) ... */}
         </section>

         {/* CTA Section */}
         <section className="w-full py-16 md:py-20 bg-white">
           {/* ... (rest of the section JSX) ... */}
         </section>
       </main>

       {/* Footer */}
       <footer className="py-8 border-t border-gray-100">
         {/* ... (rest of the section JSX) ... */}
       </footer>
    </div>
  );
} 