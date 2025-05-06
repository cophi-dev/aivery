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
    title: 'Momentum',
    description: 'Set the tone, scan the past and future',
    icon: Zap,
    prompt: 
`Summarize key stats from last week's effort (provided in the 'Overall Period Summary'). 
Look ahead: suggest ONE specific area for focus this upcoming week based on the data (e.g., increasing volume, trying a new run distance, consistency). 
If the 'Today's Activities So Far' section is present and not empty, briefly acknowledge one or two of those specific activities completed today. 
Keep the entire response concise (2-4 sentences max).`,
  },
  {
    day: 'Tuesday',
    title: 'Tiny Triumph',
    description: 'Spotlight a specific win',
    icon: Sparkles,
    prompt: 
`Identify ONE specific small achievement or positive data point from the User Data Summary (last 7 days).
AVOID focusing on the number of workouts, as the user may do many short workouts in a day.
Instead, focus on either:
- Total strength volume (in kg/tons) for strength workouts
- Total cardio minutes or distance for cardio workouts
- OR any other positive trend/metric that shows actual effort over raw workout counts
Highlight this 'Tiny Triumph'.
Keep the entire response encouraging and brief (2-3 sentences max).`,
  },
  {
    day: 'Wednesday',
    title: 'Midweek Pulse',
    description: 'Check-in and gentle nudge',
    icon: CalendarClock,
    prompt: 
`Briefly reflect on the week so far based on the User Data Summary (this week Mon-Wed). 
How is the user tracking towards consistency or goals compared to recent patterns (if data allows)? 
Offer a short, gentle motivating nudge or tip for the rest of the week. 
Keep the entire response concise and supportive (2-4 sentences max).`,
  },
  {
    day: 'Thursday',
    title: 'The Shift',
    description: 'Review the week, plan ahead',
    icon: ArrowUpRight,
    prompt: 
`Provide a quick overview of the activity pattern this week so far (Mon-Thu summary provided). 
Is the user on track for their usual weekly volume/frequency? 
Suggest ONE simple, actionable focus for the remainder of the week (e.g., "aim for one more strength session," "consider a longer weekend run"). 
Keep the entire response brief and action-oriented (2-4 sentences max).`,
  },
  {
    day: 'Friday',
    title: 'Your Rhythm',
    description: 'Analyze patterns over time',
    icon: BarChart4,
    prompt: 
`Analyze the User Data Summary (last 3 weeks). 
Identify ONE interesting pattern or trend in their activity (e.g., consistency in a specific workout type, gradual increase in volume, common workout days). 
Briefly mention this pattern. 
Keep the entire response insightful and concise (2-3 sentences max).`,
  },
  {
    day: 'Saturday',
    title: 'The Vibe',
    description: 'Weekend energy check',
    icon: Flame,
    prompt: 
`Based on the User Data Summary (last 7 days), generate a short, energetic, and positive message for the weekend. 
Mention a key stat (like total workouts or a peak metric) in a fun way. 
No specific analysis needed, just capture a positive weekend vibe related to their effort. 
Keep the entire response upbeat and very brief (1-3 sentences max).`,
  },
  {
    day: 'Sunday',
    title: 'Reset Mode',
    description: 'Reflect and prepare',
    icon: RefreshCw,
    prompt: 
`Review the User Data Summary (previous full week, Mon-Sun). 
Briefly reflect on ONE key aspect of the past week's activity (e.g., total volume, consistency, a specific achievement). 
Offer a short, encouraging thought for mental reset and preparation for the week ahead. 
Keep the entire response calm and concise (2-4 sentences max).`,
  }
]; 