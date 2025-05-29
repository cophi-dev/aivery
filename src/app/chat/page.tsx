"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Preserve URL parameters when redirecting
    const params = searchParams?.toString() || ""
    const redirectUrl = params ? `/chat/ai?${params}` : "/chat/ai"
    router.push(redirectUrl)
  }, [router, searchParams])
  
  // Return empty div while redirecting
  return <div className="h-screen w-full"></div>
}

