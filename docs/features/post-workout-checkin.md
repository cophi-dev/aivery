# Post-Workout Check-in

## Goal
Provide users with a structured way to record their subjective experience of a workout immediately after completion, including effort level, physical sensations, and psychological state.

## Scope
- **Trigger:** Automatically presented after a user completes and saves a workout.
- **Data:** Collects RPE (Rate of Perceived Exertion), mood, energy levels, and optional notes.
- **Output:** Stores data with the workout record and uses it to inform AI insights and future recommendations.

## Implementation Notes
### Frontend
- Modal dialog appears after workout completion with form inputs
- Uses a 1-10 scale for RPE with visual indicators
- Simple emoji selection for mood
- Optional free text field for specific notes

### Backend/API
- Extends the workout schema with a `postWorkoutFeedback` field
- POST endpoint to `/api/workouts/{id}/feedback` 
- Validation ensures RPE is 1-10 and all required fields are present

### AI Prompt
- Feedback data is incorporated into workout insight generation
- System prompt includes instructions to acknowledge user's subjective experience
- Pattern matching for common complaints to suggest recovery strategies

## Status
Implemented 