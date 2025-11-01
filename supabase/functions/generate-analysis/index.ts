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
    // Use gemini-2.5-pro (confirmed available) for best analysis quality with deep reasoning capability
    const requestedModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-pro'
    const validModels = ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-pro']
    const geminiModel = validModels.includes(requestedModel) ? requestedModel : 'gemini-2.5-pro'
    
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

    const { activityId } = await req.json()

    if (!activityId) {
      return new Response(
        JSON.stringify({ error: 'Activity ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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
    const ftp = user.preferences?.ftp
    const weightKg = user.weight_kg
    const ftpPerKg = (ftp && weightKg && ftp > 0 && weightKg > 0) 
      ? (ftp / weightKg).toFixed(2)
      : null
    const vo2Max = user.vo2_max
    const trainingGoals = user.training_goals
    const weeklyHours = user.weekly_training_hours

    // Get user's activity history for context and trend analysis
    const { data: recentActivities, error: historyError } = await supabaseClient
      .from('activities')
      .select('id, start_time, data, rpe, total_distance, total_timer_time, avg_power, avg_heart_rate')
      .eq('user_id', activity.user_id)
      .eq('status', 'processed')
      .order('start_time', { ascending: false, nullsFirst: false })
      .order('upload_date', { ascending: false })
      .limit(20) // Last 20 activities for context

    if (historyError) {
      console.warn('Error fetching activity history:', historyError)
    }

    // Calculate trends from history
    const activityHistory = recentActivities || []
    const historyContext = activityHistory.length > 0 ? {
      totalActivities: activityHistory.length,
      avgDuration: activityHistory.reduce((sum, a) => sum + (a.total_timer_time || 0), 0) / activityHistory.length,
      avgDistance: activityHistory.reduce((sum, a) => sum + (a.total_distance || 0), 0) / activityHistory.length,
      avgPower: activityHistory.filter(a => a.avg_power > 0).reduce((sum, a) => sum + (a.avg_power || 0), 0) / Math.max(1, activityHistory.filter(a => a.avg_power > 0).length),
      avgRPE: activityHistory.filter(a => a.rpe).reduce((sum, a) => sum + (a.rpe || 0), 0) / Math.max(1, activityHistory.filter(a => a.rpe).length),
      recentRPEs: activityHistory.filter(a => a.rpe).slice(0, 10).map(a => ({ date: a.start_time, rpe: a.rpe })),
      powerTrend: activityHistory.filter(a => a.avg_power > 0).length > 1 ? 
        (activityHistory.filter(a => a.avg_power > 0).slice(0, 5).reduce((sum, a) => sum + (a.avg_power || 0), 0) / 
         activityHistory.filter(a => a.avg_power > 0).slice(5, 10).reduce((sum, a) => sum + (a.avg_power || 0), 1)) : null,
    } : null

    // Prepare data for AI analysis
    const activityData = {
      metadata: activity.metadata,
      data: activity.data,
      userPreferences: user.preferences,
      rpe: activity.rpe, // Rate of Perceived Exertion (1-10) - critical for subjective feedback
      activityDate: activity.start_time || activity.created_at,
      // Performance metrics for power-to-weight analysis
      ftp: ftp,
      weightKg: weightKg,
      ftpPerKg: ftpPerKg, // Power-to-weight ratio (W/kg) - critical cycling performance metric
      vo2Max: vo2Max, // Maximum oxygen uptake (ml/kg/min) - crucial for aerobic capacity analysis
      trainingGoals: trainingGoals, // User's stated training goals
      weeklyTrainingHours: weeklyHours, // Available training time per week
    }

    // Generate AI analysis using Gemini API
    // Gemini 2.5 Pro uses v1 endpoint, older models use v1beta
    const useV1Endpoint = geminiModel === 'gemini-2.5-pro' || geminiModel.startsWith('gemini-2.')
    const apiVersion = useV1Endpoint ? 'v1' : 'v1beta'
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
              text: `You are a CRITICAL and ANALYTICAL professional cycling coach. Use DEEP REASONING to analyze this workout in context of the athlete's training history. Be HONEST, DATA-DRIVEN, and ACTIONABLE. Avoid generic praise - focus on what the DATA tells you.

**CRITICAL ANALYSIS REQUIREMENTS:**
- Compare this workout AGAINST the athlete's historical performance
- Identify patterns, trends, and anomalies
- Be CRITICAL - if something is mediocre, say so
- Focus on WHAT IS WRONG or SUBOPTIMAL, not just positives
- Every minute of training time is precious - identify wasted time
- Use the activity history to spot fatigue, overreaching, or improvements

**TRAINING CONTEXT - TIME OPTIMIZATION FOCUS:**
- The athlete has LIMITED TIME per week for training
- Every workout must be OPTIMIZED for maximum benefit
- Generic completion is NOT an achievement - be critical
- Focus on what works and what doesn't - be BRUTALLY HONEST when necessary
- Prioritize training that delivers the best results per hour invested

**ACTIVITY TYPE DETECTION:**
${activity.data?.summary?.avgPower && activity.data.summary.avgPower > 0 ? `
- **INDOOR ACTIVITY** (with power meter - ${activity.data.summary.avgPower}W avg)
- Indoor training allows for precise power control and structured intervals
- Can be more time-efficient than outdoor rides
- Analyze zone distribution and training structure effectiveness
` : `
- **OUTDOOR ACTIVITY** (no power meter detected)
- Relies on heart rate and perceived effort (RPE) for intensity control
- Outdoor training provides variable terrain, mental freshness, and skill development
- Analyze consistency of effort and training value without power data
`}
${activityClassification ? `
- **ACTIVITY CLASSIFICATION: ${activityClassification.name}** (Base: ${activityClassification.base.toFixed(2)})
  - Zone Distribution: ${activityClassification.distribution.z1z2.toFixed(1)}% Z1+2 (Low), ${activityClassification.distribution.z3z4.toFixed(1)}% Z3+4 (Medium), ${activityClassification.distribution.z5plus.toFixed(1)}% Z5+ (High)
  - **TRAINING PROTOCOL ANALYSIS REQUIRED:**
    ${activityClassification.name === 'Polarized' ? `
    - **POLARIZED TRAINING** (80/5/15 model - Seiler & Tonnessen research)
      - This workout follows the polarized model: 80% low intensity, 5% moderate, 15% high intensity
      - Research shows this model is highly effective for endurance athletes
      - Low-intensity base building is crucial for aerobic development
      - High-intensity intervals should be very hard but brief
      - **ANALYZE:** Is this distribution optimal for athlete's goals? Is the 80% truly easy enough?
      - **RECOMMEND:** Maintain polarized approach, but ensure low intensity is truly easy (Zone 1-2, <65% FTP)
    ` : activityClassification.name === 'Pyramidal' ? `
    - **PYRAMIDAL TRAINING** (75/20/5 model)
      - Traditional model with more moderate intensity than polarized
      - Good for athletes transitioning from base building to structured training
      - Moderate intensity (Zone 3-4) builds aerobic power but is less time-efficient than polarized
      - **ANALYZE:** Is too much time in moderate zone (gray zone) limiting adaptation?
      - **RECOMMEND:** Consider transitioning to polarized model for better adaptation per hour, or increase high-intensity work
    ` : activityClassification.name === 'Threshold' ? `
    - **THRESHOLD TRAINING** (50/40/10 model)
      - Heavy focus on Zone 4 (FTP threshold) training
      - Can be effective short-term but risks plateau and overreaching
      - Threshold work is mentally and physically demanding
      - **ANALYZE:** Is athlete over-emphasizing threshold? Risk of stagnation?
      - **RECOMMEND:** Balance with more low-intensity (recovery) and occasional high-intensity (VO2 max) work
    ` : activityClassification.name === 'HIIT' ? `
    - **HIGH-INTENSITY INTERVAL TRAINING (HIIT)** (50/10/40 model)
      - Heavy emphasis on high-intensity work (40% in Z5+)
      - Effective for time-limited athletes but requires careful recovery
      - Risk of overreaching if not balanced with low-intensity work
      - **ANALYZE:** Is athlete recovering properly? Is low-intensity portion adequate?
      - **RECOMMEND:** Ensure 50% easy recovery rides, monitor fatigue closely, prevent burnout
    ` : `
    - **MIXED/UNIQUE TRAINING PATTERN**
      - Distribution doesn't clearly match standard models
      - **ANALYZE:** What training adaptations is this targeting? Is distribution intentional or random?
      - **RECOMMEND:** Identify primary training goal and align distribution with proven protocols
    `}
  - **MANDATORY:** Research cycling training protocols (Seiler's Polarized, Pyramidal, Threshold, HIIT models)
  - **MANDATORY:** When recommending next trainings, consider this activity type and suggest complementary workouts
  - **MANDATORY:** Explain how this classification relates to athlete's goals and training protocols
` : activity.data?.summary?.avgPower ? `
- **Power data available but classification cannot be calculated** (FTP may not be set)
- Analyze power zone distribution manually and compare to training protocols
` : `
- **No power data** - Classification based on intensity zones not available
- Analyze based on heart rate zones and perceived effort
`}

**ATHLETE PERFORMANCE METRICS (CRITICAL FOR ANALYSIS - ANALYZE THESE THOROUGHLY):**
${ftpPerKg ? `
- **FTP/kg: ${ftpPerKg} W/kg** - Power-to-weight ratio (${ftp}W ÷ ${weightKg}kg) ⚡ CRITICAL METRIC
  - **MANDATORY ANALYSIS:** This is THE most important cycling performance metric - analyze it in detail
  - Compare workout power outputs to FTP/kg threshold - is athlete training at appropriate intensity?
  - For indoor workouts: Calculate workout intensity as % of FTP (${activity.data?.summary?.avgPower ? `${Math.round((activity.data.summary.avgPower / ftp) * 100)}%` : 'calculate'} of FTP)
  - Calculate workout power-to-weight: ${activity.data?.summary?.avgPower && weightKg ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg` : 'N/A'}
  - Is current FTP/kg appropriate for athlete's goals? How does it compare to elite levels?
  - For climbing/elevation: Power-to-weight is THE determining factor - analyze thoroughly
  - **REQUIRED:** Provide specific recommendations on how to improve FTP/kg if below athlete's potential
` : ftp ? `
- **FTP: ${ftp}W** (weight not provided - cannot calculate FTP/kg)
  - Calculate workout intensity as % of FTP
  - ⚠️ **URGENT:** Encourage athlete to enter weight to enable FTP/kg analysis - this is critical
` : '⚠️ NO FTP SET - Cannot perform power-to-weight or intensity zone analysis. This severely limits analysis quality.'}
${vo2Max ? `
- **VO2 Max: ${vo2Max} ml/kg/min** - Maximum aerobic capacity 🫁 CRITICAL METRIC
  - **MANDATORY ANALYSIS:** Analyze if current training is optimizing aerobic development relative to VO2 max
  - VO2 max context: ${vo2Max >= 55 ? 'Elite level' : vo2Max >= 50 ? 'Very high' : vo2Max >= 45 ? 'High' : vo2Max >= 40 ? 'Above average' : 'Average'} aerobic capacity
  - Compare workout heart rate zones to VO2 max capacity - is athlete training in optimal zones?
  - ${activity.data?.summary?.avgHeartRate ? `Current workout avg HR: ${activity.data.summary.avgHeartRate} bpm - what % of VO2 max does this represent?` : 'Analyze HR data relative to VO2 max capacity'}
  - Is training intensity aligned with VO2 max potential? Are they under-training or over-training relative to capacity?
  - **REQUIRED:** Provide specific recommendations on aerobic development based on VO2 max
  - Analyze if FTP/kg is appropriate for VO2 max level - elite VO2 max should support higher FTP/kg
` : '⚠️ NO VO2 MAX PROVIDED - Cannot assess aerobic capacity optimization. Encourage entering VO2 max from Garmin - this is critical for comprehensive analysis.'}
${trainingGoals ? `
- **ATHLETE GOALS:** ${trainingGoals}
  - **MANDATORY:** ALL recommendations must align with these stated goals
  - Assess if current workout is helping achieve these goals
  - Provide specific recommendations on how this workout contributes to or detracts from goal achievement
  - Modify all advice to directly support these goals
` : '⚠️ NO TRAINING GOALS PROVIDED - Recommend athlete enters goals in profile for personalized coaching'}
${weeklyHours ? `
- **TRAINING TIME AVAILABILITY: ${weeklyHours} hours/week**
  - **MANDATORY:** ALL recommendations must respect this time constraint
  - Calculate if current workout duration is appropriate for available time
  - Suggest optimal workout distribution across available hours
  - Prioritize time-efficient training methods
  - Avoid recommending workouts that exceed realistic time allocation
` : '⚠️ NO WEEKLY HOURS PROVIDED - Recommend athlete enters available training hours for time-optimized recommendations'}

**CRITICAL RPE ANALYSIS (if provided):**
${activity.rpe ? `
- RPE: ${activity.rpe}/10 - ${getRPEDescription(activity.rpe)}
- **CRITICAL COMPARISON:** How does RPE compare to objective metrics?
${activity.data?.summary?.avgPower && ftp ? `
  - Workout intensity: ${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP
  - Expected RPE for ${activity.data.summary.avgPower}W avg power: ${getExpectedRPE(activity.data.summary.avgPower, activity.rpe)}
  - ${activity.rpe > getExpectedRPE(activity.data.summary.avgPower, activity.rpe) + 1 ? '⚠️ HIGH RPE vs Power - May indicate: fatigue, overreaching, illness, or poor recovery. RECOMMEND REST.' : activity.rpe < getExpectedRPE(activity.data.summary.avgPower, activity.rpe) - 1 ? '✅ LOW RPE vs Power - Good freshness and form. Consider increasing intensity next time.' : '✅ RPE matches power output - Normal perceived effort for the workload.'}
` : activity.data?.summary?.avgPower ? `
  - Expected RPE for ${activity.data.summary.avgPower}W avg power: ${getExpectedRPE(activity.data.summary.avgPower, activity.rpe)}
  - ${activity.rpe > getExpectedRPE(activity.data.summary.avgPower, activity.rpe) + 1 ? '⚠️ HIGH RPE vs Power - May indicate: fatigue, overreaching, illness, or poor recovery. RECOMMEND REST.' : activity.rpe < getExpectedRPE(activity.data.summary.avgPower, activity.rpe) - 1 ? '✅ LOW RPE vs Power - Good freshness and form. Consider increasing intensity next time.' : '✅ RPE matches power output - Normal perceived effort for the workload.'}
` : 'Analyze RPE in context of heart rate zones and duration'}
` : '⚠️ NO RPE PROVIDED - Strongly encourage logging RPE for better training analysis and fatigue detection'}

**CURRENT WORKOUT DATA:**
${JSON.stringify({
  duration: activity.data?.summary?.duration ? `${Math.round(activity.data.summary.duration / 60)} minutes` : 'Unknown',
  distance: activity.data?.summary?.totalDistance ? `${activity.data.summary.totalDistance.toFixed(2)} km` : 'Unknown',
  avgPower: activity.data?.summary?.avgPower ? `${activity.data.summary.avgPower}W${ftp ? ` (${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP)` : ''}` : 'No power meter',
  avgPowerPerKg: (activity.data?.summary?.avgPower && weightKg) ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg${ftpPerKg ? ` (${Math.round((activity.data.summary.avgPower / weightKg / parseFloat(ftpPerKg)) * 100)}% of FTP/kg)` : ''}` : 'N/A',
  avgHR: activity.data?.summary?.avgHeartRate ? `${activity.data.summary.avgHeartRate} bpm${vo2Max ? ` (compare to VO2 max capacity: ${vo2Max} ml/kg/min)` : ''}` : 'Unknown',
  maxPower: activity.data?.summary?.maxPower ? `${activity.data.summary.maxPower}W${ftp ? ` (${Math.round((activity.data.summary.maxPower / ftp) * 100)}% of FTP)` : ''}` : 'N/A',
  maxHR: activity.data?.summary?.maxHeartRate ? `${activity.data.summary.maxHeartRate} bpm` : 'N/A',
  powerZones: activity.data?.powerZones ? Object.keys(activity.data.powerZones).length + ' zones' : 'No power zones',
  rpe: activity.rpe || 'Not provided',
  date: activity.start_time || activity.created_at
}, null, 2)}

**TRAINING HISTORY CONTEXT (Last ${activityHistory.length} activities):**
${historyContext ? JSON.stringify({
  averageDuration: `${Math.round(historyContext.avgDuration / 60)} minutes`,
  averageDistance: `${historyContext.avgDistance.toFixed(2)} km`,
  averagePower: historyContext.avgPower > 0 ? `${Math.round(historyContext.avgPower)}W` : 'No power data',
  averageRPE: historyContext.avgRPE > 0 ? `${historyContext.avgRPE.toFixed(1)}/10` : 'No RPE history',
  recentRPEs: historyContext.recentRPEs,
  powerTrend: historyContext.powerTrend ? (historyContext.powerTrend > 1.05 ? 'INCREASING' : historyContext.powerTrend < 0.95 ? 'DECREASING' : 'STABLE') : 'N/A'
}, null, 2) : 'No historical data available - this appears to be an early workout'}

**COMPARISON ANALYSIS REQUIRED:**
- How does this workout compare to recent averages?
- Is power/HR trending up, down, or stable?
- If RPE is provided: Is perceived effort increasing relative to power output? (fatigue indicator)
- Are there patterns suggesting overreaching or underreaching?

**ANALYSIS FORMAT - Use DEEP REASONING:**

## Performance Comparison vs History 📊
[COMPARE this workout to historical data:
- Duration vs average: is this too long/short for the benefit?
- Power vs average: showing improvement, decline, or stagnation?
- RPE trend: Is perceived effort increasing (fatigue) or decreasing (fitness)?
- Distance/efficiency: Are you getting more benefit per hour?
- Be DATA-DRIVEN, not optimistic]

## Critical Issues & Wasted Time ⚠️
[Be BRUTALLY HONEST about inefficiencies:
- Too much time in wrong zones (specify which zones and how long)
- Inefficient structure - what should have been different?
- Missing key training stimuli - what adaptation is missing?
- Poor pacing or effort distribution - be specific
- Generic riding without purpose - wasted minutes]

## Time Optimization Recommendations 🎯
[SPECIFIC recommendations to maximize training benefit per hour:
- What to keep doing
- What to eliminate (save time)
- How to restructure workouts for better efficiency
- Indoor vs outdoor training balance for time-limited athletes]

## Training Structure Feedback
${activity.data?.summary?.avgPower ? `
- Analyze power zone distribution - was time spent optimally?
- Were intervals structured effectively?
- Could similar adaptations be achieved in less time?
${ftpPerKg ? `
- **COMPREHENSIVE POWER-TO-WEIGHT ANALYSIS (MANDATORY):**
  - Workout avg power-to-weight: ${(activity.data.summary.avgPower / parseFloat(weightKg)).toFixed(2)} W/kg vs FTP/kg: ${ftpPerKg} W/kg
  - Intensity percentage: ${((activity.data.summary.avgPower / weightKg / parseFloat(ftpPerKg)) * 100).toFixed(0)}% of FTP/kg
  - Intensity assessment: ${activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) ? `⚠️ HIGH intensity - above FTP/kg threshold` : activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) * 0.9 ? `Threshold zone - appropriate for FTP work` : activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) * 0.7 ? `Tempo zone` : `Endurance zone`}
  - **REQUIRED ANALYSIS:** How does current FTP/kg (${ftpPerKg} W/kg) compare to athlete's potential? Elite amateurs: 3.5-4.5 W/kg, pros: 4.5-6.0+ W/kg
  - For climbing/weight-dependent efforts: Power-to-weight is THE determining factor - analyze thoroughly
  - Provide specific FTP/kg improvement recommendations based on current level and goals
` : ''}
${vo2Max && activity.data?.summary?.avgHeartRate ? `
- **COMPREHENSIVE VO2 MAX & AEROBIC CAPACITY ANALYSIS (MANDATORY):**
  - VO2 max: ${vo2Max} ml/kg/min (${vo2Max >= 55 ? 'Elite' : vo2Max >= 50 ? 'Very high' : vo2Max >= 45 ? 'High' : vo2Max >= 40 ? 'Above average' : 'Average'} aerobic capacity)
  - Workout avg HR: ${activity.data.summary.avgHeartRate} bpm - analyze what % of VO2 max this represents
  - **REQUIRED:** Is training intensity aligned with VO2 max potential? Are zones optimal?
  - **REQUIRED:** Does FTP/kg match VO2 max level? High VO2 max should support higher FTP/kg - analyze this relationship
  - Provide specific aerobic development recommendations based on VO2 max
` : vo2Max ? `
- **VO2 MAX ANALYSIS:** ${vo2Max} ml/kg/min - assess if HR data (when available) aligns with aerobic potential
` : ''}
` : `
- Analyze heart rate distribution without power data
- Was effort consistent? Could structure be improved?
- How can outdoor training be optimized when time is limited?
${vo2Max && activity.data?.summary?.avgHeartRate ? `
- **COMPREHENSIVE VO2 MAX & AEROBIC CAPACITY ANALYSIS (MANDATORY):**
  - VO2 max: ${vo2Max} ml/kg/min (${vo2Max >= 55 ? 'Elite' : vo2Max >= 50 ? 'Very high' : vo2Max >= 45 ? 'High' : vo2Max >= 40 ? 'Above average' : 'Average'} aerobic capacity)
  - Workout avg HR: ${activity.data.summary.avgHeartRate} bpm - analyze what % of VO2 max this represents
  - Is training optimizing aerobic development relative to VO2 max capacity?
  - Provide specific recommendations based on VO2 max level
` : vo2Max ? `
- **VO2 MAX ANALYSIS:** ${vo2Max} ml/kg/min - assess if HR zones align with aerobic potential
` : ''}
`}

## Recovery & Fatigue Assessment
${activity.rpe ? `
- Based on RPE ${activity.rpe}/10: ${activity.rpe >= 7 ? 'HIGH effort - emphasize recovery needed' : activity.rpe >= 5 ? 'MODERATE effort - monitor recovery' : 'LOW effort - good recovery status'}
- Recommendations for next session timing and intensity
` : 'Encourage RPE logging for better recovery assessment'}

## Next Session Recommendations (Goal-Aligned & Time-Optimized)
${trainingGoals ? `
**ALIGN WITH ATHLETE GOALS:** "${trainingGoals}"
` : ''}
${weeklyHours ? `
**RESPECT TIME CONSTRAINT:** ${weeklyHours} hours/week available
` : ''}
${activityClassification ? `
**CONSIDER ACTIVITY TYPE:** This workout was classified as **${activityClassification.name}** training
- **MANDATORY:** Recommend complementary workouts based on training periodization protocols
- Research-based recommendations from cycling science (Seiler, Laursen, etc.)
` : ''}
[Specific, actionable recommendations based on RESEARCH-BASED CYCLING TRAINING PROTOCOLS:
- **Activity Type Strategy:** ${activityClassification ? `Since this was ${activityClassification.name} training, recommend:` : 'Recommend activity type:'}
  ${activityClassification?.name === 'Polarized' ? `
    - Next session: Easy recovery ride (Zone 1-2, 60-75% of FTP) OR high-intensity intervals if 48h+ recovery
    - Maintain 80/5/15 distribution across weekly training
    - High-intensity sessions: 4-8x 3-5min @ 105-120% FTP with 2-3min recovery, or 30/30s intervals
  ` : activityClassification?.name === 'Pyramidal' ? `
    - Next session: Easy recovery OR threshold work if building FTP
    - Consider transitioning to polarized model for better adaptation efficiency
    - If continuing pyramidal: Balance moderate work with more low-intensity recovery
  ` : activityClassification?.name === 'Threshold' ? `
    - Next session: Easy recovery ride MANDATORY - threshold work requires recovery
    - Add more low-intensity work (Zone 1-2) to prevent overreaching
    - Balance with VO2 max intervals 1-2x per week
  ` : activityClassification?.name === 'HIIT' ? `
    - Next session: Easy recovery ride MANDATORY - high-intensity demands recovery
    - Ensure 50%+ of weekly training is low-intensity (Zone 1-2)
    - Monitor fatigue closely - HIIT is demanding
  ` : `
    - Analyze what training stimulus is missing
    - Recommend workout that addresses gaps in training distribution
  `}
- Duration recommendation ${weeklyHours ? `(considering ${weeklyHours} hours/week total)` : ''}
- Intensity zones to target ${ftpPerKg ? `(FTP/kg: ${ftpPerKg} W/kg)` : ''} ${vo2Max ? `(VO2 max: ${vo2Max} ml/kg/min)` : ''}
- Specific power targets ${ftp ? `(${Math.round(ftp * 0.6)}-${Math.round(ftp * 1.2)}W range)` : ''}
- Indoor vs outdoor suggestion based on time efficiency
- How to maximize benefit in available time
${trainingGoals ? `- Direct connection to achieving: "${trainingGoals}"` : ''}
${ftpPerKg && vo2Max ? `- Specific FTP/kg and VO2 max development recommendations based on current levels` : ''}
${activityClassification ? `- Training periodization: How does this ${activityClassification.name} session fit into weekly/monthly plan?` : ''}
- Reference cycling training science: Seiler's polarized model, periodization principles, training zones research]

**CRITICAL REQUIREMENTS FOR YOUR RESPONSE:**
1. **MUST be COMPREHENSIVE** - Your analysis should be 1000+ words minimum. Short, generic responses are unacceptable.
2. **MUST address EVERY section above** - Do not skip sections or give brief summaries.
3. **MUST use DATA** - Reference specific numbers, percentages, comparisons to history.
4. **MUST be SPECIFIC** - Vague statements like "good workout" or "could improve" are not helpful. Give exact details.
5. **MUST be ANALYTICAL** - Show your reasoning. Explain WHY something is suboptimal, not just that it is.
6. **MUST compare to HISTORY** - Always reference how this compares to the athlete's training history.
7. **MUST provide ACTIONABLE recommendations** - Not general advice, but specific, time-optimized suggestions.

**RESPONSE FORMAT:**
- Start each section with the exact heading (## Performance Comparison vs History 📊, etc.)
- Fill each section with detailed analysis (minimum 200 words per section)
- Use specific numbers and comparisons
- Be thorough - this athlete needs comprehensive coaching feedback

**DO NOT:** Give short responses, skip sections, use generic language, or provide vague recommendations.

**REMEMBER:** Be CRITICAL but CONSTRUCTIVE. The athlete has limited time - help them optimize every minute. Provide a COMPREHENSIVE analysis that demonstrates deep understanding of their training data and history.`
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
      throw new Error(`Gemini API error (${geminiResponse.status}): ${geminiResponse.statusText}. ${errorText.substring(0, 200)}`)
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
        analysis: analysisData 
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
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
