import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function transformStreamsToGpsTrack(streams: any[], startTimeStr: string): any[] | null {
  if (!streams || !streams.length) return null;
  
  const timeStream = streams.find(s => s.type === 'time')?.data;
  if (!timeStream) return null;

  const latlngStream = streams.find(s => s.type === 'latlng')?.data;
  const wattsStream = streams.find(s => s.type === 'watts')?.data;
  const hrStream = streams.find(s => s.type === 'heartrate')?.data;
  const cadenceStream = streams.find(s => s.type === 'cadence')?.data;
  const distanceStream = streams.find(s => s.type === 'distance')?.data;
  const altStream = streams.find(s => s.type === 'altitude')?.data;
  const velStream = streams.find(s => s.type === 'velocity_smooth')?.data;
  const tempStream = streams.find(s => s.type === 'temp')?.data;

  const startTime = new Date(startTimeStr).getTime();
  const track = [];

  for (let i = 0; i < timeStream.length; i++) {
    const latlng = latlngStream && latlngStream[i] ? latlngStream[i] : null;
    
    const point: any = {
      timestamp: new Date(startTime + timeStream[i] * 1000).toISOString(),
    };
    
    if (latlng) {
      point.lat = latlng[0];
      point.long = latlng[1];
    }
    if (wattsStream && wattsStream[i] != null) point.power = wattsStream[i];
    if (hrStream && hrStream[i] != null) point.heartRate = hrStream[i];
    if (cadenceStream && cadenceStream[i] != null) point.cadence = cadenceStream[i];
    if (distanceStream && distanceStream[i] != null) point.distance = distanceStream[i];
    if (altStream && altStream[i] != null) point.altitude = altStream[i];
    if (velStream && velStream[i] != null) point.speed = velStream[i];
    if (tempStream && tempStream[i] != null) point.temperature = tempStream[i];

    track.push(point);
  }
  return track;
}

