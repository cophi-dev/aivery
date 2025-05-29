'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogWorkoutButton() {
  return (
    <div className={cn(
      "group relative overflow-hidden",
      "bg-gradient-to-br from-primary to-primary/90",
      "rounded-subtle p-8 md:p-10",
      "hover:shadow-xl transition-all duration-300",
      "border border-primary/20"
    )}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
      
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Content */}
        <div className="flex-1 space-y-3">
          <h2 className="text-heading-lg text-primary-foreground font-medium tracking-tight">
            Ready to train?
          </h2>
          <p className="text-body-md text-primary-foreground/90 leading-relaxed max-w-md">
            Log your workout and track your progress with AI-powered insights
          </p>
          
          {/* Features */}
          <div className="flex flex-wrap gap-4 pt-2">
            <span className="inline-flex items-center gap-2 text-body-sm text-primary-foreground/80">
              <div className="w-1.5 h-1.5 bg-primary-foreground/60 rounded-full" />
              Track any activity
            </span>
            <span className="inline-flex items-center gap-2 text-body-sm text-primary-foreground/80">
              <div className="w-1.5 h-1.5 bg-primary-foreground/60 rounded-full" />
              Get instant insights
            </span>
            <span className="inline-flex items-center gap-2 text-body-sm text-primary-foreground/80">
              <div className="w-1.5 h-1.5 bg-primary-foreground/60 rounded-full" />
              Build consistency
            </span>
          </div>
        </div>
        
        {/* CTA Button */}
        <Link href="/workouts/new">
          <Button
            size="lg"
            variant="secondary"
            className={cn(
              "h-12 px-8 text-body-md font-medium",
              "bg-white/95 text-primary border-0",
              "hover:bg-white hover:scale-[1.02]",
              "shadow-lg hover:shadow-xl",
              "transition-all duration-200 group/btn backdrop-blur-sm"
            )}
          >
            <PlusCircle className="w-5 h-5 mr-3" />
            Log Workout
            <ArrowRight className="w-4 h-4 ml-3 group-hover/btn:translate-x-1 transition-transform duration-200" />
          </Button>
        </Link>
      </div>
    </div>
  );
} 