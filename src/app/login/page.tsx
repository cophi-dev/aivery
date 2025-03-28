"use client"

import { useState, useEffect } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Icons } from "@/components/icons"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  
  // Track whether a login has been attempted in this session
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false)
  
  // Get callback URL from search params
  const callbackUrl = searchParams?.get("callbackUrl") || "/"

  // Check for error parameter in URL
  useEffect(() => {
    const errorParam = searchParams?.get("error")
    if (errorParam === "session_required") {
      setError("You need to be logged in to access that page.")
    }
  }, [searchParams])

  // Handle redirection if already authenticated
  useEffect(() => {
    // Only redirect if authenticated and not in the middle of login or reset
    if (status === 'authenticated' && session?.user?.id && !loading && !isResetting && !isRedirecting) {
      // Don't redirect if we just logged in (prevent loops)
      if (hasAttemptedLogin) {
        return;
      }
      
      console.log("Already authenticated, redirecting to:", callbackUrl);
      setIsRedirecting(true);
      
      // Add small delay to prevent UI flashing
      const timer = setTimeout(() => {
        router.replace(callbackUrl);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [status, session, router, callbackUrl, loading, isResetting, isRedirecting, hasAttemptedLogin]);

  // Emergency reset function that works directly on this page
  const resetEverything = async () => {
    setIsResetting(true)
    setError(null)
    
    try {
      // Force sign out from NextAuth
      await signOut({ redirect: false });
      
      // Clear all cookies - more thorough approach
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=')
        if (name.trim()) {
          // Clear for all possible domains and paths
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=localhost`
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.localhost`
        }
      })
      
      // Clear storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Log the action
      console.log("Session reset completed")
      
      // Success message
      setSuccess("All session data cleared. Refreshing in 2 seconds...")
      
      // Force a complete page refresh after a delay
      setTimeout(() => {
        window.location.href = '/login?reset=true'
      }, 2000)
    } catch (error) {
      console.error("Error during reset:", error)
      setError("Failed to reset session. Please try refreshing the page manually.")
      setIsResetting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    // Mark that a login has been attempted
    setHasAttemptedLogin(true)

    try {
      // Use callbackUrl parameter for clean redirection handling by NextAuth
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl
      })

      if (!result?.ok) {
        setError(result?.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Success message
      setSuccess("Login successful! Redirecting...");
      
      // Set a flag in session storage to prevent redirect loops
      sessionStorage.setItem('just_logged_in', 'true');
      
      // Wait a moment then redirect
      setTimeout(() => {
        router.replace(callbackUrl);
      }, 1000);
      
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  // Show a loading state if redirecting
  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Icons.spinner className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-md p-6 bg-background rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link 
                href="/forgot-password" 
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || isResetting}
          >
            {loading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
          
          <div className="mt-4 text-center text-sm">
            <span className="mr-1">Don&apos;t have an account?</span>
            <Link
              aria-label="Sign up"
              href="/register"
              className="text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign up
            </Link>
          </div>
          
          <div className="flex justify-center mt-4">
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={resetEverything}
              disabled={isResetting}
              className="text-xs"
            >
              {isResetting ? 
                <><Icons.spinner className="mr-2 h-3 w-3 animate-spin" /> Resetting...</> : 
                <>Fix Login Loop: Reset Session Data</>
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 