"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Dumbbell, Calendar, MessageSquare, History, BarChart2, List, Menu, X } from "lucide-react"
import { UserNavigation } from "./user-navigation"
import { useState } from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MainHeader() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const user = session?.user
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      label: "Workout History",
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
      href: "/plan",
      label: "Planner",
      icon: <BarChart2 className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/plan")
    },
    {
      href: "/chat",
      label: "Chat",
      icon: <MessageSquare className="h-5 w-5 md:h-4 md:w-4" />,
      active: isPath("/chat")
    }
  ]

  // Prevent render errors during loading state
  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <Dumbbell className="h-6 w-6 mr-2 text-primary" />
              <span className="font-bold text-xl">Aivery</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <Dumbbell className="h-6 w-6 mr-2 text-primary" />
            <span className="font-bold text-xl">Aivery</span>
          </Link>
          
          {/* Desktop navigation - only show when user is logged in */}
          {user && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
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
        
        <div className="flex items-center gap-3">
          {/* Mobile menu burger icon */}
          {user && (
            <div className="md:hidden flex items-center mr-1">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                  <div className="py-6 px-2 flex flex-col gap-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                      <Dumbbell className="h-6 w-6 text-primary" />
                      <span className="font-bold text-xl">Aivery</span>
                    </div>
                    <nav className="flex flex-col space-y-3">
                      {navLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={cn(
                            "flex items-center gap-3 py-2 px-3 rounded-md transition-colors hover:bg-accent",
                            link.active ? "bg-accent" : ""
                          )}
                        >
                          {link.icon}
                          <span className="font-medium">{link.label}</span>
                        </Link>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}

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