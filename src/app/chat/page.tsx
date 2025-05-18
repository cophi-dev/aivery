"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ChatPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push("/chat/ai")
  }, [router])
  
  // Return empty div while redirecting
  return <div className="h-screen w-full"></div>
}