serve(async (req: Request) => {
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
    // API keys use Basic auth, OAuth tokens use Bearer
    const isApiKey = !connection.access_token.startsWith('ey') // OAuth tokens start with 'ey'
    const intervalsAuthHeader = isApiKey 
      ? `Basic ${btoa(`API_KEY:${connection.access_token}`)}`
      : `Bearer ${connection.access_token}`
    
    console.log(`Using ${isApiKey ? 'API Key' : 'OAuth'} authentication`)
    
    const activitiesResponse = await fetch(
      `https://intervals.icu/api/v1/athlete/${connection.athlete_id}/activities?oldest=${oldest}`,
      {
        headers: {
          'Authorization': intervalsAuthHeader,
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

    // Fetch wellness data
    let wellnessData: any[] = []
    try {
      console.log(`Fetching wellness data since ${oldest}...`)
      const wellnessResponse = await fetch(
        `https://intervals.icu/api/v1/athlete/${connection.athlete_id}/wellness?oldest=${oldest}`,
        { headers: { 'Authorization': intervalsAuthHeader } }
      )
      if (wellnessResponse.ok) {
        wellnessData = await wellnessResponse.json()
        console.log(`Fetched ${wellnessData.length} wellness records`)
      } else {
        console.warn('Failed to fetch wellness data:', await wellnessResponse.text())
      }
    } catch (e) {
      console.error('Error fetching wellness data:', e)
    }

    let errors: string[] = []

    // Upsert wellness records to standalone daily_wellness table
    if (wellnessData.length > 0) {
      console.log(`Upserting ${wellnessData.length} standalone records to daily_wellness table...`)
      
      const wellnessPayload = wellnessData.map((w: any) => ({
        user_id: userId,
        date: w.id, // Intervals.icu wellness ID is the date string (e.g. '2023-10-15')
        data: w
      }))

      // Batch upsert ignoring conflicts on the unique compound key
      const { error: wellnessError } = await supabase
        .from('daily_wellness')
        .upsert(wellnessPayload, { onConflict: 'user_id, date' })

      if (wellnessError) {
        console.error('Failed to batch upsert daily_wellness records:', wellnessError)
        errors.push(`Wellness Sync: ${wellnessError.message}`)
      } else {
        console.log('Successfully upserted standalone daily_wellness records natively.')
      }
    }

    let syncedCount = 0

    // Process each activity
    for (const activity of activities) {
      try {
        // Check if activity already exists (by intervals_id)
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('user_id', userId)
          .eq('metadata->>intervals_id', activity.id.toString())
          .maybeSingle()

        if (existing) {
          console.log(`Activity ${activity.id} already exists, skipping`)
          continue
        }

        // Fetch detailed activity
        let detailedActivity = null;
        try {
          const detailRes = await fetch(`https://intervals.icu/api/v1/activity/${activity.id}?intervals=true`, { headers: { 'Authorization': intervalsAuthHeader } });
          if (detailRes.ok) detailedActivity = await detailRes.json();
        } catch (e) {
          console.warn(`Failed to fetch details for ${activity.id}`);
        }

        // Fetch streams
        let streams = null;
        try {
          const streamsRes = await fetch(`https://intervals.icu/api/v1/activity/${activity.id}/streams`, { headers: { 'Authorization': intervalsAuthHeader } });
          if (streamsRes.ok) streams = await streamsRes.json();
        } catch (e) {
          console.warn(`Failed to fetch streams for ${activity.id}`);
        }

        // Merge them to ensure detailed data doesn't obliterate base summary metrics
        const act = detailedActivity ? { ...activity, ...detailedActivity } : activity;

        // Find corresponding wellness data for the day
        const activityDate = act.start_date_local ? act.start_date_local.split('T')[0] : null;
        const dayWellness = activityDate ? wellnessData.find((w: any) => w.id === activityDate) : null;

        // Dynamically compute missing max limits from streams
        let computedMaxCadence = act.max_cadence || null;
        if (!computedMaxCadence && streams && streams.length > 0) {
          const cadenceStream = streams.find((s: any) => s.type === 'cadence')?.data;
          if (cadenceStream && cadenceStream.length > 0) {
            computedMaxCadence = Math.max(...cadenceStream);
          }
        }

        // Prepare activity data (using fully detailed mapping like frontend)
        const activityData = {
          user_id: userId,
          file_name: `intervals-${act.id}.fit`,
          file_size: 0,
          upload_date: new Date().toISOString(),
          start_time: act.start_date_local,
          status: 'processed',
          metadata: {
            intervals_id: act.id,
            source: 'intervals.icu',
            type: act.type,
            name: act.name,
            description: act.description || null,
          },

          // Basic metrics
          total_distance: act.distance ? act.distance / 1000 : null,
          total_timer_time: act.moving_time || null,
          elapsed_time: act.elapsed_time || null,
          trainer: act.trainer || false,
          device_name: act.device_name || null,
          strava_id: act.strava_id || null,
          gps_track: streams && streams.length > 0 ? transformStreamsToGpsTrack(streams, act.start_date_local) : null,

          // Power metrics
          avg_power: act.icu_average_watts || act.average_watts || null,
          max_power: act.icu_pm_p_max || act.p_max || act.max_watts || null,
          normalized_power: act.icu_weighted_avg_watts || null,
          intensity_factor: act.icu_intensity || null,
          variability_index: act.icu_variability_index || null,
          tss: act.icu_training_load || null,
          work_kj: act.icu_joules ? act.icu_joules / 1000 : null,
          work_above_ftp_kj: act.icu_joules_above_ftp ? act.icu_joules_above_ftp / 1000 : null,
          max_wbal_depletion: act.icu_max_wbal_depletion || null,

          // Power model
          cp: act.icu_pm_cp || null,
          w_prime: act.icu_pm_w_prime || null,
          p_max: act.icu_pm_p_max || null,
          estimated_ftp: act.icu_pm_ftp || null,
          ftp_at_time: act.icu_ftp || null,

          // Rolling power
          rolling_cp: act.icu_rolling_cp || null,
          rolling_w_prime: act.icu_rolling_w_prime || null,
          rolling_p_max: act.icu_rolling_p_max || null,
          rolling_ftp: act.icu_rolling_ftp || null,
          rolling_ftp_delta: act.icu_rolling_ftp_delta || null,

          // Heart rate
          avg_heart_rate: act.average_heartrate || null,
          max_heart_rate: act.max_heartrate || null,
          lthr: act.lthr || null,
          resting_hr: act.icu_resting_hr || null,
          hr_recovery: act.icu_hrr || null,

          // Zone times
          power_zone_times: act.icu_zone_times ? act.icu_zone_times.map((z: any) => z.secs) : null,
          hr_zone_times: act.icu_hr_zone_times || null,
          power_zones: act.icu_power_zones || null,
          hr_zones: act.icu_hr_zones || null,

          // Speed/pace
          avg_speed: act.average_speed ? act.average_speed * 3.6 : null,
          max_speed: act.max_speed ? act.max_speed * 3.6 : null,
          pace: act.pace || null,
          gap: act.gap || null,
          avg_stride: act.average_stride || null,

          // Elevation
          elevation_gain: act.total_elevation_gain || null,
          elevation_loss: act.total_elevation_loss || null,
          avg_altitude: act.average_altitude || null,
          min_altitude: act.min_altitude || null,
          max_altitude: act.max_altitude || null,

          // Training load
          hr_load: act.hr_load || null,
          power_load: act.power_load || null,
          trimp: act.trimp || null,
          strain_score: act.strain_score || null,

          // RPE & Feel
          rpe: act.icu_rpe || null,
          feel: act.feel || null,
          session_rpe: act.session_rpe || null,

          // Fitness tracking
          ctl: act.icu_ctl || null,
          atl: act.icu_atl || null,
          weight_kg: act.icu_weight || null,

          // Intervals
          interval_summary: act.interval_summary || null,
          lap_count: act.icu_lap_count || null,
          warmup_time: act.icu_warmup_time || null,
          cooldown_time: act.icu_cooldown_time || null,

          // Training quality
          polarization_index: act.polarization_index || null,
          decoupling: act.decoupling || null,
          power_hr_ratio: act.icu_power_hr || null,
          power_hr_z2: act.icu_power_hr_z2 || null,
          efficiency_factor: act.icu_efficiency_factor || null,

          // Energy
          calories: act.calories || null,
          carbs_used: act.carbs_used || null,
          carbs_ingested: act.carbs_ingested || null,

          // Cadence
          avg_cadence: act.average_cadence || null,
          max_cadence: computedMaxCadence,

          // Weather
          weather_temp: act.average_weather_temp || null,
          feels_like: act.average_feels_like || null,
          wind_speed: act.average_wind_speed || null,
          wind_direction: act.prevailing_wind_deg || null,
          headwind_percent: act.headwind_percent || null,
          tailwind_percent: act.tailwind_percent || null,

          data: {
            summary: {
              totalDistance: act.distance ? act.distance / 1000 : null,
              duration: act.moving_time || null,
              elapsedTime: act.elapsed_time || null,
              type: act.type,
              trainer: act.trainer || false,
              name: act.name,
              description: act.description || null,
              source: act.source || null,
              deviceName: act.device_name || null,
              
              avgPower: act.icu_average_watts || act.average_watts || null,
              maxPower: act.icu_pm_p_max || act.p_max || act.max_watts || null,
              normalizedPower: act.icu_weighted_avg_watts || null,
              intensityFactor: act.icu_intensity || null,
              variabilityIndex: act.icu_variability_index || null,
              tss: act.icu_training_load || null,
              work: act.icu_joules || null,
              workAboveFTP: act.icu_joules_above_ftp || null,
              maxWbalDepletion: act.icu_max_wbal_depletion || null,

              powerModel: {
                criticalPower: act.icu_pm_cp || null,
                wPrime: act.icu_pm_w_prime || null,
                pMax: act.icu_pm_p_max || null,
                estimatedFTP: act.icu_pm_ftp || null,
                ftpSecs: act.icu_pm_ftp_secs || null,
                ftpWatts: act.icu_pm_ftp_watts || null,
              },

              rollingPower: {
                cp: act.icu_rolling_cp || null,
                wPrime: act.icu_rolling_w_prime || null,
                pMax: act.icu_rolling_p_max || null,
                ftp: act.icu_rolling_ftp || null,
                ftpDelta: act.icu_rolling_ftp_delta || null,
              },

              avgHeartRate: act.average_heartrate || null,
              maxHeartRate: act.max_heartrate || null,
              lthr: act.lthr || null,
              restingHR: act.icu_resting_hr || null,
              hrRecovery: act.icu_hrr || null,

              powerZoneTimes: act.icu_zone_times || null,
              hrZoneTimes: act.icu_hr_zone_times || null,
              powerZones: act.icu_power_zones || null,
              hrZones: act.icu_hr_zones || null,

              avgSpeed: act.average_speed ? act.average_speed * 3.6 : null,
              maxSpeed: act.max_speed ? act.max_speed * 3.6 : null,
              pace: act.pace || null,
              gap: act.gap || null,
              avgStride: act.average_stride || null,

              averageCadence: act.average_cadence || null,
              calories: act.calories || null,
              elevation: act.total_elevation_gain || null,
              elevationLoss: act.total_elevation_loss || null,
              avgAltitude: act.average_altitude || null,
              minAltitude: act.min_altitude || null,
              maxAltitude: act.max_altitude || null,

              hrLoad: act.hr_load || null,
              powerLoad: act.power_load || null,
              trimp: act.trimp || null,
              strainScore: act.strain_score || null,

              rpe: act.icu_rpe || null,
              feel: act.feel || null,
              sessionRPE: act.session_rpe || null,

              ctl: act.icu_ctl || null,
              atl: act.icu_atl || null,
              weight: act.icu_weight || null,
              ftp: act.icu_ftp || null,

              intervalSummary: act.interval_summary || null,
              lapCount: act.icu_lap_count || null,

              polarizationIndex: act.polarization_index || null,
              decoupling: act.decoupling || null,
              powerHR: act.icu_power_hr || null,
              powerHRZ2: act.icu_power_hr_z2 || null,
              efficiencyFactor: act.icu_efficiency_factor || null,

              warmupTime: act.icu_warmup_time || null,
              cooldownTime: act.icu_cooldown_time || null,

              carbsUsed: act.carbs_used || null,
              carbsIngested: act.carbs_ingested || null,

              weather: {
                avgTemp: act.average_weather_temp || null,
                avgFeelsLike: act.average_feels_like || null,
                avgWindSpeed: act.average_wind_speed || null,
                avgWindGust: act.average_wind_gust || null,
                windDirection: act.prevailing_wind_deg || null,
                headwindPercent: act.headwind_percent || null,
                tailwindPercent: act.tailwind_percent || null,
                clouds: act.average_clouds || null,
              },

              stravaId: act.strava_id || null,
              streamTypes: act.stream_types || null,
              intervals: act.icu_intervals || null,
              streams: streams && streams.length > 0 ? streams : null,
              wellness: dayWellness || null,

              _raw: act,
            },
          },
        }

        // Insert activity
        const { error: insertError } = await supabase
          .from('activities')
          .insert(activityData)

        if (insertError) {
          console.error(`Failed to insert activity ${act.id}:`, insertError)
          errors.push(`Activity ${act.id}: ${insertError.message}`)
        } else {
          syncedCount++
          console.log(`Successfully synced activity ${act.id}`)
        }
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error)
        errors.push(`Activity ${activity.id}: ${error instanceof Error ? error.message : String(error)}`)
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
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

