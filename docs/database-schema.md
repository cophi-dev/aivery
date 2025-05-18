# MongoDB Database Schema

This document outlines the MongoDB collections used in the Aivery application, including their fields, relationships, and usage.

## Collections Overview

| Collection | Purpose | Related Collections |
|------------|---------|---------------------|
| `users` | Stores user account information and preferences | `workouts`, `accounts`, `sessions`, `integrations` |
| `workouts` | Stores workout data for all users | `users`, `workoutExercises` |
| `exercises` | Library of available exercises | `workoutExercises` |
| `workoutExercises` | Links exercises to specific workouts | `workouts`, `exercises`, `sets` |
| `sets` | Individual sets performed for each exercise | `workoutExercises` |
| `exercisePRs` | Personal records for specific exercises | `users`, `exercises` |
| `integrations` | Third-party service connections (Strava, etc.) | `users` |
| `activityInsights` | AI-generated insights about workouts | `users`, `workouts` |
| `accounts` | OAuth account connections | `users` |
| `sessions` | Authentication sessions | `users` |
| `weightHistory` | Tracks user weight changes over time | `users` |
| `dailyInsights` | Stores generated daily insights | `users` |

## Algorithmically Generated Data

The following data are generated algorithmically and are not stored in the database:

1. **Workout Distance Comparisons**: Landmark comparisons (e.g., "ran from Central Park to Times Square") are generated dynamically in `src/lib/workout-distance-comparisons.ts` using a fixed list of landmarks and distances.

2. **Volume Comparisons**: Object weight comparisons (e.g., "lifted 0.5 cars") are calculated on-the-fly in both `src/app/api/ai/workout-highlight/route.ts` and `src/app/api/workout-insight/[workoutId]/route.ts` using predefined object weights.

3. **Muscle Group Analysis**: Training coverage and balance insights are calculated dynamically in `src/app/api/workout-analysis/route.ts` by analyzing exercise muscle groups. The analysis normalizes muscle group terminology, weighs primary vs. secondary involvement, and identifies potentially neglected areas based on frequency thresholds.

These analytical outputs are generated when requested and used for insights rather than being stored persistently.

## Collection Details

### `users`

**Description**: Main collection storing user account information and preferences.

**Fields**:
- `_id`: ObjectId (primary key)
- `name`: String (required)
- `email`: String (required, unique)
- `password`: String (required, excluded from default queries)
- `image`: String
- `nickname`: String
- `height`: Number
- `weight`: Number
- `age`: Number
- `gender`: String
- `activityLevel`: String
- `goals`: Array of Strings
- `workouts`: Array of ObjectIds (references to Workout collection)
- `plans`: Array of ObjectIds
- `emailVerified`: Date
- `accounts`: Array of ObjectIds (references to Account collection)
- `sessions`: Array of ObjectIds (references to Session collection)
- `aiPreferences`: Object
  - `location`: String
  - `units`: String (default: 'metric')
  - `trainingPreferences`: String
  - `fitnessGoals`: String
  - `dietaryPreferences`: String
- `tier`: String (enum: ['free', 'premium', 'expert'], default: 'free')
- `stripeCustomerId`: String (unique, sparse)
- `stripeSubscriptionId`: String (unique, sparse)
- `stripeSubscriptionStatus`: String
- `planExpiresAt`: Date
- `performanceSummary`: Object
  - `overallTotals`: Object
    - `distance`: Number (km)
    - `duration`: Number (seconds)
    - `volume`: Number (kg)
    - `count`: Number
  - `lastWorkoutDate`: Date
- `personalRecords`: Object
  - `longestRun`: Object
    - `value`: Number
    - `date`: Date
    - `workoutId`: ObjectId
  - `fastest5kPace`: Object
    - `value`: Number
    - `date`: Date
    - `workoutId`: ObjectId
  - `maxStrengthVolume`: Object
    - `value`: Number
    - `date`: Date
    - `workoutId`: ObjectId
- `dailyGrokTokenUsage`: Number (default: 0)
- `lastGrokUsageReset`: Date
- `createdAt`: Date
- `updatedAt`: Date

