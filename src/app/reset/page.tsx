"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icons } from "@/components/icons"
import { Header } from "@/components/header"
import { LoadingIndicator } from "@/components/ui/loading-indicator"

export default function ResetPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Resetting session...")
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const resetAll = async () => {
      try {
        setStatus("Clearing browser data...")
        
        // Clear localStorage and sessionStorage
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all cookies
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.split('=')
          if (name.trim()) {
            document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          }
        })
        
        // Call our server API to reset session server-side
        setStatus("Resetting session on server...")
        const response = await fetch('/api/reset-session')
        await response.json()
        
        // Wait a moment before redirecting
        setStatus("Session reset complete. Redirecting to login...")
        
        // Force browser refresh to login page
        setTimeout(() => {
          window.location.href = "/login"
        }, 2000)
      } catch (error) {
        console.error("Error during reset:", error)
        setStatus("Error occurred. Trying to continue...")
        
        // Try to redirect anyway
        setTimeout(() => {
          window.location.href = "/login"
        }, 2000)
      }
    }
    
    resetAll()
  }, [router])
  
  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <LoadingIndicator />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center max-w-md p-6 bg-background rounded-lg shadow-lg">
        <h1 className="mt-4 text-2xl font-bold">{status}</h1>
        <p className="mt-2 text-muted-foreground">
          This helps fix login issues by clearing all session data.
        </p>
      </div>
    </div>
  )
} 