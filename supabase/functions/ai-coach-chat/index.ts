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

    const { activityId, message, conversationHistory } = await req.json()

    if (!activityId || !message) {
      return new Response(
        JSON.stringify({ error: 'Activity ID and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get activity and analysis
    const { data: activity, error: activityError } = await supabaseClient
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single()

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get existing analysis
    const { data: analysis } = await supabaseClient
      .from('activity_analyses')
      .select('summary')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get user data
    const { data: user } = await supabaseClient
      .from('users')
      .select('preferences, weight_kg, vo2_max, training_goals, weekly_training_hours')
      .eq('id', activity.user_id)
      .single()

    const ftp = typeof user?.preferences?.ftp === 'number' ? user.preferences.ftp : null
    const weightKg = typeof user?.weight_kg === 'number' ? user.weight_kg : null
    const ftpPerKg = (ftp && weightKg && ftp > 0 && weightKg > 0) 
      ? Number((ftp / weightKg).toFixed(2))
      : null
    const ftpPerKgString = ftpPerKg ? ftpPerKg.toFixed(2) : null

    // Build conversation context
    const systemPrompt = `You are a professional cycling coach assistant. You have just provided an analysis for an activity. The athlete is asking a follow-up question.

**Activity Context:**
- Activity Date: ${activity.start_time || activity.created_at}
- Duration: ${activity.data?.summary?.duration ? `${Math.round(activity.data.summary.duration / 60)} minutes` : 'Unknown'}
- Distance: ${activity.data?.summary?.totalDistance ? `${activity.data.summary.totalDistance.toFixed(2)} km` : 'Unknown'}
- Avg Power: ${activity.data?.summary?.avgPower ? `${activity.data.summary.avgPower}W${ftp ? ` (${Math.round((activity.data.summary.avgPower / ftp) * 100)}% of FTP)` : ''}` : 'No power'}
${ftpPerKg ? `- FTP/kg: ${ftpPerKgString} W/kg (${ftp}W ÷ ${weightKg}kg)` : ftp ? `- FTP: ${ftp}W (weight not provided)` : '- FTP: Not set'}
${user?.vo2_max ? `- VO2 Max: ${user.vo2_max} ml/kg/min` : ''}
${user?.training_goals ? `- Goals: ${user.training_goals}` : ''}
${user?.weekly_training_hours ? `- Training Time: ${user.weekly_training_hours} hours/week` : ''}

**Previous Analysis:**
${analysis?.summary || 'No previous analysis available'}

**Instructions:**
- Answer the athlete's question based on the activity data and previous analysis
- Be helpful, supportive, and data-driven
- Reference specific metrics when possible
- Keep responses concise but informative
- If the question is about FTP/kg, ensure you calculate it correctly: FTP (watts) ÷ Weight (kg) = W/kg
- Provide actionable advice when possible`

    // Build conversation history for Gemini
    const contents: any[] = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'I understand. I have the activity context and previous analysis. How can I help you?' }]
      }
    ]

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === 'user' || msg.role === 'model') {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })
        }
      })
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    })

    // Call Gemini API
    const geminiModel = 'gemini-2.5-pro'
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent?key=${googleApiKey}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          topP: 0.8,
          topK: 40,
        }
      })
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText.substring(0, 200)}`)
    }

    const geminiData = await geminiResponse.json()
    const response = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I could not generate a response.'

    return new Response(
      JSON.stringify({ 
        success: true, 
        response 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in AI coach chat:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get response',
        message: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

