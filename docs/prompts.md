# AI Prompts Documentation

This document catalogs all the AI prompts and templates used throughout the Aivery application. Each entry includes:
- **Prompt Name**
- **Prompt ID**
- **Description**
- **Where Used**
- **Model Used**
- **Input**
- **Expected Output**
- **Notes**

## 🎯 Design Philosophy: The Fitness Buddy Approach

All AI interactions in Aivery follow the "fitness buddy" design philosophy - making the AI feel like a personal trainer who's also your best friend and inner voice, rather than a generic or overly hyped coaching bot.

### Core Principles:

**🤝 Personal & Human**
- Use the user's name and reference their specific workouts/data
- Talk like you're texting a friend who knows their fitness journey
- Be emotionally intelligent - notice when they're frustrated, excited, or struggling

**🔍 Pattern Recognition**
- Actively notice and call out patterns in their data
- Point out progress they might not see themselves
- Identify areas being neglected or overemphasized

**💯 Genuine & Real**
- Celebrate wins authentically, not with generic hype
- Acknowledge struggles and setbacks with understanding
- Give honest advice when they need a reality check
- No robotic motivational quotes or corporate trainer speak

**🧠 Inner Voice Quality**
- Feel like their inner voice during tough workouts
- Help them see the bigger picture when they're stuck
- Provide perspective based on their actual journey
- Support them like someone who's been with them the whole time

**⚖️ Balanced Tone**
- Supportive but not saccharine
- Encouraging but not unrealistic
- Direct but caring
- Knowledgeable but not preachy

---

## 🏋️ Post-Workout Feedback

### Workout Highlight Statement
- **Prompt ID:** `workout-highlight-v1`
- **Description:** Generates a concise, positive highlight statement after a completed workout.
- **Where Used:**
  - `src/app/api/ai/workout-highlight/route.ts` (`createHighlightPrompt`)
  - Referenced in `src/app/api/ai/coach/route.ts` (legacy fallback)
- **Model Used:** `gpt-4.1-mini-2025-04-14` (configurable via env)
- **Input:**
  - User name
  - Workout data (type, duration, distance, volume, notes)
  - Optional: user preferences/goals, historical context (PRs, workout counts), landmark comparison
- **Expected Output:**
  - Single sentence (15–25 words), plain text with one context-relevant emoji
- **Notes:**
  - Emoji must be context-relevant, not generic
  - Avoid repeating metric types already in UI
  - For cardio workouts, includes landmark distance comparisons (e.g., "You ran about the distance from Central Park to Times Square!")
  - For strength workouts, includes volume comparisons (e.g., "You lifted the equivalent weight of 0.5 cars!")

### Dynamic Motivational Quote
- **Prompt ID:** `motivational-quote-v1`
- **Description:** Produces a brief, motivational, and personalized quote or tip for the user, tailored to their context and recent activity.
- **Where Used:**
  - `src/app/api/quotes/route.ts`
  - `src/app/api/quotes/dynamic/route.ts` (`generateAIQuote`)
- **Model Used:** `gpt-4.1-mini-2025-04-14` (configurable via env)
- **Input:**
  - User nickname
  - Workout count
  - Recent workout types
  - Time of day
  - Day of week
  - Is weekend flag
  - Optional: weather
- **Expected Output:**
  - Plain text, max 100 characters
- **Notes:**

---

## 🧠 AI Coaching Prompts

### Initial Workout Insight
- **Prompt ID:** `initial-workout-insight-v1`
- **Description:** Generates a welcoming, insightful opening message when a user clicks a workout in their history, highlighting a stat or trend and asking an open-ended question.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (`generateInitialWorkoutInsight`)
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - User name
  - Current workout details
  - Previous workouts summary
  - Progress metrics
- **Expected Output:**
  - Markdown text (1–2 sentences)
- **Notes:**

### Workout Plan Generation
- **Prompt ID:** `workout-plan-generation-v3`
- **Description:** Produces a concise, actionable running plan (variable duration) based on user goals, PRs, and recent running history.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (plan generation logic)
- **Model Used:** `gpt-4.1-mini-2025-04-14` (or as set by env)
- **Input:**
  - User name
  - User goal
  - Exercise PRs
  - **Average weekly running distance (last 4 weeks)**
  - **Longest run (last 4 weeks)**
  - **Fastest pace (last 4 weeks)**
  - **Last 5 running workouts (date, distance, duration)**
