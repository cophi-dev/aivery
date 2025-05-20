import { cn } from "@/lib/utils";

interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "top" | "bottom" | "both";
}

export function Glow({
  className,
  variant = "both",
  ...props
}: GlowProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-0",
        variant === "top" && "top-[-200px] bottom-auto h-[500px]",
        variant === "bottom" && "bottom-[-200px] top-auto h-[500px]",
        variant === "both" && "h-full",
        className
      )}
      {...props}
    >
      <div
        className="absolute inset-0 z-[-1] bg-gradient-radial from-brand/20 to-transparent to-70% blur-3xl"
        aria-hidden="true"
      ></div>
    </div>
  );
} 