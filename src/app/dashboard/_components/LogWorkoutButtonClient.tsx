'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogWorkoutButton() {
  return (
    <Card className={cn(
      "bg-primary text-primary-foreground",
      "hover:shadow-lg transition-shadow duration-200"
    )}>
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Content */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold">
              Ready to train?
            </h2>
            <p className="text-primary-foreground/90 text-base">
              Log your workout and track your progress with AI-powered insights
            </p>
          </div>
          
          {/* CTA Button */}
          <Link href="/workouts/new">
            <Button
              size="lg"
              variant="secondary"
              className={cn(
                "h-12 px-6 text-base font-semibold",
                "bg-white text-primary",
                "hover:bg-white/95",
                "shadow-sm hover:shadow-md",
                "transition-all duration-200 group"
              )}
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Log Workout
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </Link>
        </div>
        
        {/* Simple feature list */}
        <div className="mt-6 pt-4 border-t border-primary-foreground/20">
          <div className="flex items-center justify-center sm:justify-start gap-6 text-primary-foreground/80 text-sm">
            <span>📊 Track any activity</span>
            <span>🤖 Get instant insights</span>
            <span>📈 Build consistency</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 