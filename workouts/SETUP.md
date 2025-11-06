# Workout Library Setup

This directory contains workout files (.zwo format) organized by category from [MyWhooshInfo.com](https://mywhooshinfo.com/workouts/).

## Quick Start

### 1. Download Workouts

```bash
# Download all categories
npm run workouts:download

# Download a specific category
npm run workouts:download "BEGINNER"
```

**Note**: The download script may need adjustments based on the actual HTML structure of MyWhooshInfo.com. If automatic downloading doesn't work:

1. Visit https://mywhooshinfo.com/workouts/
2. Manually download .zwo files
3. Place them in the appropriate category folders

### 2. Parse Workout Files

```bash
# Parse a specific workout file
npm run workouts:parse workouts/VO2MAX/16min-30-30-s-1.zwo
```

This will extract metadata including:
- Workout name and description
- Total duration
- Power zones used
- Estimated TSS

## Category Structure

All categories from MyWhooshInfo.com are represented:

- `BEGINNER/` - Begin your exercise journey (47 workouts)
- `UNDER_35_MIN/` - Maximize your training time (78 workouts)
- `FAST_FITNESS/` - High-intensity interval training (50 workouts)
- `TESTING/` - Explore your limits (14 workouts)
- `ANAEROBIC/` - High-powered glycolytic intervals (68 workouts)
- `ENDURANCE/` - Enhance your aerobic fitness (89 workouts)
- `SPRINT/` - High power and fast legs (47 workouts)
- `SWEETSPOT/` - Build your aerobic engine (55 workouts)
- `TAPER/` - Prepare for peak performance (10 workouts)
- `TEMPO/` - Optimize your endurance training (98 workouts)
- `THRESHOLD/` - Maximize your race pace (88 workouts)
- `UAE_TEAM_EMIRATES/` - Experience world tour training (13 workouts)
- `UAE_TEAM_ADQ/` - Experience world tour training (5 workouts)
- `VO2MAX/` - Maximize the utilization of oxygen (69 workouts)
- `ALL_TRAINING_PLAN_WORKOUTS/` - All workouts from all training plans (446 workouts)

## File Format

Workouts are stored in `.zwo` format (XML-based):

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

### Power Values

Power values are expressed as percentages of FTP:
- `0.45` = 45% of FTP (Zone 1 - Recovery)
- `0.60` = 60% of FTP (Zone 2 - Endurance)
- `0.80` = 80% of FTP (Zone 3 - Tempo)
- `0.90` = 90% of FTP (Zone 4 - Threshold)
- `1.20` = 120% of FTP (Zone 5 - VO2max)
- `1.50` = 150% of FTP (Zone 6 - Anaerobic)

## Scripts

### `scripts/download-workouts.js`

Downloads workouts from MyWhooshInfo.com and organizes them by category.

**Features**:
- Fetches HTML from category pages
- Extracts .zwo download links
- Downloads and saves files to appropriate folders
- Skips already downloaded files
- Respectful rate limiting (500ms delay between downloads)

**Usage**:
```bash
node scripts/download-workouts.js [category]
```

### `scripts/parse-zwo.js`

Parses .zwo files and extracts metadata.

**Extracted Information**:
- Name, author, description, sport type
- Total duration (seconds, minutes, formatted)
- Power zones used (Z1-Z7)
- Estimated TSS (Training Stress Score)

**Usage**:
```bash
node scripts/parse-zwo.js <path-to-zwo-file>
```

**Example Output**:
```json
{
  "name": "16min 30/30's #1",
  "author": "mywhooshinfo.com",
  "description": "Another session of intermittent training...",
  "sportType": "bike",
  "duration": {
    "seconds": 5160,
    "minutes": 86,
    "formatted": "86:00"
  },
  "powerZones": ["Z1", "Z2", "Z3", "Z6"],
  "estimatedTSS": 70
}
```

## Future Integration

These workout files can be integrated into the application to:

1. **Workout Recommendations**: Suggest workouts based on:
   - User's training goals
   - Current fitness level (FTP/kg, VO2 Max)
   - Training history and activity classification
   - Available training time

2. **Training Plan Generation**: Create structured training plans by:
   - Combining workouts from different categories
   - Balancing intensity and volume
   - Aligning with user's weekly training hours

3. **AI Coach Integration**: Enhance AI recommendations with:
   - Specific workout suggestions
   - Workout descriptions and instructions
   - Power zone targets and pacing guidance

## Troubleshooting

### Download Script Not Finding Workouts

The download script uses regex to extract .zwo links from HTML. If the website structure changes:

1. Open https://mywhooshinfo.com/workouts/ in a browser
2. Inspect the HTML structure (View Source or DevTools)
3. Update the `extractWorkoutLinks` function in `scripts/download-workouts.js`
4. Adjust the regex patterns to match the actual HTML structure

### Parse Script Not Extracting Data

If the parse script fails:

1. Verify the .zwo file is valid XML
2. Check that the file contains `<workout>` and `<workout_file>` elements
3. Ensure power values are in the expected format (decimal percentages)

## Notes

- All workouts are sourced from MyWhooshInfo.com
- Workout files are stored locally for offline access
- The download script respects server resources with rate limiting
- Manual downloads are supported if automatic downloading fails

