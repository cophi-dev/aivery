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
    title: 'Fresh Start',
    description: 'Daily progress and goals',
    icon: Zap,
    prompt: 
`Analyze today's activities and context:
1. What workouts or activities were completed today?
2. How do they align with the user's typical training style?
3. What was the intensity and focus of these activities?

Provide a focused daily insight:
- Acknowledge specific achievements or efforts made today
- Note any interesting patterns in exercise selection or intensity
- If no workouts today, provide context about rest and recovery
- Highlight any milestone reached today (volume, consistency, etc.)

Keep the response encouraging and focused on today's context (2-4 sentences).`,
  },
  {
    day: 'Tuesday',
    title: 'Daily Focus',
    description: 'Today\'s efforts and achievements',
    icon: Sparkles,
    prompt: 
`Analyze today's training data:
1. What specific exercises or activities were performed?
2. How was the intensity managed in today's session(s)?
3. Were there any notable achievements in form or progression?

Provide a focused daily insight:
- Highlight specific accomplishments from today's training
- Note any interesting exercise combinations or sequences
- If no workouts today, contextualize the rest day
- Mention any technique improvements or intensity management

Keep the response specific to today's efforts (2-3 sentences).`,
  },
  {
    day: 'Wednesday',
    title: 'Midweek Focus',
    description: 'Today\'s balance and effort',
    icon: CalendarClock,
    prompt: 
`Examine today's activities in detail:
1. What was the main focus of today's training?
2. How was intensity distributed across exercises?
3. Were there any unique or challenging elements?

Provide a focused daily insight:
- Comment on the structure of today's workout(s)
- Note any interesting training choices or adaptations
- If no workouts today, discuss the role of recovery
- Highlight any particular challenges tackled

Keep the response centered on today's training context (2-4 sentences).`,
  },
  {
    day: 'Thursday',
    title: 'Daily Progress',
    description: 'Today\'s achievements',
    icon: ArrowUpRight,
    prompt: 
`Analyze today's workout details:
1. What was the primary type of training?
2. How was effort distributed throughout the session(s)?
3. Were there any notable achievements or challenges?

Provide a focused daily insight:
- Comment on the quality of today's training
- Note any interesting exercise progressions
- If no workouts today, contextualize the recovery
- Highlight any technique or intensity achievements

Keep the response specific to today's accomplishments (2-4 sentences).`,
  },
  {
    day: 'Friday',
    title: 'Daily Review',
    description: 'Today\'s performance',
    icon: BarChart4,
    prompt: 
`Examine today's training in detail:
1. What was accomplished in today's session(s)?
2. How was training intensity managed?
3. Were there any standout moments or challenges?

Provide a focused daily insight:
- Highlight specific achievements from today
- Note any interesting training approaches
- If no workouts today, discuss the recovery context
- Mention any milestone or progress markers

Keep the response focused on today's efforts (2-3 sentences).`,
  },
  {
    day: 'Saturday',
    title: 'Weekend Training',
    description: 'Today\'s activity focus',
    icon: Flame,
    prompt: 
`Analyze today's context and recent activities:
1. What workouts or activities were completed today (if any)?
2. How has the training week been so far?
3. What opportunities exist for today?

Provide a focused daily insight that:
- If there are workouts today: Highlight and celebrate these specific achievements
- If no workouts yet today: 
  • Acknowledge the week's accomplishments so far
  • Suggest potential activities that complement recent training
  • Keep suggestions flexible (e.g. "Great options today include...")
  • Avoid assuming or prescribing rest unless clearly warranted by high recent volume
- Keep the tone energetic and opportunity-focused
- Emphasize that today's choices are open

Keep the response specific to today's context (2-3 sentences).`,
  },
  {
    day: 'Sunday',
    title: 'Daily Reflection',
    description: 'Today\'s efforts',
    icon: RefreshCw,
    prompt: 
`Examine today's activities:
1. What was the focus of today's training?
2. How was effort managed in the session(s)?
3. Were there any notable achievements?

Provide a focused daily insight:
- Comment on today's training approach
- Note any interesting exercise choices
- If no workouts today, discuss the recovery context
- Highlight any specific accomplishments

Keep the response centered on today's activities (2-4 sentences).`,
  }
]; 