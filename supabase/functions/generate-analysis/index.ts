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

    // Get user preferences, weight, and VO2 max
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('preferences, weight_kg, vo2_max')
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

**ATHLETE PERFORMANCE METRICS (CRITICAL FOR ANALYSIS):**
${ftpPerKg ? `
- **FTP/kg: ${ftpPerKg} W/kg** - Power-to-weight ratio (${ftp}W ÷ ${weightKg}kg)
  - This is THE critical cycling performance metric - use it to assess relative performance
  - Compare workout power outputs to FTP and analyze power-to-weight implications
  - For indoor workouts: Calculate workout intensity as % of FTP (e.g., ${activity.data?.summary?.avgPower ? `${Math.round((activity.data.summary.avgPower / ftp) * 100)}%` : 'calculate'} of FTP)
  - For climbing/elevation: Power-to-weight becomes even more critical
` : ftp ? `
- **FTP: ${ftp}W** (weight not provided - cannot calculate FTP/kg)
  - Calculate workout intensity as % of FTP
` : '⚠️ NO FTP SET - Cannot perform power-to-weight or intensity zone analysis'}
${vo2Max ? `
- **VO2 Max: ${vo2Max} ml/kg/min** - Maximum aerobic capacity
  - Use this to assess if current training is optimizing aerobic development
  - Compare current workout intensity to VO2 max capacity
  - Identify if training zones align with aerobic potential
  - VO2 max context: ${vo2Max >= 55 ? 'Elite level' : vo2Max >= 50 ? 'Very high' : vo2Max >= 45 ? 'High' : vo2Max >= 40 ? 'Above average' : 'Average'} aerobic capacity
` : '⚠️ NO VO2 MAX PROVIDED - Cannot assess aerobic capacity optimization. Encourage entering VO2 max from Garmin for better analysis.'}

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
- **POWER-TO-WEIGHT ANALYSIS:**
  - Workout avg: ${(activity.data.summary.avgPower / parseFloat(weightKg)).toFixed(2)} W/kg vs FTP/kg: ${ftpPerKg} W/kg
  - ${activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) ? '⚠️ HIGH intensity - above FTP/kg threshold' : activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) * 0.9 ? 'Threshold zone - appropriate for FTP work' : activity.data.summary.avgPower / weightKg > parseFloat(ftpPerKg) * 0.7 ? 'Tempo zone' : 'Endurance zone'}
  - For climbing/weight-dependent efforts: Compare power-to-weight ratio to FTP/kg
` : ''}
` : `
- Analyze heart rate distribution without power data
- Was effort consistent? Could structure be improved?
- How can outdoor training be optimized when time is limited?
${vo2Max ? `
- **AEROBIC CAPACITY ANALYSIS:**
  - VO2 max: ${vo2Max} ml/kg/min - assess if HR zones align with aerobic potential
  - Is training optimizing aerobic development relative to VO2 max capacity?
` : ''}
`}

## Recovery & Fatigue Assessment
${activity.rpe ? `
- Based on RPE ${activity.rpe}/10: ${activity.rpe >= 7 ? 'HIGH effort - emphasize recovery needed' : activity.rpe >= 5 ? 'MODERATE effort - monitor recovery' : 'LOW effort - good recovery status'}
- Recommendations for next session timing and intensity
` : 'Encourage RPE logging for better recovery assessment'}

## Next Session Recommendations (Time-Limited Focus)
[Specific, actionable recommendations:
- Duration recommendation
- Intensity zones to target
- Indoor vs outdoor suggestion
- How to maximize benefit in available time]

**REMEMBER:** Be CRITICAL but CONSTRUCTIVE. The athlete has limited time - help them optimize every minute.`
            }]
          }],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more analytical, less creative responses
            maxOutputTokens: 4000, // Higher limit for deep reasoning
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
    
    if (!analysis || analysis === 'Analysis could not be generated') {
      console.error('No analysis text in Gemini response:', JSON.stringify(geminiData))
      throw new Error('Gemini API returned empty analysis')
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
