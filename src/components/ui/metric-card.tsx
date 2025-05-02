import React from 'react';
// Remove Card import
// import { Card } from "@/components/ui/card";
// Import icons for trend display
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'; 
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface MetricData {
  title: string;
  value: string;
  change?: number | null;
}

interface MetricCardProps { 
  title: string; 
  value: string; 
  icon?: React.ReactNode; // Keep the optional icon prop
  change?: number | null; // Optional percentage change value
}

// Renamed component slightly as it's no longer a self-contained card
export const MetricContent = ({ title, value, icon, change }: MetricCardProps) => {

  const renderChange = () => {
    if (change === undefined || change === null) {
        // Optionally show a placeholder or nothing if no change data
        // return <span className="text-xs text-muted-foreground">-</span>;
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
    } // else stick with Minus icon and muted color for zero change

    return (
        <span className={cn("flex items-center text-xs font-medium", textColor)}>
            <IconComponent className="h-3 w-3 mr-0.5" />
            {formattedChange}
        </span>
    );
  };

  // Return just the inner content structure, wrapped in a div for flex layout
  return (
    <div className="flex flex-col justify-between h-full"> {/* Use h-full for flex */}
      <div> 
        <div className="flex items-center justify-between mb-1">
          {/* Simplified title: removed uppercase, lighter color */}
          <p className="text-xs font-medium text-muted-foreground/80 tracking-wide">{title}</p>
          {icon} {/* Display icon if provided */}
        </div>
      </div>

      <div> 
        <div className="flex items-baseline justify-between">
            {/* Adjusted value size potentially */}
            <p className="text-xl font-bold">{value}</p>
            {renderChange()} {/* Render the change indicator */}
        </div>
      </div>
    </div>
  );
};

// Keep export name consistent if used elsewhere, or adjust import name
export default MetricContent; 