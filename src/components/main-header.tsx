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
import { ThemeSwitch } from "@/components/ui/theme-switch-button"

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

  // Determine if on the landing page
  const isLandingPage = pathname === '/';

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
    },
    {
      href: "/challenges",
      label: "Challenges",
      icon: <BarChart2 className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/challenges")
    },
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
  /* // Temporarily commented out to fix build issues
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
  */
  // --- End Combined Event Effect ---


  // Prevent render errors during loading state
  if (isLoading && !isLandingPage) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"> {/* Keep layout consistent */}
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 animate-pulse" />
             <span className="font-bold text-xl ml-2 opacity-0">Aivery</span> {/* Keep space but hide text */}
          </div>
           {/* Placeholder for user nav during load */}
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        isLandingPage
          ? "bg-background border-b border-gray-100 dark:border-transparent"
          : "border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
        {/* Left Section (Logo + Desktop Nav) */}
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div ref={logoRef} className="h-10 w-10 relative">
               <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                 <defs>
                   <radialGradient id="glow-main" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                     <stop offset="0%" stopColor="#4B9EFF"/>
                     <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                   </radialGradient>
                 </defs>
                 <circle cx="256" cy="256" r="200" fill="url(#glow-main)" />
                 <circle ref={eyeLeftRef} cx="200" cy="200" r="20" fill="#FFFFFF" style={{ transition: 'transform 0.1s ease-out' }}/>
                 <circle ref={eyeRightRef} cx="312" cy="200" r="20" fill="#FFFFFF" style={{ transition: 'transform 0.1s ease-out' }}/>
                 <path ref={mouthRef} d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="15" fill="none" strokeLinecap="round" style={{ transition: 'transform 0.1s ease-out' }}/>
               </svg>
             </div>
            <span className={cn("font-bold text-xl", isLandingPage ? "text-gray-800 dark:text-white" : "")}>aivery</span>
          </Link>
          {/* Desktop Navigation - shown only for logged-in users */}
          {user && (
            <nav className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    link.active
                      ? (isLandingPage ? "text-indigo-600 dark:text-indigo-400" : "text-foreground") // Adjust active color for landing page
                      : (isLandingPage ? "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" : "text-muted-foreground hover:text-foreground/80") // Adjust default/hover for landing page
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right Section (User Nav / Login/Signup / Mobile Menu) */}
        <div className="flex items-center gap-3">
          {/* Theme Switch - always visible */}
          <ThemeSwitch />
          
          {user ? (
            <>
              {/* Mobile Menu Trigger - only shows for logged in users on small screens */}
               <Sheet>
                 <SheetTrigger asChild>
                   <Button variant="ghost" size="icon" className="md:hidden"> {/* Show only on small screens */} 
                     <Menu className="h-6 w-6" />
                     <span className="sr-only">Toggle Navigation</span>
                   </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="w-[250px]">
                    <div className="flex items-center p-4 border-b mb-2">
                       <div className="h-8 w-8 mr-2 relative">
                           <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                             <defs>
                               <radialGradient id="glow-sheet" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                                 <stop offset="0%" stopColor="#4B9EFF"/>
                                 <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
                               </radialGradient>
                             </defs>
                             <circle cx="256" cy="256" r="200" fill="url(#glow-sheet)" />
                             <circle cx="200" cy="200" r="20" fill="#FFFFFF"/>
                             <circle cx="312" cy="200" r="20" fill="#FFFFFF"/>
                             <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="15" fill="none" strokeLinecap="round"/>
                           </svg>
                       </div>
                       <span className="font-bold text-lg">aivery</span>
                    </div>
                    <nav className="flex flex-col p-2 space-y-1">
                       {navLinks.map((link) => (
                         <Button key={link.href} variant="ghost" className={cn("justify-start", link.active ? "bg-accent" : "")} asChild>
                           <Link href={link.href} >
                             {link.icon}
                             <span className="ml-2">{link.label}</span>
                           </Link>
                         </Button>
                       ))}
                    </nav>
                 </SheetContent>
               </Sheet>
              {/* User Navigation (for desktop) */}
              <UserNavigation />
            </>
          ) : (
            // Show Login/Signup buttons if not logged in
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                 <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 