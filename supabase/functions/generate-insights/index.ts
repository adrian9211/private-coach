import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('generate-insights: Request received', { method: req.method, url: req.url })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('generate-insights: Processing request')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    console.log('generate-insights: Request body', body)
    const { userId } = body

    if (!userId) {
      console.error('generate-insights: No userId provided')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('generate-insights: Processing for userId:', userId)

    // Get user data
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('preferences, weight_kg, vo2_max, training_goals, weekly_training_hours')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ftp = typeof user.preferences?.ftp === 'number' ? user.preferences.ftp : null
    const weightKg = typeof user.weight_kg === 'number' ? user.weight_kg : null
    const ftpPerKg = (ftp && weightKg && ftp > 0 && weightKg > 0)
      ? Number((ftp / weightKg).toFixed(2))
      : null
    const vo2Max = user.vo2_max
    const trainingGoals = user.training_goals
    const weeklyHours = user.weekly_training_hours

    // Get all processed activities
    const { data: activities, error: activitiesError } = await supabaseClient
      .from('activities')
      .select(`
        id,
        start_time,
        upload_date,
        total_distance,
        total_timer_time,
        avg_power,
        avg_heart_rate,
        avg_speed,
        rpe,
        feeling,
        personal_notes,
        data
      `)
      .eq('user_id', userId)
      .eq('status', 'processed')
      .order('start_time', { ascending: false, nullsFirst: false })
      .order('upload_date', { ascending: false })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allActivities = activities || []

    if (allActivities.length === 0) {
      return new Response(
        JSON.stringify({
          recommendations: "You haven't completed any activities yet. Start uploading your FIT files to get personalized AI insights and recommendations!"
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate training metrics
    const totalActivities = allActivities.length
    const totalDistance = allActivities.reduce((sum, a) => sum + (a.total_distance || 0), 0) / 1000 // km
    const totalTime = allActivities.reduce((sum, a) => sum + (a.total_timer_time || 0), 0)
    const activitiesWithPower = allActivities.filter(a => a.avg_power && a.avg_power > 0)
    const avgPower = activitiesWithPower.length > 0
      ? activitiesWithPower.reduce((sum, a) => sum + (a.avg_power || 0), 0) / activitiesWithPower.length
      : 0
    const activitiesWithHR = allActivities.filter(a => a.avg_heart_rate && a.avg_heart_rate > 0)
    const avgHeartRate = activitiesWithHR.length > 0
      ? activitiesWithHR.reduce((sum, a) => sum + (a.avg_heart_rate || 0), 0) / activitiesWithHR.length
      : 0

    // Get available workouts
    const { data: workouts } = await supabaseClient
      .from('workouts')
      .select('id, name, category, duration, duration_seconds, tss, intensity_factor, power_zones, description')
      .order('category')
      .order('name')

    const availableWorkouts = workouts || []

    // Calculate recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentActivities = allActivities.filter(a => {
      const date = a.start_time || a.upload_date
      return date && new Date(date) >= thirtyDaysAgo
    })

    // Subjective feedback aggregates
    const activitiesWithRPE = allActivities.filter(a => typeof (a as any).rpe === 'number') as any[]
    const activitiesWithFeeling = allActivities.filter(a => typeof (a as any).feeling === 'number') as any[]
    const avgRPEAll = activitiesWithRPE.length > 0
      ? activitiesWithRPE.reduce((sum, a) => sum + (a.rpe || 0), 0) / activitiesWithRPE.length
      : 0
    const avgFeelingAll = activitiesWithFeeling.length > 0
      ? activitiesWithFeeling.reduce((sum, a) => sum + (a.feeling || 0), 0) / activitiesWithFeeling.length
      : 0

    const recentWithRPE = recentActivities.filter(a => typeof (a as any).rpe === 'number') as any[]
    const recentWithFeeling = recentActivities.filter(a => typeof (a as any).feeling === 'number') as any[]
    const avgRPERecent = recentWithRPE.length > 0
      ? recentWithRPE.reduce((sum, a) => sum + (a.rpe || 0), 0) / recentWithRPE.length
      : 0
    const avgFeelingRecent = recentWithFeeling.length > 0
      ? recentWithFeeling.reduce((sum, a) => sum + (a.feeling || 0), 0) / recentWithFeeling.length
      : 0

    // Sample recent personal notes (last 5) for context
    const recentNotes = recentActivities
      .map(a => (a as any).personal_notes)
      .filter(n => typeof n === 'string' && n.trim().length > 0)
      .slice(0, 5) as string[]

    // Calculate power zone distribution across all activities
    let powerZoneDistribution: Record<string, number> = {}
    if (ftp && ftp > 0) {
      const zones = [
        { key: 'Z1', min: 0, max: 55 },
        { key: 'Z2', min: 56, max: 75 },
        { key: 'Z3', min: 76, max: 90 },
        { key: 'Z4', min: 91, max: 105 },
        { key: 'Z5', min: 106, max: 120 },
        { key: 'Z6', min: 121, max: 150 },
        { key: 'Z7', min: 151, max: 300 },
      ]

      zones.forEach(z => { powerZoneDistribution[z.key] = 0 })

      // Calculate zone time from activities with GPS track data
      allActivities.forEach(activity => {
        const activityData = activity.data as any
        const gpsTrack = activityData?.gps_track || activityData?.records || []

        if (Array.isArray(gpsTrack) && gpsTrack.length > 0) {
          const track = gpsTrack
            .filter((p: any) => p && (p.timestamp || p.time))
            .sort((a: any, b: any) => {
              const timeA = a.timestamp || a.time || 0
              const timeB = b.timestamp || b.time || 0
              return new Date(timeA).getTime() - new Date(timeB).getTime()
            })

          for (let i = 1; i < track.length; i++) {
            const prev = track[i - 1]
            const prevTime = prev.timestamp || prev.time
            const currTime = track[i].timestamp || track[i].time

            if (!prevTime || !currTime) continue

            const dt = (new Date(currTime).getTime() - new Date(prevTime).getTime()) / 1000
            if (!isFinite(dt) || dt <= 0 || dt > 300) continue

            const power = typeof prev.power === 'number' && prev.power > 0 ? prev.power : 0
            if (power > 0) {
              const powerPercent = (power / ftp) * 100
              const zone = zones.find(z => powerPercent >= z.min && powerPercent <= z.max)
              if (zone) {
                powerZoneDistribution[zone.key] += dt
              }
            }
          }
        } else if (activity.avg_power && activity.avg_power > 0 && activity.total_timer_time) {
          // Fallback: use average power for entire duration
          const powerPercent = (activity.avg_power / ftp) * 100
          const zone = zones.find(z => powerPercent >= z.min && powerPercent <= z.max)
          if (zone) {
            powerZoneDistribution[zone.key] += activity.total_timer_time
          }
        }
      })
    }

    // Calculate training load (CTL/ATL/Form)
    let fitness = 0
    let fatigue = 0
    let form = 0

    if (ftp && ftp > 0) {
      // Calculate daily TSS
      const dailyTSS: Record<string, number> = {}
      allActivities.forEach(activity => {
        const date = activity.start_time || activity.upload_date
        if (!date) return

        const duration = activity.total_timer_time || 0
        const power = activity.avg_power || 0

        if (duration > 0 && power > 0) {
          const intensityFactor = power / ftp
          const durationHours = duration / 3600
          const tss = durationHours * intensityFactor * intensityFactor * 100

          const dateKey = new Date(date).toISOString().split('T')[0]
          dailyTSS[dateKey] = (dailyTSS[dateKey] || 0) + Math.round(tss)
        }
      })

      // Calculate CTL (42-day) and ATL (7-day)
      const dates = Object.keys(dailyTSS).sort()
      const ctlDays = 42
      const atlDays = 7
      const ctlAlpha = 1 - Math.exp(-1 / ctlDays)
      const atlAlpha = 1 - Math.exp(-1 / atlDays)

      let ctl = 0
      let atl = 0

      dates.forEach((date, index) => {
        const tss = dailyTSS[date]
        if (index === 0) {
          ctl = tss
          atl = tss
        } else {
          ctl = ctl * (1 - ctlAlpha) + tss * ctlAlpha
          // Only use last 7 days for ATL
          if (index >= dates.length - atlDays) {
            atl = atl * (1 - atlAlpha) + tss * atlAlpha
          }
        }
      })

      fitness = Math.round(ctl * 10) / 10
      fatigue = Math.round(atl * 10) / 10
      form = Math.round((ctl - atl) * 10) / 10
    }

    // Build comprehensive prompt for AI
    const systemPrompt = `You are a KNOWLEDGEABLE and ANALYTICAL professional cycling coach with deep expertise in exercise physiology, training periodization, and performance analysis.

You are analyzing a cyclist's COMPREHENSIVE training data to provide actionable insights and recommendations.

**ATHLETE PROFILE:**
${ftp ? `- FTP: ${ftp}W` : '- FTP: Not set'}
${ftpPerKg ? `- FTP/kg: ${ftpPerKg} W/kg (${ftp}W ÷ ${weightKg}kg)` : weightKg ? `- Weight: ${weightKg}kg (FTP not set)` : ''}
${vo2Max ? `- VO2 Max: ${vo2Max} ml/kg/min` : ''}
${trainingGoals ? `- Training Goals: ${trainingGoals}` : '- Training Goals: Not specified'}
${weeklyHours ? `- Available Training Time: ${weeklyHours} hours/week` : '- Available Training Time: Not specified'}

**TRAINING HISTORY:**
- Total Activities: ${totalActivities}
- Total Distance: ${totalDistance.toFixed(0)} km
- Total Time: ${Math.round(totalTime / 3600)} hours
- Recent Activities (last 30 days): ${recentActivities.length}
- Average Power: ${avgPower > 0 ? `${Math.round(avgPower)}W${ftp ? ` (${Math.round((avgPower / ftp) * 100)}% of FTP)` : ''}` : 'No power data'}
- Average Heart Rate: ${avgHeartRate > 0 ? `${Math.round(avgHeartRate)} bpm` : 'No HR data'}

**SUBJECTIVE FEEDBACK (MANDATORY TO CONSIDER):**
- RPE (all-time): ${avgRPEAll > 0 ? avgRPEAll.toFixed(1) + '/10' : 'No RPE logged'} | last 30d: ${avgRPERecent > 0 ? avgRPERecent.toFixed(1) + '/10' : 'N/A'}
- Feeling (all-time): ${avgFeelingAll > 0 ? avgFeelingAll.toFixed(1) + '/10' : 'No feeling logged'} | last 30d: ${avgFeelingRecent > 0 ? avgFeelingRecent.toFixed(1) + '/10' : 'N/A'}
${recentNotes.length > 0 ? `- Recent Notes (sample):\n${recentNotes.map(n => `  • ${n}`).join('\n')}` : '- Recent Notes: None'}

${ftp && ftp > 0 ? `**TRAINING LOAD:**
- Fitness (CTL): ${fitness.toFixed(1)} TSS
- Fatigue (ATL): ${fatigue.toFixed(1)} TSS
- Form (TSB): ${form.toFixed(1)} (${form > 10 ? 'Peak' : form > 0 ? 'Fresh' : form > -10 ? 'Tired' : 'Exhausted'})
` : ''}

${ftp && Object.keys(powerZoneDistribution).length > 0 ? `**POWER ZONE DISTRIBUTION:**
${Object.entries(powerZoneDistribution)
          .filter(([_, time]) => time > 0)
          .map(([zone, time]) => {
            const hours = Math.round(time / 3600 * 10) / 10
            return `- ${zone}: ${hours} hours`
          })
          .join('\n')}
` : ''}

**AVAILABLE WORKOUT LIBRARY:**
${availableWorkouts.length > 0 ? `
You have access to a comprehensive workout library with ${availableWorkouts.length} structured workouts organized by category:
${Object.entries(
            availableWorkouts.reduce((acc: Record<string, any[]>, w: any) => {
              if (!acc[w.category]) acc[w.category] = []
              acc[w.category].push(w)
              return acc
            }, {})
          ).map(([category, workouts]) =>
            `- ${category}: ${workouts.length} workouts`
          ).join('\n')}

Sample workouts (you can reference these by name when making recommendations):
${availableWorkouts.slice(0, 20).map((w: any) =>
            `  • "${w.name}" (${w.category}) - ${w.duration || 'N/A'} | TSS: ${w.tss || 'N/A'} | IF: ${w.intensity_factor || 'N/A'} | Zones: ${w.power_zones?.join(', ') || 'N/A'}`
          ).join('\n')}
${availableWorkouts.length > 20 ? `  ... and ${availableWorkouts.length - 20} more workouts available` : ''}

**IMPORTANT**: When making workout recommendations, you MUST reference specific workouts by their exact name from the library above. You can search for workouts by:
- Category (e.g., VO2MAX, THRESHOLD, TEMPO, ENDURANCE, ANAEROBIC)
- Duration (duration_seconds)
- TSS (training stress score)
- Power zones (power_zones array)
- Intensity Factor (IF)

When suggesting workouts, provide:
1. The exact workout name
2. The category it belongs to
3. Why this workout fits the athlete's current needs
4. How it aligns with their training goals and available time
` : 'No workout library available - provide general training recommendations without specific workout names.'}

**ANALYSIS REQUIREMENTS:**
1. **Training Load Assessment**: Analyze current fitness, fatigue, and form. Is the athlete undertrained, optimally trained, or overtrained?
2. **Power Zone Analysis**: Evaluate zone distribution. Is training polarized, pyramidal, threshold-focused, or mixed?
3. **Performance Trends**: Assess if power is improving, stable, or declining based on recent activities.
4. **Goal Alignment**: How well does current training align with stated goals?
5. **Training Recommendations**: Provide specific, actionable recommendations for:
   - Training intensity distribution
   - Recovery needs
   - Periodization strategy
   - Next training focus areas
   ${availableWorkouts.length > 0 ? '**- SPECIFIC WORKOUT SUGGESTIONS**: Reference exact workout names from the library above that match the athlete\'s needs, goals, and available time. Explain why each suggested workout is appropriate.' : ''}
6. **FTP/kg Analysis**: ${ftpPerKg ? `Analyze ${ftpPerKg} W/kg performance level and provide context (amateur, competitive, elite, etc.)` : 'N/A - FTP or weight not set'}
7. **VO2 Max Context**: ${vo2Max ? `Analyze ${vo2Max} ml/kg/min and its relationship to training capacity` : 'N/A - VO2 Max not set'}
8. **Subjective Feedback Trends (MANDATORY)**: Explicitly analyze trends in RPE and Feeling (all-time vs last 30 days). If RPE is rising and Feeling is declining, flag fatigue/overreaching. If the user has provided notes, quote and incorporate them into long-term recommendations.

**OUTPUT FORMAT:**
Provide comprehensive insights in the following structure:
## Current Training Status
[Assessment of current state]

## Training Load Analysis
[Fitness, fatigue, form interpretation]

## Power Zone Distribution
[Analysis of training intensity distribution]

## Performance Trends
[Trends and patterns observed]

## Recommendations
[Specific, actionable recommendations organized by category]
${availableWorkouts.length > 0 ? '\n**Include specific workout suggestions from the library above, referencing workouts by their exact names.**' : ''}

## Periodization Strategy
[How to structure training going forward]
${availableWorkouts.length > 0 ? '\n**Reference specific workouts from the library that fit into the periodization plan.**' : ''}

**IMPORTANT:**
- Be specific and data-driven
- Reference actual metrics when possible
- Provide actionable recommendations
- Consider the athlete's available training time
- Align recommendations with stated goals
- If critical data is missing (FTP, goals, etc.), note this and provide general guidance
- Keep recommendations realistic and achievable`

    // Call Gemini API
    // Initialize Gemini API
    console.log('generate-insights: Initializing Gemini API')
    // Use gemini-3-pro-preview as requested by user (verified model)
    const requestedModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
    // validModels supports user requested model + fallbacks
    const validModels = ['gemini-3-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-flash-latest']
    const geminiModel = validModels.includes(requestedModel) ? requestedModel : 'gemini-flash-latest'

    if (requestedModel !== geminiModel) {
      console.warn(`generate-insights: Invalid model "${requestedModel}", using "${geminiModel}" instead`)
    }

    // Gemini 2.0 Flash Exp usually works best on v1beta
    const useV1Endpoint = !geminiModel.includes('-exp') && (geminiModel === 'gemini-2.5-pro' || geminiModel.startsWith('gemini-2.'))
    const apiVersion = 'v1beta' // Safest default for newer/experimental models like 1.5-flash and 2.0-flash-exp
    const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${geminiModel}:generateContent?key=${googleApiKey}`
    console.log(`generate-insights: Calling Gemini API with model: ${geminiModel} (${apiVersion})`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8000,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API')
    }

    const recommendations = data.candidates[0].content.parts[0].text

    // Save insights to database for caching
    const dataSnapshot = {
      totalActivities,
      totalDistance,
      totalTime,
      avgPower,
      avgHeartRate,
      recentActivitiesCount: recentActivities.length,
      fitness,
      fatigue,
      form,
      powerZoneDistribution,
      generatedAt: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseClient
      .from('user_insights')
      .upsert({
        user_id: userId,
        recommendations,
        data_snapshot: dataSnapshot,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('Error saving insights to database:', upsertError)
      // Continue anyway - return the recommendations even if save fails
    } else {
      console.log('generate-insights: Successfully saved insights to database')
    }

    return new Response(
      JSON.stringify({ recommendations }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error generating insights:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate insights' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

