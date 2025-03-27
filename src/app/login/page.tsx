"use client"

import { useState, useEffect } from "react"
import { signIn, signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { Icons } from "@/components/icons"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // Emergency reset function that works directly on this page
  const resetEverything = async () => {
    setIsResetting(true)
    
    try {
      // Force sign out
      await signOut({ redirect: false });
      
      // Clear all cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=')
        if (name.trim()) {
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=localhost`
        }
      })
      
      // Clear storage
      localStorage.clear()
      sessionStorage.clear()
      
      setSuccess("All session data cleared. Please try logging in again.")
      setIsResetting(false)
    } catch (error) {
      console.error("Error during reset:", error)
      setError("Failed to reset session. Try refreshing the page.")
      setIsResetting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
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

      // Force reload instead of client navigation
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  // If we detect we're already logged in, go to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      window.location.href = '/dashboard';
    }
  }, [status, session]);

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