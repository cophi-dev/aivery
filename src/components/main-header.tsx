"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Calendar, MessageSquare, History, BarChart2, List, Menu } from "lucide-react"
import { UserNavigation } from "./user-navigation"

export function MainHeader() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const user = session?.user
  const logoRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);

  // Safety check for pathname to fix deployment error
  const isPath = (path: string) => {
    return pathname ? pathname.startsWith(path) : false
  }

  // Add proper error handling for session loading
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!user;

  // Navigation links configuration for reuse
  const navLinks = [
    {
      href: "/workouts",
      label: "Workouts",
      icon: <History className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/workouts") || isPath("/workout")
    },
    {
      href: "/exercises",
      label: "Exercises",
      icon: <List className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/exercises")
    },
    {
      href: "/chat",
      label: "Talk to Aivery",
      icon: <MessageSquare className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/chat")
    }
  ]

  // --- Event Logic Helper ---
  const updateElementPositions = (deltaX: number, deltaY: number) => {
    const maxTranslation = 7; // Increased slightly

    const translateX = Math.max(-maxTranslation, Math.min(maxTranslation, deltaX * maxTranslation));
    // Apply less vertical translation to mouth for a better effect?
    const mouthTranslateY = Math.max(-maxTranslation / 2, Math.min(maxTranslation / 2, deltaY * (maxTranslation / 2)));
    const eyeTranslateY = Math.max(-maxTranslation, Math.min(maxTranslation, deltaY * maxTranslation));

    const transformValueEyes = `translate(${translateX}, ${eyeTranslateY})`;
    const transformValueMouth = `translate(${translateX}, ${mouthTranslateY})`;

    if (eyeLeftRef.current) {
      eyeLeftRef.current.setAttribute('transform', transformValueEyes);
    }
    if (eyeRightRef.current) {
      eyeRightRef.current.setAttribute('transform', transformValueEyes);
    }
    if (mouthRef.current) {
      mouthRef.current.setAttribute('transform', transformValueMouth);
    }
  };

  const resetElementPositions = () => {
    const resetTransform = 'translate(0, 0)';
    if (eyeLeftRef.current) {
      eyeLeftRef.current.setAttribute('transform', resetTransform);
    }
    if (eyeRightRef.current) {
      eyeRightRef.current.setAttribute('transform', resetTransform);
    }
    if (mouthRef.current) {
      mouthRef.current.setAttribute('transform', resetTransform);
    }
  };
  // --- End Event Logic Helper ---

  // --- Combined Event Effect ---
  useEffect(() => {
    // Early exit if window is not defined (SSR or other environments)
    if (typeof window === 'undefined') {
      console.log("[Logo Effect] Window not available, cannot add listeners.");
      return () => {}; // Return empty cleanup
    }

    let activeListenerType: 'orientation' | 'mouse' | null = null;
    let cleanupListener = () => {}; // Initialize cleanup function

    // --- Define Handlers ---
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta;
      const gamma = event.gamma;
      if (beta === null || gamma === null) {
        resetElementPositions();
        return;
      }
      const clampedGamma = Math.max(-45, Math.min(45, gamma));
      const clampedBeta = Math.max(-45, Math.min(45, beta));
      const deltaX = clampedGamma / 45;
      const deltaY = clampedBeta / 45;
      updateElementPositions(deltaX, deltaY);
    };

    const handleMouseMove = (event: MouseEvent) => {
        console.log('[Logo Effect] handleMouseMove - logoRef:', logoRef.current);
        const logoContainer = logoRef.current;
        if (!logoContainer) return;
        const { clientX, clientY } = event;
        const { left, top, width, height } = logoContainer.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const deltaX = (clientX - centerX) / (width / 2);
        const deltaY = (clientY - centerY) / (height / 2);
        updateElementPositions(deltaX, deltaY);
    };
    // --- End Handlers ---

    // --- Listener Setup Functions ---
    const addOrientationListener = () => {
        console.log("[Logo Effect] Adding DeviceOrientation listener.");
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        activeListenerType = 'orientation';
        cleanupListener = () => {
            if (activeListenerType === 'orientation') {
                console.log("[Logo Effect] Removing DeviceOrientation listener.");
                window.removeEventListener('deviceorientation', handleDeviceOrientation);
                resetElementPositions();
                activeListenerType = null;
            }
        };
    };

    const addMouseListener = () => {
        console.log("[Logo Effect] Adding Mouse listeners to window.");
        window.addEventListener('mousemove', handleMouseMove);
        activeListenerType = 'mouse';
        cleanupListener = () => {
            if (activeListenerType === 'mouse') {
                console.log("[Logo Effect] Removing Mouse listeners from window.");
                window.removeEventListener('mousemove', handleMouseMove);
                resetElementPositions();
                activeListenerType = null;
            }
        };
    };
    // --- End Listener Setup Functions ---

    // --- Determine and Add Listener ---
    // Check for the permission API first
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      console.log("[Logo Effect] Requesting DeviceOrientation permission...");
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            console.log("[Logo Effect] DeviceOrientation permission granted.");
            addOrientationListener();
          } else {
             console.warn("[Logo Effect] DeviceOrientation permission denied. Falling back to mouse.");
             addMouseListener(); // Fallback if denied
          }
        })
        .catch((error: any) => {
           console.error("[Logo Effect] Error requesting DeviceOrientation permission. Falling back to mouse.", error);
           addMouseListener(); // Fallback on error
        });
    } else {
      // If requestPermission doesn't exist, default to mouse listeners
      console.log("[Logo Effect] DeviceOrientation requires no permission or not supported. Using mouse listeners.");
      addMouseListener();
    }
    // --- End Determine and Add Listener ---

    // Return the assigned cleanup function
    return () => {
        // Execute whatever cleanup was assigned based on the successful listener
        cleanupListener();
    };

  }, []); // Run once on mount
  // --- End Combined Event Effect ---


  // Prevent render errors during loading state
  if (isLoading) {
    // Keep loading state centered too
    return (
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-center"> {/* Center loading state */} 
          <div className="flex items-center gap-3">
             <div className="w-14 h-14 rounded-full bg-primary/10 animate-pulse" /> {/* Make loading bigger */} 
             <span className="font-bold text-xl ml-2">Aivery</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      {/* Changed flex layout: justify-between -> no justify, added divs for structure */}
      <div className="container mx-auto px-4 py-0 h-16 flex items-center">
        
        {/* Left Section (Mobile Menu Trigger / Desktop Nav) */} 
        <div className="flex-1 flex justify-start items-center">
          {/* Mobile Menu Trigger - only shows for logged in users on small screens */}
          {user && (
             <Sheet>
               <SheetTrigger asChild>
                 <Button variant="ghost" size="icon" className="md:hidden mr-2"> {/* Show only on small screens */} 
                   <Menu className="h-6 w-6" />
                   <span className="sr-only">Toggle Navigation</span>
                 </Button>
               </SheetTrigger>
               <SheetContent side="left" className="w-[250px]">
                  {/* You might want a header inside the sheet */}
                  <div className="flex items-center p-4 border-b">
                     {/* Optionally repeat the logo/name inside sheet */}
                     <div className="w-8 h-8 relative">
                       <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                         <defs><radialGradient id="glow-sheet" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5"><stop offset="0%" stopColor="#4B9EFF"/><stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/></radialGradient></defs>
                         <circle cx="256" cy="256" r="200" fill="url(#glow-sheet)" />
                         <circle cx="200" cy="200" r="20" fill="#FFFFFF"/>
                         <circle cx="312" cy="200" r="20" fill="#FFFFFF"/>
                         <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="15" fill="none" strokeLinecap="round"/>
                       </svg>
                     </div>
                      <span className="font-bold text-lg ml-2">Aivery</span>
                  </div>
                  <nav className="flex flex-col p-4 space-y-2">
                     {navLinks.map((link) => (
                       <Link
                         key={link.href}
                         href={link.href}
                         className={cn(
                           "flex items-center gap-3 py-2 px-3 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                           link.active ? "text-foreground bg-accent/50" : "text-muted-foreground"
                         )}
                        // Add onClick={() => setOpen(false)} if you manage Sheet open state 
                       >
                         {link.icon}
                         <span>{link.label}</span>
                       </Link>
                     ))}
                  </nav>
               </SheetContent>
             </Sheet>
          )}
          {/* Desktop Navigation - shown only for logged in users on medium+ screens */}
          {user && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium"> {/* Hide on small screens */} 
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 py-1 px-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                    link.active ? "text-foreground bg-accent/50" : "text-foreground/70"
                  )}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Center Section (Logo) */} 
        <div className="flex justify-center items-center">
           <Link href="/" className="flex items-center">
            {/* Increased size w-14 h-14 -> w-14 h-14 */}
            <div ref={logoRef} className="w-14 h-14 relative">
              <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                    <stop offset="0%" stopColor="#4B9EFF"/>
                    <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                  </radialGradient>
                </defs>
                <circle cx="256" cy="256" r="200" fill="url(#glow)" />
                <circle ref={eyeLeftRef} cx="200" cy="200" r="20" fill="#FFFFFF" style={{ transition: 'transform 0.1s ease-out' }}/>
                <circle ref={eyeRightRef} cx="312" cy="200" r="20" fill="#FFFFFF" style={{ transition: 'transform 0.1s ease-out' }}/>
                <path ref={mouthRef} d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="15" fill="none" strokeLinecap="round" style={{ transition: 'transform 0.1s ease-out' }}/>
              </svg>
            </div>
            {/* Hide text label? Optional - keeps it cleaner when centered */}
            {/* <span className="font-bold text-xl ml-2">Aivery</span> */}
          </Link>
        </div>

        {/* Right Section (User Nav or Login/Signup) */} 
        <div className="flex-1 flex justify-end items-center">
          {isAuthenticated ? (
            <UserNavigation />
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="default" size="sm" className="font-medium">
                  Sign up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 