# AskAivery Dashboard Integration

## Overview
The AskAivery feature provides users with an AI-powered fitness companion directly on their dashboard. It integrates with user workout statistics and provides personalized fitness guidance using Grok.

## Features Implemented

### 1. AI Prompt Library (`src/lib/ai/aiveryPrompt.ts`)
- Clean prompt template for dashboard context
- Integrates user weekly stats (workouts, distance, duration, volume)
- Configured for calm, mindful coaching tone
- Structured for short, encouraging responses

### 2. Dedicated API Endpoint (`src/app/api/ask-aivery/route.ts`)
- **Path**: `/api/ask-aivery`
- **Method**: POST
- **Authentication**: Required (session-based)
- **Rate Limiting**: Integrated with existing Grok token limits
- **Input**: `{ input: string }`
- **Output**: `{ answer: string }`

**Features**:
- Rate limiting check with daily token limits
- User statistics integration via `getWeeklyStats()`
- Error handling with fallback responses
- Token usage tracking

### 3. Enhanced UI Component (`src/components/dashboard/AskAivery.tsx`)
- Beautiful expandable interface with Framer Motion animations
- Updated suggestions focused on user's actual data:
  - "What's my most consistent workout day?"
  - "How am I trending this month?"
  - "What's my longest streak?"
  - "Tips for improving my running pace?"
  - "Should I focus more on strength or cardio?"
  - "How can I stay consistent with my workouts?"
- Rate limit error handling (429 status)
- Support for formatted responses (whitespace-pre-wrap)

## Integration Points

### Dashboard Integration
- Already integrated in the minimal dashboard mode (`src/app/dashboard/page.tsx`)
- Appears as the 4th component in `DashboardWrapper`

### Statistics Integration
- Uses `getWeeklyStats()` from `src/lib/dashboard-logic.ts`
- Provides current week stats as context for AI responses
- Includes workouts count, total distance, duration, and volume

## Environment Configuration
- Uses existing `GROK_API_KEY` environment variable
- Leverages existing LLM service wrapper (`src/lib/services/llm.ts`)
- Model: `grok-2-1212` (configurable)

## Rate Limiting
- Shares daily token limit with chat feature (500,000 tokens/day)
- Automatic daily reset at midnight
- Graceful error handling when limits exceeded
- Token usage tracking for analytics

## Error Handling
- Network errors with fallback messages
- Rate limiting with user-friendly messages
- API errors with graceful degradation
- Loading states with animated indicators

## Future Enhancements
- [ ] User-specific fitness goal integration
- [ ] Personal records context
- [ ] Workout trend analysis
- [ ] Exercise recommendation system
- [ ] Progress insights based on historical data

## Testing
- TypeScript compilation passes
- Component renders in minimal dashboard mode
- API endpoint follows existing patterns
- Rate limiting properly implemented

## Usage Example

```typescript
// API call
const response = await fetch('/api/ask-aivery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: "How am I trending this month?" })
});

const data = await response.json();
console.log(data.answer); // AI response with user context
``` 