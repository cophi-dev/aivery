"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  highlight?: boolean;
}> = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/workouts", label: "Log", icon: History },
  { href: "/workouts/new", label: "Add", icon: Plus, highlight: true },
  { href: "/chat", label: "Coach", icon: MessageSquare },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon, highlight }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(href) ?? false;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                highlight && !active && "text-primary",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  highlight &&
                    "bg-primary text-primary-foreground shadow-sm",
                  active && !highlight && "bg-accent"
                )}
              >
                <Icon className={cn("h-4 w-4", highlight && "h-5 w-5")} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
