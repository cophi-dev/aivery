"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-[65px] left-0 right-0 z-10 bg-background border-b border-border">
        <div className="container mx-auto flex items-center justify-center">
          <nav className="flex">
            <Link 
              href="/chat" 
              className={cn(
                "px-4 py-2 font-medium text-sm transition-colors",
                pathname === "/chat" 
                  ? "text-foreground border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Classic Chat
            </Link>
            <Link 
              href="/chat/ai" 
              className={cn(
                "px-4 py-2 font-medium text-sm transition-colors",
                pathname === "/chat/ai" 
                  ? "text-foreground border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              AI Assistant
            </Link>
          </nav>
        </div>
      </div>
      <div className="pt-10">
        {children}
      </div>
    </div>
  )
} 