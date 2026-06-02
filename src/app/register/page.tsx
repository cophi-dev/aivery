"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import LegalModal from "@/components/legal/LegalModal"
import Link from "next/link"
import { Activity, BarChart3, MessageSquare } from "lucide-react"

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong")
      }

      router.push("/login?registered=true")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  const highlights = [
    { icon: <MessageSquare className="w-4 h-4" />, text: "AI coaching on your real workout data" },
    { icon: <BarChart3 className="w-4 h-4" />, text: "Progress tracking and insights" },
    { icon: <Activity className="w-4 h-4" />, text: "Strava sync included" },
  ]

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-primary mb-2">Free for everyone</p>
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Sign up to log workouts, connect Strava, and use the AI coach
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
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
                placeholder="you@example.com"
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
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="terms" className="text-sm leading-snug">
                I accept the{" "}
                <LegalModal
                  documentType="terms"
                  buttonVariant="link"
                  buttonSize="sm"
                  className="h-auto px-1 py-0 font-normal"
                />{" "}
                and{" "}
                <LegalModal
                  documentType="privacy"
                  buttonVariant="link"
                  buttonSize="sm"
                  className="h-auto px-1 py-0 font-normal"
                />
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-accent/30 p-12 items-center justify-center border-l border-border/40">
        <div className="max-w-sm space-y-6">
          <h2 className="text-xl font-semibold">Everything included</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No paid tiers. Create an account and use the full app — workout logging,
            Strava import, analytics, and Grok-powered coaching.
          </p>
          <ul className="space-y-3">
            {highlights.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {item.icon}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
