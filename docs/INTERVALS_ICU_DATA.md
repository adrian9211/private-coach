# Intervals.icu Data Reference 📊

## How to Inspect ALL Data from Intervals.icu

### Step 1: Run Full Sync
1. Go to Settings → Intervals.icu Integration
2. Open Browser Console (F12 → Console tab)
3. Click **"Full Sync (All History)"**

### Step 2: Check Console Logs

You'll see detailed logs showing EXACTLY what data is available:

```javascript
🔍 Sample Activity Data (first activity): { ... }
📋 Available fields: ['id', 'name', 'start_date_local', 'distance', 'moving_time', ...]

🔍 Sample Wellness Data: { ... }
📋 Wellness fields: ['id', 'weight', 'restingHR', 'hrv', 'sleepSecs', ...]
```

### Step 3: Expand the Objects

Click the triangles `▶` next to the logged objects to see ALL nested data.

---

## Available Data Types

### 1. Activities (Workouts/Rides)

**Endpoint:** `GET /api/v1/athlete/{id}/activities`

**Key Fields:**
- **Basic:** `id`, `name`, `description`, `type`, `start_date_local`
- **Duration:** `moving_time`, `elapsed_time`, `distance`
- **Power:** 
  - `average_watts` - Average power
  - `icu_average_watts` - Intervals.icu calculated avg
  - `icu_weighted_avg_watts` - Normalized Power (NP)
  - `max_watts` - Peak power
  - `icu_intensity` - Intensity Factor (IF)
  - `icu_training_load` - Training Stress Score (TSS)
  - `icu_joules` - Total work in joules
  - `icu_joules_above_ftp` - Work above FTP
  - `icu_variability_index` - Variability Index (VI)
- **Heart Rate:**
  - `average_heartrate` - Avg HR
  - `max_heartrate` - Max HR
- **Speed/Pace:**
  - `average_speed` - Avg speed (m/s)
  - `max_speed` - Max speed
  - `pace` - Pace (min/km or min/mile)
  - `gap` - Grade Adjusted Pace (for running)
- **Other:**
  - `average_cadence` - Avg cadence (rpm/spm)
  - `calories` - Calories burned
  - `total_elevation_gain` - Climbing (m)
  - `trainer` - Indoor/outdoor flag
- **Subjective:**
  - `icu_rpe` - Rate of Perceived Exertion (1-10)
  - `feel` - How you felt (1-5)
- **Fitness:**
  - `icu_ctl` - Chronic Training Load (Fitness)
  - `icu_atl` - Acute Training Load (Fatigue)

### 2. Wellness Data (Sleep, HRV, etc.)

**Endpoint:** `GET /api/v1/athlete/{id}/wellness`

**Key Fields:**
- **Sleep:**
  - `sleepSecs` - Total sleep duration (seconds)
  - `sleepScore` - Sleep quality score
  - `sleepQuality` - Subjective sleep quality (1-5)
  - `avgSleepingHR` - Average sleeping heart rate
- **Heart Rate Variability:**
  - `hrv` - HRV (RMSSD in ms) ⭐ From Garmin!
  - `hrvSDNN` - HRV SDNN variant
- **Body Metrics:**
  - `weight` - Body weight (kg)
  - `restingHR` - Resting heart rate
  - `spO2` - Blood oxygen saturation (%)
  - `systolic` - Blood pressure (systolic)
  - `diastolic` - Blood pressure (diastolic)
  - `bodyFat` - Body fat percentage
  - `hydration` - Hydration level
  - `hydrationVolume` - Hydration volume (ml)
  - `bloodGlucose` - Blood glucose (mmol/L)
  - `lactate` - Blood lactate (mmol/L)
- **Subjective Wellness:**
  - `soreness` - Muscle soreness (1-5)
  - `fatigue` - Fatigue level (1-5)
  - `stress` - Stress level (1-5)
  - `mood` - Mood (1-5)
  - `motivation` - Motivation (1-5)
  - `injury` - Injury level (1-5)
- **Fitness Tracking:**
  - `ctl` - Chronic Training Load (Fitness)
  - `atl` - Acute Training Load (Fatigue)
  - `rampRate` - Fitness ramp rate
  - `vo2max` - VO2 Max estimate
  - `readiness` - Readiness score
- **Other:**
  - `kcalConsumed` - Calories consumed
  - `steps` - Daily steps
  - `respiration` - Respiration rate
  - `menstrualPhase` - Menstrual cycle phase
  - `comments` - Notes/comments

### 3. Power Curves

**Endpoint:** `GET /api/v1/athlete/{id}/power-curves`

Your best power efforts for different durations (5s, 1min, 5min, 20min, etc.)

### 4. Events (Planned Workouts)

**Endpoint:** `GET /api/v1/athlete/{id}/events`

Planned workouts, races, notes, etc.

---

## What We're Currently Storing

### ✅ Activities Table
- All power, HR, speed, cadence, elevation metrics
- TSS, IF, VI, NP
- RPE, Feel
- CTL, ATL
- **ENTIRE raw activity object** in `data.summary._raw`

### ⏳ Wellness Data (TODO)
Not yet implemented, but we're logging it!

You'll see wellness data in the console. Next step is to:
1. Create a `wellness` table in Supabase
2. Store all the wellness metrics
3. Display trends on your dashboard

---

## How to Request More Data

If you see fields in the console that we're not storing:

1. **Open an issue or tell me:** "I see field `X` in the logs, can we store it?"
2. **Check the raw data:** Everything is stored in `data.summary._raw` for now
3. **We can add specific fields** to the import logic

---

## Manual API Testing

You can also test the API directly:

### Using curl:
```bash
API_KEY="11rc4qk584u9f7vhy4n9zv2ea"
ATHLETE_ID="i247527"

# Get activities
curl -X GET "https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=2024-01-01" \
  -u "API_KEY:${API_KEY}"

# Get wellness
curl -X GET "https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=2024-01-01" \
  -u "API_KEY:${API_KEY}"

# Get power curves
curl -X GET "https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/power-curves.json" \
  -u "API_KEY:${API_KEY}"
```

### Using Browser DevTools:
```javascript
const apiKey = '11rc4qk584u9f7vhy4n9zv2ea'
const athleteId = 'i247527'

// Fetch activities
fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=2024-01-01`, {
  headers: {
    'Authorization': `Basic ${btoa(`API_KEY:${apiKey}`)}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('Activities:', data)
  console.log('Fields:', Object.keys(data[0]).sort())
})

// Fetch wellness
fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=2024-01-01`, {
  headers: {
    'Authorization': `Basic ${btoa(`API_KEY:${apiKey}`)}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('Wellness:', data)
  console.log('Fields:', Object.keys(data[0]).sort())
})
```

---

## Official Documentation

- **Intervals.icu API Docs:** https://intervals.icu/api
- **OpenAPI Spec:** https://intervals.icu/swagger-ui/index.html
- **Forum:** https://forum.intervals.icu/

---

## Summary

**You're now capturing:**
- ✅ ALL activity metrics (power, HR, speed, cadence, etc.)
- ✅ TSS, IF, NP, VI
- ✅ RPE, Feel
- ✅ Fitness (CTL, ATL)
- ✅ Complete raw data in `_raw` field

**Coming next:**
- ⏳ Wellness data storage (sleep, HRV, body metrics)
- ⏳ Power curves
- ⏳ Planned workouts

**Check the console logs to see EVERYTHING that's available!** 🚀

