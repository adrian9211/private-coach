import { supabase } from '@/lib/supabase'

export class ActivityService {
  /**
   * Maps an Intervals.icu activity (with optionally attached detailed fields and streams)
   * to our local database schema and inserts it.
   */
  static async importActivity(userId: string, activityInfo: any, detailedActivity: any, streams: any[]): Promise<boolean> {
    try {
      // Activity info represents the list, detailedActivity represents the single GET result.
      const activity = detailedActivity || activityInfo;

      // Map Intervals.icu activity to our database schema
      const activityData = {
        user_id: userId,
        file_name: `intervals-${activity.id}.fit`,
        file_size: 0, 
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
        
        // Full activity data
        data: {
          summary: {
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

            // Power Model
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

            // Zone Times
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

            // Weather
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

            stravaId: activity.strava_id || null,
            streamTypes: activity.stream_types || null,

            // Add the detailed icu_intervals and streams arrays specifically requested
            intervals: activity.icu_intervals || null,
            streams: streams && streams.length > 0 ? streams : null,

            _raw: activity,
          },
        },
      }

      const { error: insertError } = await supabase
        .from('activities')
        .insert(activityData)

      if (insertError) {
        console.error(`Error importing activity ${activity.id}:`, insertError)
        return false;
      }

      return true;
    } catch (err) {
      console.error(`Error processing activity ${activityInfo.id}:`, err)
      return false;
    }
  }

  static async activityExists(userId: string, intervalsId: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('activities')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>intervals_id', intervalsId.toString())
      .maybeSingle()

    return !!existing;
  }
}
