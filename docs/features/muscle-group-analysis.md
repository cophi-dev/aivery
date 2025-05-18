# Muscle Group Analysis

## Goal
Provide users with comprehensive insights into the balance of their workout routine by analyzing which muscle groups they're training frequently and which ones they might be neglecting.

## Scope
- **Trigger:** User-initiated from the exercises page via "Muscle Group Analysis" button.
- **Data:** Analyzes workout history for configurable time periods (30 days, 90 days, 6 months).
- **Output:** Visual representation of muscle group frequency, neglected areas, and exercise distribution.

## Implementation Notes

### Frontend
- Interactive page with selectable time ranges (30/90/180 days)
- Compact view showing top 6 muscle groups with progress indicators
- Detailed analysis showing muscle groups categorized by body regions:
  - Upper Body - Push (chest, shoulders, triceps)
  - Upper Body - Pull (back, biceps, forearms) 
  - Core (abs, obliques)
  - Lower Body (quads, hamstrings, glutes, calves)
  - Other (specialized muscle groups)
  - Cardio & Mobility
- Progress bars with color-coding (green for good coverage, amber for neglected)
- Exercise frequency table with links to specific exercises

### Backend/API
- `/api/workout-analysis` endpoint processes workout data and returns analysis
- Normalizes muscle group terminology (e.g., "pecs" → "chest")
- Primary muscles receive full weight (1.0) in frequency calculation
- Secondary muscles receive partial weight (0.5) in frequency calculation
- Muscle groups are classified as "neglected" if trained fewer than 2 times in the period

### Data Processing
- Maps exercise muscle groups to standardized categories
- Accounts for both primary and secondary muscle involvement
- Handles cardio workouts separately with dedicated cardiovascular system tracking
- Derives insights about training balance and potential gaps

## Status
Implemented 