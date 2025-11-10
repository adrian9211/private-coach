# Week Plan Generation - Usage Guide

## Overview

The `generate-week-plan` edge function creates a complete 7-day training plan based on your:
- Training history
- Current fitness level (FTP, VO2 Max)
- Training goals
- Available training time
- Recent activities

All recommended workouts are automatically scheduled in your calendar.

## How to Use

### Option 1: From React Component (Frontend)

Use the `WeekPlanGenerator` component:

```tsx
import { WeekPlanGenerator } from '@/components/workouts/week-plan-generator'

// In your page/component
<WeekPlanGenerator />
```

Or call it directly:

```tsx
import { supabase } from '@/lib/supabase'

const generateWeekPlan = async (userId: string, startDate?: string) => {
  const { data, error } = await supabase.functions.invoke('generate-week-plan', {
    body: {
      userId,
      startDate, // Optional: YYYY-MM-DD format, defaults to tomorrow
    },
  })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Week Plan:', data.weekPlan)
  console.log('Scheduled Workouts:', data.scheduledWorkouts)
}
```

### Option 2: From Browser Console

Open browser console on your app and run:

```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Generate week plan
const { data, error } = await supabase.functions.invoke('generate-week-plan', {
  body: {
    userId: user.id,
    startDate: '2025-01-20' // Optional
  }
})

console.log(data)
```

### Option 3: Using cURL (Testing)

```bash
# Get your access token from browser (localStorage or Supabase dashboard)
TOKEN="your-access-token"

curl -X POST \
  'https://otkxverokhbsxrmrxdrx.supabase.co/functions/v1/generate-week-plan' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "startDate": "2025-01-20"
  }'
```

### Option 4: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/otkxverokhbsxrmrxdrx/functions
2. Click on `generate-week-plan`
3. Use the "Invoke function" tab
4. Enter JSON body:
```json
{
  "userId": "your-user-id",
  "startDate": "2025-01-20"
}
```

## Function Parameters

- **userId** (required): Your user ID
- **startDate** (optional): Start date for the week plan in `YYYY-MM-DD` format
  - If not provided, defaults to tomorrow
  - Week plan will schedule workouts for 7 days starting from this date

## Response Format

```json
{
  "success": true,
  "weekPlan": "## Weekly Training Plan\n\n**Training Philosophy:** ...",
  "scheduledWorkouts": 7,
  "startDate": "2025-01-20"
}
```

- **weekPlan**: Full AI-generated text plan with daily workouts
- **scheduledWorkouts**: Number of workouts automatically scheduled
- **startDate**: The start date used for the plan

## What Happens

1. **AI Analysis**: The function analyzes your:
   - Recent training activities
   - Current fitness metrics (FTP/kg, VO2 Max)
   - Training goals
   - Available weekly hours

2. **Plan Generation**: AI creates a structured 7-day plan following:
   - Polarized training model (80/20)
   - Pyramidal model (75/20/5)
   - Or threshold-focused approach
   - Based on your goals and history

3. **Workout Selection**: AI selects specific workouts from the library:
   - Matches workout duration to available time
   - Aligns with training goals
   - Ensures proper recovery between sessions
   - Varies workout types throughout the week

4. **Auto-Scheduling**: All workouts are automatically added to `scheduled_workouts` table:
   - Each workout is scheduled for its designated day
   - Source is marked as `week_plan`
   - You can view them in your calendar

## Viewing Scheduled Workouts

After generating a plan, you can view scheduled workouts:

```sql
SELECT 
  scheduled_date,
  workout_name,
  workout_category,
  status,
  notes
FROM scheduled_workouts
WHERE user_id = 'your-user-id'
  AND source = 'week_plan'
ORDER BY scheduled_date;
```

Or query via Supabase client:

```tsx
const { data: scheduled } = await supabase
  .from('scheduled_workouts')
  .select('*')
  .eq('user_id', userId)
  .eq('source', 'week_plan')
  .order('scheduled_date')
```

## Tips

1. **Generate Weekly**: Run this at the start of each week to plan ahead
2. **Adjust as Needed**: You can modify, skip, or cancel scheduled workouts
3. **Review Plan**: Read the generated plan to understand the training structure
4. **Complete Workouts**: Mark workouts as completed when done to track progress

## Example Integration

Add to your dashboard or workouts page:

```tsx
// apps/web/src/app/workouts/page.tsx or apps/web/src/app/dashboard/page.tsx
import { WeekPlanGenerator } from '@/components/workouts/week-plan-generator'

export default function WorkoutsPage() {
  return (
    <div>
      <h1>Workouts</h1>
      <WeekPlanGenerator />
      {/* ... rest of your workouts page */}
    </div>
  )
}
```

