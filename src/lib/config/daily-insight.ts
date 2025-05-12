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
`Reflect on the user's achievements and progress from last week, highlighting any standout moments, improvements, or personal records. Encourage the user with excitement and positivity for the new week ahead, focusing on momentum and fresh opportunities. Your response must be exactly two concise sentences.`,
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

Keep the response specific to today's efforts. Your response must be exactly two concise sentences.`,
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

Keep the response centered on today's training context. Your response must be exactly two concise sentences.`,
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

Keep the response specific to today's accomplishments. Your response must be exactly two concise sentences.`,
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

Keep the response focused on today's efforts. Your response must be exactly two concise sentences.`,
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

Keep the response specific to today's context. Your response must be exactly two concise sentences.`,
  },
  {
    day: 'Sunday',
    title: 'Weekly Reflection',
    description: 'Review your week\'s journey',
    icon: RefreshCw,
    prompt: 
`Analyze this week's performance and provide a comprehensive reflection:

1. Weekly Overview:
   - Review the total workouts and their types
   - Note the distribution of activities across the week
   - Highlight any patterns in training focus or intensity

2. Achievements & Progress:
   - Celebrate any PRs or milestones reached this week
   - Note improvements in consistency, volume, or intensity
   - Acknowledge any technique or form improvements

3. Weekly Assessment:
   - If it was a strong week: Celebrate the momentum and suggest how to carry it forward
   - If it was a moderate week: Find positive aspects and areas for potential growth
   - If it was a lighter week: Frame it constructively and suggest ways to build momentum

4. Looking Forward:
   - Provide encouraging perspective for the upcoming week
   - If there were PRs: Suggest focus areas to build on these achievements
   - If no PRs: Identify potential opportunities for progress
   - For lighter weeks: Offer motivation to start fresh and create new momentum

Keep the tone reflective but forward-looking, celebrating progress while encouraging continued growth.
Focus on patterns and achievements that can inspire next week's journey.
If today had a workout, acknowledge it within the weekly context.

Your response must be exactly two concise sentences.`,
  }
]; 