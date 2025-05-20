"use client"

import { Check, CreditCard, Crown, Heart, Shield, Stars } from "lucide-react"
import { SinglePricingCard } from "@/components/blocks/single-pricing-card"
import React from "react"

export function PricingSectionBasic() {
  const features = [
    "Unlimited workout tracking",
    "AI-powered performance insights",
    "Weekly progress reports",
    "Strava integration",
    "Personal records tracking",
    "Muscle group analysis",
    "Exercise library access",
    "Custom workout templates",
    "Performance comparisons",
    "Historical data analysis",
    "Mobile optimized dashboard",
    "Priority support",
  ].map((text) => ({ text }))

  return (
    <section className="py-24 relative overflow-hidden flex justify-center" id="pricing">
      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="inline-flex items-center gap-1 px-3 py-1 mb-4 rounded-full border border-primary/20 shadow-sm">
            <CreditCard className="mr-1 h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">Simple Pricing</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">
            Elevate your fitness journey
          </h2>
          <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
            Unlock advanced AI insights and personalized coaching for optimal performance
          </p>
        </div>

        <SinglePricingCard
          badge={{
            icon: Crown,
            text: "Premium Plan",
          }}
          title="Aivery Premium"
          subtitle="Transform your workout data into actionable fitness intelligence"
          price={{
            current: "€6,90/month",
          }}
          benefits={[
            {
              text: "Monthly subscription, cancel anytime",
              icon: Check,
            },
            {
              text: "14-day free trial, no credit card required",
              icon: Shield,
            },
            {
              text: "Built by athletes for athletes",
              icon: Heart,
            },
          ]}
          features={features}
          featuresIcon={Check}
          featuresBadge={{
            icon: Stars,
            text: "All Features",
          }}
        />
      </div>
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -left-12 opacity-[0.03] hidden lg:block">
        <svg width="180" height="180" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-12">
          <defs>
            <radialGradient id="logoGlowPricingBg1" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
              <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
              <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
            </radialGradient>
          </defs>
          <circle cx="256" cy="256" r="200" fill="url(#logoGlowPricingBg1)" />
          <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
          <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
          <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
        </svg>
      </div>
      <div className="absolute bottom-1/4 -right-12 opacity-[0.03] hidden lg:block">
        <svg width="140" height="140" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-45">
          <defs>
            <radialGradient id="logoGlowPricingBg2" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
              <stop offset="0%" stopColor="#4B9EFF" stopOpacity="1"/>
              <stop offset="70%" stopColor="#0066FF" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2"/>
            </radialGradient>
          </defs>
          <circle cx="256" cy="256" r="200" fill="url(#logoGlowPricingBg2)" />
          <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
          <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
          <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
        </svg>
      </div>
    </section>
  )
} 