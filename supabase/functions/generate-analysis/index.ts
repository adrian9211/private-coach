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
    // Use gemini-3-pro-preview as requested
    const requestedModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3-pro-preview'
    const validModels = ['gemini-3-pro-preview', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
    const geminiModel = validModels.includes(requestedModel) ? requestedModel : 'gemini-3-pro-preview'

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

    // Get user's activity history for context and trend analysis
    const { data: recentActivities, error: historyError } = await supabaseClient
      .from('activities')
      .select('id, start_time, data, rpe, feeling, total_distance, total_timer_time, avg_power, avg_heart_rate')
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
      avgFeeling: activityHistory.filter(a => a.feeling).reduce((sum, a) => sum + (a.feeling || 0), 0) / Math.max(1, activityHistory.filter(a => a.feeling).length),
      recentRPEs: activityHistory.filter(a => a.rpe).slice(0, 10).map(a => ({ date: a.start_time, rpe: a.rpe })),
      recentFeelings: activityHistory.filter(a => a.feeling).slice(0, 10).map(a => ({ date: a.start_time, feeling: a.feeling })),
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
              text: `You are a KNOWLEDGEABLE and ANALYTICAL professional cycling coach with deep expertise in exercise physiology, training periodization, and performance analysis. Use DEEP REASONING grounded in cycling science (Seiler, Coggan, Allen, Laursen, and other leading researchers) to analyze this workout in context of the athlete's training history, current fitness level, and goals.

**🔥🔥🔥 CRITICAL: USER FEEDBACK IS MANDATORY - YOU MUST ADDRESS IT IN YOUR RESPONSE 🔥🔥🔥**
${activity.feeling !== null && activity.feeling !== undefined ? `
- **USER REPORTED FEELING: ${activity.feeling}/10** (energy/well-being scale)
- **YOU MUST EXPLICITLY STATE:** "You reported feeling ${activity.feeling}/10, which indicates ${activity.feeling <= 3 ? 'poor energy and significant fatigue' : activity.feeling <= 5 ? 'below average energy' : activity.feeling <= 7 ? 'good energy' : 'excellent energy'}."
- **YOU MUST DISCUSS** how this feeling relates to your performance, RPE, and recovery in your analysis
- **YOU MUST INCLUDE** this feeling score in your "Recovery & Fatigue Assessment" section
- The user explicitly told you how tired/energetic they felt - this is CRUCIAL feedback that CANNOT be ignored or omitted
` : ''}
${activity.personal_notes && activity.personal_notes.trim().length > 0 ? `
- **USER PROVIDED PERSONAL NOTES:** "${activity.personal_notes.substring(0, 300)}${activity.personal_notes.length > 300 ? '...' : ''}"
- **YOU MUST EXPLICITLY QUOTE** relevant parts of these notes in your analysis
- **YOU MUST STATE:** "In your personal notes, you mentioned: [quote relevant parts]"
- **YOU MUST ANALYZE** these observations in context of objective metrics
- **YOU MUST ADDRESS** any concerns, observations, or insights the user mentioned
- The user shared their personal experience - this is CRUCIAL and must be addressed in your response
` : ''}
${(activity.feeling !== null && activity.feeling !== undefined) || (activity.personal_notes && activity.personal_notes.trim().length > 0) ? `
- **⚠️⚠️⚠️ MANDATORY REQUIREMENT ⚠️⚠️⚠️**
- **YOU CANNOT SKIP, IGNORE, OR OMIT** user-provided feeling or personal notes
- **IF YOU FAIL TO EXPLICITLY MENTION** feeling and/or personal notes in your analysis, your response is INCOMPLETE
- **YOU MUST INCLUDE** at least one sentence in your analysis that directly references the user's feeling score
- **YOU MUST INCLUDE** at least one sentence in your analysis that directly quotes and discusses the user's personal notes
- These are critical subjective feedback that must be explicitly mentioned and analyzed in your response
- Start your analysis or recovery section by mentioning these explicitly
` : ''}

**ANALYSIS APPROACH - RESEARCH-BASED COACHING:**
- Base your analysis on established cycling training science and research
- Compare this workout AGAINST the athlete's historical performance to identify trends and patterns
- Consider the athlete's current performance level (FTP/kg, VO2 max) when providing feedback and context
- Be BALANCED - acknowledge achievements while identifying improvement opportunities with specific, actionable guidance
- Every minute of training time is valuable - identify optimization opportunities based on training science
- Use the activity history to detect signs of fatigue, overreaching, or positive fitness adaptations
- Reference established training protocols from research (polarized training, periodization, zone-based training)

**TRAINING CONTEXT - TIME OPTIMIZATION FOCUS:**
- The athlete has LIMITED TIME per week for training
- Every workout should be OPTIMIZED for maximum benefit relative to available time
- Provide constructive, actionable feedback - identify what's working well and what could be improved
- Balance honest analysis with encouragement appropriate to the athlete's performance level
- Prioritize training methods with highest return on investment (based on Seiler's polarized model and periodization research)

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
- **FTP/kg: ${ftpPerKgString} W/kg** - Power-to-weight ratio (${ftp}W ÷ ${weightKg}kg) ⚡ CRITICAL METRIC
  - **PERFORMANCE LEVEL CONTEXT (Research-Based):**
    ${ftpPerKg >= 5.0 ? `
    - **World Tour Professional Level** (≥5.0 W/kg): Comparable to professional peloton riders (Coyle et al., 1991; Padilla et al., 2000). These athletes maintain exceptional power-to-weight ratios essential for competitive cycling at the highest level. Typical range: 5.0-6.5+ W/kg for sustained efforts.
    - Analysis perspective: This is elite performance. Acknowledge the high level of fitness and provide nuanced, professional-level training insights. Focus on optimization and fine-tuning rather than basic improvements.
    ` : ftpPerKg >= 4.5 ? `
    - **Elite/Professional Level** (4.5-4.99 W/kg): Represents elite amateur and professional-level performance (Schumacher & Mueller, 2002). These athletes demonstrate exceptional aerobic capacity and muscular efficiency. Competitive at national/international amateur level.
    - Analysis perspective: Recognize this as elite performance. Provide sophisticated training recommendations appropriate for high-level athletes. Focus on advanced periodization and performance optimization.
    ` : ftpPerKg >= 4.0 ? `
    - **Very Strong Amateur Level** (4.0-4.49 W/kg): Excellent fitness level, typically competitive in Category 1-2 races or strong local racing (Allen & Coggan, 2010). Demonstrates well-developed aerobic and muscular systems. Top 5-10% of recreational cyclists.
    - Analysis perspective: Acknowledge strong performance level. Provide training insights for high-performing amateurs. Focus on targeted improvements and advanced training concepts.
    ` : ftpPerKg >= 3.5 ? `
    - **Strong Amateur Level** (3.5-3.99 W/kg): Solid fitness foundation, competitive in Category 3-4 racing (Seiler, 2010). Represents good aerobic development and training consistency. Top 10-20% of recreational cyclists.
    - Analysis perspective: Recognize good fitness level. Provide balanced feedback acknowledging achievements while suggesting targeted improvements. Focus on structured training and continued development.
    ` : ftpPerKg >= 3.0 ? `
    - **Good Recreational Level** (3.0-3.49 W/kg): Solid recreational fitness with consistent training (Seiler & Kjerland, 2006). Demonstrates good aerobic base and regular training habits. Competitive in local group rides and category 5 races.
    - Analysis perspective: Acknowledge solid progress. Provide encouraging feedback while identifying specific improvement areas. Focus on training consistency and structured workouts.
    ` : ftpPerKg >= 2.5 ? `
    - **Recreational Level** (2.5-2.99 W/kg): Developing fitness with regular training participation (Coggan & Allen, 2012). Represents foundational aerobic development. Suitable for longer recreational rides and entry-level group cycling.
    - Analysis perspective: Encourage continued training and consistency. Provide clear, achievable recommendations for improvement. Focus on building aerobic base and establishing training routine.
    ` : `
    - **Beginner/Developing Level** (<2.5 W/kg): Early stages of cycling fitness development (Baron, 2001). Represents foundational fitness building. Normal for new cyclists or those returning to training after a break.
    - Analysis perspective: Be supportive and encouraging. Recognize that this is a development phase and focus on building consistency, basic fitness, and proper training habits. Celebrate small improvements and provide clear, simple recommendations.
    `}
  - **RESEARCH CONTEXT:** Power-to-weight ratio is the primary determinant of climbing performance (Di Prampero et al., 1979). Elite climbers typically maintain 5.5-6.5+ W/kg, while strong amateurs range 3.5-4.5 W/kg. Time trial and flat terrain performance is more dependent on absolute power (W) rather than W/kg.
  - **MANDATORY ANALYSIS:** 
    - Compare workout power outputs to FTP/kg threshold - is athlete training at appropriate intensity?
    - For indoor workouts: Calculate workout intensity as % of FTP (${activity.data?.summary?.avgPower && ftp ? `${Math.round((activity.data.summary.avgPower / ftp) * 100)}%` : 'calculate'} of FTP)
    - Calculate workout power-to-weight: ${activity.data?.summary?.avgPower && weightKg ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg (${((activity.data.summary.avgPower / weightKg) / ftpPerKg * 100).toFixed(0)}% of FTP/kg)` : 'N/A'}
    - For climbing/elevation efforts: Power-to-weight is THE determining factor - analyze thoroughly relative to performance level
    - For flat/time trial efforts: Consider absolute power (W) as primary factor, though W/kg remains relevant
  - **REQUIRED FEEDBACK TONE:** 
    - Provide contextually appropriate analysis based on performance level
    - Acknowledge achievements while identifying realistic improvement opportunities
    - Use encouraging, supportive language for developing athletes
    - Provide sophisticated insights for elite performers
    - Balance honest assessment with motivational guidance
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

