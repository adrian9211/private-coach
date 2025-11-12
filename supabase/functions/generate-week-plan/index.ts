import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    const { userId, startDate, availableHours, availableDays } = body

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user data first
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

    // Use provided hours or fall back to user's weekly hours
    const weeklyHours = availableHours || user.weekly_training_hours || 4
    // Use provided days or default to all days (0-6 = Sunday-Saturday)
    const trainingDays = availableDays && Array.isArray(availableDays) && availableDays.length > 0
      ? availableDays
      : [1, 2, 3, 4, 5, 6, 0] // All days by default

    const ftp = typeof user.preferences?.ftp === 'number' ? user.preferences.ftp : null
    const weightKg = typeof user.weight_kg === 'number' ? user.weight_kg : null
    const ftpPerKg = (ftp && weightKg && ftp > 0 && weightKg > 0) 
      ? Number((ftp / weightKg).toFixed(2))
      : null
    const vo2Max = user.vo2_max
    const trainingGoals = user.training_goals

    // Get recent activities for context
    const { data: recentActivities } = await supabaseClient
      .from('activities')
      .select('id, start_time, total_timer_time, avg_power, avg_heart_rate, rpe, feeling')
      .eq('user_id', userId)
      .eq('status', 'processed')
      .order('start_time', { ascending: false })
      .limit(10)

    // Get available workouts
    const { data: workouts } = await supabaseClient
      .from('workouts')
      .select('id, name, category, duration, duration_seconds, tss, intensity_factor, power_zones, description')
      .order('category')
      .order('name')

    const availableWorkouts = workouts || []

    // Calculate start date (default to today if not provided)
    const weekStart = startDate ? new Date(startDate) : new Date()
    // If no explicit start date provided, start from the next available training day (usually tomorrow or Monday)
    if (!startDate) {
      const today = weekStart.getDay()
      // If today is not an available training day, move to the next available day
      if (!trainingDays.includes(today)) {
        // Find next available day
        let daysToAdd = 1
        while (daysToAdd < 7 && !trainingDays.includes((today + daysToAdd) % 7)) {
          daysToAdd++
        }
        weekStart.setDate(weekStart.getDate() + daysToAdd)
      }
      // Otherwise start today
    }
    weekStart.setHours(0, 0, 0, 0)

    // Build AI prompt for week plan generation
    const systemPrompt = `You are a professional cycling coach creating a structured 7-day training plan.

**ATHLETE PROFILE:**
${ftp ? `- FTP: ${ftp}W` : '- FTP: Not set'}
${ftpPerKg ? `- FTP/kg: ${ftpPerKg} W/kg` : ''}
${vo2Max ? `- VO2 Max: ${vo2Max} ml/kg/min` : ''}
${trainingGoals ? `- Training Goals: ${trainingGoals}` : '- Training Goals: Not specified'}
${weeklyHours ? `- Available Training Time: ${weeklyHours} hours/week` : '- Available Training Time: Not specified'}

**RECENT TRAINING CONTEXT:**
${recentActivities && recentActivities.length > 0 ? `
- Last ${recentActivities.length} activities:
${recentActivities.slice(0, 5).map((a: any) => 
  `  • ${a.start_time ? new Date(a.start_time).toLocaleDateString() : 'Recent'}: ${Math.round((a.total_timer_time || 0) / 60)}min, ${a.avg_power ? `${a.avg_power}W` : 'no power'}, RPE: ${a.rpe || 'N/A'}/10, Feeling: ${a.feeling || 'N/A'}/10`
).join('\n')}
` : 'No recent activities'}

**AVAILABLE WORKOUT LIBRARY (${availableWorkouts.length} total workouts):**

**CRITICAL: You MUST select workouts from this list by their EXACT name. Do NOT invent or modify workout names.**

${Object.entries(
  availableWorkouts.reduce((acc: Record<string, any[]>, w: any) => {
    if (!acc[w.category]) acc[w.category] = []
    acc[w.category].push(w)
    return acc
  }, {})
).map(([category, workouts]) => {
  // Show first 15 workouts from each category with full details
  const sampleWorkouts = workouts.slice(0, 15)
  const remaining = workouts.length - sampleWorkouts.length
  return `**${category}** (${workouts.length} workouts):
