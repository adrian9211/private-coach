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

    // Call Python processing service
    const pythonServiceUrl = Deno.env.get('PYTHON_SERVICE_URL') || 'http://localhost:8000'
    const processResponse = await fetch(`${pythonServiceUrl}/process-fit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activityId,
        fileName: activity.file_name,
        fileSize: activity.file_size,
      }),
    })

    if (!processResponse.ok) {
      throw new Error('Failed to process FIT file')
    }

    const processedData = await processResponse.json()

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


