"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Dumbbell, Calendar, MessageSquare, History, BarChart2, List } from "lucide-react"
import { UserNavigation } from "./user-navigation"

export function MainHeader() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const user = session?.user

  // Safety check for pathname to fix deployment error
  const isPath = (path: string) => {
    return pathname ? pathname.startsWith(path) : false
  }

  // Add proper error handling for session loading
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!user;

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
          
          {/* Only show nav links when user is logged in */}
          {user && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="/workouts"
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isPath("/workouts") || isPath("/workout") ? "text-foreground bg-accent/50" : "text-foreground/70"
                )}
              >
                <History className="h-4 w-4" />
                <span>Workout History</span>
              </Link>
              <Link
                href="/exercises"
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isPath("/exercises") ? "text-foreground bg-accent/50" : "text-foreground/70"
                )}
              >
                <List className="h-4 w-4" />
                <span>Exercises</span>
              </Link>
              <Link
                href="/plan"
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isPath("/plan") ? "text-foreground bg-accent/50" : "text-foreground/70"
                )}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Planner</span>
              </Link>
              <Link
                href="/chat"
                className={cn(
                  "flex items-center gap-1.5 py-1 px-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isPath("/chat") ? "text-foreground bg-accent/50" : "text-foreground/70"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </Link>
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-3">
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