- **Prompt Structure:**
  - The system prompt now *explicitly* instructs the LLM: "You MUST base the plan on the average weekly distance, longest run, fastest pace, and the last 5 running workouts provided. Do NOT base the plan only on the most recent run."
  - Includes a summary line: 'User averages X km/week running over the last 4 weeks. Longest run: Y km. Fastest pace: Z min/km.'
  - Lists the last 5 running workouts.
  - Instructs the LLM to generate a plan based on this context.
  - **NEW: Includes a "Current Performance Analysis" section** that provides a concise performance summary at the beginning of each plan, with a slightly warmer and more natural tone.
  - **NEW: Improved requirements** for pace recommendations and progressive training structure.
  - **NEW: Multi-week plan preservation** - When modifying an existing plan, the system now detects and preserves the original plan duration.
- **Expected Output:**
  - Markdown text (structured plan)
  - **NEW: Begins with a Current Performance Analysis section** that includes:
    - Average Weekly Distance
    - Longest Run
    - Fastest Pace
    - Brief assessment of running patterns/consistency
  - Followed by the weekly workout plan
- **Notes:**
  - Only running workouts are used for running plan context.
  - Distance is normalized from both top-level and cardioDetails fields.
  - If the LLM response is vague or only references the most recent run, fallback logic retries with a stricter prompt until a concrete, actionable weekly plan is produced.
  - **NEW: Improved Conversational Follow-ups** - When a user asks a follow-up question about a plan (rather than requesting a plan modification), the system now detects this using conversational patterns and responds in natural dialogue rather than treating it as a plan update request. This creates a more natural conversation flow after plan generation.
  - **NEW: Duration Preservation** - The system now detects multi-week plans and preserves their duration during follow-up modifications, ensuring consistency in the training schedule.

### Weekly Performance Review
- **Prompt ID:** `weekly-performance-review-v1`
- **Description:** Summarizes a user's weekly activity, trends, and provides 1–2 actionable insights.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (systemPrompt for review)
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - User name
  - Period workout data
- **Expected Output:**
  - Markdown text with formatting
- **Notes:**

### Fitness Concept Explanation
- **Prompt ID:** `fitness-concept-explanation-v1`
- **Description:** Generates a multi-slide, markdown-formatted explanation of a fitness concept, tailored to the user's context.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (`getDirectTextResponse`)
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - User name
  - Query (concept to explain)
  - Optional: user preferences
- **Expected Output:**
  - Markdown text, structured for slides (headers, sections, question)
- **Notes:**

---

## 📊 Analytics / Insights

### Daily Insight Card
- **Prompt ID:** `daily-insight-card-v1`
- **Description:** Provides a daily, personalized fitness insight for the dashboard, now in the style of a supportive, fun fitness buddy. The insight is playful, humble, and natural—like a friend texting after a workout. It celebrates wins, laughs at struggles, and keeps things light and encouraging.
- **Where Used:**
  - `src/app/api/daily-insight/route.ts` (systemPrompt)
  - Consumed by dashboard components (e.g., `DailyInsightCard.tsx`)
- **Model Used:** `gpt-4.1-mini-2025-04-14` (configurable via env)
- **Input:**
  - User nickname/name
  - Current day of week
  - Daily instruction template (now used only for context)
  - Workout data summary for the relevant period
  - Optional: data fetch error note
- **Expected Output:**
  - 2–4 sentences, but natural and conversational (not forced)
  - Playful, humble, and supportive tone
  - Feels like a real friend, not a coach or robot
- **Prompt Template (2024, Fitness Buddy Style):**

  ```
  You are Aivery, the user's fitness buddy—fun, supportive, and always real. Your job is to give {displayName} a daily fitness insight that feels like it's from a friend who works out with them.

  Today is {dayName}. Here's what's up:
  {workoutDataString}

  Instructions:
  - Be playful, humble, and natural—like a friend texting after a workout.
  - Celebrate wins, laugh at struggles, and keep it light.
  - If there's a new PR, get genuinely excited (but don't brag).
  - If today's a rest day, make it feel okay—maybe joke about "earning that couch time."
  - If the week's been tough, offer encouragement and a fresh start.
  - Use emojis if it feels natural, but don't overdo it.
  - Never sound like a robot or a formal coach.
  - 2–4 sentences, but don't force it—just sound like a real person.

  Now, write today's insight for {displayName}!
  ```
- **Notes:**
  - The LLM is allowed creative freedom to make the insight feel human and fun.
  - If user data is missing, fallback to a friendly, general motivational message.

### Exercise Progress Insights (Algorithmic)
- **Prompt ID:** `exercise-progress-insights-v1`
- **Description:** Generates insights about exercise progress using rule-based logic (not an AI prompt).
- **Where Used:**
  - `src/lib/ai-workout-insights.ts` (`generateExerciseInsights`)
- **Model Used:** N/A (algorithmic)
- **Input:**
  - Exercise history data
- **Expected Output:**
  - Structured object with insight text and metrics
- **Notes:**

---

## 💬 Chat & Text Optimization

