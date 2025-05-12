import { Card } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExercisePRTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  date?: string;
  color?: string; // e.g. 'from-blue-50 to-blue-100'
  link?: string;
}

const MotionCard = motion(Card);

export function ExercisePRTile({ icon, label, value, date, color = "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20", link }: ExercisePRTileProps) {
  const content = (
    <div className={cn("block p-4 h-full w-full bg-gradient-to-br rounded-xl transition-shadow duration-300", color)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">{icon}<span className="font-medium text-foreground/80">{label}</span></div>
          <div className="text-2xl font-bold">{value}</div>
          {date && <div className="text-xs text-muted-foreground">{date}</div>}
        </div>
      </div>
    </div>
  );
  return (
    <MotionCard
      className="overflow-hidden hover:shadow-lg cursor-pointer h-full"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {link ? <Link href={link}>{content}</Link> : content}
    </MotionCard>
  );
} 