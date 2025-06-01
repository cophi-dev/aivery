"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import LegalModal from "@/components/legal/LegalModal"
import Link from "next/link"
import { Crown, Sparkles, Activity, BarChart3 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!termsAccepted) {
      setError("You must accept the Terms and Conditions and Privacy Policy")
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong")
      }

      // Redirect to login with a premium signup flag
      router.push("/login?registered=true&premium=true")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong")
      setLoading(false)
    }
  }

  const premiumFeatures = [
    { icon: <Sparkles className="w-4 h-4" />, text: "AI-Powered Insights" },
    { icon: <BarChart3 className="w-4 h-4" />, text: "Advanced Analytics" },
    { icon: <Activity className="w-4 h-4" />, text: "Unlimited Workouts" }
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          
          {/* Premium Badge */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <Crown className="w-6 h-6 text-primary" />
              <Badge variant="default" className="px-3 py-1">
                Premium Only
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">Join Aivery Premium</h1>
            <p className="text-muted-foreground mt-2">Create your account to access premium features</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="terms" className="text-sm flex flex-wrap items-center">
                I accept the {" "}
                <LegalModal 
                  documentType="terms"
                  buttonVariant="link"
                  buttonSize="sm"
                  className="h-auto px-1 py-0 font-normal"
                />
                {" "} and {" "}
                <LegalModal 
                  documentType="privacy"
                  buttonVariant="link"
                  buttonSize="sm"
                  className="h-auto px-1 py-0 font-normal"
                />
              </label>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Premium Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Premium Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-12 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
            <Crown className="w-10 h-10 text-primary" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Premium Fitness Platform</h2>
          <p className="text-muted-foreground mb-8">
            Aivery is designed exclusively for serious fitness enthusiasts who want 
            AI-powered insights and advanced analytics.
          </p>

          <div className="space-y-4">
            {premiumFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {feature.icon}
                </div>
                <span className="font-medium">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-background/50 backdrop-blur-sm rounded-lg border">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">€6.90</div>
              <div className="text-sm text-muted-foreground">per month</div>
              <p className="text-xs text-muted-foreground mt-2">
                Full access after account creation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 