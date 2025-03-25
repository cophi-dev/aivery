"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserAccountNav } from "@/components/user-account-nav"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { User } from "next-auth"
import { Dumbbell, Calendar, MessageSquare } from "lucide-react"

interface MainHeaderProps {
  user: Pick<User, "name" | "email" | "image"> | null
}

export function MainHeader({ user }: MainHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center mr-6">
            <Dumbbell className="h-5 w-5 mr-2 text-primary" />
            <span className="font-bold text-lg">Aivery</span>
          </Link>
          
          {/* Only show nav links when user is logged in */}
          {user && (
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/workout"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname.startsWith("/workout") ? "text-foreground" : "text-foreground/60"
                )}
              >
                Workouts
              </Link>
              <Link
                href="/plan"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname.startsWith("/plan") ? "text-foreground" : "text-foreground/60"
                )}
              >
                Plans
              </Link>
              <Link
                href="/calendar"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:text-foreground",
                  pathname.startsWith("/calendar") ? "text-foreground" : "text-foreground/60"
                )}
              >
                <Calendar className="h-4 w-4" />
                <span>Calendar</span>
              </Link>
              <Link
                href="/chat"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname.startsWith("/chat") ? "text-foreground" : "text-foreground/60"
                )}
              >
                AI Coach
              </Link>
            </nav>
          )}
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          {user ? (
            <UserAccountNav user={user} />
          ) : (
            <div className="flex items-center space-x-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 