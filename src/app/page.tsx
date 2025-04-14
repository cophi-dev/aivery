"use client"; // Mark as Client Component

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3, Activity, LineChart, MessageSquare, Calendar, Zap } from "lucide-react"
import { useState, useEffect, useRef } from 'react';
import React from 'react';

export default function LandingPage() {
  // --- Refs for SVG elements ---
  const logoRef = useRef<HTMLDivElement>(null); // Ref for the container div
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  // --- End Refs ---

  // State for mouse position - simplified as we only need mouse for this page
  // State to control if effect should run (prevents SSR issues)
  const [isClient, setIsClient] = useState(false);

  // --- Event Logic Helper (Refined) ---
  const updateElementPositions = (deltaX: number, deltaY: number) => {
    const maxTranslation = 8; // Increased sensitivity slightly

    // Clamp the movement (ensure value stays within -1 to 1 before scaling)
    const clampedDeltaX = Math.max(-1, Math.min(1, deltaX));
    const clampedDeltaY = Math.max(-1, Math.min(1, deltaY));

    const translateX = clampedDeltaX * maxTranslation;
    const eyeTranslateY = clampedDeltaY * maxTranslation;
    const mouthTranslateY = clampedDeltaY * (maxTranslation / 1.5); // Keep mouth moving less vertically

    const transformValueEyes = `translate(${translateX}px, ${eyeTranslateY}px)`; // Added px unit
    const transformValueMouth = `translate(${translateX}px, ${mouthTranslateY}px)`; // Added px unit

    // Apply styles directly using the refs
    if (eyeLeftRef.current) {
      eyeLeftRef.current.style.transform = transformValueEyes;
    }
    if (eyeRightRef.current) {
      eyeRightRef.current.style.transform = transformValueEyes;
    }
    if (mouthRef.current) {
      mouthRef.current.style.transform = transformValueMouth;
    }
  };

  const resetElementPositions = () => {
    const resetTransform = 'translate(0, 0)';
    if (eyeLeftRef.current) eyeLeftRef.current.style.transform = resetTransform;
    if (eyeRightRef.current) eyeRightRef.current.style.transform = resetTransform;
    if (mouthRef.current) mouthRef.current.style.transform = resetTransform;
  };
  // --- End Event Logic Helper ---

  // --- Combined Event Effect (Adapted from MainHeader - Mouse only) ---
   useEffect(() => {
     setIsClient(true); // Indicate component has mounted

     if (typeof window === 'undefined') {
       return; // Exit if not in browser
     }

     const handleMouseMove = (event: MouseEvent) => {
       const logoContainer = logoRef.current;
       if (!logoContainer) return;

       // Get position relative to the logo container itself for more direct control
       const { clientX, clientY } = event;
       const { left, top, width, height } = logoContainer.getBoundingClientRect();
       const centerX = left + width / 2;
       const centerY = top + height / 2;

       // Normalize the delta: -1 to 1 range relative to center
       const deltaX = (clientX - centerX) / (width / 2);
       const deltaY = (clientY - centerY) / (height / 2);

       window.requestAnimationFrame(() => { // Optimize updates
           updateElementPositions(deltaX, deltaY);
       });
     };

     // Add mousemove listener to the window
     window.addEventListener('mousemove', handleMouseMove);
     // Optional: Reset when mouse leaves the window?
     // window.addEventListener('mouseleave', resetElementPositions);

     // Cleanup listener on component unmount
     return () => {
       window.removeEventListener('mousemove', handleMouseMove);
       // window.removeEventListener('mouseleave', resetElementPositions);
       resetElementPositions(); // Reset on unmount
     };
   }, [isClient]); // Rerun if isClient changes (only runs once on mount effectively)
  // --- End Combined Event Effect ---

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Gradient background element */}
      <div className="absolute top-0 left-0 w-full h-[70vh] overflow-hidden -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-transparent"></div>
        <div className="absolute top-[10%] right-[10%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-gradient-to-br from-blue-100/40 to-blue-200/40 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] left-[5%] w-[30vw] h-[30vw] max-w-[500px] max-h-[500px] bg-gradient-to-tr from-blue-200/30 to-blue-100/30 rounded-full blur-3xl"></div>
      </div>

      {/* Minimal Header - REMOVED AGAIN */}
      {/* 
      <header className="py-6 relative">
        ...
      </header>
      */}

      <main className="flex-1">
        {/* Clean Hero Section - Mobile Adjustments */}
        <section className="w-full py-16 sm:py-20 md:py-24 relative"> {/* Adjusted padding */}
          <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center">
            <div className="flex flex-col items-center justify-center">
              {/* Logo - Size seems OK */}
              <div className="w-24 h-24 md:w-32 md:h-32 mb-8">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/aivery.jpg-MAo6jTy6pBDE5u4EvmYJZJ9TWxI0cb.jpeg"
                  alt="Aivery Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Headline - Adjust mobile size */}
              <h1 className="font-dm-serif text-3xl sm:text-4xl md:text-6xl font-medium tracking-tight mb-6 md:mb-8"> {/* Adjusted sizes */}
                Train smarter. See the patterns.
                <br />
                Improve with purpose.
              </h1>

              {/* Subheading - Adjust mobile size */}
              <p className="font-poppins text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-8 md:mb-10 max-w-2xl"> {/* Adjusted sizes */}
                Aivery helps you understand your workouts – not just track them.
              </p>

              {/* CTA Buttons - Update link */}
              <div className="flex justify-center">
                <Button
                  asChild
                  className="rounded-md px-6 sm:px-8 text-white bg-brand-accent hover:bg-brand-accent-hover shadow-sm transition-colors duration-200"
                >
                  <Link href="/register">Start using Aivery now</Link>
                </Button>
              </div>
            </div>
            {/* Mockup Image - Adjust max-width, add mobile padding */} 
            <div className="mt-12 md:mt-20 px-4 sm:px-0"> {/* Adjusted margin, added padding */}
              <img 
                src="/mock.png" 
                alt="Aivery App Mockup" 
                className="max-w-full lg:max-w-4xl mx-auto rounded-lg shadow-xl border border-gray-200" // Use max-w-full on smaller screens
                width={1200} 
                height={750} 
              />
            </div>
          </div>
        </section>

        {/* Abstract visualization - Adjust card padding/text on mobile */}
        <section className="w-full py-16 md:py-20 relative"> {/* Adjusted padding */}
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 text-center">What you can already do with Aivery</h2> {/* Adjusted sizes */} 
            <p className="text-gray-600 text-center mb-10 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base"> {/* Adjusted sizes */} 
              Powerful features that help you understand your training journey
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"> {/* Adjusted gap */}
              {features.map((feature, index) => (
                <div key={index} className="group flex items-start space-x-4 p-4 sm:p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ease-out"> {/* Adjusted padding */} 
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 group-hover:from-blue-200 group-hover:to-blue-400 transition-colors duration-300"> {/* Adjusted size */} 
                    {feature.icon && 
                      React.cloneElement(feature.icon as React.ReactElement, { 
                        className: `h-5 w-5 sm:h-6 sm:w-6 ${feature.title === 'Fun Facts' ? 'text-orange-400' : 'text-black'}` // Adjusted size
                      })
                    }
                  </div>
                  <div>
                    <h3 className="font-medium text-base sm:text-lg mb-1 sm:mb-2">{feature.title}</h3> {/* Adjusted sizes/margin */} 
                    <p className="text-gray-600 text-xs sm:text-sm">{feature.description}</p> {/* Adjusted size */} 
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center text-gray-600 max-w-2xl mx-auto p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl">
              <p>
                It's all about understanding your data – and your journey. We're not here to throw charts at you. Aivery
                helps you make sense of what you're doing – so you can train with more clarity and motivation.
              </p>
            </div>
          </div>
        </section>

        {/* Epic Achievement Facts Section - Remove aspect-video */}
        <section className="w-full py-16 md:py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden"> {/* Adjusted padding */}
          <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-blue-50 rounded-full blur-3xl opacity-50 -z-10"></div>

          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 text-center">Epic Achievement Facts</h2> {/* Adjusted sizes */} 
            <p className="text-gray-600 text-center mb-10 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base"> {/* Adjusted sizes */} 
              We turn your workouts into mind-blowing real-world facts
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"> {/* Adjusted gap */}
              {/* Panda Card */}
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"> {/* Adjusted padding */}
                {/* Removed aspect-video, adjusted min-h */} 
                <div className="min-h-[150px] sm:min-h-[180px] mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-4xl">🏋️‍♂️</span>
                        <span className="text-xl">=</span>
                        <span className="text-4xl">🐼</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    BEAST MODE
                  </div>
                </div>
                 <h3 className="text-base sm:text-lg md:text-xl font-medium mb-2">You just deadlifted a panda bear! 🐼</h3> {/* Adjusted size */}
                 <p className="text-gray-600 text-sm sm:text-base"> {/* Adjusted size */}
                  Your 350lb deadlift is the equivalent of picking up an adult panda bear.
                  <br />
                  <strong>Next stop: grizzly bear territory!</strong>
                 </p>
              </div>

              {/* T-Rex Card - Remove bottom line */}
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"> 
                <div className="min-h-[150px] sm:min-h-[180px] mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Removed bottom line div */}
                      {/* <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-200"></div> */}
                      <div className="flex items-center space-x-6">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl">🏃‍♂️</span>
                          <span className="text-xs font-medium mt-1 bg-blue-100 px-2 py-0.5 rounded-full">7.5 mph</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">›</div>
                        <div className="flex flex-col items-center">
                          <span className="text-4xl">🦖</span>
                          <span className="text-xs font-medium mt-1 bg-blue-100 px-2 py-0.5 rounded-full">5-7 mph</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Restore T-Rex tag */}
                  <div className="absolute top-3 right-3 bg-brand-accent text-white text-xs font-bold px-2 py-1 rounded-full">
                    NEW RECORD
                  </div>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-medium mb-2">You outran a T-Rex! 🦖</h3> 
                <p className="text-gray-600 text-sm sm:text-base"> 
                 {/* Restore T-Rex text */}
                  Your 7.5 mph pace would leave a T-Rex in the dust (they topped out at 5-7 mph).
                  <br />
                  <strong>Jurassic survival: unlocked!</strong>
                </p>
              </div>

              {/* Burger Card - Restore content */}
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"> 
                <div className="min-h-[150px] sm:min-h-[180px] mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
                 {/* Restore Burger visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-4xl">🔥</span>
                        <span className="text-2xl">=</span>
                        <span className="text-4xl">🍔</span>
                        <span className="text-xl">×12</span>
                      </div>
                      <div className="flex space-x-1">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="text-xl">
                            🍔
                          </div>
                        ))}
                      </div>
                      <div className="flex space-x-1 mt-1">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="text-xl">
                            🍔
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                 <h3 className="text-base sm:text-lg md:text-xl font-medium mb-2">Burger Burner Extraordinaire!</h3> 
                 <p className="text-gray-600 text-sm sm:text-base"> 
                   {/* Restore Burger text */}
                    Your last workout burned 12 cheeseburgers worth of calories.
                    <br />
                    <strong>That's a whole fast food feast!</strong>
                </p>
              </div>

              {/* Eiffel Tower Card - Remove horizontal lines */}
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"> 
                <div className="min-h-[150px] sm:min-h-[180px] mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative h-full w-full flex items-center justify-center">
                      {/* Vertical Line */}
                      <div className="absolute left-1/2 transform -translate-x-1/2 bottom-0 w-[2px] h-[80%] bg-blue-300"></div>
                      {/* Removed horizontal lines map */}
                      {/* 
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[30%] h-[1px] bg-blue-200 left-1/2 transform -translate-x-1/2"
                          style={{
                            bottom: `${i * 10}%`,
                          }}
                        ></div>
                      ))}
                      */}
                      {/* Emojis */}
                      <div className="absolute bottom-[80%] left-1/2 transform -translate-x-1/2">
                        <span className="text-4xl">🗼</span>
                      </div>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                        <span className="text-4xl">👟</span>
                      </div>
                    </div>
                  </div>
                  {/* Restore Eiffel Tower tag */}
                  <div className="absolute top-2 right-2 bg-blue-100 rounded-full px-2 py-0.5">
                    <span className="text-xs font-medium text-blue-800">×2</span>
                  </div>
                </div>
                 <h3 className="text-base sm:text-lg md:text-xl font-medium mb-2">Stair Master Champion!</h3> 
                 <p className="text-gray-600 text-sm sm:text-base"> 
                  {/* Restore Eiffel Tower text */}
                    You've climbed the equivalent of the Eiffel Tower twice this month.
                    <br />
                    <strong>Paris is jealous of your calves!</strong>
                </p>
              </div>
            </div>

            <div className="mt-10 text-center">
              {/* Changed badge color scheme to blue */}
              <p className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                More ridiculous facts unlock as you keep crushing workouts! 🚀
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section - Update button links */}
        <section id="pricing" className="w-full py-16 md:py-20">
          <div className="container px-4 md:px-6 max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 text-center">Pricing</h2> {/* Adjusted sizes */} 
            <p className="text-gray-600 text-center mb-10 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base"> {/* Adjusted sizes */} 
              Simple, transparent pricing that grows with you
            </p>

            <div className="bg-white rounded-2xl p-8 md:p-10 mb-8 shadow-xl border border-gray-100 relative overflow-hidden hover:shadow-2xl transition-shadow duration-300">
              <div className="absolute top-0 right-0 bg-brand-accent text-white px-4 py-1 text-sm font-medium">
                Popular
              </div>
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
                <div>
                  <h3 className="text-xl font-medium mb-2">Full Access</h3>
                  <p className="text-gray-600">Includes all current and upcoming features.</p>
                </div>
                <div className="mt-4 md:mt-0 md:text-right">
                  <div className="text-3xl font-medium">
                    12.90 €<span className="text-base font-normal text-gray-600">/month</span>
                  </div>
                  <p className="text-sm text-gray-600">Early adopters lock in this price permanently.</p>
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className="w-full rounded-md text-white bg-brand-accent hover:bg-brand-accent-hover shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Link href="/register">Start using Aivery now</Link>
              </Button>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 md:p-10 border border-gray-100 hover:shadow-lg transition-shadow duration-300">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
                <div>
                  <h3 className="text-xl font-medium mb-2">Free Trial</h3>
                  <p className="text-gray-600">Try all features with daily usage limits.</p>
                </div>
                <div className="mt-4 md:mt-0 md:text-right">
                  <div className="text-3xl font-medium">Free</div>
                </div>
              </div>
              <Button asChild variant="outline" size="lg" className="w-full rounded-md">
                <Link href="/register">Start for free</Link>
              </Button>
            </div>

            <p className="text-center text-gray-600 mt-8">
              Because once you've seen your data through Aivery,
              <br />
              we're confident you'll want the full version.
            </p>
          </div>
        </section>

        {/* CTA Section - No button here anymore */}
        <section id="cta" className="w-full py-16 md:py-20 relative overflow-hidden">
          {/* Changed background to white */}
          <div className="absolute inset-0 bg-white opacity-90"></div> 
          {/* Updated SVG pattern to include blue circle */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 512 512' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='256' cy='256' r='200' fill='%234B9EFF' /%3E%3Ccircle cx='200' cy='200' r='20' fill='white'/%3E%3Ccircle cx='312' cy='200' r='20' fill='white'/%3E%3Cpath d='M200 300q56 20 112 0' stroke='white' stroke-width='15' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '60px 60px',
              opacity: 0.15 // Slightly increased opacity 
            }}
          ></div>

          <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center relative z-10">
            <h2 className="font-dm-serif text-3xl sm:text-4xl md:text-6xl font-medium tracking-tight mb-8 text-black"> {/* Adjusted sizes */} 
              Ready to train with more clarity?
            </h2> 
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="py-8">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <div className="w-6 h-6 mr-2">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/aivery.jpg-MAo6jTy6pBDE5u4EvmYJZJ9TWxI0cb.jpeg"
                  alt="Aivery Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm text-gray-500">© {new Date().getFullYear()} Aivery. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                Terms
              </Link>
              <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
    title: "Complete Workout History",
    description: "See your complete workout history in one clean view with intuitive visualizations.",
  },
  {
    icon: <Activity className="h-5 w-5 text-blue-500" />,
    title: "Automatic Analysis",
    description: "Get automatic analysis for strength & cardio sessions to understand your performance.",
  },
  {
    icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
    title: "AI Chat",
    description: "Chat with Aivery about your training – powered by your own data for personalized insights.",
  },
  {
    icon: <Calendar className="h-5 w-5 text-blue-500" />,
    title: "Weekly Summaries",
    description: "Receive weekly summaries + actionable tips for your next week to keep improving.",
  },
  {
    icon: <LineChart className="h-5 w-5 text-blue-500" />,
    title: "Trend Spotting",
    description: "Spot volume trends, intensity shifts, exercise consistency & more with visual analytics.",
  },
  {
    icon: <Zap className="h-5 w-5 text-orange-400" />,
    title: "Fun Facts",
    description: "Get fun facts that put your effort into perspective and keep you motivated.",
  },
]


