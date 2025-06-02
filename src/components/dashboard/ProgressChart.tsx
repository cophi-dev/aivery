'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statsFormatters } from '@/lib/stats';

type ChartMetric = 'volume' | 'distance' | 'workouts';

interface WeeklyProgressData {
  week: string;
  weekStart: string;
  workouts: number;
  duration: number;
  distance: number;
  volume: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const ProgressChart = () => {
  const [weeklyData, setWeeklyData] = useState<WeeklyProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('volume');

  useEffect(() => {
    const fetchProgressHistory = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/dashboard/progress-history');
        
        if (!res.ok) {
          throw new Error('Failed to fetch progress history');
        }
        
        const data = await res.json();
        setWeeklyData(data.weeklyData || []);
      } catch (error) {
        console.error('Failed to fetch progress history:', error);
        setError('Unable to load progress chart');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgressHistory();
  }, []);

  const getMetricConfig = (metric: ChartMetric) => {
    switch (metric) {
      case 'volume':
        return {
          dataKey: 'volume',
          name: 'Weekly Volume',
          color: '#8b5cf6',
          formatter: (value: number) => statsFormatters.volume(value),
          yAxisLabel: 'Volume'
        };
      case 'distance':
        return {
          dataKey: 'distance',
          name: 'Weekly Distance',
          color: '#3b82f6',
          formatter: (value: number) => statsFormatters.distance(value),
          yAxisLabel: 'Distance (km)'
        };
      case 'workouts':
        return {
          dataKey: 'workouts',
          name: 'Weekly Sessions',
          color: '#10b981',
          formatter: (value: number) => {
            const rounded = Math.round(value * 10) / 10; // Round to 1 decimal place
            return `${rounded} session${rounded !== 1 ? 's' : ''}`;
          },
          yAxisLabel: 'Sessions'
        };
    }
  };

  const config = getMetricConfig(selectedMetric);

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Week of {label}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium" style={{ color: payload[0].color }}>
              {config.name}: {config.formatter(value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const MetricToggle = () => (
    <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
      {[
        { key: 'volume' as ChartMetric, label: 'Volume', icon: '💪' },
        { key: 'distance' as ChartMetric, label: 'Distance', icon: '🏃' },
        { key: 'workouts' as ChartMetric, label: 'Sessions', icon: '📊' }
      ].map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => setSelectedMetric(key)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${
            selectedMetric === key
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <span className="text-xs">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Trends
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {error}
          </p>
        </div>
      </motion.section>
    );
  }

  if (isLoading) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Trends
          </h2>
          <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center justify-between mb-6">
              <div className="w-64 h-8 bg-zinc-300 dark:bg-zinc-600 rounded animate-pulse"></div>
            </div>
            <div className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"></div>
          </div>
        </div>
      </motion.section>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <motion.section 
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            Progress Trends
          </h2>
          <div className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 text-center">
            <div className="text-4xl mb-4">📈</div>
            <p className="text-[1rem] text-neutral-600 dark:text-neutral-400 mb-6 font-serif italic">
              Track a few workouts to see your progress trends here.
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
          Progress Trends
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your weekly training patterns over the last 12 weeks
        </p>
      </div>

      <div className="p-6 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
        {/* Metric Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
              {config.name}
            </span>
          </div>
          <MetricToggle />
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={weeklyData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                className="opacity-20" 
                stroke="currentColor"
              />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-neutral-600 dark:text-neutral-400"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-neutral-600 dark:text-neutral-400"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={config.dataKey}
                stroke={config.color}
                strokeWidth={2}
                dot={{ 
                  fill: config.color, 
                  strokeWidth: 2, 
                  r: 4 
                }}
                activeDot={{ 
                  r: 6, 
                  fill: config.color,
                  stroke: '#fff',
                  strokeWidth: 2
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            {weeklyData.length > 0 && (
              <>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Current Week
                  </p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {config.formatter(weeklyData[weeklyData.length - 1][config.dataKey as keyof WeeklyProgressData] as number)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Peak Week
                  </p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {config.formatter(Math.max(...weeklyData.map(w => w[config.dataKey as keyof WeeklyProgressData] as number)))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Avg/Week
                  </p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {config.formatter(
                      weeklyData.reduce((sum, w) => sum + (w[config.dataKey as keyof WeeklyProgressData] as number), 0) / weeklyData.length
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default ProgressChart; 