### AI Fitness Coach Chat
- **Prompt ID:** `ai-fitness-coach-chat-v2`
- **Description:** Handles chat interactions with a personal trainer/friend/inner voice approach. Emotionally intelligent, pattern-aware, and genuinely supportive without being overly hype-y or generic.
- **Where Used:**
  - `src/app/api/chat/route.ts` (systemPrompt)
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - User name
  - Recent workouts (last 3)
  - Personal records (e.g. best 5K, longest run)
  - Current goals or targets
  - User conversation history
  - Optional: Weekly review context (when accessed from review screens)
- **Expected Output:**
  - Markdown text with personal, conversational tone
- **System Prompt (Current - Fitness Buddy Style):**

  ```
  You are Aivery, {userName}'s fitness buddy and inner voice. You're that friend who knows their workout history, celebrates their wins, and gives them the nudge they need. You're supportive but real, insightful but never preachy.

  WHO YOU ARE:
  - Like a personal trainer who's also your best friend
  - Someone who notices patterns and connections others miss
  - Your inner voice during tough workouts
  - Emotionally intelligent and tuned into how {userName} is feeling
  - Direct but caring - you'll call out what needs calling out

  YOUR PERSONALITY:
  - Notice patterns: "I see you've been crushing your runs but skipping strength work..."
  - Celebrate genuinely: Get excited about progress, even small wins
  - Be emotionally aware: Read between the lines - if someone sounds frustrated, acknowledge it
  - Give perspective: Help them see the bigger picture when they're stuck in the weeds
  - Be human: Use humor, admit when things are tough, relate to their struggles
  - Stay real: No generic motivational quotes or overly hyped language

  RESPONSE STYLE:
  - Talk like you're texting a friend who asked for advice
  - Use "you" and "your" - make it personal
  - Reference specific workouts, numbers, and patterns from their data
  - If you spot something interesting in their data, point it out
  - When giving advice, explain *why* based on what you see in their patterns
  - Use casual language but stay helpful and informed
  ```

- **Weekly Review Context (When Available):**

  ```
  You are Aivery, an AI fitness coach. The user is asking about their {reviewPeriod} workouts.

  Based on the weekly review data I'm providing, answer the user's question about their workout performance.

  Weekly Review Data:
  - Period: {reviewPeriod}
  - Title: {reviewTitle}
  {reviewSections}

  IMPORTANT: Use the above context to give a personalized response to the user's query: "{userQuery}".
  Format using markdown for readability, and be specific in your analysis of their performance.
  ```

- **Notes:**
  - The system prompt now always includes the user's last 3 workouts, personal records, and current goals/targets if available.
  - If user data is missing or unclear, the AI provides a general, actionable suggestion based on best fitness coaching practices (fallback rule), and only asks for clarification if essential.
  - When launched from a weekly review via the "Talk to Aivery about it" button, the chat receives additional context from the review data stored in sessionStorage, enabling more relevant follow-up conversations about the weekly performance data.

### Training Preferences Optimization
- **Prompt ID:** `training-preferences-optimization-v1`
- **Description:** Cleans up and structures user-entered training preferences into a clear, first-person paragraph.
- **Where Used:**
  - `src/app/api/optimize-text/route.ts` (field === 'trainingPreferences')
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - Raw user preference text
  - Optional: user context
- **Expected Output:**
  - Plain text paragraph
- **Notes:**

### Fitness Goals Optimization
- **Prompt ID:** `fitness-goals-optimization-v1`
- **Description:** Cleans up and structures user-entered fitness goals into a clear, first-person paragraph.
- **Where Used:**
  - `src/app/api/optimize-text/route.ts` (field === 'fitnessGoals')
- **Model Used:** `gpt-4.1-mini-2025-04-14`
- **Input:**
  - Raw user goals text
  - Optional: user context
- **Expected Output:**
  - Plain text paragraph
- **Notes:**

## Proactive Fallback for Vague Queries

When `analyzeUserQuery` returns `intent: 'unknown'` **and** the user has recent running workouts, PRs, or goals, the system:

- **Skips clarification.**
- **Returns a proactive, actionable suggestion** using the system prompt and available user context, prioritizing running context if available.
- The system prompt now explicitly instructs:
  - DO NOT say 'Here's a suggestion...' or 'Based on your recent activity...'.
  - Instead, give a concrete, actionable workout or activity, e.g.: 'A 20–30 minute tempo run today would be a great fit.'
- If the LLM response is too generic (e.g., matches those phrases or is under 40 characters), the system retries with a more forceful prompt requiring a specific session or activity.
- **Note:** The fallback context now includes average weekly running distance and recent running workouts if available.

**Example:**

> User: What should I do today?
>
> AI: Based on your recent runs and your 10K goal, a 20–30 minute tempo run today would be a great fit.

