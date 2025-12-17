'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface IntervalsConnection {
  id: string
  athlete_id: string
  access_token: string
  connected_at: string
  last_sync_at: string | null
  sync_enabled: boolean
}

interface IntervalsIntegrationProps {
  userId: string
}

export function IntervalsIntegration({ userId }: IntervalsIntegrationProps) {
  const [connection, setConnection] = useState<IntervalsConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Check if API key is configured (simpler method for personal use)
  const apiKey = process.env.NEXT_PUBLIC_INTERVALS_API_KEY
  const athleteId = process.env.NEXT_PUBLIC_INTERVALS_ATHLETE_ID
  const hasApiKey = !!(apiKey && athleteId)

  // Check if OAuth is configured (for multi-user)
  const hasOAuth = !!(process.env.NEXT_PUBLIC_INTERVALS_CLIENT_ID && process.env.NEXT_PUBLIC_INTERVALS_REDIRECT_URI)

  // Debug logging
  console.log('🔍 Intervals.icu Debug:')
  console.log('  API Key present:', !!apiKey)
  console.log('  Athlete ID present:', !!athleteId)
  console.log('  Has API Key:', hasApiKey)
  console.log('  Has OAuth:', hasOAuth)
  console.log('  Connection:', connection ? 'Connected' : 'Not connected')

  useEffect(() => {
    loadConnection()

    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search)
    if (params.get('intervals') === 'connected') {
      setSuccess('Successfully connected to Intervals.icu!')
      // Clear URL parameter
      window.history.replaceState({}, '', '/settings')
      // Reload connection
      setTimeout(() => loadConnection(), 1000)
    }
  }, [userId, hasApiKey])

  const loadConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('intervals_connections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setConnection(data)

      // If using API key and no connection exists, auto-connect
      if (!data && hasApiKey) {
        console.log('API key found, auto-connecting...')
        await handleApiKeyConnect()
      }
    } catch (err: any) {
      console.error('Error loading Intervals.icu connection:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApiKeyConnect = async () => {
    if (!apiKey || !athleteId) return

    try {
      setLoading(true)
      setError(null)

      // Verify API key works by fetching athlete info
      const athleteResponse = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
        headers: {
          'Authorization': `Basic ${btoa(`API_KEY:${apiKey}`)}`,
        },
      })

      if (!athleteResponse.ok) {
        throw new Error('Invalid API key or athlete ID')
      }

      const athlete = await athleteResponse.json()

      // Store connection in database
      const { data, error: dbError } = await supabase
        .from('intervals_connections')
        .upsert({
          user_id: userId,
          athlete_id: athleteId,
          access_token: apiKey, // Store API key as access token
          refresh_token: apiKey, // For API keys, token doesn't expire
          token_expires_at: new Date('2099-12-31').toISOString(), // Far future
          connected_at: new Date().toISOString(),
          sync_enabled: true,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single()

      if (dbError) {
        throw dbError
      }

      setConnection(data)
      setSuccess(`Connected as ${athlete.name || athleteId}!`)
    } catch (err: any) {
      console.error('API key connection error:', err)
      setError(err.message || 'Failed to connect with API key')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_INTERVALS_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_INTERVALS_REDIRECT_URI

    if (!clientId || !redirectUri) {
      setError('Intervals.icu OAuth is not configured. Please contact support.')
      return
    }

    // Build OAuth URL
    const authUrl = new URL('https://intervals.icu/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'ACTIVITY:READ,ATHLETE:READ') // Request necessary permissions
    authUrl.searchParams.set('state', userId) // Pass user ID for callback

    // Redirect to Intervals.icu OAuth
    window.location.href = authUrl.toString()
  }

  const handleSync = async (fullSync = false) => {
    setSyncing(true)
    setError(null)
    setSuccess(null)

    try {
      // Determine which credentials to use
      // Prioritize stored connection, then environment variables
      const syncApiKey = connection?.access_token || apiKey
      const syncAthleteId = connection?.athlete_id || athleteId

      // Check if we have valid credentials for client-side sync
      // API Key auth uses "API_KEY" as username, invalid if token starts with "ey" (OAuth JWT)
      const isApiKeyAuth = syncApiKey && !syncApiKey.startsWith('ey')
      const canSyncClientSide = isApiKeyAuth && syncAthleteId

      // Debug: Check which auth method we're using
      console.log('🔍 Sync Debug:', {
        hasApiKey,
        hasStoredConnection: !!connection,
        usingStoredCredentials: !!connection?.access_token,
        syncAthleteId,
        isApiKeyAuth,
        canSyncClientSide
      })

      // For API key method, sync directly from browser
      if (canSyncClientSide) {
        console.log(`🔄 ${fullSync ? 'Full' : 'Incremental'} sync using saved credentials...`)

        // Get last sync date or default to 5 years ago (to fetch all historical data)
        // If fullSync is true, always fetch from 5 years ago
        const lastSync = (fullSync || !connection?.last_sync_at)
          ? new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000) // 5 years
          : new Date(connection.last_sync_at)

        const oldest = lastSync.toISOString().split('T')[0]
        console.log(`📅 Fetching activities since ${oldest}`)

        // Fetch activities from Intervals.icu
        const response = await fetch(
          `https://intervals.icu/api/v1/athlete/${syncAthleteId}/activities?oldest=${oldest}`,
          {
            headers: {
              'Authorization': `Basic ${btoa(`API_KEY:${syncApiKey}`)}`,
            },
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`)
        }

        const activities = await response.json()
        console.log(`📥 Fetched ${activities.length} activities`)

        // Log first activity to see ALL available fields
        if (activities.length > 0) {
          console.log('🔍 Sample Activity Data (first activity):', activities[0])
          console.log('📋 Available fields:', Object.keys(activities[0]).sort())
        }

        if (activities.length === 0) {
          setSuccess('No new activities to sync')
          setSyncing(false)
          return
        }

        // Import activities to database
        console.log('💾 Importing activities to database...')
        let imported = 0
        let skipped = 0
        let errors = 0

        for (const activity of activities) {
          try {
            // Check if activity already exists (by intervals_id in metadata)
            const { data: existing } = await supabase
              .from('activities')
              .select('id')
              .eq('user_id', userId)
              .eq('metadata->>intervals_id', activity.id.toString())
              .maybeSingle()

            if (existing) {
              console.log(`⏭️  Skipping existing activity: ${activity.name}`)
              skipped++
              continue
            }

            // Map Intervals.icu activity to our database schema
            const activityData = {
              user_id: userId,
              file_name: `intervals-${activity.id}.fit`,
              file_size: 0, // Placeholder for imported activities (no actual file)
              upload_date: new Date().toISOString(),
              start_time: activity.start_date_local,
              status: 'processed',
              metadata: {
                intervals_id: activity.id,
                source: 'intervals.icu',
                type: activity.type,
                name: activity.name,
                description: activity.description || null,
              },

              // Basic metrics
              total_distance: activity.distance ? activity.distance / 1000 : null, // m to km
              total_timer_time: activity.moving_time || null,
              elapsed_time: activity.elapsed_time || null,
              trainer: activity.trainer || false,
              device_name: activity.device_name || null,
              strava_id: activity.strava_id || null,

              // Power metrics
              avg_power: activity.icu_average_watts || activity.average_watts || null,
              max_power: activity.max_watts || null,
              normalized_power: activity.icu_weighted_avg_watts || null,
              intensity_factor: activity.icu_intensity || null,
              variability_index: activity.icu_variability_index || null,
              tss: activity.icu_training_load || null,
              work_kj: activity.icu_joules ? activity.icu_joules / 1000 : null,
              work_above_ftp_kj: activity.icu_joules_above_ftp ? activity.icu_joules_above_ftp / 1000 : null,
              max_wbal_depletion: activity.icu_max_wbal_depletion || null,

              // Power model
              cp: activity.icu_pm_cp || null,
              w_prime: activity.icu_pm_w_prime || null,
              p_max: activity.icu_pm_p_max || null,
              estimated_ftp: activity.icu_pm_ftp || null,
              ftp_at_time: activity.icu_ftp || null,

              // Rolling power
              rolling_cp: activity.icu_rolling_cp || null,
              rolling_w_prime: activity.icu_rolling_w_prime || null,
              rolling_p_max: activity.icu_rolling_p_max || null,
              rolling_ftp: activity.icu_rolling_ftp || null,
              rolling_ftp_delta: activity.icu_rolling_ftp_delta || null,

              // Heart rate
              avg_heart_rate: activity.average_heartrate || null,
              max_heart_rate: activity.max_heartrate || null,
              lthr: activity.lthr || null,
              resting_hr: activity.icu_resting_hr || null,
              hr_recovery: activity.icu_hrr || null,

              // Zone times
              power_zone_times: activity.icu_zone_times ? activity.icu_zone_times.map((z: any) => z.secs) : null,
              hr_zone_times: activity.icu_hr_zone_times || null,
              power_zones: activity.icu_power_zones || null,
              hr_zones: activity.icu_hr_zones || null,

              // Speed/pace
              avg_speed: activity.average_speed || null,
              max_speed: activity.max_speed || null,
              pace: activity.pace || null,
              gap: activity.gap || null,
              avg_stride: activity.average_stride || null,

              // Elevation
              elevation_gain: activity.total_elevation_gain || null,
              elevation_loss: activity.total_elevation_loss || null,
              avg_altitude: activity.average_altitude || null,
              min_altitude: activity.min_altitude || null,
              max_altitude: activity.max_altitude || null,

              // Training load
              hr_load: activity.hr_load || null,
              power_load: activity.power_load || null,
              trimp: activity.trimp || null,
              strain_score: activity.strain_score || null,

              // RPE & Feel
              rpe: activity.icu_rpe || null,
              feel: activity.feel || null,
              session_rpe: activity.session_rpe || null,

              // Fitness tracking
              ctl: activity.icu_ctl || null,
              atl: activity.icu_atl || null,
              weight_kg: activity.icu_weight || null,

              // Intervals
              interval_summary: activity.interval_summary || null,
              lap_count: activity.icu_lap_count || null,
              warmup_time: activity.icu_warmup_time || null,
              cooldown_time: activity.icu_cooldown_time || null,

              // Training quality
              polarization_index: activity.polarization_index || null,
              decoupling: activity.decoupling || null,
              power_hr_ratio: activity.icu_power_hr || null,
              power_hr_z2: activity.icu_power_hr_z2 || null,
              efficiency_factor: activity.icu_efficiency_factor || null,

              // Energy
              calories: activity.calories || null,
              carbs_used: activity.carbs_used || null,
              carbs_ingested: activity.carbs_ingested || null,

              // Cadence
              avg_cadence: activity.average_cadence || null,

              // Weather
              weather_temp: activity.average_weather_temp || null,
              feels_like: activity.average_feels_like || null,
              wind_speed: activity.average_wind_speed || null,
              wind_direction: activity.prevailing_wind_deg || null,
              headwind_percent: activity.headwind_percent || null,
              tailwind_percent: activity.tailwind_percent || null,
              // Full activity data - store EVERYTHING from Intervals.icu
              data: {
                summary: {
                  // Basic info
                  totalDistance: activity.distance ? activity.distance / 1000 : null,
                  duration: activity.moving_time || null,
                  elapsedTime: activity.elapsed_time || null,
                  type: activity.type,
                  trainer: activity.trainer || false,
                  name: activity.name,
                  description: activity.description || null,
                  source: activity.source || null,
                  deviceName: activity.device_name || null,

                  // Power metrics
                  avgPower: activity.icu_average_watts || activity.average_watts || null,
                  maxPower: activity.max_watts || null,
                  normalizedPower: activity.icu_weighted_avg_watts || null,
                  intensityFactor: activity.icu_intensity || null,
                  variabilityIndex: activity.icu_variability_index || null,
                  tss: activity.icu_training_load || null,
                  work: activity.icu_joules || null,
                  workAboveFTP: activity.icu_joules_above_ftp || null,
                  maxWbalDepletion: activity.icu_max_wbal_depletion || null,

                  // Power Model (Critical Power, W', FTP estimates)
                  powerModel: {
                    criticalPower: activity.icu_pm_cp || null,
                    wPrime: activity.icu_pm_w_prime || null,
                    pMax: activity.icu_pm_p_max || null,
                    estimatedFTP: activity.icu_pm_ftp || null,
                    ftpSecs: activity.icu_pm_ftp_secs || null,
                    ftpWatts: activity.icu_pm_ftp_watts || null,
                  },

                  // Rolling Power Curve
                  rollingPower: {
                    cp: activity.icu_rolling_cp || null,
                    wPrime: activity.icu_rolling_w_prime || null,
                    pMax: activity.icu_rolling_p_max || null,
                    ftp: activity.icu_rolling_ftp || null,
                    ftpDelta: activity.icu_rolling_ftp_delta || null,
                  },

                  // Heart rate metrics
                  avgHeartRate: activity.average_heartrate || null,
                  maxHeartRate: activity.max_heartrate || null,
                  lthr: activity.lthr || null,
                  restingHR: activity.icu_resting_hr || null,
                  hrRecovery: activity.icu_hrr || null,

                  // Zone Times (CRITICAL for training analysis!)
                  powerZoneTimes: activity.icu_zone_times || null,
                  hrZoneTimes: activity.icu_hr_zone_times || null,
                  powerZones: activity.icu_power_zones || null,
                  hrZones: activity.icu_hr_zones || null,

                  // Speed/pace metrics
                  avgSpeed: activity.average_speed || null,
                  maxSpeed: activity.max_speed || null,
                  pace: activity.pace || null,
                  gap: activity.gap || null,
                  avgStride: activity.average_stride || null,

                  // Other metrics
                  averageCadence: activity.average_cadence || null,
                  calories: activity.calories || null,
                  elevation: activity.total_elevation_gain || null,
                  elevationLoss: activity.total_elevation_loss || null,
                  avgAltitude: activity.average_altitude || null,
                  minAltitude: activity.min_altitude || null,
                  maxAltitude: activity.max_altitude || null,

                  // Training Load
                  hrLoad: activity.hr_load || null,
                  powerLoad: activity.power_load || null,
                  trimp: activity.trimp || null,
                  strainScore: activity.strain_score || null,

                  // RPE & Feel
                  rpe: activity.icu_rpe || null,
                  feel: activity.feel || null,
                  sessionRPE: activity.session_rpe || null,

                  // Fitness data
                  ctl: activity.icu_ctl || null,
                  atl: activity.icu_atl || null,
                  weight: activity.icu_weight || null,
                  ftp: activity.icu_ftp || null,

                  // Interval Summary
                  intervalSummary: activity.interval_summary || null,
                  lapCount: activity.icu_lap_count || null,

                  // Training Quality
                  polarizationIndex: activity.polarization_index || null,
                  decoupling: activity.decoupling || null,
                  powerHR: activity.icu_power_hr || null,
                  powerHRZ2: activity.icu_power_hr_z2 || null,
                  efficiencyFactor: activity.icu_efficiency_factor || null,

                  // Warm up / Cool down
                  warmupTime: activity.icu_warmup_time || null,
                  cooldownTime: activity.icu_cooldown_time || null,

                  // Carbs & Energy
                  carbsUsed: activity.carbs_used || null,
                  carbsIngested: activity.carbs_ingested || null,

                  // Weather (when available)
                  weather: {
                    avgTemp: activity.average_weather_temp || null,
                    avgFeelsLike: activity.average_feels_like || null,
                    avgWindSpeed: activity.average_wind_speed || null,
                    avgWindGust: activity.average_wind_gust || null,
                    windDirection: activity.prevailing_wind_deg || null,
                    headwindPercent: activity.headwind_percent || null,
                    tailwindPercent: activity.tailwind_percent || null,
                    clouds: activity.average_clouds || null,
                  },

                  // Strava integration
                  stravaId: activity.strava_id || null,

                  // Available stream types
                  streamTypes: activity.stream_types || null,

                  // Keep the ENTIRE activity object for reference
                  _raw: activity,
                },
              },
            }

            const { error: insertError } = await supabase
              .from('activities')
              .insert(activityData)

            if (insertError) {
              console.error(`❌ Error importing activity ${activity.id}:`, insertError)
              errors++
            } else {
              console.log(`✅ Imported: ${activity.name}`)
              imported++
            }
          } catch (err) {
            console.error(`❌ Error processing activity ${activity.id}:`, err)
            errors++
          }
        }

        // Update last sync time
        if (connection) {
          await supabase
            .from('intervals_connections')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('user_id', userId)

          await loadConnection()
        }

        // Now fetch wellness data (sleep, HRV, etc.)
        console.log('\n🏥 Fetching wellness data (sleep, HRV, etc.)...')
        try {
          const wellnessResponse = await fetch(
            `https://intervals.icu/api/v1/athlete/${syncAthleteId}/wellness?oldest=${oldest}`,
            {
              headers: {
                'Authorization': `Basic ${btoa(`API_KEY:${syncApiKey}`)}`,
              },
            }
          )

          if (wellnessResponse.ok) {
            const wellnessData = await wellnessResponse.json()
            console.log(`📊 Fetched ${wellnessData.length} wellness records`)

            // Log first wellness record to see ALL available fields
            if (wellnessData.length > 0) {
              console.log('🔍 Sample Wellness Data:', wellnessData[0])
              console.log('📋 Wellness fields:', Object.keys(wellnessData[0]).sort())
            }

            // TODO: Store wellness data in database
            // For now just log it so you can see what's available
          } else {
            console.warn('⚠️ Could not fetch wellness data:', wellnessResponse.status)
          }
        } catch (wellnessError) {
          console.error('❌ Error fetching wellness data:', wellnessError)
        }

        // Show results
        const resultParts = []
        if (imported > 0) resultParts.push(`${imported} imported`)
        if (skipped > 0) resultParts.push(`${skipped} skipped`)
        if (errors > 0) resultParts.push(`${errors} errors`)

        setSuccess(`✅ Sync complete! ${resultParts.join(', ')}`)
        console.log(`✨ Import complete: ${resultParts.join(', ')}`)
      } else {
        // OAuth method - use edge function
        console.warn('⚠️ Using OAuth/edge function path. API key not detected.')
        console.warn('Environment check:', {
          NEXT_PUBLIC_INTERVALS_API_KEY: !!process.env.NEXT_PUBLIC_INTERVALS_API_KEY,
          NEXT_PUBLIC_INTERVALS_ATHLETE_ID: !!process.env.NEXT_PUBLIC_INTERVALS_ATHLETE_ID,
        })

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        console.log('📡 Calling intervals-sync-activities edge function...')
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intervals-sync-activities`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ Edge function error:', errorData)
          throw new Error(errorData.error || 'Sync failed')
        }

        const result = await response.json()
        setSuccess(`Synced ${result.synced} of ${result.total} activities`)

        await loadConnection()
      }
    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err.message || 'Failed to sync activities')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Intervals.icu? Your existing activities will not be deleted.')) {
      return
    }

    setDisconnecting(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('intervals_connections')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      setConnection(null)
      setSuccess('Disconnected from Intervals.icu')
    } catch (err: any) {
      console.error('Disconnect error:', err)
      setError(err.message || 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="mt-4 text-xs text-gray-500">Loading connection status...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Intervals.icu Integration</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automatically sync your activities and training data
          </p>
        </div>
        <img
          src="https://intervals.icu/logo192.png"
          alt="Intervals.icu"
          className="w-12 h-12"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {!connection ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {hasApiKey ? (
            // API Key method - auto-connecting
            <>
              <div className="animate-spin w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Connecting to Intervals.icu...</h4>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Using your API key to establish connection
              </p>
            </>
          ) : hasOAuth ? (
            // OAuth method - manual button
            <>
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Intervals.icu</h4>
              <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                Automatically import activities, wellness data, and training metrics from Intervals.icu.
                No more manual uploads!
              </p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect to Intervals.icu
              </button>
            </>
          ) : (
            // Not configured
            <>
              <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Configuration Required</h4>
              <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                Intervals.icu integration is not configured. Add your API key to <code className="bg-gray-100 px-2 py-1 rounded text-xs">env.local</code> or set up OAuth credentials.
              </p>
              <a
                href="https://github.com/your-repo/docs/intervals-icu-setup.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                View setup instructions
              </a>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Connected</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Athlete ID: {connection.athlete_id}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Connected:</span>
              <span className="font-medium text-gray-900">
                {new Date(connection.connected_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Last Sync:</span>
              <span className="font-medium text-gray-900">
                {connection.last_sync_at
                  ? new Date(connection.last_sync_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Auto-sync:</span>
              <span className={`font-medium ${connection.sync_enabled ? 'text-green-600' : 'text-gray-600'}`}>
                {connection.sync_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-3">
              <button
                onClick={() => handleSync(false)}
                disabled={syncing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Syncing...
                  </span>
                ) : (
                  'Sync New'
                )}
              </button>
              <button
                onClick={() => handleSync(true)}
                disabled={syncing}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? 'Syncing...' : 'Full Sync (All History)'}
              </button>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

