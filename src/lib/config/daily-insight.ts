import { Sparkles, Zap, CalendarClock, ArrowUpRight, BarChart4, Flame, RefreshCw } from 'lucide-react';

export type DailyContent = {
  day: string;
  title: string;
  description: string;
  icon: React.ElementType;
  prompt: string;
};

export const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const dailyContentConfig: DailyContent[] = [
  {
    day: 'Monday',
    title: 'Weekly Analysis',
    description: 'Performance patterns and optimization',
    icon: Zap,
    prompt: 
`Look at last week's training and give one insight about what went well or what to focus on this week.`,
  },
  {
    day: 'Tuesday',
    title: 'Performance Analysis',
    description: 'Today\'s training effectiveness',
    icon: Sparkles,
    prompt: 
`Comment on today's workout performance. If no workout today, mention what might be good to do or if rest makes sense.`,
  },
  {
    day: 'Wednesday',
    title: 'Midweek Assessment',
    description: 'Training load and adaptation',
    icon: CalendarClock,
    prompt: 
`Look at this week's training so far. Are they on track, doing too much, or need to step it up?`,
  },
  {
    day: 'Thursday',
    title: 'Progress Metrics',
    description: 'Quantified performance gains',
    icon: ArrowUpRight,
    prompt: 
`Highlight any recent progress or improvements. If no clear progress, suggest what might help them move forward.`,
  },
  {
    day: 'Friday',
    title: 'Weekly Synthesis',
    description: 'Training effectiveness review',
    icon: BarChart4,
    prompt: 
`Summarize how this week's training went. What was the highlight or what should they focus on for the weekend?`,
  },
  {
    day: 'Saturday',
    title: 'Training Optimization',
    description: 'Weekend performance strategy',
    icon: Flame,
    prompt: 
`Based on this week's training, what would be smart to do this weekend? More training, recovery, or something specific?`,
  },
  {
    day: 'Sunday',
    title: 'Weekly Performance Review',
    description: 'Comprehensive training analysis',
    icon: RefreshCw,
    prompt: 
`Reflect on the full week's training. What was the biggest win and what should they focus on next week?`,
  }
]; 