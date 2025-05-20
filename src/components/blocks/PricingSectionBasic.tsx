"use client"

import { Check, ChevronRight, CreditCard, Crown, ExternalLink, Heart, Shield, ShoppingCart, Stars } from "lucide-react"
import { SinglePricingCard, type Testimonial } from "@/components/blocks/single-pricing-card"

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

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Alex Johnson",
      role: "Marathon Runner",
      company: "Boston Qualifier",
      content:
        "Aivery helped me track my marathon training with incredible precision. The AI-generated insights showed me patterns I never would have noticed on my own. My finishing time improved by 12 minutes!",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    },
    {
      id: 2,
      name: "Sarah Miller",
      role: "CrossFit Athlete",
      company: "Level 2 Certified",
      content:
        "The muscle group analysis feature showed me I was neglecting posterior chain exercises. After following Aivery's recommendations, my performance improved dramatically across all my WODs.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    },
    {
      id: 3,
      name: "Michael Chen",
      role: "Powerlifter",
      company: "State Champion",
      content:
        "Tracking my strength progress has never been easier. Aivery automatically identifies PRs and gives me actionable advice on how to keep progressing. The €6,90/month is easily worth it.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/46.jpg",
    },
    {
      id: 4,
      name: "Emily Rodriguez",
      role: "Yoga Instructor",
      company: "Wellness Studio",
      content:
        "I use Aivery to track my strength training alongside my yoga practice. The weekly insights help me maintain balance in my training and have helped prevent overtraining injuries.",
      rating: 4,
      avatar: "https://randomuser.me/api/portraits/women/65.jpg",
    },
    {
      id: 5,
      name: "David Park",
      role: "Triathlete",
      company: "Ironman Finisher",
      content:
        "Managing training across swimming, cycling, and running used to be a nightmare. With Aivery's Strava integration and multi-sport tracking, I can focus on training instead of logging workouts.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/22.jpg",
    },
    {
      id: 6,
      name: "Olivia Martinez",
      role: "Recreational Runner",
      company: "Weekend Warrior",
      content:
        "As someone who just runs for fun, Aivery makes fitness tracking accessible and motivating. The real-world distance comparisons make my achievements feel tangible and meaningful.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/women/24.jpg",
    },
  ]

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
          primaryButton={{
            text: "Start Free Trial",
            icon: ShoppingCart,
            chevronIcon: ChevronRight,
          }}
          secondaryButton={{
            text: "View Demo",
            icon: ExternalLink,
            href: "#",
          }}
          testimonials={testimonials}
          testimonialRotationSpeed={5000}
        />
      </div>
    </section>
  )
} 