**🔥 CRITICAL: FEELING & WELL-BEING ANALYSIS (MANDATORY IF PROVIDED):**
${activity.feeling ? `
- **USER REPORTED FEELING: ${activity.feeling}/10** - ${activity.feeling <= 3 ? 'Poor energy/well-being - CRITICAL FATIGUE SIGNAL' : activity.feeling <= 5 ? 'Below average energy - Recovery concern' : activity.feeling <= 7 ? 'Good energy - Normal' : 'Excellent energy - Optimal recovery'}
- **MANDATORY ANALYSIS REQUIRED:**
  - **YOU MUST EXPLICITLY MENTION** the user's feeling score in your analysis
  - **YOU MUST DISCUSS** how this feeling relates to their performance and recovery
  - **YOU MUST COMPARE** feeling to RPE and objective metrics
${activity.rpe ? `
  - RPE vs Feeling Comparison: ${activity.rpe > activity.feeling + 2 ? '⚠️ HIGH RPE (${activity.rpe}/10) with LOW Feeling (${activity.feeling}/10) - STRONG FATIGUE INDICATOR. This divergence is CRITICAL - user is experiencing high effort but low well-being. RECOMMEND IMMEDIATE REST and recovery.' : activity.rpe < activity.feeling - 2 ? '✅ LOW RPE (${activity.rpe}/10) with HIGH Feeling (${activity.feeling}/10) - Excellent freshness, optimal training condition.' : '✅ RPE (${activity.rpe}/10) and Feeling (${activity.feeling}/10) align - Normal correlation between effort and well-being.'}
` : 'Analyze feeling in context of workout performance and duration'}
- **RECOVERY INDICATOR:** Low feeling (1-5) suggests poor recovery, even if performance was good. High feeling (8-10) indicates excellent recovery and readiness.
- **MANDATORY:** Include feeling analysis in your "Recovery & Fatigue Assessment" section
` : '⚠️ NO FEELING PROVIDED - Encourage logging feeling for comprehensive recovery assessment'}

