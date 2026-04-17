import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getRPEDescription(rpe: number): string {
  const descriptions: Record<number, string> = {
    1: 'Resting - No effort',
    2: 'Very Easy - Light effort, can maintain indefinitely',
    3: 'Easy - Comfortable pace, easy conversation',
    4: 'Moderate - Starting to feel effort, still comfortable',
    5: 'Moderately Hard - Noticeable effort, breathing deeper',
    6: 'Hard - Definite effort, breathing heavily',
    7: 'Very Hard - Very difficult, can maintain briefly',
    8: 'Extremely Hard - Maximum effort, very uncomfortable',
    9: 'Maximum - Near exhaustion, unsustainable',
    10: 'Absolute Maximum - Complete exhaustion, cannot continue'
  }
  return descriptions[rpe] || 'Unknown'
}

function getExpectedRPE(avgPower: number, reportedRPE: number): number {
  // Rough estimation: For a 200W FTP rider
  // This is a simplified model - actual RPE varies by fitness, conditions, etc.
  // Returns what RPE might be expected based on power output
  if (avgPower < 100) return 3
  if (avgPower < 150) return 4
  if (avgPower < 200) return 5
  if (avgPower < 250) return 6
  if (avgPower < 300) return 7
  if (avgPower < 350) return 8
  return 9
}

