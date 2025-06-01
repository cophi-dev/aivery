"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Icons } from "@/components/icons"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { InlineSpinner } from "@/components/ui/inline-spinner"

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const searchParams = useSearchParams()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  
  // Get callback URL from search params
  const callbackUrl = searchParams?.get("callbackUrl") || "/"

  // Check URL parameters
  useEffect(() => {
    // Check for error parameter
    const errorParam = searchParams?.get("error")
    if (errorParam === "session_required") {
      setError("You need to be logged in to access that page.")
    }
    
    // Check for logout parameter
    const logoutParam = searchParams?.get("logout")
    if (logoutParam === "true") {
      setSuccess("You have been successfully logged out.")
      
      // Replace URL without the parameter to prevent seeing the message on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete("logout")
      window.history.replaceState({}, "", url)
    }

    // Check for registration success with premium flag
    const registeredParam = searchParams?.get("registered")
    const premiumParam = searchParams?.get("premium")
    if (registeredParam === "true" && premiumParam === "true") {
      setSuccess("Account created successfully! Please sign in to start your premium subscription.")
    } else if (registeredParam === "true") {
      setSuccess("Account created successfully! Please sign in.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
      setIsRedirecting(true);
      
      // Wait a moment then redirect
      setTimeout(() => {
        router.replace(callbackUrl);
      }, 800);
      
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  // Check if running in development
  const isDev = process.env.NODE_ENV === 'development'

  // TODO: Add loading state based on session status if needed
  const isLoadingInitial = false; // Placeholder - Replace with actual session loading check if applicable

  if (isLoadingInitial) {
    return <LoadingIndicator />;
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
            disabled={loading}
          >
            {loading && <InlineSpinner size={16} className="mr-2" />}
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
        </form>
      </div>
    </div>
  )
} 