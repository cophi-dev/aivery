# Aivery Main Features

This document provides a comprehensive overview of Aivery's key features as highlighted in our landing page and referenced throughout our documentation.

## Core Features

### 1. Personalized Workout Insights
- Every workout gets an AI-generated highlight statement that makes achievements tangible
- For running/cycling: Real-world landmark comparisons (e.g., "like running from Central Park to Times Square")
- For strength workouts: Intuitive volume comparisons (e.g., "equivalent to lifting 0.5 cars")
- Emoji-enhanced statements with context-relevant symbols

### 2. Advanced Muscle Group Analysis
- Interactive visualization of muscle group coverage categorized by body regions
- Identification of potentially neglected muscle groups
- Customizable time ranges (30 days, 90 days, 6 months)
- Exercise frequency tracking with performance history
- Weighting of primary vs. secondary muscle involvement

### 3. Smart Performance Tracking
- Automatic personal record tracking across all exercises
- PR detection for weight, reps, volume, distance, and pace
- Performance history visualization
- Progress trends and patterns identification

### 4. AI Coaching Conversations
- Contextual chat interface with access to workout history
- Personalized responses based on user goals and recent activities
- Training plan generation with running-specific context
- Weekly performance reviews with actionable insights
- When launched from weekly review, chat receives additional context from review data

### 5. Seamless Strava Integration
- One-click connection to Strava account
- Automated workout import with proper conversion and normalization
- Backfilling of historical activities
- Webhook support for real-time activity syncing

### 6. Weekly Performance Reviews
- Comprehensive analysis of weekly activity
- Identification of trends and patterns
- 1-2 actionable insights per review
- "Talk to Aivery about it" floating chat bubble with cross-app context sharing
- Smooth loading transitions with BlurText animation

## Technical Highlights

### LLM Integration
- Provider-agnostic AI service configurable via environment variables
- Support for multiple AI models
- Context-aware prompts with fallback for vague queries
- Centralized prompt handling and consistency

### Database Architecture
- MongoDB-based workout storage with comprehensive schema
- User performance summary with aggregated metrics
- Personal records tracking and automatic updates
- Efficient data retrieval for AI insights generation

### User Experience
- Modern, responsive UI with smooth transitions
- Cross-feature context preservation
- Consistent design language
- Performance-optimized components

## Pricing Model

- **Free Plan**: Basic tracking and limited AI insights
- **Premium Plan**: Unlimited insights, advanced coaching, and priority features

## Technical Stack

- Next.js application with hybrid rendering
- MongoDB database with optimized schema
- AI integration with configurable models
- Responsive UI with modern components

---

*This feature overview is maintained as part of our documentation set and should be updated whenever significant features are added or modified.* 