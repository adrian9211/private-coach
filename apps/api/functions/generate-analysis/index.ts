import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
              text: `You are a professional cycling coach analyzing workout data. Provide detailed insights about the activity, performance trends, and personalized recommendations based on the user's goals and preferences.

Analyze this cycling activity data and provide insights:

${JSON.stringify(activityData, null, 2)}

Please provide a comprehensive analysis including:
1. Performance summary
2. Key insights about the workout
3. Personalized recommendations for future training
4. Areas for improvement
5. Training trends and patterns`
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
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`)
    }

    const geminiData = await geminiResponse.json()
    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis could not be generated'

    // Parse the analysis and structure it
    const analysisData = {
      summary: analysis,
      insights: [], // Will be extracted from analysis
      recommendations: [], // Will be generated based on analysis
      trends: [], // Will be calculated from historical data
      performanceMetrics: activityData.metadata,
    }

    // Save analysis to database
    const { error: analysisError } = await supabaseClient
      .from('activity_analyses')
      .insert({
        activity_id: activityId,
        summary: analysisData.summary,
        insights: analysisData.insights,
        recommendations: analysisData.recommendations,
        trends: analysisData.trends,
        performance_metrics: analysisData.performanceMetrics,
      })

    if (analysisError) {
      throw new Error('Failed to save analysis')
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
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
