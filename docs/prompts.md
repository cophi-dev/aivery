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

---

## 🏋️ Post-Workout Feedback

### Workout Highlight Statement
- **Prompt ID:** `workout-highlight-v1`
- **Description:** Generates a concise, positive highlight statement after a completed workout.
- **Where Used:**
  - `src/app/api/ai/workout-highlight/route.ts` (`createHighlightPrompt`)
  - Referenced in `src/app/api/ai/coach/route.ts` (legacy fallback)
- **Model Used:** `grok-3-mini-latest` (configurable via env)
- **Input:**
  - User name
  - Workout data (type, duration, distance, volume, notes)
  - Optional: user preferences/goals, historical context (PRs, workout counts), landmark comparison
- **Expected Output:**
  - Single sentence (15–25 words), plain text with one context-relevant emoji
- **Notes:**
  - Emoji must be context-relevant, not generic
  - Avoid repeating metric types already in UI

### Dynamic Motivational Quote
- **Prompt ID:** `motivational-quote-v1`
- **Description:** Produces a brief, motivational, and personalized quote or tip for the user, tailored to their context and recent activity.
- **Where Used:**
  - `src/app/api/quotes/route.ts`
  - `src/app/api/quotes/dynamic/route.ts` (`generateAIQuote`)
- **Model Used:** `grok-3-mini-latest` (configurable via env)
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
- **Model Used:** `grok-3-mini-latest`
- **Input:**
  - User name
  - Current workout details
  - Previous workouts summary
  - Progress metrics
- **Expected Output:**
  - Markdown text (1–2 sentences)
- **Notes:**

### Workout Plan Generation
- **Prompt ID:** `workout-plan-generation-v2`
- **Description:** Produces a concise, actionable 1-week running plan based on user goals, PRs, and recent running history.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (plan generation logic)
- **Model Used:** `grok-3-mini-latest` (or as set by env)
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
- **Expected Output:**
  - Markdown text (structured plan)
- **Notes:**
  - Only running workouts are used for running plan context.
  - Distance is normalized from both top-level and cardioDetails fields.
  - If the LLM response is vague or only references the most recent run, fallback logic retries with a stricter prompt until a concrete, actionable weekly plan is produced.
  - **NEW: Improved Conversational Follow-ups** - When a user asks a follow-up question about a plan (rather than requesting a plan modification), the system now detects this using conversational patterns and responds in natural dialogue rather than treating it as a plan update request. This creates a more natural conversation flow after plan generation.

### Weekly Performance Review
- **Prompt ID:** `weekly-performance-review-v1`
- **Description:** Summarizes a user's weekly activity, trends, and provides 1–2 actionable insights.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (systemPrompt for review)
- **Model Used:** `grok-3-mini-latest`
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
- **Model Used:** `grok-3-mini-latest`
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
- **Description:** Provides a daily, personalized fitness insight for the dashboard, with day-specific instructions and PR highlighting.
- **Where Used:**
  - `src/app/api/daily-insight/route.ts` (systemPrompt)
  - Consumed by dashboard components (e.g., `DailyInsightCard.tsx`)
- **Model Used:** `grok-3-mini-latest` (configurable via env)
- **Input:**
  - User nickname/name
  - Current day of week
  - Daily instruction template
  - Workout data summary for the relevant period
  - Optional: data fetch error note
- **Expected Output:**
  - Plain text, concise (2–4 sentences), tailored to day's prompt
- **Notes:**

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
- **Prompt ID:** `ai-fitness-coach-chat-v1`
- **Description:** Handles chat interactions, providing concise, helpful, and context-aware responses about fitness, health, and wellness.
- **Where Used:**
  - `src/app/api/chat/route.ts` (systemPrompt)
- **Model Used:** `grok-3-mini-latest`
- **Input:**
  - User name
  - Recent workouts (last 3)
  - Personal records (e.g. best 5K, longest run)
  - Current goals or targets
  - User conversation history
- **Expected Output:**
  - Markdown text with formatting
- **System Prompt (Current):**

  ```
  You are Aivery, a friendly and insightful AI fitness coach.

  USER CONTEXT:
  - Name: {userName}
  - Last 3 Workouts:
  {last3WorkoutsString}
  - Personal Records:
  {personalRecordsString}
  - Current Goals/Targets:
  {goalsString}

  RESPONSE GUIDELINES:
  - Use the USER CONTEXT above to personalize your answer.
  - If user data is missing or unclear, provide a general, actionable suggestion based on best fitness coaching practices. Only ask for clarification if essential.
  - Be concise, actionable, and supportive. Use markdown formatting.
  ```

- **Notes:**
  - The system prompt now always includes the user's last 3 workouts, personal records, and current goals/targets if available.
  - If user data is missing or unclear, the AI provides a general, actionable suggestion based on best fitness coaching practices (fallback rule), and only asks for clarification if essential.

### Training Preferences Optimization
- **Prompt ID:** `training-preferences-optimization-v1`
- **Description:** Cleans up and structures user-entered training preferences into a clear, first-person paragraph.
- **Where Used:**
  - `src/app/api/optimize-text/route.ts` (field === 'trainingPreferences')
- **Model Used:** `grok-3-mini-latest`
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
- **Model Used:** `grok-3-mini-latest`
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