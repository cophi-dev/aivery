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
- **Prompt ID:** `workout-plan-generation-v1`
- **Description:** Produces a concise, actionable 1-week workout plan based on user goals, PRs, and recent history.
- **Where Used:**
  - `src/app/api/ai/coach/route.ts` (plan generation logic)
- **Model Used:** `grok-3-mini-latest`
- **Input:**
  - User name
  - User goal
  - Exercise PRs
  - Recent workout history
- **Expected Output:**
  - Markdown text (structured plan)
- **Notes:**

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
  - Database schema overview
  - Context (data fetched based on query)
  - User conversation history
- **Expected Output:**
  - Markdown text with formatting
- **Notes:**

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