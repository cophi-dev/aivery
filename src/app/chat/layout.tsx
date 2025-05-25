"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Metadata } from 'next'
import { generateMetadata } from '@/lib/utils/metadata'

export const metadata: Metadata = generateMetadata({
  title: "AI Coach | Aivery",
  description: "Chat with your AI fitness coach for personalized workout advice, training insights, and goal-oriented fitness guidance. Get expert recommendations tailored to your progress.",
  path: "/chat",
  keywords: ["AI coach", "fitness advice", "workout guidance", "personalized training", "AI assistant"],
  type: "website"
})

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
} 