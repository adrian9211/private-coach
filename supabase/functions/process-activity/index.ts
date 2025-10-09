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

    // Get activity data from database
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

    // Update activity status to processing
    await supabaseClient
      .from('activities')
      .update({ status: 'processing' })
      .eq('id', activityId)

    // Download the FIT file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('activity-files')
      .download(activity.metadata.storagePath)

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError)
      throw new Error('Failed to download FIT file from storage')
    }

    // Convert file to ArrayBuffer for processing
    const arrayBuffer = await fileData.arrayBuffer()
    console.log('File downloaded, size:', arrayBuffer.byteLength)
    
    // Process the FIT file data
    const processedData = await processFitFile(arrayBuffer, activity.file_name)
    console.log('Processing completed:', processedData)

    // Update activity with processed data
    const { error: updateError } = await supabaseClient
      .from('activities')
      .update({
        status: 'processed',
        processed_date: new Date().toISOString(),
        data: processedData,
        metadata: processedData.metadata,
      })
      .eq('id', activityId)

    if (updateError) {
      throw new Error('Failed to update activity')
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

// FIT file processing function (simplified for testing)
async function processFitFile(arrayBuffer: ArrayBuffer, fileName: string) {
  try {
    console.log('Starting FIT file processing for:', fileName)
    
    // For now, let's create mock data to test the system
    // In a real implementation, you'd parse the actual FIT file
    
    const mockData = {
      metadata: {
        fileName,
        fileSize: arrayBuffer.byteLength,
        processedAt: new Date().toISOString(),
        recordCount: 100
      },
      summary: {
        totalDistance: 25.5, // km
        duration: 3600, // seconds (1 hour)
        avgSpeed: 25.5, // km/h
        totalCalories: 800,
        avgHeartRate: 150,
        maxHeartRate: 180,
        avgPower: 200,
        maxPower: 400,
        avgCadence: 85,
        maxCadence: 110
      },
      records: [], // Empty for now
      powerZones: calculatePowerZones(200, 400),
      heartRateZones: calculateHeartRateZones(150, 180)
    }
    
    console.log('Mock data created:', mockData)
    return mockData
    
  } catch (error) {
    console.error('Error processing FIT file:', error)
    throw new Error(`Failed to process FIT file: ${error.message}`)
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


