// @deno-types="https://esm.sh/@types/node@18.15.0/index.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global for TypeScript
declare const Deno: any

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
    // Create Supabase client with timeout
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )
    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { activityId } = requestBody

    if (!activityId || typeof activityId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid Activity ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get activity data from database with timeout
    const { data: activity, error: activityError } = await supabaseClient
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single()

    if (activityError) {
      console.error('Database error:', activityError)
      return new Response(
        JSON.stringify({ error: 'Database error: ' + activityError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!activity) {
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if activity is already processed
    if (activity.status === 'processed') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Activity already processed',
          data: activity.data 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update activity status to processing
    const { error: statusUpdateError } = await supabaseClient
      .from('activities')
      .update({ status: 'processing' })
      .eq('id', activityId)

    if (statusUpdateError) {
      console.error('Status update error:', statusUpdateError)
      throw new Error('Failed to update activity status')
    }

    // Determine the storage path, falling back to file_name if metadata is missing the path
    const storagePath = activity.metadata?.storagePath || activity.file_name;
    if (!storagePath) {
      throw new Error(`Could not determine storage path for activity ID: ${activityId}`);
    }

    // Download the FIT file from storage with timeout
    const downloadPromise = supabaseClient.storage
      .from('activity-files')
      .download(storagePath);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Download timeout after 30 seconds')), 30000)
    )

    const { data: fileData, error: downloadError } = await Promise.race([
      downloadPromise,
      timeoutPromise
    ])

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError)
      
      // Update status to failed
      await supabaseClient
        .from('activities')
        .update({ status: 'failed' })
        .eq('id', activityId)
      
      throw new Error('Failed to download FIT file from storage: ' + (downloadError?.message || 'Unknown error'))
    }

    // Convert file to ArrayBuffer for processing
    const arrayBuffer = await fileData.arrayBuffer()
    console.log('File downloaded, size:', arrayBuffer.byteLength)
    
    // Validate file size
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded file is empty')
    }

    if (arrayBuffer.byteLength > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('File too large (>50MB)')
    }
    
    // Process the FIT file data
    const processedData = await processFitFile(arrayBuffer, activity.file_name)
    console.log('Processing completed successfully')

    // Generate CSV files and upload to storage
    try {
      await generateAndUploadCSV(processedData, activity, supabaseClient)
      console.log('CSV files generated and uploaded successfully')
    } catch (csvError) {
      console.warn('Failed to generate CSV files:', csvError)
      // Continue processing even if CSV generation fails
    }

    // Merge new metadata with existing metadata
    const updatedMetadata = {
      ...activity.metadata,
      ...processedData.metadata
    }

    // Prepare GPS track data
    const gpsTrack = processedData.records
      ?.filter(record => record.positionLat && record.positionLong)
      ?.map(record => ({
        timestamp: record.timestamp,
        lat: record.positionLat,
        long: record.positionLong,
        distance: record.distance,
        speed: record.speed,
        heartRate: record.heartRate,
        power: record.power,
        cadence: record.cadence,
        altitude: record.altitude,
        temperature: record.temperature,
        grade: record.grade,
        resistance: record.resistance
      })) || []

    // Update activity with processed data
    const { error: updateError } = await supabaseClient
      .from('activities')
      .update({
        status: 'processed',
        processed_date: new Date().toISOString(),
        data: processedData,
        metadata: updatedMetadata,
        // Populate existing summary fields
        sport: processedData.metadata.sport,
        device: processedData.metadata.device,
        start_time: processedData.metadata.startTime,
        total_timer_time: processedData.summary.duration,
        total_distance: processedData.summary.totalDistance,
        total_calories: processedData.summary.totalCalories,
        avg_speed: processedData.summary.avgSpeed,
        max_speed: processedData.summary.maxSpeed,
        avg_heart_rate: processedData.summary.avgHeartRate,
        max_heart_rate: processedData.summary.maxHeartRate,
        avg_power: processedData.summary.avgPower,
        max_power: processedData.summary.maxPower,
        avg_cadence: processedData.summary.avgCadence,
        max_cadence: processedData.summary.maxCadence,
        total_ascent: processedData.summary.elevationGain,
        // Populate new additional fields
        sub_sport: processedData.sessions?.[0]?.subSport || null,
        total_elapsed_time: processedData.sessions?.[0]?.totalElapsedTime || null,
        total_descent: processedData.sessions?.[0]?.totalDescent || null,
        min_temperature: processedData.sessions?.[0]?.minTemperature || null,
        max_temperature: processedData.sessions?.[0]?.maxTemperature || null,
        avg_temperature: processedData.summary.temperature || null,
        processing_method: 'fit-sdk-full',
        processed_at: new Date().toISOString(),
        gps_track: gpsTrack
      })
      .eq('id', activityId)

    if (updateError) {
      console.error('Update error:', updateError)
      
      // Update status to failed
      await supabaseClient
        .from('activities')
        .update({ status: 'failed' })
        .eq('id', activityId)
      
      throw new Error('Failed to update activity: ' + updateError.message)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Activity processed successfully',
        data: processedData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing activity:', error)
    
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

// Full FIT SDK processing implementation
async function processFitFile(arrayBuffer: ArrayBuffer, fileName: string) {
  try {
    console.log('Starting FIT file processing for:', fileName, 'Size:', arrayBuffer.byteLength)
    
    // Import FIT SDK modules
    const { Decoder, Stream, Profile } = await import('./fitsdk/index.js')
    
    // Create stream from ArrayBuffer
    const stream = Stream.fromArrayBuffer(arrayBuffer)
    
    // Validate FIT file
    if (!Decoder.isFIT(stream)) {
      throw new Error('Invalid FIT file format')
    }
    
    // Create decoder
    const decoder = new Decoder(stream)
    
    // Verify file integrity
    if (!decoder.checkIntegrity()) {
      throw new Error('FIT file integrity check failed')
    }
    
    // Initialize data structures
    const activityData = {
      metadata: {
        fileName,
        fileSize: arrayBuffer.byteLength,
        processedAt: new Date().toISOString(),
        extractionMethod: 'fit-sdk-full',
        device: null as string | null,
        sport: null as string | null,
        startTime: null as string | null,
        totalTime: null as number | null
      },
      records: [] as any[],
      laps: [] as any[],
      sessions: [] as any[],
      summary: {
        totalDistance: 0,
        duration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        totalCalories: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        avgPower: 0,
        maxPower: 0,
        avgCadence: 0,
        maxCadence: 0,
        elevationGain: 0,
        temperature: null as number | null
      }
    }
    
    // Track metrics for calculations
    const metrics = {
      distances: [] as number[],
      speeds: [] as number[],
      heartRates: [] as number[],
      powers: [] as number[],
      cadences: [] as number[],
      elevations: [] as number[],
      temperatures: [] as number[],
      timestamps: [] as string[]
    }
    
    // Process FIT file with message listeners
    const result = decoder.read({
      mesgListener: (mesgNum, message) => {
        try {
          switch (mesgNum) {
            case 0: // fileId
              // Extract file metadata
              if (message.manufacturer !== null) {
                activityData.metadata.device = getDeviceName(message.manufacturer, message.product)
              }
              if (message.timeCreated !== null) {
                activityData.metadata.startTime = message.timeCreated.toISOString()
              }
              break
              
            case 18: // session
              // Extract session data
              const session = {
                timestamp: message.timestamp?.toISOString() || null,
                startTime: message.startTime?.toISOString() || null,
                totalElapsedTime: message.totalElapsedTime || 0,
                totalTimerTime: message.totalTimerTime || 0,
                totalDistance: message.totalDistance || 0,
                totalCalories: message.totalCalories || 0,
                avgSpeed: message.avgSpeed || 0,
                maxSpeed: message.maxSpeed || 0,
                avgHeartRate: message.avgHeartRate || 0,
                maxHeartRate: message.maxHeartRate || 0,
                avgPower: message.avgPower || 0,
                maxPower: message.maxPower || 0,
                avgCadence: message.avgCadence || 0,
                maxCadence: message.maxCadence || 0,
                sport: message.sport || null,
                subSport: message.subSport || null,
                totalAscent: message.totalAscent || 0,
                totalDescent: message.totalDescent || 0,
                minTemperature: message.minTemperature || null,
                maxTemperature: message.maxTemperature || null
              }
              
              activityData.sessions.push(session)
              
              // Update summary with session data
              if (session.totalDistance > 0) {
                activityData.summary.totalDistance = session.totalDistance / 1000 // Convert to km
              }
              if (session.totalTimerTime > 0) {
                activityData.summary.duration = session.totalTimerTime
              }
              if (session.totalCalories > 0) {
                activityData.summary.totalCalories = session.totalCalories
              }
              if (session.avgSpeed > 0) {
                activityData.summary.avgSpeed = session.avgSpeed * 3.6 // Convert m/s to km/h
              }
              if (session.maxSpeed > 0) {
                activityData.summary.maxSpeed = session.maxSpeed * 3.6 // Convert m/s to km/h
              }
              if (session.avgHeartRate > 0) {
                activityData.summary.avgHeartRate = session.avgHeartRate
              }
              if (session.maxHeartRate > 0) {
                activityData.summary.maxHeartRate = session.maxHeartRate
              }
              if (session.avgPower > 0) {
                activityData.summary.avgPower = session.avgPower
              }
              if (session.maxPower > 0) {
                activityData.summary.maxPower = session.maxPower
              }
              if (session.avgCadence > 0) {
                activityData.summary.avgCadence = session.avgCadence
              }
              if (session.maxCadence > 0) {
                activityData.summary.maxCadence = session.maxCadence
              }
              if (session.totalAscent > 0) {
                activityData.summary.elevationGain = session.totalAscent
              }
              if (session.minTemperature !== null) {
                activityData.summary.temperature = session.minTemperature
              }
              
              // Set sport from session
              if (session.sport !== null) {
                activityData.metadata.sport = getSportName(session.sport)
              }
              break
              
            case 19: // lap
              // Extract lap data
              const lap = {
                timestamp: message.timestamp?.toISOString() || null,
                startTime: message.startTime?.toISOString() || null,
                totalElapsedTime: message.totalElapsedTime || 0,
                totalTimerTime: message.totalTimerTime || 0,
                totalDistance: message.totalDistance || 0,
                totalCalories: message.totalCalories || 0,
                avgSpeed: message.avgSpeed || 0,
                maxSpeed: message.maxSpeed || 0,
                avgHeartRate: message.avgHeartRate || 0,
                maxHeartRate: message.maxHeartRate || 0,
                avgPower: message.avgPower || 0,
                maxPower: message.maxPower || 0,
                avgCadence: message.avgCadence || 0,
                maxCadence: message.maxCadence || 0,
                sport: message.sport || null,
                subSport: message.subSport || null,
                totalAscent: message.totalAscent || 0,
                totalDescent: message.totalDescent || 0,
                minTemperature: message.minTemperature || null,
                maxTemperature: message.maxTemperature || null
              }
              
              activityData.laps.push(lap)
              break
              
            case 20: // record
              // Extract record data (GPS, sensors)
              const record = {
                timestamp: message.timestamp?.toISOString() || null,
                positionLat: message.positionLat || null,
                positionLong: message.positionLong || null,
                distance: message.distance || null,
                speed: message.speed || null,
                heartRate: message.heartRate || null,
                power: message.power || null,
                cadence: message.cadence || null,
                altitude: message.altitude || null,
                temperature: message.temperature || null,
                grade: message.grade || null,
                resistance: message.resistance || null
              }
              
              activityData.records.push(record)
              
              // Collect metrics for calculations
              if (record.timestamp) {
                metrics.timestamps.push(record.timestamp)
              }
              if (record.distance !== null) {
                metrics.distances.push(record.distance)
              }
              if (record.speed !== null) {
                metrics.speeds.push(record.speed)
              }
              if (record.heartRate !== null) {
                metrics.heartRates.push(record.heartRate)
              }
              if (record.power !== null) {
                metrics.powers.push(record.power)
              }
              if (record.cadence !== null) {
                metrics.cadences.push(record.cadence)
              }
              if (record.altitude !== null) {
                metrics.elevations.push(record.altitude)
              }
              if (record.temperature !== null) {
                metrics.temperatures.push(record.temperature)
              }
              break
          }
        } catch (msgError) {
          console.warn('Error processing message:', msgError)
        }
      }
    })
    
    // Calculate additional metrics from record data if session data is incomplete
    if (activityData.summary.totalDistance === 0 && metrics.distances.length > 0) {
      activityData.summary.totalDistance = Math.max(...metrics.distances) / 1000 // Convert to km
    }
    
    if (activityData.summary.duration === 0 && metrics.timestamps.length > 1) {
      const startTime = new Date(metrics.timestamps[0])
      const endTime = new Date(metrics.timestamps[metrics.timestamps.length - 1])
      activityData.summary.duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    }
    
    if (activityData.summary.avgSpeed === 0 && metrics.speeds.length > 0) {
      const avgSpeed = metrics.speeds.reduce((sum, speed) => sum + speed, 0) / metrics.speeds.length
      activityData.summary.avgSpeed = avgSpeed * 3.6 // Convert m/s to km/h
    }
    
    if (activityData.summary.maxSpeed === 0 && metrics.speeds.length > 0) {
      activityData.summary.maxSpeed = Math.max(...metrics.speeds) * 3.6 // Convert m/s to km/h
    }
    
    if (activityData.summary.avgHeartRate === 0 && metrics.heartRates.length > 0) {
      activityData.summary.avgHeartRate = Math.round(
        metrics.heartRates.reduce((sum, hr) => sum + hr, 0) / metrics.heartRates.length
      )
    }
    
    if (activityData.summary.maxHeartRate === 0 && metrics.heartRates.length > 0) {
      activityData.summary.maxHeartRate = Math.max(...metrics.heartRates)
    }
    
    if (activityData.summary.avgPower === 0 && metrics.powers.length > 0) {
      activityData.summary.avgPower = Math.round(
        metrics.powers.reduce((sum, power) => sum + power, 0) / metrics.powers.length
      )
    }
    
    if (activityData.summary.maxPower === 0 && metrics.powers.length > 0) {
      activityData.summary.maxPower = Math.max(...metrics.powers)
    }
    
    if (activityData.summary.avgCadence === 0 && metrics.cadences.length > 0) {
      activityData.summary.avgCadence = Math.round(
        metrics.cadences.reduce((sum, cadence) => sum + cadence, 0) / metrics.cadences.length
      )
    }
    
    if (activityData.summary.maxCadence === 0 && metrics.cadences.length > 0) {
      activityData.summary.maxCadence = Math.max(...metrics.cadences)
    }
    
    if (activityData.summary.elevationGain === 0 && metrics.elevations.length > 1) {
      let totalAscent = 0
      for (let i = 1; i < metrics.elevations.length; i++) {
        const diff = metrics.elevations[i] - metrics.elevations[i - 1]
        if (diff > 0) {
          totalAscent += diff
        }
      }
      activityData.summary.elevationGain = Math.round(totalAscent)
    }
    
    if (activityData.summary.temperature === null && metrics.temperatures.length > 0) {
      activityData.summary.temperature = Math.round(
        metrics.temperatures.reduce((sum, temp) => sum + temp, 0) / metrics.temperatures.length
      )
    }
    
    // Calculate power and heart rate zones
    const processedData = {
      ...activityData,
      powerZones: calculatePowerZones(activityData.summary.avgPower, activityData.summary.maxPower),
      heartRateZones: calculateHeartRateZones(activityData.summary.avgHeartRate, activityData.summary.maxHeartRate)
    }
    
    console.log('FIT file processed successfully:', {
      records: processedData.records.length,
      laps: processedData.laps.length,
      sessions: processedData.sessions.length,
      summary: processedData.summary
    })
    
    return processedData
    
  } catch (error) {
    console.error('Error processing FIT file:', error)
    throw new Error(`Failed to process FIT file: ${error.message}`)
  }
}

// Generate CSV files from processed data and upload to storage
async function generateAndUploadCSV(processedData: any, activity: any, supabaseClient: any) {
  console.log('Starting CSV generation...')
  
  // Helper function to convert array of objects to CSV
  const convertToCSV = (data: any[], headers: string[]): string => {
    if (data.length === 0) return headers.join(',') + '\n'
    
    const csvRows = [headers.join(',')]
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header]
        if (value === null || value === undefined) return ''
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`
        }
        return value
      })
      csvRows.push(values.join(','))
    }
    
    return csvRows.join('\n')
  }
  
  // Generate CSV for each data type
  const csvFiles: { [key: string]: string } = {}
  
  // Records CSV (GPS and sensor data)
  if (processedData.records && processedData.records.length > 0) {
    const recordHeaders = Object.keys(processedData.records[0])
    csvFiles['records'] = convertToCSV(processedData.records, recordHeaders)
  }
  
  // Laps CSV
  if (processedData.laps && processedData.laps.length > 0) {
    const lapHeaders = Object.keys(processedData.laps[0])
    csvFiles['laps'] = convertToCSV(processedData.laps, lapHeaders)
  }
  
  // Sessions CSV
  if (processedData.sessions && processedData.sessions.length > 0) {
    const sessionHeaders = Object.keys(processedData.sessions[0])
    csvFiles['sessions'] = convertToCSV(processedData.sessions, sessionHeaders)
  }
  
  // Summary CSV
  if (processedData.summary) {
    csvFiles['summary'] = convertToCSV([processedData.summary], Object.keys(processedData.summary))
  }
  
  // Metadata CSV
  if (processedData.metadata) {
    csvFiles['metadata'] = convertToCSV([processedData.metadata], Object.keys(processedData.metadata))
  }
  
  // Upload each CSV file to the activity-csv-files bucket
  const userId = activity.user_id
  const activityId = activity.id
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  
  // Create a service role client for storage operations
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  for (const [fileType, csvContent] of Object.entries(csvFiles)) {
    const fileName = `${userId}/${activityId}_${fileType}_${timestamp}.csv`
    const csvBlob = new Blob([csvContent], { type: 'text/csv' })
    
    const { error: uploadError } = await serviceClient.storage
      .from('activity-csv-files')
      .upload(fileName, csvBlob, {
        contentType: 'text/csv',
        upsert: false
      })
    
    if (uploadError) {
      console.error(`Failed to upload ${fileType} CSV:`, uploadError)
      throw new Error(`Failed to upload ${fileType} CSV: ${uploadError.message}`)
    }
    
    console.log(`Uploaded ${fileType} CSV: ${fileName}`)
  }
}

// Calculate power zones based on FTP (simplified)
function calculatePowerZones(avgPower: number, maxPower: number) {
  const estimatedFTP = Math.max(avgPower * 0.95, maxPower * 0.75)
  
  return {
    zone1: { min: 0, max: estimatedFTP * 0.55, label: 'Recovery' },
    zone2: { min: estimatedFTP * 0.55, max: estimatedFTP * 0.75, label: 'Endurance' },
    zone3: { min: estimatedFTP * 0.75, max: estimatedFTP * 0.90, label: 'Tempo' },
    zone4: { min: estimatedFTP * 0.90, max: estimatedFTP * 1.05, label: 'Threshold' },
    zone5: { min: estimatedFTP * 1.05, max: estimatedFTP * 1.20, label: 'VO2 Max' },
    zone6: { min: estimatedFTP * 1.20, max: Infinity, label: 'Anaerobic' }
  }
}

// Calculate heart rate zones (simplified)
function calculateHeartRateZones(avgHeartRate: number, maxHeartRate: number) {
  const estimatedMaxHR = Math.max(maxHeartRate, avgHeartRate * 1.2)
  
  return {
    zone1: { min: 0, max: estimatedMaxHR * 0.60, label: 'Recovery' },
    zone2: { min: estimatedMaxHR * 0.60, max: estimatedMaxHR * 0.70, label: 'Aerobic Base' },
    zone3: { min: estimatedMaxHR * 0.70, max: estimatedMaxHR * 0.80, label: 'Aerobic' },
    zone4: { min: estimatedMaxHR * 0.80, max: estimatedMaxHR * 0.90, label: 'Threshold' },
    zone5: { min: estimatedMaxHR * 0.90, max: estimatedMaxHR * 1.00, label: 'VO2 Max' }
  }
}

// Get device name from manufacturer and product codes
function getDeviceName(manufacturer: number, product: number): string {
  const manufacturerMap: { [key: number]: string } = {
    1: 'Garmin',
    2: 'Garmin FR405',
    3: 'Zephyr',
    4: 'Dayton',
    5: 'IDT',
    6: 'SRM',
    7: 'Quarq',
    8: 'iBike',
    9: 'Saris',
    10: 'Spark HK',
    11: 'Tanita',
    12: 'Echowell',
    13: 'Dynastream OEM',
    14: 'Nautilus',
    15: 'Dynastream',
    16: 'Timex',
    17: 'Metrigear',
    18: 'Xelic',
    19: 'Beurer',
    20: 'Cardiosport',
    21: 'A&D',
    22: 'HMM',
    23: 'Suunto',
    24: 'Thita Elektronik',
    25: 'GPulse',
    26: 'Clean Mobile',
    27: 'PedalBrain',
    28: 'Peaksware',
    29: 'Saxonar',
    30: 'LeMond Fitness',
    31: 'Dexcom',
    32: 'Wahoo Fitness',
    33: 'Octane Fitness',
    34: 'Archinoetics',
    35: 'The Hurt Box',
    36: 'Citizen Systems',
    37: 'Magellan',
    38: 'Osynce',
    39: 'Holux',
    40: 'Concept2',
    41: 'Shimano',
    42: 'One Giant Leap',
    43: 'Ace Sensor',
    44: 'Brim Brothers',
    45: 'Xplova',
    46: 'Perception Digital',
    47: 'BF1systems',
    48: 'Pioneer',
    49: 'Spantec',
    50: 'Metalogics',
    51: '4iiiis',
    52: 'Seiko Epson',
    53: 'Seiko Epson OEM',
    54: 'iFor Powell',
    55: 'Maxwell Guider',
    56: 'StarTrac',
    57: 'Breakaway',
    58: 'Alatech Technology Ltd',
    59: 'Mio Technology Europe',
    60: 'Rotor',
    61: 'Geonaute',
    62: 'ID Bike',
    63: 'Specialized',
    64: 'WTEK',
    65: 'Physical Enterprises',
    66: 'North Pole Engineering',
    67: 'BKOOL',
    68: 'Cateye',
    69: 'Stages Cycling',
    70: 'Sigma Sport',
    71: 'TomTom',
    72: 'Peripedal',
    73: 'Wattbike',
    76: 'Moxy',
    77: 'Ciclosport',
    78: 'Powerbahn',
    79: 'Acorn Projects APS',
    80: 'Lifebeam',
    81: 'Bontrager',
    82: 'Wellgo',
    83: 'Scosche',
    84: 'Magura',
    85: 'Woodway',
    86: 'Elite',
    87: 'Nielsen Kellerman',
    88: 'DK City',
    89: 'Tacx',
    90: 'Direction Technology',
    91: 'Magtonic',
    92: '1partcarbon',
    93: 'Inside Ride Technologies',
    94: 'Sound of Motion',
    95: 'Stryd',
    96: 'ICG',
    97: 'MiPulse',
    98: 'BSX Athletics',
    99: 'Look',
    100: 'Campagnolo SRL',
    101: 'Body Bike Smart',
    102: 'Praxisworks',
    103: 'Limits Technology',
    104: 'TopAction Technology',
    105: 'Cosinuss',
    106: 'Fitcare',
    107: 'Magene',
    108: 'Giant Manufacturing Co',
    109: 'Tigrasport',
    110: 'Salutron',
    111: 'Technogym',
    112: 'Bryton Sensors',
    113: 'Latitude Limited',
    114: 'Soaring Technology',
    115: 'iGPSport',
    116: 'Thinkrider',
    117: 'Gopher Sport',
    118: 'WaterRower',
    119: 'OrangeTheory',
    120: 'InPeak',
    121: 'Kinetic',
    122: 'Johnson Health Tech',
    123: 'Polar Electro',
    124: 'Seesense',
    125: 'NCI Technology',
    126: 'IQSquare',
    127: 'Leomo',
    128: 'iFit.com',
    129: 'Coros',
    130: 'Versa Design',
    131: 'Chileaf',
    132: 'Cycplus',
    133: 'Gravaa',
    134: 'Sigeyi',
    135: 'Coospo',
    136: 'Geoid',
    137: 'Bosch',
    138: 'Kyto',
    139: 'Kinetic Sports',
    140: 'Decathlon',
    141: 'TQ Systems',
    142: 'Tag Heuer',
    143: 'Keiser Fitness',
    144: 'Zwift',
    145: 'Porsche EP',
    146: 'Blackbird',
    147: 'Meilan',
    148: 'Ezon',
    149: 'Laisi',
    150: 'Myzone',
    151: 'Abawo',
    152: 'Bafang',
    153: 'Luhong Technology',
    255: 'Development',
    257: 'Healthandlife',
    258: 'Lezyne',
    259: 'Scribe Labs',
    260: 'Zwift',
    261: 'Watteam',
    262: 'Recon',
    263: 'Favero Electronics',
    264: 'Dynovelo',
    265: 'Strava',
    266: 'Precor',
    267: 'Bryton',
    268: 'SRAM',
    269: 'Navman',
    270: 'COBI',
    271: 'Spivi',
    272: 'Mio Magellan',
    273: 'Evesports',
    274: 'Sensitivus Gauge',
    275: 'Podoon',
    276: 'LifeTime Fitness',
    277: 'Falco eMotors',
    278: 'Minoura',
    279: 'Cycliq',
    280: 'Luxottica',
    281: 'TrainerRoad',
    282: 'The Sufferfest',
    283: 'FullSpeedAhead',
    284: 'Virtualtraining',
    285: 'FeedbackSports',
    286: 'Omata',
    287: 'VDO',
    288: 'Magnetic Days',
    289: 'Hammerhead',
    290: 'Kinetic by Kurt',
    291: 'Shapelog',
    292: 'Dabuziduo',
    293: 'Jetblack',
    294: 'Coros',
    295: 'Virtugo',
    296: 'Velosense',
    297: 'Cycligent Inc',
    298: 'Trailforks',
    299: 'Mahle Ebikemotion',
    300: 'Nurvv',
    301: 'Microprogram'
  }

  const manufacturerName = manufacturerMap[manufacturer] || `Unknown Manufacturer (${manufacturer})`
  return `${manufacturerName} (Product: ${product})`
}

// Get sport name from sport code
function getSportName(sport: number): string {
  const sportMap: { [key: number]: string } = {
    0: 'Generic',
    1: 'Running',
    2: 'Cycling',
    3: 'Transition',
    4: 'Fitness Equipment',
    5: 'Swimming',
    6: 'Basketball',
    7: 'Soccer',
    8: 'Tennis',
    9: 'American Football',
    10: 'Training',
    11: 'Walking',
    12: 'Cross Country Skiing',
    13: 'Alpine Skiing',
    14: 'Snowboarding',
    15: 'Rowing',
    16: 'Mountaineering',
    17: 'Hiking',
    18: 'Multisport',
    19: 'Paddling',
    20: 'Flying',
    21: 'E-Biking',
    22: 'Motorcycling',
    23: 'Boating',
    24: 'Driving',
    25: 'Golf',
    26: 'Hang Gliding',
    27: 'Horseback Riding',
    28: 'Hunting',
    29: 'Fishing',
    30: 'Inline Skating',
    31: 'Rock Climbing',
    32: 'Sailing',
    33: 'Ice Skating',
    34: 'Sky Diving',
    35: 'Snowshoeing',
    36: 'Snowmobiling',
    37: 'Stand Up Paddleboarding',
    38: 'Surfing',
    39: 'Wakeboarding',
    40: 'Water Skiing',
    41: 'Kayaking',
    42: 'Rafting',
    43: 'Windsurfing',
    44: 'Kitesurfing',
    45: 'Tactical',
    46: 'Jumpmaster',
    47: 'Boxing',
    48: 'Floor Climbing',
    49: 'Baseball',
    53: 'Diving',
    62: 'HIIT',
    64: 'Racket',
    65: 'Wheelchair Push Walk',
    66: 'Wheelchair Push Run',
    67: 'Meditation',
    69: 'Disc Golf',
    71: 'Cricket',
    72: 'Rugby',
    73: 'Hockey',
    74: 'Lacrosse',
    75: 'Volleyball',
    76: 'Water Tubing',
    77: 'Wakesurfing',
    80: 'Mixed Martial Arts',
    82: 'Snorkeling',
    83: 'Dance',
    84: 'Jump Rope',
    254: 'All'
  }

  return sportMap[sport] || `Unknown Sport (${sport})`
}