// Extract workout recommendations from AI analysis text
function extractWorkoutRecommendations(analysisText: string, availableWorkouts: any[]): Array<{ name: string; reasoning?: string }> {
  const recommendations: Array<{ name: string; reasoning?: string }> = []

  // Look for workout names in quotes or after specific patterns
  // Patterns: "workout name", 'workout name', **workout name**, or after "I recommend", "try", etc.
  const workoutNames = availableWorkouts.map(w => w.name)

  // Find section about next session recommendations
  const nextSessionMatch = analysisText.match(/##\s*Next\s+Session\s+Recommendations[^\#]*/i)
  if (!nextSessionMatch) {
    // Try alternative section titles
    const altMatch = analysisText.match(/##\s*(?:Next\s+Training|Recommended\s+Workouts?|Future\s+Recommendations)[^\#]*/i)
    if (altMatch) {
      return extractFromSection(altMatch[0], workoutNames)
    }
    return recommendations
  }

  return extractFromSection(nextSessionMatch[0], workoutNames)
}

function extractFromSection(sectionText: string, workoutNames: string[]): Array<{ name: string; reasoning?: string }> {
  const recommendations: Array<{ name: string; reasoning?: string }> = []

  // Try to find workout names in various formats
  for (const workoutName of workoutNames) {
    // Look for exact match in quotes, bold, or after recommendation keywords
    const patterns = [
      new RegExp(`['"]([^'"]*${escapeRegex(workoutName)}[^'"]*)['"]`, 'i'),
      new RegExp(`\\*\\*([^*]*${escapeRegex(workoutName)}[^*]*)\\*\\*`, 'i'),
      new RegExp(`(?:recommend|suggest|try|use|do)\\s+['"]?([^'"]*${escapeRegex(workoutName)}[^'"]*)['"]?`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = sectionText.match(pattern)
      if (match) {
        // Check if this is actually the workout name (not just containing it)
        const matchedText = match[1] || match[0]
        if (matchedText.includes(workoutName) && matchedText.length < workoutName.length + 20) {
          // Extract context around the match for reasoning
          const startIndex = Math.max(0, sectionText.indexOf(matchedText) - 100)
          const endIndex = Math.min(sectionText.length, sectionText.indexOf(matchedText) + matchedText.length + 200)
          const context = sectionText.substring(startIndex, endIndex)

          if (!recommendations.find(r => r.name === workoutName)) {
            recommendations.push({
              name: workoutName,
              reasoning: context.trim(),
            })
          }
          break
        }
      }
    }
  }

  // Sort by order of appearance in text
  recommendations.sort((a, b) => {
    const indexA = sectionText.indexOf(a.name)
    const indexB = sectionText.indexOf(b.name)
    return indexA - indexB
  })

  return recommendations.slice(0, 3) // Return top 3 recommendations
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Calculate activity classification from power zone distribution
function calculateActivityClassification(
  activity: any,
  ftp: number | null
): { name: string; distribution: { z1z2: number; z3z4: number; z5plus: number }; base: number } | null {
  if (!ftp || !activity.data) return null

  const gpsTrack = activity.gps_track || activity.data?.gps_track || activity.data?.records || []
  if (!Array.isArray(gpsTrack) || gpsTrack.length < 2) return null

  const powerZones = [
    { key: 'Z1', minPercent: 0, maxPercent: 55 },
    { key: 'Z2', minPercent: 56, maxPercent: 75 },
    { key: 'Z3', minPercent: 76, maxPercent: 90 },
    { key: 'Z4', minPercent: 91, maxPercent: 105 },
    { key: 'Z5', minPercent: 106, maxPercent: 120 },
    { key: 'Z6', minPercent: 121, maxPercent: 150 },
    { key: 'Z7', minPercent: 151, maxPercent: 300 },
  ]

  const zoneTotals: Record<string, number> = {}
  powerZones.forEach(z => { zoneTotals[z.key] = 0 })

  const track = gpsTrack
    .filter((p: any) => p && (p.timestamp || p.time))
    .sort((a: any, b: any) => {
      const timeA = a.timestamp || a.time || 0
      const timeB = b.timestamp || b.time || 0
      return new Date(timeA).getTime() - new Date(timeB).getTime()
    })

  let totalTime = 0

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1]
    const curr = track[i]
    const prevTime = prev.timestamp || prev.time
    const currTime = curr.timestamp || curr.time

    if (!prevTime || !currTime) continue

    const dt = (new Date(currTime).getTime() - new Date(prevTime).getTime()) / 1000

    if (!isFinite(dt) || dt <= 0 || dt > 300) continue

    const power = typeof prev.power === 'number' && prev.power > 0 ? prev.power : 0

    if (power > 0) {
      const zone = powerZones.find(z => {
        const minWatts = Math.round(ftp * z.minPercent / 100)
        const maxWatts = z.maxPercent >= 300 ? Infinity : Math.round(ftp * z.maxPercent / 100)
        return power >= minWatts && power <= maxWatts
      })

      if (zone) {
        zoneTotals[zone.key] += dt
        totalTime += dt
      }
    }
  }

  if (totalTime === 0) return null

  const zoneTimes = powerZones.map(zone => ({
    zone: zone.key,
    percentage: (zoneTotals[zone.key] / totalTime) * 100
  })).filter(z => z.percentage > 0)

  const z1z2 = zoneTimes.filter(z => z.zone === 'Z1' || z.zone === 'Z2').reduce((sum, z) => sum + z.percentage, 0)
  const z3z4 = zoneTimes.filter(z => z.zone === 'Z3' || z.zone === 'Z4').reduce((sum, z) => sum + z.percentage, 0)
  const z5plus = zoneTimes.filter(z => ['Z5', 'Z6', 'Z7'].includes(z.zone)).reduce((sum, z) => sum + z.percentage, 0)

  const distribution = { z1z2, z3z4, z5plus }
  const base = (z3z4 + z5plus) > 0 ? (z1z2 / (z3z4 + z5plus)) : (z1z2 > 0 ? 999 : 0)

  // Classify
  const classifications = [
    { name: 'Polarized', distribution: { z1z2: 80, z3z4: 5, z5plus: 15 } },
    { name: 'Pyramidal', distribution: { z1z2: 75, z3z4: 20, z5plus: 5 } },
    { name: 'Threshold', distribution: { z1z2: 50, z3z4: 40, z5plus: 10 } },
    { name: 'HIIT', distribution: { z1z2: 50, z3z4: 10, z5plus: 40 } },
  ]

  let bestMatch = { name: 'Mixed', match: 0 }

  classifications.forEach(classification => {
    const distance = Math.sqrt(
      Math.pow(distribution.z1z2 - classification.distribution.z1z2, 2) +
      Math.pow(distribution.z3z4 - classification.distribution.z3z4, 2) +
      Math.pow(distribution.z5plus - classification.distribution.z5plus, 2)
    )

    const match = Math.max(0, 100 - (distance * 2))

    if (match > bestMatch.match) {
      bestMatch = { name: classification.name, match: Math.round(match) }
    }
  })

  return {
    name: bestMatch.match >= 50 ? bestMatch.name : 'Mixed',
    distribution,
    base
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Initialize Gemini API
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    // Use gemini-3-pro-preview as requested by user (verified model)
    const requestedModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
    // validModels supports user requested model + fallbacks
    const validModels = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-flash-latest']
    const geminiModel = validModels.includes(requestedModel) ? requestedModel : 'gemini-2.0-flash'

    if (requestedModel !== geminiModel) {
      console.warn(`Invalid model "${requestedModel}", using "${geminiModel}" instead`)
    }

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_API_KEY environment variable is not set' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { activityId, forceRegenerate } = await req.json()

    if (!activityId) {
      return new Response(
        JSON.stringify({ error: 'Activity ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If forceRegenerate is true, delete existing analysis to ensure fresh generation
    if (forceRegenerate) {
      const { error: deleteError } = await supabaseClient
        .from('activity_analyses')
        .delete()
        .eq('activity_id', activityId)

      if (deleteError) {
        console.log('Note: Could not delete existing analysis (may not exist):', deleteError)
      } else {
        console.log('Deleted existing analysis for fresh regeneration')
      }
    }

    // Get activity data
    const { data: activity, error: activityError } = await supabaseClient
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single()

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user preferences, weight, VO2 max, goals, and training availability
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('preferences, weight_kg, vo2_max, training_goals, weekly_training_hours')
      .eq('id', activity.user_id)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate FTP/kg (power-to-weight ratio) - critical cycling performance metric
    const ftp = typeof user.preferences?.ftp === 'number' ? user.preferences.ftp : null
    const weightKg = typeof user.weight_kg === 'number' ? user.weight_kg : null
    const ftpPerKg = (ftp && weightKg && ftp > 0 && weightKg > 0)
      ? Number((ftp / weightKg).toFixed(2))
      : null
    const ftpPerKgString = ftpPerKg ? ftpPerKg.toFixed(2) : null
    const vo2Max = user.vo2_max
    const trainingGoals = user.training_goals
    const weeklyHours = user.weekly_training_hours

    // Calculate activity classification BEFORE building the prompt
    const activityClassification = calculateActivityClassification(activity, ftp)

    // Query available workouts from database for recommendations
    const { data: workouts, error: workoutsError } = await supabaseClient
      .from('workouts')
      .select('id, name, category, duration, duration_seconds, tss, intensity_factor, power_zones, description')
      .order('category')
      .order('name')

    const availableWorkouts = workouts || []
    console.log(`Found ${availableWorkouts.length} workouts available for recommendations`)

    // Get user's activity history for context and trend analysis (Last 14 Days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivities, error: historyError } = await supabaseClient
      .from('activities')
      .select('id, start_time, data, rpe, feeling, total_distance, total_timer_time, avg_power, avg_heart_rate, tss, work_kj')
      .eq('user_id', activity.user_id)
      .eq('status', 'processed')
      .gte('start_time', fourteenDaysAgo)
      .order('start_time', { ascending: false, nullsFirst: false })

    if (historyError) {
      console.warn('Error fetching activity history:', historyError)
    }

    // Build a strict Day-By-Day array of the last 14 days
    const activityHistory = recentActivities || []
    let groupedHistory: Record<string, any> = {};
    
    activityHistory.forEach(a => {
      if (!a.start_time) return;
      // Convert to strict YYYY-MM-DD local format based on string
      const dateKey = a.start_time.split('T')[0];
      
      if (!groupedHistory[dateKey]) {
        groupedHistory[dateKey] = {
          date: dateKey,
          activityCount: 0,
          totalDurationSecs: 0,
          totalDistanceKm: 0,
          totalTSS: 0,
          totalWorkKj: 0,
          avgRpe: 0,
          avgFeeling: 0,
          rpeCount: 0,
          feelingCount: 0
        };
      }
      
      const day = groupedHistory[dateKey];
      day.activityCount += 1;
      day.totalDurationSecs += (a.total_timer_time || 0);
      day.totalDistanceKm += (a.total_distance || 0);
      day.totalTSS += (a.tss || 0);
      day.totalWorkKj += (a.work_kj || 0);
      
      if (typeof a.rpe === 'number') {
        day.avgRpe += a.rpe;
        day.rpeCount += 1;
      }
      if (typeof a.feeling === 'number') {
        day.avgFeeling += a.feeling;
        day.feelingCount += 1;
      }
    });

    // Finalize averages
    const dailyBreakdown = Object.values(groupedHistory)
      .map((day: any) => {
        day.avgRpe = day.rpeCount > 0 ? Number((day.avgRpe / day.rpeCount).toFixed(1)) : null;
        day.avgFeeling = day.feelingCount > 0 ? Number((day.avgFeeling / day.feelingCount).toFixed(1)) : null;
        day.totalDistanceKm = Number(day.totalDistanceKm.toFixed(1));
        day.totalTSS = Number(day.totalTSS.toFixed(0));
        day.totalWorkKj = Number(day.totalWorkKj.toFixed(0));
        
        // Format duration for the AI beautifully
        const hours = Math.floor(day.totalDurationSecs / 3600);
        const mins = Math.floor((day.totalDurationSecs % 3600) / 60);
        day.totalDurationFormatted = `${hours}h ${mins}m`;
        
        // Clean up internal counters passed to AI
        delete day.rpeCount;
        delete day.feelingCount;
        delete day.totalDurationSecs;
        
        return day;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // descending dates

    const historyContext = dailyBreakdown.length > 0 ? {
      totalActivitiesLast14Days: activityHistory.length,
      activeDaysLast14Days: dailyBreakdown.length,
      averageTSSPerActiveDay: Number((dailyBreakdown.reduce((sum, d) => sum + d.totalTSS, 0) / dailyBreakdown.length).toFixed(0)),
      dayByDayLog: dailyBreakdown
    } : null;

    // Prepare data for AI analysis
    const activityData = {
      metadata: activity.metadata,
      data: activity.data,
      userPreferences: user.preferences,
      rpe: activity.rpe, // Rate of Perceived Exertion (1-10) - critical for subjective feedback
      feeling: activity.feeling, // General well-being/energy level (1-10) - separate from RPE
      personalNotes: activity.personal_notes, // User's personal experience and observations
      activityDate: activity.start_time || activity.created_at,
      // Performance metrics for power-to-weight analysis
      ftp: ftp,
      weightKg: weightKg,
      ftpPerKg: ftpPerKgString, // Power-to-weight ratio (W/kg) - critical cycling performance metric
      vo2Max: vo2Max, // Maximum oxygen uptake (ml/kg/min) - crucial for aerobic capacity analysis
      trainingGoals: trainingGoals, // User's stated training goals
      weeklyTrainingHours: weeklyHours, // Available training time per week
    }

    // Generate AI analysis using Gemini API
    // Gemini 2.0 Flash Exp usually works best on v1beta
    const useV1Endpoint = !geminiModel.includes('-exp') && (geminiModel === 'gemini-2.5-pro' || geminiModel.startsWith('gemini-2.'))
    const apiVersion = 'v1beta' // Safest default for newer/experimental models like 1.5-flash and 2.0-flash-exp
    const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${geminiModel}:generateContent?key=${googleApiKey}`
    console.log(`Calling Gemini API with model: ${geminiModel} (${apiVersion})`)

    const geminiResponse = await fetch(
      geminiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a professional cycling coach with deep expertise in exercise physiology, training periodization, and performance analysis. Use research-grounded reasoning (Seiler, Coggan, Allen, Laursen) to analyze this workout in context of the athlete's training history, current fitness level, and goals.

MANDATORY: If the user provided a feeling score or personal notes, you must explicitly address them in your analysis. Failure to mention provided feeling scores or personal notes makes the response incomplete.

${activity.feeling !== null && activity.feeling !== undefined ? `User reported feeling: ${activity.feeling}/10 (energy/well-being scale). You must explicitly state and analyze this in the Recovery & Fatigue Assessment section.` : ''}
${activity.personal_notes && activity.personal_notes.trim().length > 0 ? `User personal notes: "${activity.personal_notes.substring(0, 300)}${activity.personal_notes.length > 300 ? '...' : ''}". You must quote and analyze relevant parts in your response.` : ''}

ANALYSIS APPROACH:
- Base your analysis on established cycling training science and research
- Compare this workout against the athlete's historical performance to identify trends and patterns
- Consider the athlete's current performance level (FTP/kg, VO2 max) when providing feedback
- Be balanced — acknowledge achievements while identifying improvement opportunities
- Every minute of training time is valuable — identify optimization opportunities based on training science
- Use the activity history to detect signs of fatigue, overreaching, or positive fitness adaptations

ACTIVITY TYPE:
${activity.data?.summary?.avgPower && activity.data.summary.avgPower > 0 ? `
- Indoor activity with power meter (${activity.data.summary.avgPower}W avg)
- Indoor training allows for precise power control and structured intervals
- Analyze zone distribution and training structure effectiveness
` : `
- Outdoor activity (no power meter detected)
- Relies on heart rate and perceived effort (RPE) for intensity control
- Analyze consistency of effort and training value without power data
`}
${activityClassification ? `
- Activity classification: ${activityClassification.name} (Base ratio: ${activityClassification.base.toFixed(2)})
  - Zone distribution: ${activityClassification.distribution.z1z2.toFixed(1)}% Z1+2 (Low), ${activityClassification.distribution.z3z4.toFixed(1)}% Z3+4 (Medium), ${activityClassification.distribution.z5plus.toFixed(1)}% Z5+ (High)
  - Training protocol context:
    ${activityClassification.name === 'Polarized' ? `
    - Polarized Training (80/5/15 model — Seiler & Tonnessen): 80% low intensity, 5% moderate, 15% high intensity. Highly effective for endurance athletes. Ensure low intensity is truly easy (Zone 1-2, <65% FTP).
    ` : activityClassification.name === 'Pyramidal' ? `
    - Pyramidal Training (75/20/5 model): Traditional model with more moderate intensity. Good for athletes transitioning from base building. Consider whether too much time in the moderate "gray zone" is limiting adaptation compared to a polarized approach.
    ` : activityClassification.name === 'Threshold' ? `
    - Threshold Training (50/40/10 model): Heavy focus on Zone 4. Effective short-term but risks plateau and overreaching. Balance with more low-intensity work and occasional VO2 max intervals.
    ` : activityClassification.name === 'HIIT' ? `
    - HIIT (50/10/40 model): Heavy high-intensity emphasis. Effective for time-limited athletes but requires careful recovery. Ensure 50%+ of weekly training remains low-intensity.
    ` : `
    - Mixed/Unique Pattern: Distribution doesn't match standard models. Identify primary training goal and align distribution with proven protocols.
    `}
  - When recommending next sessions, suggest complementary workouts based on this classification and standard periodization protocols.
` : activity.data?.summary?.avgPower ? `
- Power data available but classification cannot be calculated (FTP may not be set). Analyze zone distribution manually.
` : `
- No power data — analyze based on heart rate zones and perceived effort.
`}

ATHLETE PERFORMANCE METRICS:
${ftpPerKg ? `
- FTP/kg: ${ftpPerKgString} W/kg (${ftp}W ÷ ${weightKg}kg)
  - Performance level: ${ftpPerKg >= 5.0 ? 'World Tour Professional (≥5.0 W/kg)' : ftpPerKg >= 4.5 ? 'Elite/Professional (4.5-4.99 W/kg)' : ftpPerKg >= 4.0 ? 'Very Strong Amateur (4.0-4.49 W/kg)' : ftpPerKg >= 3.5 ? 'Strong Amateur (3.5-3.99 W/kg)' : ftpPerKg >= 3.0 ? 'Good Recreational (3.0-3.49 W/kg)' : ftpPerKg >= 2.5 ? 'Recreational (2.5-2.99 W/kg)' : 'Beginner/Developing (<2.5 W/kg)'}
  - Workout intensity: ${activity.data?.summary?.avgPower && ftp ? `${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP` : 'calculate from data'}
  - Workout power-to-weight: ${activity.data?.summary?.avgPower && weightKg ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg (${((activity.data.summary.avgPower / weightKg) / ftpPerKg * 100).toFixed(0)}% of FTP/kg)` : 'N/A'}
  - For climbing/elevation efforts: power-to-weight is the primary factor. For flat/TT: absolute power (W) is primary.
` : ftp ? `
- FTP: ${ftp}W (weight not provided — cannot calculate FTP/kg; encourage athlete to enter weight)
` : 'FTP not set — note this as a gap, cannot perform intensity zone analysis.'}\
${vo2Max ? `
- VO2 max: ${vo2Max} ml/kg/min (${vo2Max >= 55 ? 'Elite' : vo2Max >= 50 ? 'Very high' : vo2Max >= 45 ? 'High' : vo2Max >= 40 ? 'Above average' : 'Average'} aerobic capacity)
  - Analyze if training is optimizing aerobic development relative to VO2 max
  - ${activity.data?.summary?.avgHeartRate ? `Workout avg HR: ${activity.data.summary.avgHeartRate} bpm — analyze what % of VO2 max this represents` : 'Analyze HR data relative to VO2 max capacity'}
  - Is FTP/kg appropriate for this VO2 max level?
` : 'No VO2 max provided — note this as a gap and encourage the athlete to enter it from Garmin.'}\
${trainingGoals ? `
- Athlete goals: ${trainingGoals} — all recommendations must align with these
` : 'No training goals provided.'}\
${weeklyHours ? `
- Training time availability: ${weeklyHours} hours/week — all recommendations must respect this constraint
` : 'No weekly hours provided.'}

RPE:
${activity.rpe ? `
- RPE: ${activity.rpe}/10 — ${getRPEDescription(activity.rpe)}
${activity.data?.summary?.avgPower && ftp ? `
  - Workout intensity: ${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP; expected RPE: ${getExpectedRPE(activity.data.summary.avgPower, activity.rpe)}
  - Assessment: ${activity.rpe > getExpectedRPE(activity.data.summary.avgPower, activity.rpe) + 1 ? 'Higher RPE than expected for this power — possible fatigue or poor recovery.' : activity.rpe < getExpectedRPE(activity.data.summary.avgPower, activity.rpe) - 1 ? 'Lower RPE than expected — good freshness and form.' : 'RPE matches power output — normal perceived effort.'}
` : 'Analyze RPE in context of heart rate zones and duration.'}
` : 'No RPE provided — encourage logging RPE for better fatigue detection.'}

Feeling & Well-being:
${activity.feeling ? `
- Feeling: ${activity.feeling}/10 — ${activity.feeling <= 3 ? 'Poor energy — significant fatigue signal' : activity.feeling <= 5 ? 'Below average energy — recovery concern' : activity.feeling <= 7 ? 'Good energy — normal' : 'Excellent energy — optimal recovery'}
${activity.rpe ? `- RPE vs Feeling: ${activity.rpe}/10 RPE, ${activity.feeling}/10 feeling — ${activity.rpe > activity.feeling + 2 ? 'High effort with low well-being — notable fatigue divergence, discuss this explicitly.' : activity.rpe < activity.feeling - 2 ? 'Low RPE with high feeling — excellent freshness.' : 'Both are aligned — normal correlation.'}` : ''}
` : 'No feeling provided — encourage logging.'}

Daily Wellness:
${activity.data?.summary?.wellness ? `
- Weight: ${activity.data.summary.wellness.weight || 'N/A'}kg, Resting HR: ${activity.data.summary.wellness.restingHR || 'N/A'}bpm, HRV: ${activity.data.summary.wellness.hrv || 'N/A'}ms, Sleep Score: ${activity.data.summary.wellness.sleepScore || 'N/A'}/100
- Incorporate these into the Recovery & Fatigue Assessment section
` : 'No daily wellness metrics for this activity.'}

Personal Notes:
${activity.personal_notes ? `
"${activity.personal_notes}"
- Quote and analyze relevant parts in your response. Address concerns, observations, and insights relative to objective metrics.
` : 'None provided.'}

Current Workout Data:
${JSON.stringify({
                duration: activity.data?.summary?.duration ? `${Math.round(activity.data.summary.duration / 60)} minutes` : 'Unknown',
                distance: activity.data?.summary?.totalDistance ? `${activity.data.summary.totalDistance.toFixed(2)} km` : 'Unknown',
                avgPower: activity.data?.summary?.avgPower ? `${activity.data.summary.avgPower}W${ftp ? ` (${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP)` : ''}` : 'No power meter',
                avgPowerPerKg: (activity.data?.summary?.avgPower && weightKg) ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg${ftpPerKg ? ` (${Math.round((activity.data.summary.avgPower / weightKg / ftpPerKg) * 100)}% of FTP/kg)` : ''}` : 'N/A',
                avgHR: activity.data?.summary?.avgHeartRate ? `${activity.data.summary.avgHeartRate} bpm${vo2Max ? ` (compare to VO2 max capacity: ${vo2Max} ml/kg/min)` : ''}` : 'Unknown',
                maxPower: activity.data?.summary?.maxPower || activity.max_power ? `${activity.data?.summary?.maxPower || activity.max_power}W${ftp ? ` (${Math.round(((activity.data?.summary?.maxPower || activity.max_power) / ftp) * 100)}% of FTP)` : ''}` : 'N/A',
                maxHR: activity.data?.summary?.maxHeartRate ? `${activity.data.summary.maxHeartRate} bpm` : 'N/A',
                tss: activity.data?.summary?.tss || activity.tss ? Math.round(activity.data?.summary?.tss || activity.tss) : 'N/A',
                intensityFactor: activity.data?.summary?.intensityFactor || activity.intensity_factor ? Number(activity.data?.summary?.intensityFactor || activity.intensity_factor).toFixed(2) : 'N/A',
                variabilityIndex: activity.variability_index || activity.data?.summary?.variabilityIndex || 'N/A',
                efficiencyFactor: activity.efficiency_factor || activity.data?.summary?.efficiencyFactor || 'N/A',
                decoupling: activity.data?.summary?.decoupling || activity.decoupling ? `${Number(activity.data?.summary?.decoupling || activity.decoupling).toFixed(1)}%` : 'N/A',
                peakPower_pMax: activity.data?.summary?._raw?.icu_pm_p_max || activity.max_power || 'N/A',
                wPrime: activity.icu_pm_w_prime || activity.data?.summary?.powerModel?.wPrime || 'N/A',
                powerZones: activity.data?.powerZones ? Object.keys(activity.data.powerZones).length + ' zones' : 'No power zones',
                rpe: activity.rpe || 'Not provided',
                feeling: activity.feeling || 'Not provided',
                personalNotes: activity.personal_notes || 'Not provided',
                wellness: activity.data?.summary?.wellness ? {
                  sleepQuality: activity.data.summary.wellness.sleepQuality,
                  sleepScore: activity.data.summary.wellness.sleepScore,
                  hrv: activity.data.summary.wellness.hrv,
                  restingHR: activity.data.summary.wellness.restingHR,
                  weight: activity.data.summary.wellness.weight,
                  spO2: activity.data.summary.wellness.spO2,
                  vo2max: activity.data.summary.wellness.vo2max,
                  kcalConsumed: activity.data.summary.wellness.kcalConsumed,
                  bodyFat: activity.data.summary.wellness.bodyFat,
                } : 'Not provided',
                date: activity.start_time || activity.created_at
              }, null, 2)}

- **YOU MUST ANALYZE** how feeling relates to performance, RPE, and recovery
` : ''}
${activity.personal_notes ? `
- **YOU MUST EXPLICITLY MENTION** and analyze the user's personal notes: "${activity.personal_notes.substring(0, 100)}${activity.personal_notes.length > 100 ? '...' : ''}"
- **YOU MUST INCORPORATE** Comparison context: How does this workout compare to recent averages? Is power/HR trending up, down, or stable? If RPE and Feeling are both available, are they diverging? What patterns emerge from user observations?

OUTPUT FORMAT AND STYLE RULES:
- Use ## headings for each main section (exactly as listed below)
- Use ### for sub-sections within a section
- Use plain bullet points (- item) for lists
- Use **bold** ONLY for specific metric values, workout names, or key numbers — never for entire sentence labels
- Do NOT bold labels within bullets (write "Efficiency Factor: 1.23" not "**Efficiency Factor:** 1.23")
- Write in a clear, direct coaching voice — no emoji in headings, no filler phrases
- Keep each bullet concise (1–2 sentences max)
- Separate sections with a blank line — do not use --- horizontal rules

Provide the analysis in this exact structure:

## Performance Comparison vs History
[Compare this workout to historical data: duration vs average, power vs average, RPE trend, feeling trend, distance/efficiency. Use specific metrics and % changes. Explicitly state and analyze any provided feeling score.]

## Training Efficiency Analysis
[Efficiency Factor (EF), Intensity Factor (IF), Variability Index (VI), decoupling/aerobic drift, Peak Power (pMax), W'. Power zone distribution relative to polarized/pyramidal principles. What training stimulus was targeted and achieved?]

## Time Optimization Recommendations
[Specific recommendations to maximize training benefit per hour: what to keep, what to change, how to restructure, indoor vs outdoor balance.]

## Training Structure Feedback
[Power zone distribution, interval structure effectiveness. Power-to-weight analysis. VO2 max alignment if applicable.]

## Recovery & Fatigue Assessment
[Begin by explicitly stating the feeling score if provided ("You reported feeling X/10, which indicates..."). Cover RPE, feeling, wellness metrics (HRV, sleep score, resting HR), RPE vs feeling divergence, and personal notes. End with timing recommendation for next session.]

## Next Session Recommendations
[Goal-aligned and time-optimized. Reference specific workouts from the library by exact name. For each: exact name, why it fits current needs, how it complements this session, and timing suggestion.]
Workout Library (reference by exact name):
${availableWorkouts.slice(0, 30).map((w: any) =>
                `  • "${w.name}" (${w.category}) - ${w.duration || 'N/A'} | TSS: ${w.tss || 'N/A'} | IF: ${w.intensity_factor || 'N/A'} | Zones: ${w.power_zones?.join(', ') || 'N/A'}`
              ).join('\n')}
${availableWorkouts.length > 30 ? `  ... and ${availableWorkouts.length - 30} more workouts available` : ''}
` : ''}

Additional requirements:
- Be comprehensive — each section must have substantive content
- Use specific numbers and comparisons throughout
- Show your reasoning — explain WHY something is suboptimal
- Always reference how this compares to the athlete's training history
- Provide actionable, time-optimized recommendations
- If user provided feeling and/or personal notes, they must be explicitly addressed`
            }]
          }],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more analytical, less creative responses
            maxOutputTokens: 8000, // Higher limit for comprehensive deep reasoning analysis
            topP: 0.8,
            topK: 40,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)

      let additionalInfo = ''

      // If model not found (404), try to list available models to help validation
      if (geminiResponse.status === 404) {
        try {
          const listModelsUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${googleApiKey}`
          const listResponse = await fetch(listModelsUrl)
          if (listResponse.ok) {
            const listData = await listResponse.json()
            const models = listData.models
              ? listData.models
                .map((m: any) => m.name.replace('models/', ''))
                .filter((n: string) => n.includes('gemini'))
                .join(', ')
              : 'No models found'
            additionalInfo = ` Available models for your key: [${models}]`
          }
        } catch (e) {
          console.warn('Failed to list models:', e)
        }
      }

      throw new Error(`Gemini API error (${geminiResponse.status}): ${geminiResponse.statusText}. ${additionalInfo} ${errorText.substring(0, 200)}`)
    }

    const geminiData = await geminiResponse.json()

    // Check for Gemini API errors in response
    if (geminiData.error) {
      console.error('Gemini API response error:', geminiData.error)
      throw new Error(`Gemini API error: ${geminiData.error.message || JSON.stringify(geminiData.error)}`)
    }

    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis could not be generated'
    const finishReason = geminiData.candidates?.[0]?.finishReason
    const tokenCount = analysis.length

    console.log(`Analysis received: ${tokenCount} characters, finishReason: ${finishReason}`)

    if (!analysis || analysis === 'Analysis could not be generated') {
      console.error('No analysis text in Gemini response:', JSON.stringify(geminiData))
      throw new Error('Gemini API returned empty analysis')
    }

    // Warn if response seems too short or was truncated
    if (tokenCount < 500) {
      console.warn(`WARNING: Analysis is very short (${tokenCount} chars). This may indicate an issue.`)
    }

    if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
      console.warn(`WARNING: Response was truncated due to ${finishReason}. Consider increasing maxOutputTokens.`)
    }

    if (finishReason === 'STOP') {
      console.log('Response completed normally (STOP)')
    } else {
      console.log(`Response finish reason: ${finishReason}`)
    }

    // Extract workout recommendations from analysis and schedule them
    const suggestedWorkouts = extractWorkoutRecommendations(analysis, availableWorkouts)
    console.log(`Extracted ${suggestedWorkouts.length} workout recommendations from analysis`)

    // Schedule the primary recommended workout for tomorrow (or next available day)
    if (suggestedWorkouts.length > 0) {
      const primaryWorkout = suggestedWorkouts[0]
      const activityDate = activity.start_time ? new Date(activity.start_time) : new Date()
      const tomorrow = new Date(activityDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // Reset to start of day

      // Find the workout in the database
      const { data: workoutMatch } = await supabaseClient
        .from('workouts')
        .select('id, name, category')
        .eq('name', primaryWorkout.name)
        .maybeSingle()

      if (workoutMatch) {
        // Check if already scheduled for this date
        const { data: existing } = await supabaseClient
          .from('scheduled_workouts')
          .select('id')
          .eq('user_id', activity.user_id)
          .eq('scheduled_date', tomorrow.toISOString().split('T')[0])
          .eq('workout_name', primaryWorkout.name)
          .maybeSingle()

        if (!existing) {
          // Schedule the workout
          const { error: scheduleError } = await supabaseClient
            .from('scheduled_workouts')
            .insert({
              user_id: activity.user_id,
              workout_id: workoutMatch.id,
              workout_name: primaryWorkout.name,
              workout_category: workoutMatch.category,
              scheduled_date: tomorrow.toISOString().split('T')[0],
              source: 'ai_recommendation',
              notes: primaryWorkout.reasoning || `Recommended after activity analysis on ${activityDate.toISOString().split('T')[0]}`,
            })

          if (scheduleError) {
            console.error('Error scheduling workout:', scheduleError)
          } else {
            console.log(`Successfully scheduled workout "${primaryWorkout.name}" for ${tomorrow.toISOString().split('T')[0]}`)
          }
        } else {
          console.log(`Workout "${primaryWorkout.name}" already scheduled for ${tomorrow.toISOString().split('T')[0]}`)
        }
      } else {
        console.warn(`Could not find workout "${primaryWorkout.name}" in database to schedule`)
      }
    }

    // Parse the analysis and structure it
    const analysisData = {
      summary: analysis,
      insights: [], // Will be extracted from analysis
      recommendations: [], // Will be generated based on analysis
      trends: [], // Will be calculated from historical data
      performanceMetrics: activityData.metadata,
    }

    // Save analysis to database (delete existing first, then insert)
    // First check if analysis exists
    const { data: existing } = await supabaseClient
      .from('activity_analyses')
      .select('id')
      .eq('activity_id', activityId)
      .maybeSingle()

    if (existing) {
      // Update existing analysis
      const { error: updateError } = await supabaseClient
        .from('activity_analyses')
        .update({
          summary: analysisData.summary,
          insights: analysisData.insights,
          recommendations: analysisData.recommendations,
          trends: analysisData.trends,
          performance_metrics: analysisData.performanceMetrics,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('activity_id', activityId)

      if (updateError) {
        console.error('Database error updating analysis:', updateError)
      }
    } else {
      // Insert new analysis
      const { error: insertError } = await supabaseClient
        .from('activity_analyses')
        .insert({
          activity_id: activityId,
          summary: analysisData.summary,
          insights: analysisData.insights,
          recommendations: analysisData.recommendations,
          trends: analysisData.trends,
          performance_metrics: analysisData.performanceMetrics,
          generated_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Database error inserting analysis:', insertError)
        // Don't fail completely if save fails - still return the analysis
        console.warn('Analysis generated but failed to save to database')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisData,
        scheduledWorkouts: suggestedWorkouts.length > 0 ? suggestedWorkouts.map(w => w.name) : []
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error generating analysis:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorDetails = error instanceof Error ? error.stack : undefined

    return new Response(
      JSON.stringify({
        error: 'Failed to generate analysis',
        message: errorMessage,
        details: errorDetails,
        hint: errorMessage.includes('GOOGLE_API_KEY')
          ? 'Please set GOOGLE_API_KEY in Supabase Edge Function secrets'
          : errorMessage.includes('Gemini API')
            ? 'Check your Gemini API key and quota'
            : 'Check function logs for more details'
      }),
      {
        status: 200, // Return 200 to ensure client receives the error details
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
