"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { 
  Calendar, 
  MessageSquare, 
  History, 
  BarChart2, 
  List, 
  Menu, 
  Home,
  TrendingUp,
  Target,
  Settings,
  Zap,
  Plus
} from "lucide-react"
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

  // Enhanced navigation links configuration
  const primaryNavLinks = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <Home className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/dashboard"),
      priority: "high"
    },
    {
      href: "/workouts",
      label: "Workouts",
      icon: <History className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/workouts") || isPath("/workout"),
      priority: "high"
    },
    {
      href: "/exercises",
      label: "Exercises",
      icon: <List className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/exercises"),
      priority: "medium"
    },
    {
      href: "/chat",
      label: "AI Coach",
      icon: <MessageSquare className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/chat"),
      priority: "high"
    }
  ]

  // Secondary navigation for analytics and planning
  const secondaryNavLinks = [
    {
      href: "/analytics",
      label: "Analytics",
      icon: <TrendingUp className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/analytics"),
      category: "insights"
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: <Calendar className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/calendar"),
      category: "planning"
    },
    {
      href: "/plan",
      label: "Plans",
      icon: <Target className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/plan") || isPath("/planner"),
      category: "planning"
    },
    {
      href: "/challenges",
      label: "Challenges",
      icon: <Zap className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/challenges"),
      category: "motivation"
    },
    {
      href: "/settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/settings"),
      category: "account"
    }
  ]

  // Quick action links
  const quickActions = [
    {
      href: "/workouts/new",
      label: "Log Workout",
      icon: <Plus className="h-4 w-4" />,
      variant: "default" as const
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

  // Prevent render errors during loading state
  if (isLoading && !isLandingPage) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 animate-pulse" />
             <span className="font-bold text-xl ml-2 opacity-0">Aivery</span>
          </div>
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
          
          {/* Desktop Navigation - Primary links only */}
          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {primaryNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    link.active
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Divider */}
              <div className="h-6 w-px bg-border mx-2" />
              
              {/* Quick Action Button */}
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button size="sm" className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    {action.icon}
                    <span className="ml-2 hidden xl:inline">{action.label}</span>
                  </Button>
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
              {/* Mobile Menu Trigger */}
               <Sheet>
                 <SheetTrigger asChild>
                   <Button variant="ghost" size="icon" className="lg:hidden">
                     <Menu className="h-6 w-6" />
                     <span className="sr-only">Toggle Navigation</span>
                   </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="w-[280px]">
                    {/* Header */}
                    <div className="flex items-center p-4 border-b mb-4">
                       <div className="h-8 w-8 mr-3 relative">
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
                    
                    {/* Primary Navigation */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                         Main
                       </div>
                       {primaryNavLinks.map((link) => (
                         <Button 
                           key={link.href} 
                           variant="ghost" 
                           className={cn(
                             "justify-start h-10",
                             link.active ? "bg-accent text-accent-foreground" : ""
                           )} 
                           asChild
                         >
                           <Link href={link.href}>
                             {link.icon}
                             <span className="ml-3">{link.label}</span>
                           </Link>
                         </Button>
                       ))}
                    </nav>

                    {/* Secondary Navigation by Category */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                         Analytics & Planning
                       </div>
                       {secondaryNavLinks.filter(link => link.category === 'insights' || link.category === 'planning').map((link) => (
                         <Button 
                           key={link.href} 
                           variant="ghost" 
                           className={cn(
                             "justify-start h-10",
                             link.active ? "bg-accent text-accent-foreground" : ""
                           )} 
                           asChild
                         >
                           <Link href={link.href}>
                             {link.icon}
                             <span className="ml-3">{link.label}</span>
                           </Link>
                         </Button>
                       ))}
                    </nav>

                    {/* Other Features */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                         More
                       </div>
                       {secondaryNavLinks.filter(link => link.category === 'motivation' || link.category === 'account').map((link) => (
                         <Button 
                           key={link.href} 
                           variant="ghost" 
                           className={cn(
                             "justify-start h-10",
                             link.active ? "bg-accent text-accent-foreground" : ""
                           )} 
                           asChild
                         >
                           <Link href={link.href}>
                             {link.icon}
                             <span className="ml-3">{link.label}</span>
                           </Link>
                         </Button>
                       ))}
                    </nav>

                    {/* Quick Actions */}
                    <div className="border-t pt-4">
                       <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                         Quick Actions
                       </div>
                       {quickActions.map((action) => (
                         <Button 
                           key={action.href} 
                           variant={action.variant}
                           className="w-full justify-start h-10" 
                           asChild
                         >
                           <Link href={action.href}>
                             {action.icon}
                             <span className="ml-3">{action.label}</span>
                           </Link>
                         </Button>
                       ))}
                    </div>
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