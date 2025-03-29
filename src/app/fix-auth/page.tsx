"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function FixAuthPage() {
  const router = useRouter()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  // Load debug info
  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Add cache-busting
        const response = await fetch(`/api/debug-auth?t=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          setDebugInfo(data)
        } else {
          setError("Failed to load auth debug info")
        }
      } catch (e) {
        setError("Error loading auth information")
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDebugInfo()
  }, [])

  // Handle clearing cookies and session
  const handleResetSession = async () => {
    try {
      setIsLoading(true)
      
      // Clear cookies by setting to expired
      document.cookie.split(";").forEach(function(c) {
        if (c.trim().toLowerCase().startsWith("next-auth")) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
        }
      })
      
      // Sign out from next-auth
      await signOut({ redirect: false })
      
      setSuccess(true)
      
      // Allow UI to update before redirect
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (e) {
      setError("Error resetting session: " + String(e))
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Fix Authentication Issues</CardTitle>
          <CardDescription>
            Use this page to resolve login and session problems
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          ) : success ? (
            <div className="p-4 bg-green-100 text-green-800 rounded-md">
              Session successfully reset! Redirecting you to the login page...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted">
                  <h3 className="font-medium mb-2">Session Status</h3>
                  <div className="space-y-1 text-sm">
                    <p>Session exists: {debugInfo?.session?.exists ? "Yes" : "No"}</p>
                    {debugInfo?.session?.user && (
                      <>
                        <p>User ID: {debugInfo.session.user.id}</p>
                        <p>Email: {debugInfo.session.user.email}</p>
                      </>
                    )}
                    <p>Expires: {debugInfo?.session?.expires}</p>
                  </div>
                </div>
                
                <div className="rounded-md p-4 bg-amber-50 text-amber-800">
                  <h3 className="font-medium mb-2">Having trouble?</h3>
                  <p className="mb-2 text-sm">
                    If you're experiencing login loops or authentication issues, clicking the reset button below 
                    will clear your session data and cookies, allowing you to log in fresh.
                  </p>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleResetSession}
                disabled={isLoading}
              >
                Reset Session &amp; Clear Cookies
              </Button>
            </>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between border-t pt-4">
          <Link href="/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
} 