${sampleWorkouts.map((w: any) => 
  `  - "${w.name}"${w.duration ? ` (${Math.round(w.duration)}min)` : ''}${w.tss ? ` [TSS: ${Math.round(w.tss)}]` : ''}`
).join('\n')}${remaining > 0 ? `\n  ... and ${remaining} more ${category} workouts` : ''}`
}).join('\n\n')}

**TASK:**
Create a comprehensive 7-day training plan starting ${weekStart.toLocaleDateString()}. The plan should:

1. **Follow Training Science Principles:**
   - Polarized training model (80% low intensity, 20% high intensity) OR
   - Pyramidal model (75% low, 20% moderate, 5% high) OR
   - Threshold-focused model (if building FTP)
   - Appropriate recovery days between hard sessions
   - Progressive overload throughout the week

2. **Respect Time Constraints:**
   - Total time: ${weeklyHours} hours (${weeklyHours * 60} minutes) per week
   - Available training days: ${trainingDays.map((d: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}
   - Only schedule workouts on available days (${trainingDays.join(', ')})
   - Distribute time across available days
   - Include rest days on non-available days

3. **Select Specific Workouts:**
   - You MUST use the EXACT workout names from the library above
   - DO NOT create, invent, or modify workout names
   - DO NOT use names like "Tempo Bursts 2x15" or "Endurance Builder 75" - these are NOT in the library
   - Use names EXACTLY as shown: "Tempo 2x15", "Sweetspot 3x8", "10min Ramps", etc.
   - Choose workouts that align with training goals
   - Vary workout types throughout the week
   - Match workout duration to available time
   - Only schedule workouts on days ${trainingDays.join(', ')} (0=Sunday, 1=Monday, etc.)

4. **Structure the Week:**
   ${trainingDays.map((day: number, idx: number) => {
     const date = new Date(weekStart)
     date.setDate(weekStart.getDate() + day)
     const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
     return `   - Day ${day + 1} (${dayName}, ${date.toLocaleDateString()}): [Workout name] - [Category] - [Duration] - [Why]`
   }).join('\n')}
   - Mark non-available days as REST DAYS

5. **Provide Rationale:**
   - Explain the training structure
   - Explain why each workout fits the plan
   - Explain how it progresses toward goals

**OUTPUT FORMAT:**
Return your response as a valid JSON object with this structure:

{
  "trainingPhilosophy": "Brief explanation of the training approach (1-2 sentences)",
  "weekOverview": {
    "totalTime": ${weeklyHours},
    "availableDays": ${trainingDays.length},
    "intensityDistribution": "e.g., 75% low, 20% moderate, 5% high"
  },
  "dailySchedule": [
${Array.from({ length: 7 }, (_, i) => {
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + i)
  const dayNum = date.getDay()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum]
  const isAvailable = trainingDays.includes(dayNum)
  return `    {
      "day": ${i + 1},
      "date": "${date.toISOString().split('T')[0]}",
      "dayName": "${dayName}",
      "isRestDay": ${!isAvailable}${isAvailable ? `,
      "workoutName": "[EXACT NAME FROM LIBRARY]",
      "category": "[Category from library]",
      "rationale": "Why this workout fits (1 sentence)"` : ''}
    }`
}).join(',\n')}
  ]
}

**CRITICAL REQUIREMENTS:**
1. Return ONLY valid JSON - no markdown, no extra text
2. Use EXACT workout names from the library (copy-paste from above)
3. DO NOT invent or modify workout names
4. For rest days, set "isRestDay": true and omit workoutName
5. Keep rationales to ONE sentence each

**EXAMPLE:**
{
  "trainingPhilosophy": "Pyramidal model focusing on aerobic base with targeted intensity.",
  "weekOverview": {
    "totalTime": 4,
    "availableDays": 4,
    "intensityDistribution": "75% low, 20% moderate, 5% high"
  },
  "dailySchedule": [
    {
      "day": 1,
      "date": "2025-11-14",
      "dayName": "Friday",
      "isRestDay": false,
      "workoutName": "10min Ramps",
      "category": "THRESHOLD",
      "rationale": "Builds FTP with short high-intensity efforts."
    },
    {
      "day": 2,
      "date": "2025-11-15",
      "dayName": "Saturday",
      "isRestDay": true
    }
  ]
}`

    // Call Gemini API
    const geminiModel = 'gemini-2.5-pro'
    const apiVersion = 'v1'
    const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${geminiModel}:generateContent?key=${googleApiKey}`

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
          temperature: 0.4,
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

    let weekPlanText = data.candidates[0].content.parts[0].text
    
    // Extract JSON from the response (AI might wrap it in markdown code blocks)
    let weekPlan: any
    try {
      // Try to extract JSON from code blocks first
      const jsonMatch = weekPlanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        weekPlan = JSON.parse(jsonMatch[1])
      } else {
        // Try to parse directly
        weekPlan = JSON.parse(weekPlanText)
      }
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error)
      console.log('AI response:', weekPlanText.substring(0, 500))
      throw new Error('AI did not return valid JSON. Please try again.')
    }

    // Parse workout recommendations and schedule them
    const scheduledWorkouts = await scheduleWorkoutsFromJSON(
      weekPlan,
      availableWorkouts,
      userId,
      weekStart,
      trainingDays,
      supabaseClient
    )

    return new Response(
      JSON.stringify({
        success: true,
        weekPlan: weekPlan,
        weekPlanText: JSON.stringify(weekPlan, null, 2), // Pretty-printed for display
        scheduledWorkouts: scheduledWorkouts.length,
        startDate: weekStart.toISOString().split('T')[0],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error generating week plan:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate week plan' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// Schedule workouts from JSON response
async function scheduleWorkoutsFromJSON(
  weekPlan: any,
  availableWorkouts: any[],
  userId: string,
  weekStart: Date,
  availableDays: number[],
  supabaseClient: any
): Promise<Array<{ date: string; workoutName: string }>> {
  const scheduled: Array<{ date: string; workoutName: string }> = []
  const workoutNames = availableWorkouts.map(w => w.name)

  console.log(`scheduleWorkoutsFromJSON: Starting with ${availableWorkouts.length} available workouts`)
  
  if (availableWorkouts.length === 0) {
    console.warn('scheduleWorkoutsFromJSON: No workouts available in database!')
    return scheduled
  }

  if (!weekPlan.dailySchedule || !Array.isArray(weekPlan.dailySchedule)) {
    console.error('scheduleWorkoutsFromJSON: Invalid week plan structure')
    return scheduled
  }

  console.log(`scheduleWorkoutsFromJSON: Processing ${weekPlan.dailySchedule.length} days`)
  
  for (const day of weekPlan.dailySchedule) {
    if (day.isRestDay) {
      console.log(`scheduleWorkoutsFromJSON: Day ${day.day} - Rest day, skipping`)
      continue
    }

    if (!day.workoutName) {
      console.warn(`scheduleWorkoutsFromJSON: Day ${day.day} - No workout name provided`)
      continue
    }

    const workoutName = day.workoutName.trim()
    console.log(`scheduleWorkoutsFromJSON: Day ${day.day} - Processing workout: "${workoutName}"`)

    // Find exact workout match
    const workoutMatch = workoutNames.find(name => name === workoutName)

    if (!workoutMatch) {
      console.warn(`scheduleWorkoutsFromJSON: Day ${day.day} - Exact match not found for "${workoutName}", trying fuzzy match`)
      // Try fuzzy match
      const fuzzyMatch = workoutNames.find(name => {
        const normalizedName = name.toLowerCase().trim()
        const normalizedSearch = workoutName.toLowerCase().trim()
        return normalizedName === normalizedSearch || 
               normalizedName.includes(normalizedSearch) || 
               normalizedSearch.includes(normalizedName)
      })
      
      if (!fuzzyMatch) {
        console.error(`scheduleWorkoutsFromJSON: Day ${day.day} - No match found for "${workoutName}"`)
        console.log(`scheduleWorkoutsFromJSON: Available workouts sample: ${workoutNames.slice(0, 5).join(', ')}...`)
        continue
      }
      
      console.log(`scheduleWorkoutsFromJSON: Day ${day.day} - Fuzzy matched "${workoutName}" to "${fuzzyMatch}"`)
      day.workoutName = fuzzyMatch
    }

    const scheduledDate = new Date(day.date)
    const dayOfWeek = scheduledDate.getDay()
    
    // Verify this day is available
    if (!availableDays.includes(dayOfWeek)) {
      console.warn(`scheduleWorkoutsFromJSON: Day ${day.day} - ${day.dayName} (${dayOfWeek}) not in available days ${availableDays.join(',')}`)
      continue
    }
    
    // Find workout in database (take first match if there are duplicates)
    const { data: workouts, error: workoutError } = await supabaseClient
      .from('workouts')
      .select('id, name, category')
      .eq('name', day.workoutName)
      .limit(1)

    if (workoutError) {
      console.error(`scheduleWorkoutsFromJSON: Error fetching workout "${day.workoutName}":`, workoutError)
      continue
    }

    if (!workouts || workouts.length === 0) {
      console.error(`scheduleWorkoutsFromJSON: Workout "${day.workoutName}" not found in database`)
      continue
    }

    const workout = workouts[0]
    console.log(`scheduleWorkoutsFromJSON: Day ${day.day} - Found workout: ${workout.name} (${workout.category})`)

    // Check if already scheduled
    const { data: existing } = await supabaseClient
      .from('scheduled_workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('scheduled_date', day.date)
      .eq('workout_name', day.workoutName)
      .maybeSingle()

    if (existing) {
      console.log(`scheduleWorkoutsFromJSON: Workout "${day.workoutName}" already scheduled for ${day.date}`)
      continue
    }

    // Insert scheduled workout
    const { error: insertError } = await supabaseClient
      .from('scheduled_workouts')
      .insert({
        user_id: userId,
        workout_id: workout.id,
        workout_name: workout.name,
        workout_category: workout.category,
        scheduled_date: day.date,
        source: 'week_plan',
        notes: day.rationale || `Part of weekly training plan generated on ${new Date().toISOString().split('T')[0]}`,
      })

    if (insertError) {
      console.error(`scheduleWorkoutsFromJSON: Error inserting workout:`, insertError)
    } else {
      scheduled.push({
        date: day.date,
        workoutName: day.workoutName,
      })
      console.log(`scheduleWorkoutsFromJSON: ✓ Scheduled "${day.workoutName}" for ${day.date}`)
    }
  }

  console.log(`scheduleWorkoutsFromJSON: Completed - scheduled ${scheduled.length} workouts`)
  return scheduled
}

