'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, TrendingUp, Calendar, Target, Sparkles } from "lucide-react";
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
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        icon: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
        hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800/50',
        icon: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/50'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-800/50',
        icon: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-100 dark:bg-purple-900/50',
        hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/50'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">AI Coach</CardTitle>
            <CardDescription>Get personalized insights</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {quickActions.map((action) => {
          const colors = getColorClasses(action.color);
          const IconComponent = action.icon;
          
          return (
            <Button
              key={action.id}
              variant="ghost"
              onClick={() => handleActionClick(action)}
              className={cn(
                "w-full justify-start h-auto p-4 rounded-lg",
                colors.bg,
                colors.border,
                colors.hover,
                "border transition-colors duration-200"
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <div className={cn("p-2 rounded-lg", colors.iconBg)}>
                  <IconComponent className={cn("h-4 w-4", colors.icon)} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm text-foreground">
                    {action.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          );
        })}
        
        {/* Chat prompt */}
        <div className="pt-3 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => sendAiMessage("Hello! I'd like to chat about my fitness progress.", { requestType: 'general-chat' })}
            className="w-full justify-center gap-2 hover:bg-muted/50 transition-colors duration-200"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Start a conversation</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}