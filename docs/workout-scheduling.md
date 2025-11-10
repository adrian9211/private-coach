# Workout Scheduling & Week Plan Generation

## Overview

The AI coach now automatically schedules recommended workouts and can generate complete weekly training plans. This document explains the new features and how they work.

## Features

### 1. Automatic Workout Scheduling from Activity Analysis

When you generate an analysis for an activity, the AI will:

1. **Include "Next Session Recommendations" Section**
   - The AI analysis now includes a mandatory section titled "## Next Session Recommendations 🎯"
   - This section recommends 1-3 specific workouts from the library by exact name
   - Each recommendation includes:
     - Exact workout name
     - Why it fits your needs
     - When to do it
     - Expected training stress

2. **Automatic Scheduling**
   - The primary recommended workout is automatically scheduled for the following day
   - The workout appears in your calendar/scheduled workouts
   - If a workout is already scheduled for that day, it won't create a duplicate

### 2. Weekly Training Plan Generation

A new edge function `generate-week-plan` creates a complete 7-day training plan:

- **Structured Week Plan**: AI generates a full week of workouts
- **Science-Based**: Follows polarized, pyramidal, or threshold-focused training models
- **Time-Aware**: Respects your available training hours per week
- **Goal-Aligned**: Matches workouts to your training goals
- **Auto-Scheduled**: All workouts are automatically scheduled in your calendar

## Database Schema

### `scheduled_workouts` Table

Stores all scheduled workouts with:
- `user_id`: Owner of the scheduled workout
- `workout_id`: Reference to the workout (nullable if workout deleted)
- `workout_name`: Name of workout (preserved even if workout deleted)
- `workout_category`: Category of workout
- `scheduled_date`: Date the workout is scheduled
- `scheduled_time`: Optional time of day
- `status`: `scheduled`, `completed`, `skipped`, or `cancelled`
- `source`: `ai_recommendation`, `manual`, or `week_plan`
- `activity_id`: Link to completed activity if workout was done
- `notes`: User notes or AI reasoning

## API Usage

### Generate Analysis (with Auto-Scheduling)

```typescript
// Existing endpoint - now includes automatic scheduling
const response = await supabase.functions.invoke('generate-analysis', {
  body: { activityId: '...' }
})

// Response includes:
{
  success: true,
  analysis: { ... },
  scheduledWorkouts: ['12min 30/30\'s #2'] // Array of scheduled workout names
}
```

### Generate Week Plan

```typescript
const response = await supabase.functions.invoke('generate-week-plan', {
  body: {
    userId: 'user-id',
    startDate: '2025-01-15' // Optional, defaults to tomorrow
  }
})

// Response includes:
{
  success: true,
  weekPlan: '...', // Full AI-generated week plan text
  scheduledWorkouts: 7, // Number of workouts scheduled
  startDate: '2025-01-15'
}
```

## How It Works

### Activity Analysis → Workout Scheduling

1. User generates analysis for an activity
2. AI includes "Next Session Recommendations" section in analysis
3. System extracts workout names from the analysis text
4. Primary recommendation is automatically scheduled for tomorrow
5. Workout appears in `scheduled_workouts` table

### Week Plan Generation

1. User calls `generate-week-plan` function
2. AI analyzes:
   - User's training history
   - Current fitness level (FTP, VO2 Max)
   - Training goals
   - Available training time
3. AI generates structured 7-day plan with specific workouts
4. System parses workout names from the plan
5. All workouts are scheduled in `scheduled_workouts` table

## Workout Name Extraction

The system uses pattern matching to extract workout names from AI responses:

- Looks for workout names in quotes: `"12min 30/30's #2"`
- Looks for workout names in bold: `**Threshold 20**`
- Looks for workout names after recommendation keywords: `I recommend Threshold 20`
- Matches against exact workout names in the database

## Best Practices

1. **Review Scheduled Workouts**: Check your calendar to review AI-scheduled workouts
2. **Adjust as Needed**: You can modify, skip, or cancel scheduled workouts
3. **Complete Workouts**: Mark workouts as completed when done to track progress
4. **Generate Week Plans**: Use week plan generation for structured training blocks

## Future Enhancements

Potential improvements:
- Smart scheduling that avoids conflicts
- Workout difficulty progression
- Recovery day recommendations
- Integration with training calendar UI
- Workout completion tracking
- Performance analysis of completed scheduled workouts

