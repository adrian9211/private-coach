# Workout Library Integration

This document explains how the workout library is integrated with the AI coach system.

## Overview

The workout library contains 1,160+ structured cycling workouts extracted from MyWhooshInfo.com. These workouts are stored in the database and can be suggested by the AI coach based on:

- User's training history
- Current fitness level (FTP/kg, VO2 Max)
- Training goals
- Available training time
- Recent activity classification
- Recovery status (fitness, fatigue, form)

## Database Schema

The `workouts` table stores:
- Workout metadata (name, category, description, duration, TSS, IF)
- Workout structure (steps with power zones)
- Power zones used (Z1-Z7)
- Source (XML or JSON)

## Setup Instructions

### 1. Run Database Migration

```bash
# Apply the migration to create the workouts table
supabase db reset
# Or apply just the new migration
supabase migration up
```

### 2. Import Workouts to Database

```bash
# Set your Supabase credentials
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Import all workouts from JSON files
npm run workouts:import
```

This will:
- Read all JSON files from the `workouts/` directory
- Extract workout metadata and structure
- Import them into the `workouts` table
- Show a summary of imported/updated workouts

### 3. Verify Import

Check the database to confirm workouts were imported:

```sql
SELECT category, COUNT(*) as count 
FROM workouts 
GROUP BY category 
ORDER BY category;
```

## AI Coach Integration

### generate-insights Function

The `generate-insights` function (weekly/long-term recommendations) now:
- Queries all available workouts from the database
- Includes workout library information in the AI prompt
- Instructs the AI to reference specific workouts by name
- Considers workout duration, TSS, power zones, and category when making suggestions

### generate-analysis Function

The `generate-analysis` function (individual activity analysis) now:
- Queries available workouts for "next training" recommendations
- Suggests specific workouts that complement the completed activity
- Considers activity classification (Polarized, Pyramidal, Threshold, HIIT, Mixed)
- Matches workouts to user's available time and training goals

## How It Works

1. **Workout Selection Criteria:**
   - **Duration**: Matches user's available training time
   - **TSS**: Appropriate for current fitness/fatigue level
   - **Power Zones**: Complements recent training distribution
   - **Category**: Aligns with training goals (VO2MAX, THRESHOLD, TEMPO, etc.)
   - **Intensity Factor**: Matches recovery status

2. **AI Recommendations:**
   - The AI receives a sample of workouts (up to 30) in the prompt
   - It's instructed to reference workouts by their exact name
   - It explains why each suggested workout fits the athlete's needs
   - Recommendations consider the full training context

3. **Workout Categories:**
   - **VO2MAX**: High-intensity interval training
   - **THRESHOLD**: FTP-focused workouts
   - **TEMPO**: Moderate intensity endurance
   - **ENDURANCE**: Long, low-intensity base building
   - **ANAEROBIC**: Short, very high-intensity efforts
   - **SWEETSPOT**: Sub-threshold training
   - **BEGINNER**: Entry-level structured workouts
   - **UNDER_35_MIN**: Time-efficient workouts
   - And more...

## Example AI Recommendation

The AI might suggest:

> "Based on your recent Polarized training session, I recommend the **'12min 30/30's #2'** workout from the VO2MAX category. This workout:
> - Duration: 1:14:00 (fits your available time)
> - TSS: 81 (appropriate for your current fitness level)
> - Power Zones: Z1, Z2, Z5 (complements your polarized distribution)
> - Why: This workout will help maintain your high-intensity stimulus while allowing adequate recovery time between intervals."

## Maintenance

### Adding New Workouts

1. Place new `.zwo` or `.json` files in the appropriate category folder
2. Run `npm run workouts:extract` if you have HTML files
3. Run `npm run workouts:import` to import new workouts

### Updating Existing Workouts

The import script uses `UPSERT` with `onConflict: 'category,slug'`, so:
- Existing workouts are updated if JSON files change
- New workouts are inserted
- No duplicates are created

## Troubleshooting

### Workouts Not Appearing in AI Recommendations

1. Check if workouts are in the database:
   ```sql
   SELECT COUNT(*) FROM workouts;
   ```

2. Check AI function logs for errors querying workouts

3. Verify the workouts table has proper RLS policies

### Import Errors

- Check that JSON files are valid
- Verify Supabase credentials are correct
- Check that the migration was applied successfully

## Future Enhancements

Potential improvements:
- Workout favorites/bookmarks
- Workout search and filtering
- Workout completion tracking
- Personalized workout plans
- Workout difficulty ratings
- Integration with training calendar

