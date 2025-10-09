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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Initialize Gemini API
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-pro'

    const { action } = await req.json()

    if (action !== 'generate_weekly_summary') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get all users for weekly summary
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email, preferences')

    if (usersError) {
      throw new Error('Failed to fetch users')
    }

    const summaries = []

    for (const user of users || []) {
      // Get user's activities from the past week
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const { data: activities, error: activitiesError } = await supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('upload_date', oneWeekAgo.toISOString())
        .eq('status', 'processed')

      if (activitiesError) {
        console.error(`Failed to fetch activities for user ${user.id}:`, activitiesError)
        continue
      }

      if (!activities || activities.length === 0) {
        continue // Skip users with no activities this week
      }

      // Prepare data for AI analysis
      const weeklyData = {
        user: {
          id: user.id,
          preferences: user.preferences
        },
        activities: activities.map(activity => ({
          id: activity.id,
          metadata: activity.metadata,
          upload_date: activity.upload_date
        })),
        summary: {
          totalActivities: activities.length,
          totalDistance: activities.reduce((sum, act) => sum + (act.metadata?.totalDistance || 0), 0),
          totalTime: activities.reduce((sum, act) => sum + (act.metadata?.totalTime || 0), 0),
          avgPower: activities.reduce((sum, act) => sum + (act.metadata?.avgPower || 0), 0) / activities.length,
          avgHeartRate: activities.reduce((sum, act) => sum + (act.metadata?.avgHeartRate || 0), 0) / activities.length,
        }
      }

      // Generate weekly summary using Gemini API
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
                text: `You are a professional cycling coach creating a weekly training summary. Analyze the user's training data from the past week and provide insights and recommendations.

User Profile:
${JSON.stringify(user.preferences, null, 2)}

Weekly Training Data:
${JSON.stringify(weeklyData.summary, null, 2)}

Activities:
${JSON.stringify(weeklyData.activities, null, 2)}

Please provide a comprehensive weekly summary including:
1. Training volume and consistency analysis
2. Performance trends and improvements
3. Areas that need attention
4. Recommendations for next week's training
5. Motivation and encouragement based on their progress`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1500,
            }
          })
        }
      )

      if (!geminiResponse.ok) {
        console.error(`Gemini API error for user ${user.id}:`, geminiResponse.statusText)
        continue
      }

      const geminiData = await geminiResponse.json()
      const summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Weekly summary could not be generated'

      summaries.push({
        userId: user.id,
        email: user.email,
        week: new Date().toISOString().split('T')[0],
        summary: summary,
        data: weeklyData.summary
      })
    }

    // TODO: Send summaries via email or notification service
    console.log(`Generated ${summaries.length} weekly summaries`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${summaries.length} weekly summaries`,
        summaries: summaries
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error generating weekly summaries:', error)
    
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


