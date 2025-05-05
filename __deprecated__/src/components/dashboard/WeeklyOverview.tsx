'use client';

import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Clock, Route, Weight, Activity, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionCard = motion(Card);

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden"
    >
      <div className="p-6 bg-gradient-to-br from-card to-muted/30">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {icon}
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="flex items-center space-x-2">
              {trend === 'up' && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">+{change}%</span>
                </>
              )}
              {trend === 'down' && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">{change}%</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MotionCard>
  );
}

interface InsightCardProps {
  type: 'achievement' | 'warning' | 'info';
  title: string;
  description: string;
}

function InsightCard({ type, title, description }: InsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "p-4 rounded-lg border",
        type === 'achievement' && "bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800",
        type === 'warning' && "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800",
        type === 'info' && "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"
      )}
    >
      <div className="flex items-start space-x-3">
        <div className={cn(
          "mt-0.5",
          type === 'achievement' && "text-green-600 dark:text-green-400",
          type === 'warning' && "text-amber-600 dark:text-amber-400",
          type === 'info' && "text-blue-600 dark:text-blue-400"
        )}>
          {type === 'achievement' && <TrendingUp className="h-5 w-5" />}
          {type === 'warning' && <AlertTriangle className="h-5 w-5" />}
          {type === 'info' && <Activity className="h-5 w-5" />}
        </div>
        <div>
          <h4 className={cn(
            "font-medium mb-1",
            type === 'achievement' && "text-green-900 dark:text-green-100",
            type === 'warning' && "text-amber-900 dark:text-amber-100",
            type === 'info' && "text-blue-900 dark:text-blue-100"
          )}>
            {title}
          </h4>
          <p className={cn(
            "text-sm",
            type === 'achievement' && "text-green-700 dark:text-green-300",
            type === 'warning' && "text-amber-700 dark:text-amber-300",
            type === 'info' && "text-blue-700 dark:text-blue-300"
          )}>
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function WeeklyOverview() {
  const [dateRange, setDateRange] = useState("Apr 28 - May 4, 2025");

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Activity Overview</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">{dateRange}</div>
          <Button variant="outline" size="icon">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button 
          variant="ghost" 
          size="sm"
          className="bg-background shadow-sm"
        >
          Daily
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
        >
          Weekly
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
        >
          Monthly
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Workouts"
          value="7"
          change={75}
          icon={<Activity className="h-5 w-5 text-primary" />}
          trend="up"
        />
        <MetricCard
          title="Total Duration"
          value="1:23:22"
          change={13.3}
          icon={<Clock className="h-5 w-5 text-primary" />}
          trend="down"
        />
        <MetricCard
          title="Total Distance"
          value="5.0 km"
          change={43}
          icon={<Route className="h-5 w-5 text-primary" />}
          trend="down"
        />
        <MetricCard
          title="Total Volume"
          value="7.4 t"
          change={30.6}
          icon={<Weight className="h-5 w-5 text-primary" />}
          trend="up"
        />
      </div>

      {/* Insights Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Insights</h3>
        <div className="space-y-3">
          <InsightCard
            type="achievement"
            title="Workout Frequency Increased"
            description="You've boosted your workout count from 4 to 7, showing great consistency!"
          />
          <InsightCard
            type="achievement"
            title="Strength Progress"
            description="Strength volume rose by 30.6% to 7.39 tons, highlighting progress in your lifting efforts."
          />
          <InsightCard
            type="warning"
            title="Running Distance Decreased"
            description="Running distance decreased by 43.0% to 5.0 km; consider adding another run to rebuild endurance."
          />
        </div>
      </div>

      {/* Weekly Activity Chart will go here */}
      <div className="h-[300px] rounded-xl border bg-card p-6">
        {/* Chart component will be added here */}
      </div>
    </div>
  );
} 