**🔥 CRITICAL: PERSONAL NOTES & USER EXPERIENCE (MANDATORY IF PROVIDED):**
${activity.personal_notes ? `
- **USER'S PERSONAL OBSERVATIONS (MUST BE ANALYZED):**
  "${activity.personal_notes}"
  
- **MANDATORY REQUIREMENTS:**
  - **YOU MUST EXPLICITLY MENTION** and quote relevant parts of the user's personal notes in your analysis
  - **YOU MUST ANALYZE** these notes in context of objective metrics (power, HR, RPE, feeling)
  - **YOU MUST ADDRESS** any concerns, observations, or insights the user mentioned
  - **YOU MUST DISCUSS** what worked well, what was challenging, and any unusual conditions mentioned
  - **YOU MUST INCORPORATE** these observations into your recommendations
  - Look for patterns, concerns, or insights the user mentioned that might not be visible in metrics alone
  - Consider: What worked well? What was challenging? Any unusual conditions or sensations?
  - **THIS USER FEEDBACK IS CRITICAL** - it provides subjective context that metrics cannot capture
` : 'No personal notes provided - Encourage user to log observations for better analysis'}

**CURRENT WORKOUT DATA:**
${JSON.stringify({
                duration: activity.data?.summary?.duration ? `${Math.round(activity.data.summary.duration / 60)} minutes` : 'Unknown',
                distance: activity.data?.summary?.totalDistance ? `${activity.data.summary.totalDistance.toFixed(2)} km` : 'Unknown',
                avgPower: activity.data?.summary?.avgPower ? `${activity.data.summary.avgPower}W${ftp ? ` (${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP)` : ''}` : 'No power meter',
                avgPowerPerKg: (activity.data?.summary?.avgPower && weightKg) ? `${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg${ftpPerKg ? ` (${Math.round((activity.data.summary.avgPower / weightKg / ftpPerKg) * 100)}% of FTP/kg)` : ''}` : 'N/A',
                avgHR: activity.data?.summary?.avgHeartRate ? `${activity.data.summary.avgHeartRate} bpm${vo2Max ? ` (compare to VO2 max capacity: ${vo2Max} ml/kg/min)` : ''}` : 'Unknown',
                maxPower: activity.data?.summary?.maxPower ? `${activity.data.summary.maxPower}W${ftp ? ` (${Math.round((activity.data.summary.maxPower / ftp) * 100)}% of FTP)` : ''}` : 'N/A',
                maxHR: activity.data?.summary?.maxHeartRate ? `${activity.data.summary.maxHeartRate} bpm` : 'N/A',
                powerZones: activity.data?.powerZones ? Object.keys(activity.data.powerZones).length + ' zones' : 'No power zones',
                rpe: activity.rpe || 'Not provided',
                feeling: activity.feeling || 'Not provided',
                personalNotes: activity.personal_notes || 'Not provided',
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
- If Feeling is provided: Is well-being/energy level declining? (recovery indicator)
- RPE vs Feeling: Are they diverging? (High RPE + Low Feeling = strong fatigue signal)
- Are there patterns suggesting overreaching or underreaching?
- If personal notes provided: What patterns or concerns emerge from user observations?

**🔥 MANDATORY ANALYSIS REQUIREMENTS:**
${activity.feeling ? `
- **YOU MUST EXPLICITLY DISCUSS** the user's feeling score (${activity.feeling}/10) in your analysis
- **YOU MUST ANALYZE** how feeling relates to performance, RPE, and recovery
` : ''}
${activity.personal_notes ? `
- **YOU MUST EXPLICITLY MENTION** and analyze the user's personal notes: "${activity.personal_notes.substring(0, 100)}${activity.personal_notes.length > 100 ? '...' : ''}"
- **YOU MUST INCORPORATE** their observations into your recommendations
` : ''}

**ANALYSIS FORMAT - Use DEEP REASONING:**

## Performance Comparison vs History 📊
[COMPARE this workout to historical data using quantitative analysis:
- Duration vs average: Is this workout length appropriate for the training stimulus?
- Power vs average: Is power output showing improvement, decline, or stagnation? (reference % changes)
- RPE trend: Is perceived effort increasing (potential fatigue) or decreasing (improving fitness)?
- Feeling trend: Is well-being improving or declining? (recovery indicator)
- RPE vs Feeling correlation: Are they aligned or diverging? (divergence indicates fatigue)
- Distance/efficiency: Are you getting more training benefit per hour invested?
- Personal notes patterns: What recurring themes emerge from user observations?
- Provide DATA-DRIVEN insights with specific metrics and comparisons]

## Training Efficiency Analysis 📈
[Identify optimization opportunities based on training science:
- Power zone distribution: Are zones utilized optimally according to polarized/pyramidal training principles?
- Training structure: Could intervals or session design be improved based on research?
- Missing training stimuli: What key adaptations might be missing based on current training pattern?
- Pacing and effort distribution: Analyze power/HR distribution relative to training goals
- Training purpose: Is the session structured with clear training objectives aligned with periodization?]

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
${ftpPerKg && weightKg ? `
- **COMPREHENSIVE POWER-TO-WEIGHT ANALYSIS (MANDATORY):**
  - Workout avg power-to-weight: ${(activity.data.summary.avgPower / weightKg).toFixed(2)} W/kg vs FTP/kg: ${ftpPerKgString} W/kg
  - Intensity percentage: ${((activity.data.summary.avgPower / weightKg / ftpPerKg) * 100).toFixed(0)}% of FTP/kg
  - Intensity assessment: ${activity.data.summary.avgPower / weightKg > ftpPerKg ? `⚠️ HIGH intensity - above FTP/kg threshold` : activity.data.summary.avgPower / weightKg > ftpPerKg * 0.9 ? `Threshold zone - appropriate for FTP work` : activity.data.summary.avgPower / weightKg > ftpPerKg * 0.7 ? `Tempo zone` : `Endurance zone`}
  - **REQUIRED ANALYSIS:** 
    - Current FTP/kg (${ftpPerKgString} W/kg) performance context: ${ftpPerKg >= 5.0 ? 'World Tour Professional level (≥5.0 W/kg) - comparable to professional peloton riders' : ftpPerKg >= 4.5 ? 'Elite/Professional level (4.5-4.99 W/kg) - elite amateur and professional performance' : ftpPerKg >= 4.0 ? 'Very Strong Amateur (4.0-4.49 W/kg) - excellent fitness, top 5-10% of recreational cyclists' : ftpPerKg >= 3.5 ? 'Strong Amateur (3.5-3.99 W/kg) - solid fitness, top 10-20% recreational level' : ftpPerKg >= 3.0 ? 'Good Recreational (3.0-3.49 W/kg) - solid fitness with consistent training' : ftpPerKg >= 2.5 ? 'Recreational (2.5-2.99 W/kg) - developing fitness with regular training' : 'Beginner/Developing (<2.5 W/kg) - foundational fitness building phase'}
    - Research-based performance benchmarks (Seiler, 2010; Coggan & Allen, 2012): Elite amateurs typically achieve 3.5-4.5 W/kg, professional cyclists 4.5-6.5+ W/kg, with world-class climbers exceeding 6.0 W/kg
    - For climbing/weight-dependent efforts: Power-to-weight is THE primary determining factor (Di Prampero et al., 1979) - analyze thoroughly relative to athlete's current level
    - For flat/time trial efforts: Consider both absolute power (W) and power-to-weight, with absolute power being more critical on flat terrain
  - **IMPROVEMENT RECOMMENDATIONS:**
    - Provide realistic, research-based recommendations appropriate to current performance level
    - For developing athletes (<3.5 W/kg): Focus on aerobic base building, consistency, and progressive overload
    - For intermediate athletes (3.5-4.5 W/kg): Introduce structured intervals, polarized training, and advanced periodization
    - For elite athletes (≥4.5 W/kg): Focus on fine-tuning, advanced periodization, and race-specific preparation
    - Reference training science: Seiler's polarized model, periodization principles, and zone-based training protocols
    - Be encouraging and supportive while providing honest, data-driven insights
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
${activity.rpe || (activity.feeling !== null && activity.feeling !== undefined) ? `
- **Recovery Assessment (MUST INCLUDE ALL PROVIDED METRICS - START WITH USER FEEDBACK):**
${activity.feeling !== null && activity.feeling !== undefined ? `
  **🔥 START THIS SECTION BY STATING:**
  "You reported feeling ${activity.feeling}/10 (${activity.feeling <= 3 ? 'poor energy - significant fatigue' : activity.feeling <= 5 ? 'below average energy' : activity.feeling <= 7 ? 'good energy' : 'excellent energy'}). This is a critical indicator of your recovery status and must be addressed."
  - **Feeling:** ${activity.feeling}/10 - ${activity.feeling <= 3 ? 'POOR energy - STRONG REST RECOMMENDED. The user explicitly reported feeling tired/exhausted. This MUST be mentioned and analyzed.' : activity.feeling <= 5 ? 'Below average energy - recovery concern. The user reported feeling below normal. This MUST be mentioned.' : activity.feeling >= 8 ? 'EXCELLENT energy - optimal for training. The user reported feeling great. This MUST be mentioned.' : 'Good energy - normal training ready. The user reported feeling okay. This MUST be mentioned.'}
` : ''}
${activity.rpe ? `  - **RPE:** ${activity.rpe}/10 - ${activity.rpe >= 7 ? 'HIGH effort - emphasize recovery needed' : activity.rpe >= 5 ? 'MODERATE effort - monitor recovery' : 'LOW effort - good recovery status'}` : ''}
${activity.rpe && activity.feeling !== null && activity.feeling !== undefined ? `
  - **Combined Assessment:** ${activity.rpe >= 7 && activity.feeling <= 3 ? '⚠️ HIGH RPE (${activity.rpe}/10) + LOW Feeling (${activity.feeling}/10) = STRONG FATIGUE SIGNAL - REST REQUIRED. **YOU MUST EXPLICITLY STATE:** "Your RPE of ${activity.rpe}/10 combined with your feeling of ${activity.feeling}/10 indicates significant fatigue. This divergence is critical - you experienced high effort but reported feeling very tired. REST is REQUIRED."' : activity.rpe <= 5 && activity.feeling >= 8 ? '✅ LOW RPE (${activity.rpe}/10) + HIGH Feeling (${activity.feeling}/10) = EXCELLENT RECOVERY - Ready for intensity. **YOU MUST EXPLICITLY STATE:** "Your RPE of ${activity.rpe}/10 combined with your feeling of ${activity.feeling}/10 indicates excellent recovery and freshness."' : 'Normal correlation between effort (RPE ${activity.rpe}/10) and well-being (Feeling ${activity.feeling}/10).'}
` : ''}
${activity.personal_notes && activity.personal_notes.trim().length > 0 ? `
  **🔥 USER'S PERSONAL OBSERVATIONS (MUST BE QUOTED IN THIS SECTION):**
  - **YOU MUST START A PARAGRAPH WITH:** "In your personal notes, you mentioned: '[quote 1-2 sentences from: ${activity.personal_notes}]'"
  - **YOU MUST ANALYZE:** What did the user say about how they felt? Any concerns or insights mentioned? 
  - **YOU MUST DISCUSS:** How do these observations relate to the objective metrics (power, HR, RPE, feeling)?
  - This is critical subjective context that metrics alone cannot capture - it MUST be addressed
` : ''}
- **Recommendations** for next session timing and intensity based on recovery status and user feedback
` : 'Encourage RPE and Feeling logging for better recovery assessment'}

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
- Reference cycling training science: Seiler's polarized model, periodization principles, training zones research
${availableWorkouts.length > 0 ? `
- **SPECIFIC WORKOUT SUGGESTIONS**: You have access to a workout library with ${availableWorkouts.length} structured workouts. When recommending next training sessions, reference specific workouts by their exact name from the library below. Consider:
  - Workout duration vs available time
  - TSS (Training Stress Score) appropriate for recovery/fatigue level
  - Power zones that complement this activity's classification
  - Category alignment (VO2MAX, THRESHOLD, TEMPO, ENDURANCE, ANAEROBIC, etc.)
  
  **Available Workout Library (sample - reference by exact name):**
  ${availableWorkouts.slice(0, 30).map((w: any) =>
                `  • "${w.name}" (${w.category}) - ${w.duration || 'N/A'} | TSS: ${w.tss || 'N/A'} | IF: ${w.intensity_factor || 'N/A'} | Zones: ${w.power_zones?.join(', ') || 'N/A'}`
              ).join('\n')}
  ${availableWorkouts.length > 30 ? `  ... and ${availableWorkouts.length - 30} more workouts available` : ''}
  
  **When suggesting workouts, provide:**
  1. The exact workout name from the library
  2. Why this workout fits the athlete's current needs
  3. How it complements the activity just completed
  4. How it aligns with training goals and available time
` : ''}]

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

**MANDATORY SECTION - Next Session Recommendations:**
You MUST include a section titled "## Next Session Recommendations 🎯" at the end of your analysis. In this section:
1. Recommend 1-3 specific workouts from the library above by their EXACT name
2. For each recommended workout, provide:
   - The exact workout name (must match exactly from the library)
   - Why this workout fits the athlete's current needs
   - When to do it (e.g., "tomorrow", "in 2 days", "next week")
   - Expected training stress and recovery needs
3. Format workout names clearly, for example:
   - "I recommend the **'12min 30/30's #2'** workout from the VO2MAX category..."
   - "For your next threshold session, try **'Threshold 20'**..."
4. If you recommend multiple workouts, prioritize them (e.g., "Primary recommendation:", "Alternative option:")

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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
