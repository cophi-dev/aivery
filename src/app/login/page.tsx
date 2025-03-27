"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Icons } from "@/components/icons"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const isRegistered = searchParams?.get('registered') === 'true'
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(isRegistered ? "Registration successful! Please log in." : null)

  // Simpler session detection with direct redirect, no loops
  useEffect(() => {
    // Only redirect if we're definitely logged in
    if (status === 'authenticated' && session?.user?.id) {
      // Simple direct navigation
      window.location.href = '/dashboard';
    }
  }, [status, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Simple authentication - no redirect specified
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (!result?.ok) {
        setError(result?.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Success - set flag for a moment to show success message
      setSuccess("Login successful!");
      
      // Wait a moment then refresh the page completely
      setTimeout(() => {
        // Force complete refresh to get fresh session
        window.location.href = '/dashboard';
      }, 1000);
      
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    )
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
              autoComplete="email"
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
              autoComplete="current-password"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
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
          
          <div className="flex justify-center mt-2">
            <Link href="/reset">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Getting HTTP 431 errors? Click here to reset session
              </Button>
            </Link>
          </div>
          
          <div className="flex justify-center mt-6">
            <Link href="/health">
              <Button variant="outline" size="sm" className="gap-2">
                <Icons.question className="h-4 w-4" />
                Having trouble? Check system status
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
} 