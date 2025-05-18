"use client"

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
      <div className="pt-0">
        {children}
      </div>
    </div>
  )
} 