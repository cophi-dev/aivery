import React from 'react';
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'; 
import { cn } from "@/lib/utils";

interface MetricData {
  title: string;
  value: string;
  change?: number | null;
}

interface DoubleMetricCardProps { 
  metric1: MetricData;
  metric2: MetricData;
}

// Helper to render change indicator (adapted from MetricCard)
const RenderChange = ({ change }: { change?: number | null }) => {
  if (change === undefined || change === null) {
      return null; 
  }

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isZero = change === 0;
  const formattedChange = `${isPositive ? '+' : ''}${change.toFixed(1)}%`;

  let IconComponent = Minus;
  let textColor = "text-muted-foreground";

  if (isPositive) {
      IconComponent = ArrowUp;
      textColor = "text-green-600 dark:text-green-500";
  } else if (isNegative) {
      IconComponent = ArrowDown;
      textColor = "text-red-600 dark:text-red-500";
  }

  return (
      <span className={cn("flex items-center text-xs font-medium", textColor)}>
          <IconComponent className="h-3 w-3 mr-0.5" />
          {formattedChange}
      </span>
  );
};


export const DoubleMetricCard = ({ metric1, metric2 }: DoubleMetricCardProps) => {
  return (
    // Using flex-col, reduced padding slightly, kept min-height
    <Card className="p-3 flex flex-col justify-between min-h-[110px]"> 
      {/* Metric 1 Section */}
      <div> 
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{metric1.title}</p>
        <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold">{metric1.value}</p>
            <RenderChange change={metric1.change} />
        </div>
      </div>

      {/* Divider */}
      <hr className="my-2 border-border/50"/> 

      {/* Metric 2 Section */}
      <div> 
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{metric2.title}</p>
        <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold">{metric2.value}</p>
            <RenderChange change={metric2.change} />
        </div>
      </div>
    </Card>
  );
};

// Optional default export
// export default DoubleMetricCard; 