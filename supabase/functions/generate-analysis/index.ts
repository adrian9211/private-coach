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
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-pro'

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

    // Get user preferences
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('preferences')
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

    // Prepare data for AI analysis
    const activityData = {
      metadata: activity.metadata,
      data: activity.data,
      userPreferences: user.preferences,
      rpe: activity.rpe, // Rate of Perceived Exertion (1-10) - critical for subjective feedback
      activityDate: activity.start_time || activity.created_at,
    }

    // Generate AI analysis using Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a CRITICAL and HONEST professional cycling coach analyzing workout data. Your role is to provide HONEST, ACTIONABLE feedback to help optimize training with LIMITED TIME per week. Be direct, constructive, and focus on efficiency.

**TRAINING CONTEXT - TIME OPTIMIZATION FOCUS:**
- The athlete has LIMITED TIME per week for training
- Every workout must be OPTIMIZED for maximum benefit
- Focus on what works and what doesn't - be CRITICAL when necessary
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

**CRITICAL RPE ANALYSIS (if provided):**
${activity.rpe ? `
- RPE: ${activity.rpe}/10 - ${getRPEDescription(activity.rpe)}
- **CRITICAL COMPARISON:** How does RPE compare to objective metrics?
${activity.data?.summary?.avgPower ? `
  - Expected RPE for ${activity.data.summary.avgPower}W avg power: ${getExpectedRPE(activity.data.summary.avgPower, activity.rpe)}
  - ${activity.rpe > getExpectedRPE(activity.data.summary.avgPower, activity.rpe) + 1 ? '⚠️ HIGH RPE vs Power - May indicate: fatigue, overreaching, illness, or poor recovery. RECOMMEND REST.' : activity.rpe < getExpectedRPE(activity.data.summary.avgPower, activity.rpe) - 1 ? '✅ LOW RPE vs Power - Good freshness and form. Consider increasing intensity next time.' : '✅ RPE matches power output - Normal perceived effort for the workload.'}
` : 'Analyze RPE in context of heart rate zones and duration'}
` : '⚠️ NO RPE PROVIDED - Strongly encourage logging RPE for better training analysis and fatigue detection'}

**WORKOUT DATA:**
${JSON.stringify({
  duration: activity.data?.summary?.duration ? `${Math.round(activity.data.summary.duration / 60)} minutes` : 'Unknown',
  distance: activity.data?.summary?.totalDistance ? `${activity.data.summary.totalDistance.toFixed(2)} km` : 'Unknown',
  avgPower: activity.data?.summary?.avgPower ? `${activity.data.summary.avgPower}W` : 'No power meter',
  avgHR: activity.data?.summary?.avgHeartRate ? `${activity.data.summary.avgHeartRate} bpm` : 'Unknown',
  powerZones: activity.data?.powerZones ? 'Power zones available' : 'No power zones',
  rpe: activity.rpe || 'Not provided'
}, null, 2)}

**PROVIDE CRITICAL ANALYSIS IN THIS FORMAT:**

## What Worked Well ✅
[List specific positives - what made this workout effective or valuable]

## Critical Issues & Wasted Time ⚠️
[Be HONEST about what didn't work, wasted time, or could be improved. Examples:
- Too much time in wrong zones
- Inefficient structure for time available
- Missing key training stimuli
- Poor pacing or effort distribution]

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
` : `
- Analyze heart rate distribution without power data
- Was effort consistent? Could structure be improved?
- How can outdoor training be optimized when time is limited?
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
            temperature: 0.7,
            maxOutputTokens: 2000,
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