If no user context is available, the system falls back to the previous behavior (clarification or a general suggestion).

## Proactive Fallback for Vague or Insufficient Plan Responses

When a user requests a workout plan and their query includes progression/increase for multiple aspects (e.g., "increase my cardio distance and weight volume"), the system enforces:

- The LLM must generate a detailed, progressive 1-week plan covering all requested aspects (e.g., both cardio and strength/weight).
- If the LLM response is only for a single day or does not address all requested aspects, the system retries with a stricter prompt requiring a multi-day, progressive plan.
- The plan must be actionable, specific for each day, and show clear progression for each aspect mentioned in the user query.

This fallback logic ensures that vague or insufficient responses are automatically retried until a concrete, actionable weekly plan is produced.

## Fallback Logic for Vague or Open-Ended Queries

When the user asks a vague or open-ended question (e.g., "What should I do today?"), the system will:

- Gather user context: last 3 workouts, recent PRs, and current goals/targets.
- Pass this context to the LLM in a structured format.
- Use the following strict system prompt:

```
You are Aivery, a friendly and insightful AI fitness coach.

USER CONTEXT:
- Name: [User Name]
- Last 3 Workouts:
  - [Date]: [Workout Name/Type] ([Duration], [Distance], ...)
  ...
- Recent PRs:
  - [Exercise]: [Value] ([Date])
  ...
- Current Goals/Targets: [Goals]

The user asked: "[User Query]"

IMPORTANT RULES:
- You MUST ONLY reference exercises, PRs, and activities that are actually present in the USER CONTEXT above.
- Do NOT invent or mention any exercise, PR, or activity that is not listed in the context.
- If suggesting a PR-based progression, use only the PRs listed above, by name and value.
- If the context does not include a certain exercise or PR, do not mention it.
- Be concise, positive, and tailor the suggestion to their context.
- Do not ask for clarification.
- DO NOT say 'Here's a suggestion...' or 'Based on your recent activity...'. Instead, give a concrete, actionable workout or activity, e.g.: 'A 20–30 minute tempo run today would be a great fit.'
```

This ensures the AI's suggestions are always grounded in the user's real data and never hallucinate exercises or PRs.

## Prompt Structure and Handling (2024)

- **Centralized Prompt Construction:** All prompts for LLMs are constructed in the API layer and passed to the `callLLM` helper in `src/lib/services/llm.ts`.
- **Follow-Up Instructions:** If a follow-up instruction is present, it is appended to the system prompt before sending to the LLM.
- **Prompt Fallback/Retry:** If the LLM response is vague or generic, the API endpoint retries with a more forceful or explicit prompt. Each retry and the final prompt are logged for traceability.
- **No UI/Legacy Prompt Construction:** Prompt construction is no longer performed in UI components or legacy fetch code; all logic is centralized in the API.

## 🌍 Workout Insights & Comparisons

### Real-World Distance Comparisons
- **Prompt ID:** N/A (algorithmic)
- **Description:** Maps workout distances to real-world landmarks/locations for relatable comparisons.
- **Where Used:**
  - `src/lib/workout-distance-comparisons.ts` (`generateDistanceComparisonText`)
  - `src/app/api/ai/workout-highlight/route.ts` (used as input to highlight generation)
  - `src/app/api/workout-insight/[workoutId]/route.ts` (used for fun facts)
- **Model Used:** N/A (algorithmic)
- **Input:**
  - Distance in kilometers (from running/cycling workouts)
- **Expected Output:**
  - Natural language comparison to landmark distances (e.g., "You ran about the distance from Central Park to Times Square in New York!")
- **Notes:**
  - Uses fixed database of 21 landmarks across New York, London, and Tokyo
  - Finds closest distance match and generates appropriate text
  - Adds contextual elements based on how close the match is

### Volume Comparisons for Strength Workouts
- **Prompt ID:** N/A (algorithmic)
- **Description:** Compares workout volumes (weight × reps) to everyday objects for intuitive understanding.
- **Where Used:**
  - `src/app/api/ai/workout-highlight/route.ts` (`generateVolumeComparisonText`)
  - `src/app/api/workout-insight/[workoutId]/route.ts` (various volume comparison functions)
- **Model Used:** N/A (algorithmic)
- **Input:**
  - Total volume in kilograms (from strength workouts)
- **Expected Output:**
  - Natural language comparison to object weights (e.g., "You lifted the equivalent of 2.5 grand pianos!")
- **Notes:**
  - Compares to objects like cars (1500kg), elephants (5000kg), grand pianos (400kg), etc.
  - Selects most appropriate comparison based on volume
  - Formats as either percentage or multiple of object weight
  - Falls back to smaller objects for low volumes