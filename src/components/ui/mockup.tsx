import { cn } from "@/lib/utils";
import React from "react";

interface MockupFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "small" | "medium" | "large";
}

export function MockupFrame({
  children,
  className,
  size = "medium",
  ...props
}: MockupFrameProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-6xl mx-auto rounded-lg overflow-hidden border border-border shadow-xl",
        size === "small" && "max-w-4xl",
        size === "large" && "max-w-7xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface MockupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "browser" | "mobile" | "responsive";
}

export function Mockup({
  children,
  className,
  type = "browser",
  ...props
}: MockupProps) {
  if (type === "browser") {
    return (
      <div className={cn("overflow-hidden", className)} {...props}>
        <div className="flex items-center gap-1.5 p-3 bg-muted/50 border-b border-border">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div>{children}</div>
      </div>
    );
  }

  if (type === "mobile") {
    return (
      <div
        className={cn(
          "max-w-[320px] mx-auto overflow-hidden rounded-xl border-8 border-border",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  // Responsive default
  return (
    <div className={cn("overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
} 