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

    // Calculate start date (default to tomorrow if not provided)
    const weekStart = startDate ? new Date(startDate) : new Date()
    weekStart.setDate(weekStart.getDate() + 1)
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

**AVAILABLE WORKOUT LIBRARY:**
You have access to ${availableWorkouts.length} structured workouts organized by category:
${Object.entries(
  availableWorkouts.reduce((acc: Record<string, any[]>, w: any) => {
    if (!acc[w.category]) acc[w.category] = []
    acc[w.category].push(w)
    return acc
  }, {})
).map(([category, workouts]) => 
  `- ${category}: ${workouts.length} workouts`
).join('\n')}

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
   - Reference workouts by their EXACT name from the library
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
Provide your response in this exact format:

## Weekly Training Plan

**Training Philosophy:** [Brief explanation of the training approach]

**Week Overview:**
- Total Training Time: ${weeklyHours} hours
- Available Training Days: ${trainingDays.length} days (${trainingDays.map((d: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')})
- Rest Days: ${7 - trainingDays.length} days
- Intensity Distribution: [X]% low, [X]% moderate, [X]% high

**Daily Schedule:**

${Array.from({ length: 7 }, (_, i) => {
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + i)
  const dayNum = date.getDay()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum]
  const isAvailable = trainingDays.includes(dayNum)
  return `### Day ${i + 1} - ${dayName} (${date.toLocaleDateString()})
${isAvailable ? `**Workout:** "[EXACT WORKOUT NAME FROM LIBRARY]"
- Category: [Category]
- Duration: [Duration]
- TSS: [TSS if available]
- Rationale: [Why this workout fits]` : '**REST DAY** (Not available for training)'}`
}).join('\n\n')}

**Weekly Progression:**
[Explain how the week builds fitness and progresses toward goals]

**IMPORTANT:**
- Use EXACT workout names from the library
- Ensure workouts exist in the library
- Provide specific, actionable plan
- Consider recovery between sessions
- Align with training goals

**CRITICAL REQUIREMENTS:**
1. **MUST reference workouts by EXACT name** - The workout names must match exactly from the library
2. **MUST provide a workout for each day** (or explicitly mark rest days)
3. **MUST explain the training structure** - Why this plan works
4. **MUST respect time constraints** - Don't exceed available training hours
5. **MUST follow training science** - Use proven periodization principles`

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

    const weekPlan = data.candidates[0].content.parts[0].text

    // Parse workout recommendations and schedule them
    const scheduledWorkouts = await parseAndScheduleWorkouts(
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
        weekPlan,
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

// Parse workout names from week plan and schedule them
async function parseAndScheduleWorkouts(
  weekPlan: string,
  availableWorkouts: any[],
  userId: string,
  weekStart: Date,
  availableDays: number[],
  supabaseClient: any
): Promise<Array<{ date: string; workoutName: string }>> {
  const scheduled: Array<{ date: string; workoutName: string }> = []
  const workoutNames = availableWorkouts.map(w => w.name)

  console.log(`parseAndScheduleWorkouts: Starting with ${availableWorkouts.length} available workouts`)
  console.log(`parseAndScheduleWorkouts: Week plan length: ${weekPlan.length} chars`)
  
  if (availableWorkouts.length === 0) {
    console.warn('parseAndScheduleWorkouts: No workouts available in database!')
    return scheduled
  }

  // Try multiple regex patterns to match different AI output formats
  const patterns = [
    // Pattern 1: ### Day X - DayName ... Workout: "Name"
    /###\s*Day\s+(\d+)\s*-\s*([^\n(]+)[^\#]*?Workout[:"\s]*["']?([^"'\n]+)["']?/gi,
    // Pattern 2: Day X: ... Workout: Name
    /Day\s+(\d+)[:\-]\s*([^\n]+?)(?:Workout|workout)[:"\s]*["']?([^"'\n]+)["']?/gi,
    // Pattern 3: **Day X** ... Workout: Name
    /\*\*Day\s+(\d+)\*\*[^\#]*?Workout[:"\s]*["']?([^"'\n]+)["']?/gi,
    // Pattern 4: Just look for workout names mentioned after day numbers
    /(?:Day|day)\s+(\d+)[^\n]*?["']([^"']{5,50})["']/gi,
  ]

  let dayMatches: RegExpMatchArray[] = []
  for (const pattern of patterns) {
    const matches = Array.from(weekPlan.matchAll(pattern))
    if (matches.length > 0) {
      console.log(`parseAndScheduleWorkouts: Found ${matches.length} matches with pattern ${pattern}`)
      dayMatches = matches
      break
    }
  }

  if (dayMatches.length === 0) {
    console.warn('parseAndScheduleWorkouts: No day matches found in week plan')
    console.log('parseAndScheduleWorkouts: First 500 chars of plan:', weekPlan.substring(0, 500))
    return scheduled
  }

  console.log(`parseAndScheduleWorkouts: Processing ${dayMatches.length} day matches`)
  console.log(`parseAndScheduleWorkouts: Available workout names (first 10): ${workoutNames.slice(0, 10).join(', ')}`)
  
  for (const match of dayMatches) {
    const dayNumber = parseInt(match[1])
    const workoutNameMatch = match[3] || match[2] // Try both capture groups
    
    console.log(`parseAndScheduleWorkouts: Processing match ${dayNumber}, raw match:`, {
      match1: match[1],
      match2: match[2],
      match3: match[3],
      fullMatch: match[0]?.substring(0, 100)
    })
    
    if (!workoutNameMatch) {
      console.log(`parseAndScheduleWorkouts: Day ${dayNumber} - No workout name found in match`)
      continue
    }
    
    const trimmedName = workoutNameMatch.trim()
    
    if (!trimmedName || trimmedName.toLowerCase().includes('rest') || trimmedName.length < 3) {
      console.log(`parseAndScheduleWorkouts: Skipping Day ${dayNumber} - invalid workout name: "${trimmedName}"`)
      continue
    }

    console.log(`parseAndScheduleWorkouts: Day ${dayNumber} - looking for workout: "${trimmedName}"`)

    // Find exact workout match
    const workoutMatch = workoutNames.find(name => {
      const normalizedName = name.toLowerCase().trim()
      const normalizedMatch = trimmedName.toLowerCase().trim()
      return normalizedMatch.includes(normalizedName) || normalizedName.includes(normalizedMatch)
    })

    if (!workoutMatch) {
      console.warn(`parseAndScheduleWorkouts: Day ${dayNumber} - No match found for "${trimmedName}"`)
      console.log(`parseAndScheduleWorkouts: Available workouts: ${workoutNames.slice(0, 5).join(', ')}...`)
      continue
    }

    console.log(`parseAndScheduleWorkouts: Day ${dayNumber} - Matched "${trimmedName}" to "${workoutMatch}"`)

    const scheduledDate = new Date(weekStart)
    scheduledDate.setDate(weekStart.getDate() + (dayNumber - 1))
    
    // Check if this day is available
    const dayOfWeek = scheduledDate.getDay()
    if (!availableDays.includes(dayOfWeek)) {
      console.log(`parseAndScheduleWorkouts: Skipping Day ${dayNumber} - day ${dayOfWeek} not in available days ${availableDays.join(',')}`)
      continue
    }
    
    // Find workout in database
    const { data: workout, error: workoutError } = await supabaseClient
      .from('workouts')
      .select('id, name, category')
      .eq('name', workoutMatch)
      .maybeSingle()

    if (workoutError) {
      console.error(`parseAndScheduleWorkouts: Error fetching workout "${workoutMatch}":`, workoutError)
      continue
    }

    if (!workout) {
      console.warn(`parseAndScheduleWorkouts: Workout "${workoutMatch}" not found in database`)
      continue
    }

    // Check if already scheduled
    const { data: existing, error: checkError } = await supabaseClient
      .from('scheduled_workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('scheduled_date', scheduledDate.toISOString().split('T')[0])
      .eq('workout_name', workoutMatch)
      .maybeSingle()

    if (checkError) {
      console.error(`parseAndScheduleWorkouts: Error checking existing scheduled workout:`, checkError)
    }

    if (existing) {
      console.log(`parseAndScheduleWorkouts: Workout "${workoutMatch}" already scheduled for ${scheduledDate.toISOString().split('T')[0]}`)
      continue
    }

    const { error: insertError } = await supabaseClient
      .from('scheduled_workouts')
      .insert({
        user_id: userId,
        workout_id: workout.id,
        workout_name: workout.name,
        workout_category: workout.category,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        source: 'week_plan',
        notes: `Part of weekly training plan generated on ${new Date().toISOString().split('T')[0]}`,
      })

    if (insertError) {
      console.error(`parseAndScheduleWorkouts: Error inserting scheduled workout:`, insertError)
      console.error(`parseAndScheduleWorkouts: Insert data:`, {
        user_id: userId,
        workout_id: workout.id,
        workout_name: workout.name,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
      })
    } else {
      scheduled.push({
        date: scheduledDate.toISOString().split('T')[0],
        workoutName: workoutMatch,
      })
      console.log(`parseAndScheduleWorkouts: ✓ Scheduled "${workoutMatch}" for ${scheduledDate.toISOString().split('T')[0]}`)
    }
  }

  console.log(`parseAndScheduleWorkouts: Completed - scheduled ${scheduled.length} workouts`)
  return scheduled
}

