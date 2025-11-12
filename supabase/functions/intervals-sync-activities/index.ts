import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log('Syncing activities for user:', userId)

    // Get Intervals.icu connection
    const { data: connection, error: connError } = await supabase
      .from('intervals_connections')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Intervals.icu not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!connection.sync_enabled) {
      return new Response(
        JSON.stringify({ error: 'Sync is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start sync log
    const syncLogId = crypto.randomUUID()
    const syncStartTime = new Date()

    // Get activities from last sync (or last 30 days if first sync)
    const lastSyncDate = connection.last_sync_at 
      ? new Date(connection.last_sync_at) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    const oldest = lastSyncDate.toISOString().split('T')[0]
    
    console.log(`Fetching activities since ${oldest}...`)
    
    // Fetch activities from Intervals.icu
    const activitiesResponse = await fetch(
      `https://intervals.icu/api/v1/athlete/${connection.athlete_id}/activities?oldest=${oldest}`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      }
    )

    if (!activitiesResponse.ok) {
      const errorText = await activitiesResponse.text()
      console.error('Failed to fetch activities:', errorText)
      
      // Log error
      await supabase.from('intervals_sync_logs').insert({
        id: syncLogId,
        user_id: userId,
        sync_type: 'activities',
        status: 'error',
        error_message: `Failed to fetch activities: ${errorText}`,
        started_at: syncStartTime.toISOString(),
        completed_at: new Date().toISOString(),
      })

      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities from Intervals.icu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const activities = await activitiesResponse.json()
    console.log(`Fetched ${activities.length} activities`)

    let syncedCount = 0
    let errors = []

    // Process each activity
    for (const activity of activities) {
      try {
        // Check if activity already exists (by intervals_id)
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('user_id', userId)
          .eq('metadata->>intervals_id', activity.id)
          .maybeSingle()

        if (existing) {
          console.log(`Activity ${activity.id} already exists, skipping`)
          continue
        }

        // Prepare activity data (using correct Intervals.icu API field names)
        const activityData = {
          user_id: userId,
          file_name: `intervals-${activity.id}.fit`,
          upload_date: new Date().toISOString(),
          start_time: activity.start_date_local,
          status: 'processed', // Mark as processed since we have data
          metadata: {
            intervals_id: activity.id,
            source: 'intervals.icu',
            type: activity.type,
            name: activity.name,
            description: activity.description || null,
          },
          // Summary data (field names from OpenAPI spec)
          total_distance: activity.distance ? activity.distance / 1000 : null, // Convert m to km
          total_timer_time: activity.moving_time,
          avg_power: activity.icu_average_watts || activity.average_watts || null,
          avg_heart_rate: activity.average_heartrate || null,
          avg_speed: activity.average_speed || null,
          // Store full activity data with correct field names
          data: {
            summary: {
              totalDistance: activity.distance ? activity.distance / 1000 : null,
              duration: activity.moving_time,
              avgPower: activity.icu_average_watts || activity.average_watts || null,
              avgHeartRate: activity.average_heartrate || null,
              avgSpeed: activity.average_speed || null,
              maxPower: activity.max_watts || null,
              maxHeartRate: activity.max_heartrate || null,
              normalizedPower: activity.icu_weighted_avg_watts || null,
              intensityFactor: activity.icu_intensity || null,
              tss: activity.icu_training_load || null,
              calories: activity.calories || null,
              elevation: activity.total_elevation_gain || null,
              averageCadence: activity.average_cadence || null,
              maxSpeed: activity.max_speed || null,
              type: activity.type,
              trainer: activity.trainer || false,
            },
          },
        }

        // Insert activity
        const { error: insertError } = await supabase
          .from('activities')
          .insert(activityData)

        if (insertError) {
          console.error(`Failed to insert activity ${activity.id}:`, insertError)
          errors.push(`Activity ${activity.id}: ${insertError.message}`)
        } else {
          syncedCount++
          console.log(`Successfully synced activity ${activity.id}`)
        }
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error)
        errors.push(`Activity ${activity.id}: ${error.message}`)
      }
    }

    // Update last sync time
    await supabase
      .from('intervals_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    // Log sync result
    await supabase.from('intervals_sync_logs').insert({
      id: syncLogId,
      user_id: userId,
      sync_type: 'activities',
      status: errors.length === 0 ? 'success' : (syncedCount > 0 ? 'partial' : 'error'),
      items_synced: syncedCount,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      started_at: syncStartTime.toISOString(),
      completed_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        total: activities.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

