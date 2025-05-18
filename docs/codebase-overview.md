# Aivery Codebase Overview

## What is Aivery?
Aivery is an AI-powered fitness platform that helps users track workouts, sync data from Strava and other sources, and receive personalized insights and plans. The system leverages LLMs (configurable via environment variable) for workout summaries, motivational quotes, and coaching, and stores all user and workout data in MongoDB.

---

## Folder Structure (Key Areas)

- **/src/app/api/** – All API endpoints (REST/Next.js API routes). Includes:
  - `/ai/` (AI prompts, insights, chat)
    - **NOTE:** Running plan generation now uses only running workouts, and the system prompt *explicitly* instructs the LLM to use average weekly running distance (last 4 weeks), longest run, fastest pace, and the last 5 running workouts for context. The prompt warns to NOT base the plan only on the most recent run. Fallback logic for vague queries also uses this context and retries with stricter instructions if needed.
  - `/strava/` (Strava integration, sync, webhooks)
  - `/workouts/`, `/exercises/`, `/user/` (core data endpoints)
  - `/workout-insight/` (generates fun facts with real-world comparisons)
- **/src/lib/** – Core business logic, data access, and integrations:
  - `/db/` (MongoDB models, repositories, connection, seeders)
  - `/services/` (Strava, file parsing, integrations)
  - `/strava/` (Strava-specific helpers)
  - `/workout-distance-comparisons.ts` (landmark comparisons for cardio workouts)
  - Utility modules for AI, actions, and more
    - **NOTE:** AI context for running plans and fallback suggestions is now based on running-only data, with weekly mileage summary, longest run, fastest pace, and distance normalization.
- **/src/components/** – React UI components:
  - `/dashboard/` (dashboard widgets, insights)
    - PRs display shows highest values sorted by value DESC, not random samples
  - `/exercises/`, `/exercise/` (exercise display, PRs)
  - `/ui/` (shared UI primitives: buttons, cards, dialogs, etc.)
  - `/features/` (feature-specific modals, slideshows)
  - `/forms/`, `/calendar/`, `/landing/`, `/providers/` (specialized UI)
- **/docs/** – Documentation:
  - `database-schema.md` (MongoDB schema, relationships)
  - `prompts.md` (AI prompt catalog)
  - `weekly-checklist.md` (maintenance checklist)
  - `features/` (feature-specific docs)

---

## Data Flow: Strava → API → Mongo → AI → UI

1. **User connects Strava** (or logs a workout manually)
2. **API** endpoints in `/src/app/api/strava/` handle OAuth, sync, and webhooks
3. **Workout data** is stored in MongoDB via `/src/lib/db/` repositories
4. **AI endpoints** (e.g., `/src/app/api/ai/`) generate insights, summaries, and plans using LLMs (model is environment-configurable)
5. **UI components** in `/src/components/` display data, insights, and feedback to the user

---

## Key Features

1. **Personalized AI Highlights** - Each workout gets an AI-generated highlight statement that references:
   - For running/cycling: Real-world landmark comparisons (e.g., "like running from Central Park to Times Square")
   - For strength workouts: Intuitive volume comparisons (e.g., "equivalent to lifting 0.5 cars")

2. **Flexible LLM Integration** - All LLM calls use a central provider-agnostic service, configurable via environment variables.

3. **Strava Integration** - Seamless import of workouts from Strava with proper conversion and normalization.

---

## Key Docs
- [Database Schema](./database-schema.md)
- [AI Prompts](./prompts.md)

---

# Codebase Inventory

Generated on: 5/5/2025, 10:11:10 PM

| File Path | Purpose | Main Export | Status |
|-----------|---------|-------------|--------|
| tailwind.config.js | @type {import('tailwindcss').Config} | No named export found | ❌ |
| server.js | when using middleware `hostname` and `port` must be provided below | No named export found | ✅ |
| repair.js | Simple repair script with direct MongoDB connection | No named export found | ✅ |
| postcss.config.js | No description available | No named export found | ❌ |
| next.config.js | @type {import('next').NextConfig} | No named export found | ❌ |
| generateCodebaseOverview.js | Extract the first comment block from file content
 @param {string} content - File content
 @returns ... | No named export found | ❌ |
| scripts/update-user.js | No description available | No named export found | ❌ |
| scripts/update-manifest.js | Path to manifest file | No named export found | ❌ |
| scripts/test-grok.js | Test script for Grok API | No named export found | ❌ |
| scripts/test-endpoints.js | Test script for AI endpoints | No named export found | ❌ |
| scripts/fix-buffer-errors.js | This script helps fix the MongoDB Buffer serialization warnings
 by patching MongoDB's toJSON method... | No named export found | ❌ |
| temp/exercises.json/jest.config.js | No description available | No named export found | ❌ |
| src/scripts/repair-workout-exercises.js | Script to repair workout exercise relationships | No named export found | ❌ |
| src/pages/api/auth/reset-session.js | Special API endpoint to force-reset the user's session state | handler (default) | ❌ |
| playwright.config.ts | No description available | defineConfig (default) | ❌ |
| next-env.d.ts | / <reference types="next" />
/ <reference types="next/image-types/global" />
/ <reference types="nex... | No named export found | ❌ |
| types/db.ts | No description available | No named export found | ✅ |
| prisma/seed.ts | Helper to get random integer | No named export found | ❌ |
| src/middleware.ts | Paths that are considered public (accessible without authentication) | config (named) | ✅ |
| scripts/tag-exercises.ts | Use CommonJS require syntax | No named export found | ❌ |
| scripts/seed-exercises.ts | Define the exercises to add
 Using singular, title-case names for consistency | No named export found | ❌ |
| scripts/populate-exercise-details.ts | Configuration | No named export found | ❌ |
| scripts/import-exercises.ts | Use ES Module import syntax | No named export found | ❌ |
| scripts/createDemoUser.ts | ESM way to get __dirname equivalent
 const __filename = fileURLToPath(import.meta.url);  No longer n... | No named export found | ❌ |
| scripts/clear_workouts.ts | No description available | No named export found | ❌ |
| scripts/clear_workout_exercises.ts | No description available | No named export found | ❌ |
| scripts/clear_exercises.ts | No description available | No named export found | ❌ |
| scripts/clear_all_demo_data.ts | No description available | No named export found | ❌ |
| scripts/backfill-workout-volumes.ts | scripts/backfill-workout-volumes.ts | No named export found | ❌ |
| scripts/backfill-user-summaries.ts | scripts/backfill-user-summaries.ts | No named export found | ❌ |
| scripts/backfill-exercise-prs.ts | scripts/backfill-exercise-prs.ts | No named export found | ❌ |
| scripts/backfill-exercise-flags.ts | Load environment variables from .env.local file | No named export found | ❌ |
| src/scripts/repair-workout-exercises.ts | Script to repair workout exercise relationships | No named export found | ❌ |
| src/scripts/fix-strava-distances.ts | Script to fix distances for existing Strava workouts
 This corrects workouts that were imported with... | No named export found | ❌ |
| src/types/next-themes.d.ts | List of all available theme names | useTheme (named) | ❌ |
| src/types/mongodb.d.ts | No description available | getCollection (named) | ❌ |
| src/types/fit-file-parser.d.ts | No description available | No named export found | ❌ |
| src/types/db.ts | No description available | No named export found | ✅ |
| src/lib/workout-exercise-actions.ts | Fetch all workout exercises for a workout | No named export found | ❌ |
| src/lib/workout-distance-comparisons.ts | Generates a fun, descriptive text comparing the target workout distance
 to a real-world distance be... | generateDistanceComparisonText (named) | ✅ |
| src/lib/workout-actions.ts | Calculates and updates the performanceSummary and overall personalRecords
 fields for a given user b... | No named export found | ✅ |
| src/lib/utils.ts | Helper function to safely extract text from Claude API response content
 
 @param content The conten... | cn (named) | ✅ |
| src/lib/suppress-warnings.ts | This file contains utilities to suppress specific React warnings
 that occur due to MongoDB ObjectID... | No named export found | ❌ |
| src/lib/strava.ts | Refreshes the Strava access token using the refresh token.
 Updates the account in the database with... | No named export found | ✅ |
| src/lib/strava-actions.ts | No description available | No named export found | ✅ |
| src/lib/prisma.ts | No description available | prisma (named) | ✅ |
| src/lib/integration-actions.ts | Mock user ID for demo purposes | No named export found | ✅ |
| src/lib/generateImagePrompt.ts | Helper function to format duration (seconds -> H:MM:SS) | generatePrompt (named) | ✅ |
| src/lib/exercise-db-api.ts | Fetches detailed information (description, GIF) for a given exercise name 
 from the public Exercise... | No named export found | ✅ |
| src/lib/exercise-actions.ts | Fetch exercises, potentially filtered by tags | No named export found | ✅ |
| src/lib/db.ts | Example function to get user workouts | No named export found | ✅ |
| src/lib/dashboard-metrics.ts | Simplified version of WorkoutExerciseData for our needs | No named export found | ✅ |
| src/lib/client-utils.ts | Client-side utility functions for handling API requests | No named export found | ✅ |
| src/lib/challenge-actions.ts | Fetches challenges for the current month for the logged-in user.
 If challenges don't exist, generat... | No named export found | ✅ |
| src/lib/auth.ts | Add debug info about cookie domain | authOptions (named) | ✅ |
| src/lib/auth-utils.ts | Helper function to check if a user is authenticated for API routes
 Returns the session if authentic... | withApiAuth (named) | ✅ |
| src/lib/ai-workout-insights.ts | Generate insights about an exercise based on previous workout data
 
 @param exerciseHistory The pre... | No named export found | ❌ |
| src/lib/ai-preferences.ts | Fetches the user's AI personalization preferences
 @returns The user's AI preferences or default val... | getDefaultAiPreferences (named) | ❌ |
| src/lib/ai-exercise-generator.ts | Generate exercise details by looking up the exercise in the MongoDB database.
 
 @param exerciseName... | No named export found | ❌ |
| src/lib/actions.ts | Mock user ID for demo purposes
 In a real app, you would get this from the session | No named export found | ✅ |
| src/hooks/useDebounce.ts | Custom hook that debounces a value.
 
 @param value The value to debounce.
 @param delay The debounc... | useDebounce (named) | ✅ |
| src/app/version.ts | Version file for tracking builds and forcing cache invalidation | VERSION (named) | ✅ |
| src/app/serverconfig.ts | Configuration to increase server limits for Next.js
 This helps prevent HTTP 431 errors due to large... | serverConfig (named) | ❌ |
| src/app/dynamic-config.ts | This file ensures all pages are server-rendered dynamically
 Import this file in layout.tsx to apply... | configureDynamicRendering (default) | ✅ |
| src/lib/strava/webhook.ts | The verification token used in the webhook endpoint | WEBHOOK_VERIFY_TOKEN (named) | ✅ |
| src/lib/strava/config.ts | No description available | STRAVA_CONFIG (named) | ✅ |
| src/lib/services/workoutService.ts | Mock user ID for demo purposes | No named export found | ❌ |
| src/lib/services/stravaService.ts | Transform a Strava activity to our workout format | SUPPORTED_ACTIVITY_TYPES (named) | ✅ |
| src/lib/services/stravaArchiveService.ts | We need FitFileParser and xml2js potentially
 import FitFileParser from 'fit-file-parser';  Or the c... | mapStravaType (named) | ✅ |
| src/lib/services/integrationService.ts | Mock user ID for demo purposes | No named export found | ✅ |
| src/lib/services/gpxFileService.ts | No description available | GpxFileParser (named) | ✅ |
| src/lib/services/fitFileService.ts | No description available | FitFileParser (named) | ✅ |
| src/lib/services/activityService.ts | No description available | ActivityProcessor (named) | ❌ |
| src/lib/db/workouts-db.ts | Mock user ID for demo purposes | No named export found | ❌ |
| src/lib/db/utils.ts | Utility functions for handling MongoDB documents | sanitizeWorkoutData (named) | ✅ |
| src/lib/db/mongoose.ts | Remove top-level check
 const MONGODB_URI = process.env.MONGODB_URI
 if (!MONGODB_URI) {
   throw ne... | dbConnect (default) | ✅ |
| src/lib/db/mongodb.ts | *:***@') 
  : 'undefined'
console.log(`MongoDB URI format: ${logUri.substring(0, 15)}...`)

interfac... | dbConnect (default) | ✅ |
| src/lib/db/middleware.ts | A middleware helper for API routes to ensure DB connection | withDbConnection (named) | ✅ |
| src/lib/db/init-db.ts | Test user email for development | No named export found | ✅ |
| src/lib/db/connection.ts | Database client to abstract MongoDB operations | getDbClient (named) | ✅ |
| temp/exercises.json/scripts/psql-builder.ts | npm run build:psql <db.name> | 'exercises'; | No named export found | ❌ |
| temp/exercises.json/scripts/json-builder.ts | No description available | No named export found | ❌ |
| @/lib/db/repositories/workoutRepository.ts | Find workout by ID | No named export found | ✅ |
| temp/exercises.json/types/measure.d.ts | No description available | No named export found | ❌ |
| temp/exercises.json/types/exercise.d.ts | No description available | No named export found | ❌ |
| src/app/actions/workoutActions.ts | Server action to fetch Personal Record (PR) data for the current user. | No named export found | ❌ |
| src/app/actions/workout.ts | No description available | No named export found | ✅ |
| src/app/actions/workout-actions.ts | Fetches a summary of a user's workouts
 Includes total count, duration, distance, and most common wo... | No named export found | ✅ |
| src/app/actions/delete-workouts.ts | Wrapper function to handle form submissions | No named export found | ✅ |
| src/app/api/route.ts | This file forces all API routes to be dynamic by setting a parent route with dynamic configuration | dynamic (named) | ✅ |
| src/app/api/force-dynamic.ts | This file exports configuration to force dynamic behavior in API routes
 Import this in API route fi... | dynamic (named) | ✅ |
| src/lib/db/repositories/workoutRepository.ts | Helper function to convert MongoDB documents to plain objects
 This recursively converts all ObjectI... | getUserWorkouts (named) | ✅ |
| src/lib/db/repositories/workoutExerciseRepository.ts | Convert Mongoose document to WorkoutExerciseData | No named export found | ✅ |
| src/lib/db/repositories/userRepository.ts | Original functions wrapped with withDbConnection middleware | createUser (named) | ✅ |
| src/lib/db/repositories/integrationRepository.ts | No description available | No named export found | ✅ |
| src/lib/db/repositories/exerciseRepository.ts | Convert Mongoose document to ExerciseData | No named export found | ✅ |
| src/lib/db/models/workoutExercise.ts | Interface for a single set (primarily for strength) | mongoose (default) | ✅ |
| src/lib/db/models/workout.ts | Define schema for individual time-series data points | mongoose (default) | ✅ |
| src/lib/db/models/weightHistory.ts | Create an index on userId and date for efficient queries | mongoose (default) | ✅ |
| src/lib/db/models/user.ts | --- NEW SCHEMAS for Summaries --- | mongoose (default) | ✅ |
| src/lib/db/models/set.ts | Interface representing a document in MongoDB. | mongoose (default) | ✅ |
| src/lib/db/models/session.ts | No description available | mongoose (default) | ✅ |
| src/lib/db/models/integration.ts | Create a compound index to ensure a user can only have one integration per provider | mongoose (default) | ✅ |
| src/lib/db/models/exercisePR.ts | No description available | mongoose (default) | ✅ |
| src/lib/db/models/exercise.ts | Define specific types for clarity | mongoose (default) | ✅ |
| src/lib/db/models/activityInsight.ts | Define the structure for the stored insight data | ActivityInsightModel (default) | ✅ |
| src/lib/db/models/account.ts | Create a compound index to ensure uniqueness of provider + providerAccountId | mongoose (default) | ✅ |
| temp/exercises.json/scripts/__tests__/psql-builder.test.ts | No description available | No named export found | ❌ |
| temp/exercises.json/scripts/__tests__/json-builder.test.ts | No description available | No named export found | ❌ |
| src/app/api/user/route.ts | Main handler wrapped with authentication | GET (named) | ✅ |
| src/app/api/workout-data/route.ts | This endpoint will be used by the AI to fetch workout data dynamically | dynamic (named) | ✅ |
| src/app/api/workouts/route.ts | GET /api/workouts - Fetch workouts for the current user | dynamic (named) | ✅ |
| src/app/api/test-data/route.ts | This endpoint creates test workout data for a user | dynamic (named) | ✅ |
| src/app/api/test-query/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/strava-status/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/sync-user-workouts/route.ts | This endpoint will sync all workouts in the workouts collection with their respective users | dynamic (named) | ✅ |
| src/app/api/strava/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/quotes/route.ts | import Anthropic from "@anthropic-ai/sdk";  Removed unused import | dynamic (named) | ✅ |
| src/app/api/og-screenshot/route.ts | Determine the base URL based on Vercel environment or fallback to localhost | config (named) | ✅ |
| src/app/api/optimize-text/route.ts | import Anthropic from "@anthropic-ai/sdk";  REMOVED | maxDuration (named) | ✅ |
| src/app/api/reset-session/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/init-db/route.ts | Force dynamic execution, prevents static generation during build | dynamic (named) | ✅ |
| src/app/api/health/route.ts | No description available | No named export found | ✅ |
| src/app/api/debug-workouts/route.ts | No description available | No named export found | ✅ |
| src/app/api/debug-auth/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/my-story/route.ts | Generate a simple fallback story when the Anthropic API fails | dynamic (named) | ✅ |
| src/app/api/db-test/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/debug/route.ts | No description available | No named export found | ✅ |
| src/app/api/exercises/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/dashboard-workouts/route.ts | Ensure this route is never cached | dynamic (named) | ✅ |
| src/app/api/check-db/route.ts | Force dynamic execution, prevents static generation during build | dynamic (named) | ✅ |
| src/app/api/check-mongodb/route.ts | Force dynamic execution, prevents static generation during build | dynamic (named) | ✅ |
| src/app/api/chat/workout-analysis.ts | Force dynamic rendering and prevent caching | dynamic (named) | ✅ |
| src/app/api/chat/route.ts | Force dynamic rendering and prevent caching | dynamic (named) | ✅ |
| src/app/api/chat/fresh-data.ts | Helper function to get fresh workout data by forcing a new connection
 This helps prevent caching is... | generateWorkoutTypeSummaries (named) | ✅ |
| src/app/api/challenges/route.ts | Simplify Prisma import - rely on TS resolution from instance | No named export found | ✅ |
| src/app/api/workout/debug/route.ts | Force dynamic execution, prevents static generation during build | dynamic (named) | ✅ |
| src/app/api/user/weight-history/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/user/profile/route.ts | No description available | No named export found | ✅ |
| src/app/api/user/password/route.ts | Add an interface for the user with password | No named export found | ✅ |
| src/app/api/user/delete-workouts/route.ts | DELETE /api/user/delete-workouts
 Deletes all workouts of specified types for the current user.
 Req... | dynamic (named) | ✅ |
| src/app/api/user/physical/route.ts | No description available | No named export found | ✅ |
| src/app/api/user/image/route.ts | No description available | No named export found | ✅ |
| src/app/api/user/delete/route.ts | Import all necessary models | No named export found | ✅ |
| src/app/api/user/ai-preferences/route.ts | PUT /api/user/ai-preferences - Update AI personalization preferences | dynamic (named) | ✅ |
| src/app/api/user/avatar/route.ts | Helper function to properly serialize MongoDB objects | GET (named) | ✅ |
| src/app/api/workout-insight/[workoutId]/route.ts | --- Fun Analogy Helpers --- | No named export found | ✅ |
| src/app/api/workouts/fix-strava-links/route.ts | Helper function to validate and format Strava ID | dynamic (named) | ✅ |
| src/app/api/workouts/delete-by-types/route.ts | POST /api/workouts/delete-by-types
 Simple endpoint to delete workouts by types without additional c... | dynamic (named) | ✅ |
| src/app/api/workouts/[id]/route.ts | No description available | No named export found | ✅ |
| src/app/api/workouts/fix-strava-data/route.ts | Ensure runtime is Node.js | runtime (named) | ✅ |
| src/app/api/workouts/delete/route.ts | POST /api/workouts/delete
 Deletes all workouts of specified types for the given user ID.
 This is a... | dynamic (named) | ✅ |
| src/app/api/strava-admin/generate-image/route.ts | Import the new prompt generation library | dynamic (named) | ✅ |
| src/app/api/strava-admin/activities/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/stripe/webhook/route.ts | --- MongoDB/Mongoose Imports --- | dynamic (named) | ✅ |
| src/app/api/stripe/create-portal-session/route.ts | Ensure Stripe secret key is defined | No named export found | ✅ |
| src/app/api/stripe/create-checkout-session/route.ts | import { getUserSubscriptionPlan } from '@/lib/stripe/subscription';  Placeholder for subscription c... | No named export found | ✅ |
| src/app/api/strava/webhook/route.ts | This is the verification token we'll configure in Strava
 Should be a random string, but we'll hardc... | dynamic (named) | ✅ |
| src/app/api/strava/upload-client/route.ts | Export dynamic runtime | dynamic (named) | ✅ |
| src/app/api/strava/test-activity/route.ts | Endpoint for testing Strava activity fetching and transformation | dynamic (named) | ✅ |
| src/app/api/strava/test/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/strava/test-webhook/route.ts | This is a debug endpoint for testing webhook functionality locally | No named export found | ✅ |
| src/app/api/strava/server-upload/route.ts | Set dynamic to force-dynamic to prevent caching | dynamic (named) | ✅ |
| src/app/api/strava/setup/route.ts | A simple secret key to prevent unauthorized access
 In a real app, use a proper authentication syste... | dynamic (named) | ✅ |
| src/app/api/strava/manual-import/route.ts | Keep runtime (Node.js needed for file handling) | runtime (named) | ✅ |
| src/app/api/strava/sync-recent/route.ts | Define the type directly as workaround for import issue | No named export found | ✅ |
| src/app/api/strava/process-batch/route.ts | Keep runtime (Node.js needed for processing) | runtime (named) | ✅ |
| src/app/api/strava/import/route.ts | --- Interface for Summary Stats --- START | runtime (named) | ✅ |
| src/app/api/strava/force-valid/route.ts | Endpoint to force a Strava connection to be considered valid | No named export found | ✅ |
| src/app/api/strava/import-status/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/strava/handle-blob-upload/route.ts | Use Node.js runtime as dependencies require it (e.g., for auth) | runtime (named) | ✅ |
| src/app/api/strava/generate-upload-url/route.ts | Export dynamic runtime | dynamic (named) | ✅ |
| src/app/api/strava/fix-distances/route.ts | Support both GET and POST methods | No named export found | ✅ |
| src/app/api/strava/check-upload/route.ts | Simple endpoint to test file uploads without processing | dynamic (named) | ✅ |
| src/app/api/strava/callback/route.ts | Helper function to check for Strava configuration issues | dynamic (named) | ✅ |
| src/app/api/strava/chunked-upload/route.ts | Set dynamic to force-dynamic to prevent caching | dynamic (named) | ✅ |
| src/app/api/strava/cleanup-blob/route.ts | This route is intentionally simple and just attempts deletion.
 It's called on error, so we don't wa... | dynamic (named) | ✅ |
| src/app/api/strava/chunk-upload/route.ts | API route for handling chunked uploads of large Strava exports
 This route receives chunks of a file... | runtime (named) | ✅ |
| src/app/api/strava/batch-status/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/strava/authorize/route.ts | Test that we can reach Strava API | dynamic (named) | ✅ |
| src/app/api/quotes/dynamic/route.ts | GET handler for dynamic quotes
 This endpoint always returns a different quote with each request
 No... | dynamic (named) | ✅ |
| src/app/api/debug/user-info/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/debug/image-check/route.ts | Explicitly mark this route as dynamic | dynamic (named) | ✅ |
| src/app/api/debug/avatar/route.ts | Explicitly mark this route as dynamic | dynamic (named) | ✅ |
| src/app/api/debug/nickname/route.ts | Explicitly mark this route as dynamic | dynamic (named) | ✅ |
| src/app/api/exercises/suggest/route.ts | import Anthropic from "@anthropic-ai/sdk";  REMOVED | dynamic (named) | ✅ |
| src/app/api/dashboard/metrics/route.ts | Force dynamic execution and disable caching for this route | dynamic (named) | ✅ |
| src/app/api/cron/cleanup-archive/route.ts | GET /api/cron/cleanup-archive
 
 Permanently deletes workouts that have been archived (soft-deleted)... | dynamic (named) | ✅ |
| src/app/api/exercises/history/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/chat/workout-analysis/route.ts | Force dynamic rendering and prevent caching | dynamic (named) | ✅ |
| src/app/api/auth/session/route.ts | No description available | No named export found | ✅ |
| src/app/api/auth/refresh-session/route.ts | Force dynamic rendering | dynamic (named) | ✅ |
| src/app/api/auth/debug-session/route.ts | No description available | No named export found | ✅ |
| src/app/api/auth/logout/route.ts | Force clear all session cookies | dynamic (named) | ✅ |
| src/app/api/auth/debug/route.ts | Debug route to check authentication status | dynamic (named) | ✅ |
| src/app/api/auth/register/route.ts | No description available | No named export found | ✅ |
| src/app/api/auth/[...nextauth]/route.ts | Enhanced NextAuth handler with debugging | No named export found | ✅ |
| src/app/api/auth/clear-session/route.ts | No description available | No named export found | ✅ |
| src/app/api/ai/workout-highlight/route.ts | Remove Google Generative AI import
 import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } ... | dynamic (named) | ✅ |
| src/app/api/ai/overview-insights/route.ts | Consider importing User model if needed for personalization
 import UserModel from '@/lib/db/models/... | No named export found | ✅ |
| src/app/api/ai/coach/route.ts | Generates an initial insightful message for a specific workout. | dynamic (named) | ✅ |
| src/app/api/ai/coach/dateUtils.ts | Calculates start and end dates for common period descriptions.
 @param period - e.g., "last_month", ... | calculateDateRange (named) | ✅ |
| src/app/api/ai/parse-workout/route.ts | Placeholder type for the structured data we expect from the AI
 TODO: Refine this based on the actua... | No named export found | ✅ |
| src/app/api/workout-insight/[workoutId]/insight/route.ts | TODO: Implement logic to generate insightful comparison statement | No named export found | ✅ |
| src/app/api/workouts/[id]/check/route.ts | No description available | dynamic (named) | ✅ |
| src/app/api/auth/callback/strava/route.ts | ... other imports ... | dynamic (named) | ✅ |
| src/app/page.tsx | Server component imports | Page (default) | ✅ |
| src/app/not-found.tsx | No description available | NotFound (default) | ❌ |
| src/app/loading.tsx | No description available | Loading (default) | ✅ |
| src/app/layout.tsx | Import the dynamic config to force dynamic rendering | async (default) | ✅ |
| src/app/cleanup.tsx | This is a standalone component to break the login loop
 It doesn't depend on any other components or... | ForceCleanup (default) | ✅ |
| src/lib/workout-utils.tsx | Copied from utils.ts | getWorkoutTypeStyle (named) | ✅ |
| src/components/workout-weekly-view.tsx | NEW: Import Switch and Label for the toggle | WorkoutWeeklyView (default) | ✅ |
| src/components/workout-summary.tsx | No description available | WorkoutSummary (default) | ❌ |
| src/components/workout-progress-graph.tsx | Define the props for the component - Now accepting raw data | WorkoutProgressGraph (default) | ❌ |
| src/components/workout-monthly-view.tsx | Import AiveryInsights | WorkoutMonthlyView (default) | ✅ |
| src/components/workout-list-view.tsx | Define types for sorting | WorkoutListView (default) | ✅ |
| src/components/workout-list-display.tsx | Define the structure of a single workout item based on API response | WorkoutListDisplay (named) | ✅ |
| src/components/workout-history.tsx | Add missing popover components temporarily - will be replaced with proper imports | WorkoutHistory (default) | ❌ |
| src/components/workout-daily-view.tsx | import { getWorkoutsByDateRange } from '@/lib/workout-actions';  Assuming an action exists/will exis... | WorkoutDailyView (default) | ✅ |
| src/components/workout-analysis.tsx | No description available | WorkoutAnalysis (named) | ✅ |
| src/components/user-navigation.tsx | Inner component that only renders when session is valid | UserNavigation (named) | ✅ |
| src/components/user-avatar.tsx | No description available | UserAvatar (named) | ✅ |
| src/components/user-account-nav.tsx | No description available | UserAccountNav (named) | ❌ |
| src/components/theme-switcher.tsx | No description available | ThemeSwitcher (named) | ❌ |
| src/components/strava-import.tsx | --- Define structure for import status polling response --- START | StravaImport (named) | ✅ |
| src/components/recent-workouts.tsx | No description available | RecentWorkouts (default) | ❌ |
| src/components/progress-chart.tsx | No description available | ProgressChart (default) | ❌ |
| src/components/persistent-chat.tsx | --- Rate Limit Message Variations --- | PersistentChat (named) | ✅ |
| src/components/main-header.tsx | No description available | MainHeader (named) | ✅ |
| src/components/image-crop-dialog.tsx | No description available | ImageCropDialog (named) | ✅ |
| src/components/icons.tsx | No description available | Icons (named) | ✅ |
| src/components/header.tsx | No description available | Header (named) | ✅ |
| src/components/delete-workout-button.tsx | No description available | DeleteWorkoutButton (named) | ❌ |
| src/components/debug-image.tsx | No description available | DebugImage (named) | ✅ |
| src/components/chat.tsx | No description available | No named export found | ✅ |
| src/components/cache-buster.tsx | Client-side cache buster component
 Forces a refresh if the version is different from what's stored ... | CacheBuster (default) | ❌ |
| src/components/avatar-loader.tsx | No description available | AvatarLoader (named) | ✅ |
| src/components/UserNicknameDisplay.tsx | No description available | UserNicknameDisplay (default) | ✅ |
| src/components/UpgradeButton.tsx | Ensure the publishable key is available | UpgradeButton (named) | ✅ |
| src/app/workouts-direct/page.tsx | Force dynamic rendering | async (default) | ✅ |
| src/app/workouts/summary.tsx | No description available | WorkoutSummary (default) | ✅ |
| src/app/workouts/page.tsx | Import Tabs component from Shadcn UI | WorkoutsPage (default) | ✅ |
| src/app/workouts/client-page.tsx | No description available | ClientWorkoutsPage (default) | ❌ |
| src/app/strava-admin/page.tsx | No direct import of IWorkout needed if we define the list item type here | StravaAdminPage (default) | ✅ |
| src/app/settings/page.tsx | No description available | SettingsPage (default) | ✅ |
| src/app/reset/page.tsx | No description available | ResetPage (default) | ✅ |
| src/app/register/page.tsx | No description available | RegisterPage (default) | ✅ |
| src/app/planner/page.tsx | Define the expected exercise input structure based on createWorkout signature | WorkoutPlannerPage (default) | ✅ |
| src/app/plan/page.tsx | No description available | PlanPage (default) | ✅ |
| src/app/my-story/page.tsx | No description available | MyStoryPage (default) | ✅ |
| src/app/login/page.tsx | No description available | LoginPage (default) | ✅ |
| src/app/login/layout.tsx | Use static rendering for login page | LoginLayout (default) | ✅ |
| src/app/init-db/page.tsx | No description available | InitDbPage (default) | ✅ |
| src/app/integrations/page.tsx | No description available | IntegrationsPage (default) | ✅ |
| src/app/health/page.tsx | No description available | HealthCheckPage (default) | ✅ |
| src/app/fix-auth/page.tsx | No description available | FixAuthPage (default) | ✅ |
| src/app/forgot-password/page.tsx | No description available | ForgotPasswordPage (default) | ✅ |
| src/app/debug/page.tsx | No description available | DebugPage (default) | ✅ |
| src/app/debug-images/page.tsx | No description available | DebugImagesPage (default) | ✅ |
| src/app/exercises/page.tsx | Revalidate this page on demand or periodically if needed
 export const revalidate = 3600;  Example: ... | async (default) | ✅ |
| src/app/check-db/page.tsx | No description available | CheckDbPage (default) | ✅ |
| src/app/dashboard/page.tsx | import { headers } from 'next/headers';  headers() only works in Server Components | DashboardPage (default) | ✅ |
| src/app/challenges/page.tsx | Remove "use client"; directive | async (default) | ✅ |
| src/app/challenges/challenge-list-client.tsx | --- Helper functions (Copied from original page.tsx) --- | ChallengeListClient (named) | ✅ |
| src/app/calendar/page.tsx | No description available | CalendarPage (default) | ✅ |
| src/app/chat/page.tsx | Define Message type clearly | ChatPage (default) | ✅ |
| src/app/analytics/page.tsx | No description available | AnalyticsPage (default) | ✅ |
| src/components/ui/use-toast.tsx | No description available | reducer (named) | ✅ |
| src/components/ui/tooltip.tsx | No description available | No named export found | ✅ |
| src/components/ui/toggle.tsx | No description available | No named export found | ✅ |
| src/components/ui/toggle-group.tsx | No description available | No named export found | ✅ |
| src/components/ui/toast.tsx | No description available | ToastProvider (named) | ✅ |
| src/components/ui/textarea.tsx | No description available | No named export found | ✅ |
| src/components/ui/text-generate-effect.tsx | No description available | TextGenerateEffect (named) | ✅ |
| src/components/ui/tabs.tsx | No description available | No named export found | ✅ |
| src/components/ui/switch.tsx | No description available | No named export found | ✅ |
| src/components/ui/steps.tsx | No description available | Steps (named) | ❌ |
| src/components/ui/splash-cursor.tsx | No description available | No named export found | ✅ |
| src/components/ui/skeleton.tsx | No description available | No named export found | ✅ |
| src/components/ui/sheet.tsx | No description available | No named export found | ✅ |
| src/components/ui/separator.tsx | No description available | No named export found | ✅ |
| src/components/ui/select.tsx | No description available | No named export found | ✅ |
| src/components/ui/scroll-area.tsx | No description available | No named export found | ✅ |
| src/components/ui/radio-group.tsx | No description available | No named export found | ✅ |
| src/components/ui/progress.tsx | No description available | No named export found | ✅ |
| src/components/ui/popover.tsx | No description available | No named export found | ✅ |
| src/components/ui/metric-card.tsx | Remove Card import
 import { Card } from "@/components/ui/card";
 Import icons for trend display | MetricContent (default) | ✅ |
| src/components/ui/loading-indicator.tsx | Define loading messages | LoadingIndicator (named) | ✅ |
| src/components/ui/label.tsx | No description available | No named export found | ✅ |
| src/components/ui/input.tsx | No description available | No named export found | ✅ |
| src/components/ui/inline-spinner.tsx | No description available | InlineSpinner (named) | ✅ |
| src/components/ui/glow-effect.tsx | No description available | GlowEffect (named) | ✅ |
| src/components/ui/dropdown-menu.tsx | No description available | No named export found | ✅ |
| src/components/ui/double-metric-card.tsx | Helper to render change indicator (adapted from MetricCard) | DoubleMetricCard (default) | ❌ |
| src/components/ui/dialog.tsx | No description available | No named export found | ✅ |
| src/components/ui/command.tsx | No description available | No named export found | ✅ |
| src/components/ui/collapsible.tsx | No description available | No named export found | ✅ |
| src/components/ui/checkbox.tsx | No description available | No named export found | ✅ |
| src/components/ui/card.tsx | No description available | No named export found | ✅ |
| src/components/ui/calendar.tsx | No description available | No named export found | ✅ |
| src/components/ui/button.tsx | No description available | No named export found | ✅ |
| src/components/ui/badge.tsx | No description available | No named export found | ✅ |
| src/components/ui/avatar.tsx | No description available | No named export found | ✅ |
| src/components/ui/alert.tsx | No description available | No named export found | ✅ |
| src/components/ui/alert-dialog.tsx | No description available | No named export found | ❌ |
| src/components/landing/landing-page-client.tsx | Define features array here or import if needed | LandingPageClient (default) | ✅ |
| src/components/providers/theme-provider.tsx | When Next.js router changes routes, this prevents flashing | ThemeProvider (named) | ❌ |
| src/components/providers/auth-provider.tsx | No description available | AuthProvider (named) | ✅ |
| src/components/forms/edit-workout-form.tsx | No description available | EditWorkoutForm (named) | ✅ |
| src/components/features/InfoDisplayModal.tsx | --- Data structure for parsed sections --- | InfoDisplayModal (named) | ✅ |
| src/components/features/ConceptSlideshow.tsx | No description available | ConceptSlideshow (named) | ✅ |
| src/components/calendar/workout-card.tsx | No description available | WorkoutCard (named) | ✅ |
| src/components/calendar/date-picker.tsx | No description available | DatePicker (named) | ✅ |
| src/components/exercise/exercise-detail-client.tsx | Define helper functions (can be outside or inside component scope in client components) | ExerciseDetailPageClient (default) | ✅ |
| src/components/dashboard/WeeklyOverview.tsx | No description available | WeeklyOverview (named) | ❌ |
| src/components/dashboard/AiveryInsights.tsx | Placeholder type for API response - adapt as needed | AiveryInsights (default) | ✅ |
| src/components/exercises/exercise-list.tsx | Mapping for display names and URL values | ExerciseList (named) | ❌ |
| src/components/exercises/exercise-grid.tsx | No description available | ExerciseGrid (named) | ✅ |
| src/app/workouts/new/page.tsx | Type guard to filter out nulls | NewWorkoutPage (default) | ✅ |
| src/app/workouts/[id]/page.tsx | Helper function to get icon based on workout type | ActivityDetailPage (default) | ✅ |
| src/app/workouts/[id]/client-page.tsx | No description available | ActivityDetailClient (default) | ❌ |
| src/app/settings/strava/repair-button.tsx | No description available | RepairStravaDataButton (default) | ✅ |
| src/app/settings/strava/page.tsx | No description available | async (default) | ✅ |
| src/app/settings/strava/fix-button.tsx | No description available | FixStravaDataButton (default) | ❌ |
| src/app/settings/strava/distance-fix.tsx | No description available | DistanceRepairPage (default) | ✅ |
| src/app/settings/strava/disconnect-button.tsx | No description available | StravaDisconnectButton (default) | ✅ |
| src/app/settings/strava/connect-button.tsx | No description available | StravaConnectButton (default) | ✅ |
| src/app/exercises/new/page.tsx | No description available | NewExercisePage (default) | ✅ |
| src/app/exercises/[id]/page.tsx | Imports needed ONLY by Server Component & Metadata | async (default) | ✅ |
| src/app/dashboard/_components/SubscriptionStatusClient.tsx | Client component for Subscription Status and Management | SubscriptionStatus (named) | ✅ |
| src/app/dashboard/_components/SpotlightCardsClient.tsx | --- Keyword & Question Lists (defined locally) --- | SpotlightCards (named) | ✅ |
| src/app/dashboard/_components/QuickActionsCardClient.tsx | Define the props for the component, including the function to send messages | QuickActionsCard (named) | ✅ |
| src/app/dashboard/_components/ProgressCardsClient.tsx | --- Formatting Helpers (defined locally) ---
 Format volume (assuming kg) | ProgressCards (named) | ✅ |
| src/app/dashboard/_components/PersonalRecordsCardClient.tsx | Base type for a single record entry (value and date are required) | PersonalRecordsCard (named) | ✅ |
| src/app/dashboard/_components/LogWorkoutButtonClient.tsx | No description available | LogWorkoutButton (named) | ✅ |
| src/app/dashboard/_components/DashboardHeaderClient.tsx | No description available | DashboardHeader (named) | ✅ |
| src/app/auth/signin/page.tsx | No description available | async (default) | ✅ |
| src/app/activity/new/page.tsx | No description available | NewActivityPage (default) | ✅ |
| src/app/workout/session/[id]/page.tsx | No description available | WorkoutSessionPage (default) | ✅ |
| src/app/workout/start/[id]/page.tsx | This component acts as a bridge that copies the workout and redirects to the session page | StartWorkoutPage (default) | ✅ |
| src/app/workouts/[id]/edit/page.tsx | No description available | EditWorkoutRedirect (default) | ✅ |
| src/app/workout/edit/[id]/page.tsx | No description available | EditWorkoutRedirect (default) | ✅ |
| src/app/settings/strava/fix-distances/page.tsx | No description available | FixDistancesPage (default) | ✅ |
| src/app/activity/running/new/page.tsx | No description available | NewRunningActivityPage (default) | ✅ |
| src/app/activity/swimming/new/page.tsx | No description available | NewSwimmingActivityPage (default) | ✅ |
| src/app/activity/cycling/new/page.tsx | No description available | NewCyclingActivityPage (default) | ✅ |

Both `/api/chat` and `/api/ai/coach` endpoints now enforce that vague queries (intent: 'unknown') with user context result in a concrete, actionable suggestion. If the LLM response is too generic, the system retries with a more forceful prompt. See `docs/prompts.md` (Proactive Fallback for Vague Queries) for details.

## LLM Integration Architecture (2024)

- **Centralized LLM Helper:** All LLM (Large Language Model) API calls are routed through `src/lib/services/llm.ts` using the `callLLM` helper function.
- **Provider/Model Selection:** LLM provider and model are standardized to use OpenAI with `gpt-4.1-mini-2025-04-14`. All configuration is done via environment variables (e.g., `LLM_PROVIDER_*`, `LLM_MODEL_*`).
- **Provider/Model Logging:** Every LLM call logs the provider and model used for traceability and debugging.
- **Prompt Handling:** Prompt fallback, retry logic for vague queries, and follow-up instruction handling are implemented centrally for consistency and maintainability.
- **No Direct Fetch Calls:** All previous direct fetch calls to LLM APIs have been removed or refactored.
