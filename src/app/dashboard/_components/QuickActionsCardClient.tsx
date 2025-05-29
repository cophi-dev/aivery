'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, TrendingUp, Calendar, Target, Sparkles, ChevronRight, Zap } from "lucide-react";
import { cn } from '@/lib/utils';

interface QuickActionsCardProps {
  sendAiMessage: (query: string, context: any) => void;
}

export function QuickActionsCard({ sendAiMessage }: QuickActionsCardProps) {
  const quickActions = [
    {
      id: 'weekly-review',
      title: 'Weekly Review',
      description: 'Get insights on your week',
      icon: TrendingUp,
      color: 'emerald',
      query: "Can you analyze my weekly performance and give me insights?",
      context: { requestType: 'weekly-review', reviewPeriod: '7days' }
    },
    {
      id: 'workout-plan',
      title: 'Workout Plan',
      description: 'Get a custom plan',
      icon: Target,
      color: 'blue',
      query: "Can you create a workout plan for me based on my recent activity?",
      context: { requestType: 'workout-planning' }
    },
    {
      id: 'progress-check',
      title: 'Progress Check',
      description: 'Review your gains',
      icon: Calendar,
      color: 'purple',
      query: "How am I progressing towards my fitness goals?",
      context: { requestType: 'progress-analysis' }
    }
  ];

  const handleActionClick = (action: typeof quickActions[0]) => {
    sendAiMessage(action.query, action.context);
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        border: 'border-emerald-200/50 dark:border-emerald-800/30',
        icon: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        hover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40',
        accent: 'bg-emerald-500'
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/20',
        border: 'border-blue-200/50 dark:border-blue-800/30',
        icon: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        hover: 'hover:bg-blue-100/80 dark:hover:bg-blue-900/40',
        accent: 'bg-blue-500'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/20',
        border: 'border-purple-200/50 dark:border-purple-800/30',
        icon: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        hover: 'hover:bg-purple-100/80 dark:hover:bg-purple-900/40',
        accent: 'bg-purple-500'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200 border-0 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              AI Coach
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Get personalized insights
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {quickActions.map((action, index) => {
          const colors = getColorClasses(action.color);
          const IconComponent = action.icon;
          
          return (
            <div key={action.id} className="relative group">
              <Button
                variant="ghost"
                onClick={() => handleActionClick(action)}
                className={cn(
                  "w-full justify-between h-auto p-4 rounded-xl",
                  colors.bg,
                  colors.border,
                  colors.hover,
                  "border transition-all duration-200 group-hover:shadow-sm group-hover:scale-[1.02]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-lg", colors.iconBg, "transition-transform duration-200 group-hover:scale-110")}>
                    <IconComponent className={cn("h-4 w-4", colors.icon)} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm text-foreground">
                      {action.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              
              {/* Progress indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-muted-foreground/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          );
        })}
        
        {/* Enhanced chat prompt */}
        <div className="pt-4 mt-4 border-t border-border/30">
          <Button
            variant="outline"
            onClick={() => sendAiMessage("Hello! I'd like to chat about my fitness progress.", { requestType: 'general-chat' })}
            className="w-full justify-center gap-2 h-12 rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
          >
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium">Start a conversation</span>
            <Zap className="h-3 w-3 text-primary/60 group-hover:text-primary transition-colors duration-200" />
          </Button>
        </div>

        {/* Subtle footer note */}
        <div className="pt-2">
          <p className="text-xs text-center text-muted-foreground/60">
            AI-powered insights tailored to your fitness journey
          </p>
        </div>
      </CardContent>
    </Card>
  );
}