**Indexes**:
- `email`: Unique index

**Used by**:
- Authentication system
- User profile management
- AI personalization
- Subscription management

### `workouts`

**Description**: Stores all workout data for users.

**NOTE:** Running plan generation and fallback logic for AI now use only running workouts, and the system prompt *explicitly* instructs the LLM to use average weekly running distance (last 4 weeks), longest run, fastest pace, and the last 5 running workouts for context. The prompt warns to NOT base the plan only on the most recent run. Distance is normalized from both top-level and cardioDetails fields for context.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `name`: String (required)
- `date`: Date (required)
- `duration`: Number (required, total duration in seconds)
- `intensity`: String (enum: ['Low', 'Medium', 'High'])
- `type`: String (enum: ['strength', 'running', 'swimming', 'cycling', 'hiit', 'flexibility', 'walking', 'yoga', 'pilates', 'other'], required)
- `calculatedVolume`: Number (default: 0)
- `distance`: Number
- `aiHighlight`: String
- `cardioDetails`: Object
  - `distance`: Number (required)
  - `duration`: Number (required)
  - `pace`: Number
  - `speed`: Number
  - `maxSpeed`: Number
  - `elevationGain`: Number
  - `heartRate`: Object
    - `average`: Number (required)
    - `max`: Number (required)
    - `zones`: Object
  - `laps`: Array of Objects
  - Various other cardio-specific fields
- `notes`: String
- `completed`: Boolean (default: false)
- `completedAt`: Date
- `source`: String (enum: ['manual', 'garmin', 'coros', 'strava', 'apple', 'ai'], default: 'manual')
- `sourceId`: String
- `importedFrom`: String
- `importId`: String
- `stravaLink`: String
- `records`: Array of Objects (time-series data)
  - `timestamp`: Date (required)
  - `heart_rate`: Number
  - `distance`: Number
  - `speed`: Number
  - `altitude`: Number
  - `latitude`: Number
  - `longitude`: Number
  - `cadence`: Number
  - `power`: Number
- `deletedAt`: Date (default: null, for soft deletion)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes**:
- Compound index: `{ userId: 1, source: 1, sourceId: 1 }` (unique, sparse)

**Used by**:
- Workout tracking
- Activity feed
- Progress tracking
- AI insights generation

### `exercises`

**Description**: Library of available exercises for workout creation.

**Fields**:
- `_id`: ObjectId (primary key)
- `name`: String (required)
- `aliases`: Array of Strings
- `description`: String
- `muscleGroups`: Array of Strings (required)
- `secondaryMuscles`: Array of Strings
- `category`: String (enum: ['strength', 'cardio', 'flexibility', 'other'], required)
- `level`: String (enum: ['beginner', 'intermediate', 'advanced'])
- `equipment`: Array of Strings
- `instructions`: Array of Strings (required)
- `tips`: Array of Strings
- `images`: Array of Strings
- `videos`: Array of Strings
- `tags`: Array of Strings
- `userId`: ObjectId (optional, for user-created exercises)
- `trackMaxReps`: Boolean
- `createdAt`: Date
- `updatedAt`: Date

**Used by**:
- Workout creation
- Exercise searching and filtering
- Workout planning

### `workoutExercises`

**Description**: Links exercises to specific workouts, with details on how they were performed.

**Fields**:
- `_id`: ObjectId (primary key)
- `workoutId`: ObjectId (required, references workouts collection)
- `exerciseId`: Object (embedded reference)
  - `_id`: String (required, references exercises collection)
  - `name`: String (required)
  - `category`: String
- `sets`: Array of ObjectIds (references sets collection)
- `notes`: String
- `order`: Number
- `duration`: Number
- `distance`: Number
- `pace`: Number
- `speed`: Number
- `elevationGain`: Number
- `calories`: Number
- `createdAt`: Date
- `updatedAt`: Date

**Used by**:
- Workout detail views
- Exercise performance tracking
- Progress analysis

### `sets`

**Description**: Stores individual sets performed for each exercise in a workout.

