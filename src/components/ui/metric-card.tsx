import React from 'react';
import { Card } from "@/components/ui/card";
// Import icons for trend display
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'; 
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface MetricCardProps { 
  title: string; 
  value: string; 
  icon?: React.ReactNode; // Keep the optional icon prop
  change?: number | null; // Optional percentage change value
}

export const MetricCard = ({ title, value, icon, change }: MetricCardProps) => {

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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1"> {/* Added mb-1 */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        {icon} {/* Display icon if provided */}
      </div>
      {/* Display value and change side-by-side */}
      <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold">{value}</p>
          {renderChange()} {/* Render the change indicator */}
      </div>
    </Card>
  );
};

export default MetricCard; // Add default export if needed elsewhere, or remove if only named used 