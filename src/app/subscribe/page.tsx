'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UpgradeButton } from '@/components/UpgradeButton';
import { 
  Crown, 
  Sparkles, 
  Activity, 
  BarChart3, 
  Calendar, 
  MessageSquare,
  Zap,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react';

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPath = searchParams?.get('from');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      // Not logged in - redirect to login with return path
      const loginUrl = fromPath 
        ? `/login?callbackUrl=${encodeURIComponent(fromPath)}`
        : '/login?callbackUrl=/subscribe';
      router.push(loginUrl);
    } else if (status === 'authenticated') {
      setIsLoading(false);
    }
  }, [status, router, fromPath]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-body-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "AI-Powered Insights",
      description: "Get personalized workout recommendations and insights powered by advanced AI"
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Advanced Analytics",
      description: "Track your progress with detailed charts, trends, and performance metrics"
    },
    {
      icon: <Activity className="w-5 h-5" />,
      title: "Unlimited Workouts",
      description: "Log unlimited workouts across all activity types - strength, cardio, and more"
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      title: "Smart Planning",
      description: "AI-generated training plans tailored to your goals and schedule"
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "AI Coaching Chat",
      description: "Get instant answers and coaching advice from your personal AI trainer"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Strava Integration",
      description: "Seamlessly sync your activities and get deeper insights on your data"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Crown className="w-8 h-8 text-primary" />
            <Badge variant="secondary" className="px-3 py-1">
              Premium Only
            </Badge>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Premium Fitness
            </span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Aivery is a premium-only platform designed for serious fitness enthusiasts. 
            Get unlimited access to AI-powered insights, advanced analytics, and personalized coaching.
          </p>

          {fromPath && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8 max-w-md mx-auto">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <Star className="w-4 h-4 inline mr-2" />
                Upgrade to access <strong>{decodeURIComponent(fromPath)}</strong> and unlock all premium features
              </p>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-2">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pricing Card */}
        <Card className="max-w-md mx-auto border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Premium Access</CardTitle>
            <CardDescription className="text-base">
              Everything you need to reach your fitness goals
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold">€6.90</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>

            <div className="space-y-3 mb-8">
              {[
                "Unlimited workout logging",
                "AI-powered insights & coaching",
                "Advanced analytics & progress tracking",
                "Personalized training plans",
                "Strava integration",
                "Priority support"
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <UpgradeButton 
              plan="premium" 
              currentPlanIsFree={true} 
              className="w-full font-semibold py-3"
            >
              Start Premium Journey
              <ArrowRight className="w-4 h-4 ml-2" />
            </UpgradeButton>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Secure payment powered by Stripe. Cancel anytime.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground mb-4">
            Have questions? Contact us at{' '}
            <a href="mailto:support@aivery.app" className="text-primary hover:underline">
              support@aivery.app
            </a>
          </p>
          
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <span className="text-border">•</span>
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 