**Fields**:
- `_id`: ObjectId (primary key)
- `workoutExerciseId`: ObjectId (required, references workoutExercises collection)
- `order`: Number
- `weight`: Number
- `reps`: Number
- `duration`: Number
- `distance`: Number
- `notes`: String

**Used by**:
- Workout exercise details
- Strength progress tracking

### `exercisePRs`

**Description**: Records personal records for specific exercises.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `exerciseId`: ObjectId (required, references exercises collection)
- `type`: String (enum: ['weight', 'reps', 'volume'], required)
- `value`: Number (required)
- `date`: Date (required)
- `workoutId`: ObjectId (references workouts collection)
- `workoutExerciseId`: ObjectId (references workoutExercises collection)
- `setId`: ObjectId (references sets collection)

**Indexes**:
- Compound index: `{ userId: 1, exerciseId: 1, type: 1 }` (unique)

**Used by**:
- Personal records tracking
- Progress visualization
- Achievement tracking

### `integrations`

**Description**: Manages third-party service connections like Strava.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `provider`: String (enum: ['garmin', 'coros', 'strava', 'apple'], required)
- `accessToken`: String (required)
- `refreshToken`: String
- `expiresAt`: Date
- `lastSynced`: Date
- `metadata`: Mixed (arbitrary JSON data)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes**:
- Compound index: `{ userId: 1, provider: 1 }` (unique)

**Used by**:
- Third-party data synchronization
- Activity importing

### `activityInsights`

**Description**: Stores AI-generated insights about workouts.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `periodType`: String (enum: ['weekly', 'monthly'], required)
- `periodStartDate`: Date (required)
- `insightData`: Object
  - `highlight`: String
  - `positiveTrends`: Array of Strings
  - `negativeTrends`: Array of Strings
  - `milestones`: Array of Strings
- `generatedAt`: Date (default: current timestamp)
- `lastWorkoutTimestamp`: Date (nullable)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes**:
- Index on `userId`
- Index on `periodType`
- Index on `periodStartDate`
- Compound index: `{ userId: 1, periodType: 1, periodStartDate: 1 }`

**Used by**:
- AI-generated workout insights
- Weekly and monthly summaries
- User dashboard

### `dailyInsights`

**Description**: Stores daily insights generated for the dashboard, allowing for caching.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references `users`)
- `date`: Date (required, the date the insight applies to, start of day UTC)
- `title`: String (required, title from `dailyContentConfig`)
- `description`: String (required, description from `dailyContentConfig`)
- `insightText`: String (required, the generated AI insight)
- `generatedAt`: Date (required, timestamp when the insight was generated)
- `lastWorkoutTimestamp`: Date (nullable, timestamp of the latest workout considered for this insight)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes**:
- Compound index: `{ userId: 1, date: 1 }` (unique)
- Index on `userId`

**Used by**:
- Dashboard daily insight card
- Caching mechanism for daily insights

### `accounts`

**Description**: Manages OAuth accounts linked to user profiles.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `provider`: String (required)
- `providerAccountId`: String (required)
- `type`: String (required)
- `access_token`: String
- `token_type`: String
- `id_token`: String
- `refresh_token`: String
- `expires_at`: Number
- `scope`: String
- `session_state`: String

**Indexes**:
- Compound index: `{ provider: 1, providerAccountId: 1 }` (unique)

**Used by**:
- Authentication system
- Third-party login

### `sessions`

**Description**: Manages authentication sessions.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `expires`: Date (required)
- `sessionToken`: String (required, unique)

**Used by**:
- Authentication system
- Session management

### `weightHistory`

**Description**: Tracks user weight changes over time.

**Fields**:
- `_id`: ObjectId (primary key)
- `userId`: ObjectId (required, references users collection)
- `weight`: Number (required)
- `date`: Date (required)
- `source`: String

**Used by**:
- Weight tracking
- Body metrics visualization

## LLM-Related Data

- LLM provider/model selection and prompt/follow-up handling are managed via environment variables and application logic, not persisted in the database.
- No LLM API keys, provider names, or model names are stored in any database table.
- If future LLM metadata (e.g., provider, model, prompt version) is to be logged or audited, add a new table or extend existing audit/log tables accordingly. 