# Workouts Directory

This directory contains workout files (.zwo format) organized by category, sourced from [MyWhooshInfo.com](https://mywhooshinfo.com/workouts/).

## Categories

- **BEGINNER** - Begin your exercise journey
- **UNDER_35_MIN** - Maximize your training time (under 35 minutes)
- **FAST_FITNESS** - High-intensity interval training (HIIT)
- **TESTING** - Explore your limits
- **ANAEROBIC** - High-powered glycolytic intervals
- **ENDURANCE** - Enhance your aerobic fitness
- **SPRINT** - High power and fast legs
- **SWEETSPOT** - Build your aerobic engine
- **TAPER** - Prepare for peak performance
- **TEMPO** - Optimize your endurance training
- **THRESHOLD** - Maximize your race pace
- **UAE_TEAM_EMIRATES** - Experience world tour training
- **UAE_TEAM_ADQ** - Experience world tour training
- **VO2MAX** - Maximize the utilization of oxygen
- **ALL_TRAINING_PLAN_WORKOUTS** - All workouts from all training plans

## File Format

Workouts are stored in `.zwo` format, which is an XML-based workout file format used by training platforms like Zwift, TrainerRoad, and others.

### Example Structure

```xml
<workout_file>
  <author>mywhooshinfo.com</author>
  <name>Workout Name</name>
  <description>Workout description</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.45" PowerHigh="0.65"/>
    <SteadyState Duration="120" Power="0.60"/>
    <IntervalsT Repeat="16" OnDuration="30" OnPower="1.20" OffDuration="30" OffPower="0.55"/>
  </workout>
</workout_file>
```

### Power Zones

Power values in .zwo files are expressed as percentages of FTP:
- `0.45` = 45% of FTP (Zone 1 - Recovery)
- `0.60` = 60% of FTP (Zone 2 - Endurance)
- `0.80` = 80% of FTP (Zone 3 - Tempo)
- `0.90` = 90% of FTP (Zone 4 - Threshold)
- `1.20` = 120% of FTP (Zone 5 - VO2max)
- `1.50` = 150% of FTP (Zone 6 - Anaerobic)

## Downloading Workouts

Use the download script to fetch workouts from MyWhooshInfo.com:

```bash
# Download all categories
node scripts/download-workouts.js

# Download a specific category
node scripts/download-workouts.js "BEGINNER"
```

**Note**: The download script may need adjustments based on the actual HTML structure of MyWhooshInfo.com. If automatic downloading doesn't work, you may need to:

1. Inspect the website's HTML structure
2. Update the `extractWorkoutLinks` function in `scripts/download-workouts.js`
3. Or manually download workouts and place them in the appropriate category folders

## Usage in Application

These workout files can be used to:
- Suggest workouts to users based on their training goals
- Generate personalized training plans
- Provide structured interval sessions
- Integrate with AI coach recommendations

## Future Enhancements

- Parse .zwo files to extract metadata (duration, TSS, power zones)
- Create a workout database with searchable metadata
- Generate workout recommendations based on user's FTP, goals, and training history
- Integrate with activity analysis to suggest complementary workouts

