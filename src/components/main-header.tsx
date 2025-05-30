"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion"
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
  Plus,
  Share2
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
      href: "/share",
      label: "Share Moments",
      icon: <Share2 className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/share"),
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
      <motion.header 
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 animate-pulse" />
             <span className="font-serif text-xl ml-2 opacity-0">aivery</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 animate-pulse" />
        </div>
      </motion.header>
    );
  }

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-50 w-full",
        isLandingPage
          ? "bg-gradient-to-r from-background via-background to-background/95 border-b border-blue-100/50 dark:border-blue-900/30"
          : "border-b border-blue-200/30 dark:border-blue-800/30 bg-gradient-to-r from-background/95 via-background/98 to-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-indigo-500/30 to-blue-500/20" />
      
      <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
        {/* Left Section (Logo + Desktop Nav) */}
        <div className="flex items-center gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-3 group">
              <div ref={logoRef} className="h-10 w-10 relative transition-transform duration-300 group-hover:scale-110">
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
              <span className={cn(
                "font-serif text-xl tracking-tight transition-colors duration-300", 
                isLandingPage ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-900 dark:text-neutral-100",
                "group-hover:text-blue-600 dark:group-hover:text-blue-400"
              )}>
                aivery
              </span>
            </Link>
          </motion.div>
          
          {/* Desktop Navigation - Primary links only */}
          {user && (
            <motion.nav 
              className="hidden lg:flex items-center gap-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              {primaryNavLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 relative group",
                      link.active
                        ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                        : "text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20"
                    )}
                  >
                    {link.label}
                    {link.active && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-blue-100/30 to-indigo-100/30 dark:from-blue-800/20 dark:to-indigo-800/20 rounded-xl -z-10"
                        layoutId="activeNavItem"
                        transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                      />
                    )}
                  </Link>
                </motion.div>
              ))}
              
              {/* Enhanced Divider */}
              <motion.div 
                className="h-8 w-px bg-gradient-to-b from-blue-200/50 via-blue-300/70 to-blue-200/50 dark:from-blue-800/50 dark:via-blue-700/70 dark:to-blue-800/50 mx-3"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: 0.8, duration: 0.3 }}
              />
              
              {/* Enhanced Quick Action Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.3 }}
              >
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href}>
                    <Button 
                      size="sm" 
                      className={cn(
                        "shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl",
                        "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                        "border border-blue-400/50 hover:border-blue-500/50",
                        "group relative overflow-hidden"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {action.icon}
                      <span className="ml-2 hidden xl:inline relative z-10">{action.label}</span>
                    </Button>
                  </Link>
                ))}
              </motion.div>
            </motion.nav>
          )}
        </div>

        {/* Right Section (User Nav / Login/Signup / Mobile Menu) */}
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Enhanced Theme Switch */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <ThemeSwitch />
          </motion.div>
          
          {user ? (
            <>
              {/* Enhanced Mobile Menu Trigger */}
               <Sheet>
                 <SheetTrigger asChild>
                   <motion.div
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ delay: 0.6, duration: 0.3 }}
                   >
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className={cn(
                         "lg:hidden rounded-xl transition-all duration-300",
                         "hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50",
                         "dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
                       )}
                     >
                       <Menu className="h-6 w-6" />
                       <span className="sr-only">Toggle Navigation</span>
                     </Button>
                   </motion.div>
                 </SheetTrigger>
                 <SheetContent 
                   side="left" 
                   className={cn(
                     "w-[280px] border-r border-blue-200/30 dark:border-blue-800/30",
                     "bg-gradient-to-b from-background to-background/95",
                     "backdrop-blur-xl"
                   )}
                 >
                    {/* Enhanced Header */}
                    <motion.div 
                      className="flex items-center p-4 border-b border-blue-200/30 dark:border-blue-800/30 mb-4"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
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
                       <span className="font-serif text-lg tracking-tight">aivery</span>
                    </motion.div>
                    
                    {/* Enhanced Primary Navigation */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <motion.div 
                         className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 px-2"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ delay: 0.1 }}
                       >
                         Main
                       </motion.div>
                       {primaryNavLinks.map((link, index) => (
                         <motion.div
                           key={link.href}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: 0.1 + index * 0.05 }}
                         >
                           <Button 
                             variant="ghost" 
                             className={cn(
                               "justify-start h-11 rounded-xl transition-all duration-300 w-full",
                               link.active 
                                 ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50" 
                                 : "hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20"
                             )} 
                             asChild
                           >
                             <Link href={link.href}>
                               {link.icon}
                               <span className="ml-3 font-medium">{link.label}</span>
                             </Link>
                           </Button>
                         </motion.div>
                       ))}
                    </nav>

                    {/* Enhanced Secondary Navigation by Category */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <motion.div 
                         className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 px-2"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ delay: 0.3 }}
                       >
                         Analytics & Planning
                       </motion.div>
                       {secondaryNavLinks.filter(link => link.category === 'insights' || link.category === 'planning').map((link, index) => (
                         <motion.div
                           key={link.href}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: 0.3 + index * 0.05 }}
                         >
                           <Button 
                             variant="ghost" 
                             className={cn(
                               "justify-start h-11 rounded-xl transition-all duration-300 w-full",
                               link.active 
                                 ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50" 
                                 : "hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20"
                             )} 
                             asChild
                           >
                             <Link href={link.href}>
                               {link.icon}
                               <span className="ml-3 font-medium">{link.label}</span>
                             </Link>
                           </Button>
                         </motion.div>
                       ))}
                    </nav>

                    {/* Enhanced Other Features */}
                    <nav className="flex flex-col space-y-1 mb-6">
                       <motion.div 
                         className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 px-2"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ delay: 0.5 }}
                       >
                         More
                       </motion.div>
                       {secondaryNavLinks.filter(link => link.category === 'motivation' || link.category === 'account').map((link, index) => (
                         <motion.div
                           key={link.href}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: 0.5 + index * 0.05 }}
                         >
                           <Button 
                             variant="ghost" 
                             className={cn(
                               "justify-start h-11 rounded-xl transition-all duration-300 w-full",
                               link.active 
                                 ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50" 
                                 : "hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20"
                             )} 
                             asChild
                           >
                             <Link href={link.href}>
                               {link.icon}
                               <span className="ml-3 font-medium">{link.label}</span>
                             </Link>
                           </Button>
                         </motion.div>
                       ))}
                    </nav>

                    {/* Enhanced Quick Actions */}
                    <motion.div 
                      className="border-t border-blue-200/30 dark:border-blue-800/30 pt-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                    >
                       <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 px-2">
                         Quick Actions
                       </div>
                       {quickActions.map((action, index) => (
                         <motion.div
                           key={action.href}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: 0.7 + index * 0.05 }}
                         >
                           <Button 
                             variant={action.variant}
                             className={cn(
                               "w-full justify-start h-11 rounded-xl",
                               "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                               "border border-blue-400/50 hover:border-blue-500/50 transition-all duration-300"
                             )}
                             asChild
                           >
                             <Link href={action.href}>
                               {action.icon}
                               <span className="ml-3 font-medium">{action.label}</span>
                             </Link>
                           </Button>
                         </motion.div>
                       ))}
                    </motion.div>
                 </SheetContent>
               </Sheet>
              
              {/* Enhanced User Navigation (for desktop) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, duration: 0.3 }}
              >
                <UserNavigation />
              </motion.div>
            </>
          ) : (
            // Enhanced Login/Signup buttons
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Button 
                variant="ghost" 
                asChild
                className="rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all duration-300"
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button 
                asChild
                className={cn(
                  "rounded-xl shadow-lg hover:shadow-xl transition-all duration-300",
                  "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                  "border border-blue-400/50 hover:border-blue-500/50"
                )}
              >
                 <Link href="/register">Sign up</Link>
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.header>
  )
} 