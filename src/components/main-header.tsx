"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Calendar, MessageSquare, History, BarChart2, List } from "lucide-react"
import { UserNavigation } from "./user-navigation"
import Image from "next/image"

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

  // Prevent render errors during loading state
  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <div className="w-8 h-8 relative">
                <div className="w-8 h-8 rounded-full bg-primary/10 animate-pulse" />
              </div>
              <span className="font-bold text-xl ml-2">Aivery</span>
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
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-0 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <div className="w-8 h-8 relative">
              <Image
                src="/icon.svg"
                alt="Aivery"
                width={32}
                height={32}
                priority
              />
            </div>
            <span className="font-bold text-xl ml-2">Aivery</span>
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