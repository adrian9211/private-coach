// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Decoder, Stream } from './fitsdk/index.js'

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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { activityId } = await req.json()

    if (!activityId) {
      throw new Error('Activity ID is required')
    }

    // 1. Fetch activity metadata to get the file path
    const { data: activity, error: activityError } = await supabaseClient
      .from('activities')
      .select('file_name, metadata, user_id')
      .eq('id', activityId)
      .single()

    if (activityError) throw activityError

    // 2. Download the FIT file from storage
    const storagePath = activity.metadata?.storagePath || `${activity.user_id}/${activity.file_name}`
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('activity-files')
      .download(storagePath)

    if (downloadError) throw downloadError

    const arrayBuffer = await fileData.arrayBuffer()

    // 3. Decode the FIT file
    const stream = Stream.fromArrayBuffer(arrayBuffer)
    if (!Decoder.isFIT(stream)) {
      throw new Error('Invalid FIT file.')
    }

    const decoder = new Decoder(stream)
    const { messages, errors } = decoder.read()

    if (errors.length > 0) {
      console.warn('encountered errors decoding file', errors)
    }
    
    // 4. Convert decoded messages to CSV
    const csvData = convertToCsv(messages);

    return new Response(JSON.stringify(csvData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/decode-activity' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

function convertToCsv(messages) {
  const csvSections = {};

  // Group messages by type (e.g., record, lap, session)
  const groupedMessages = {};
  for (const message of messages) {
    const messageType = message.name;
    if (!groupedMessages[messageType]) {
      groupedMessages[messageType] = [];
    }
    groupedMessages[messageType].push(message.message);
  }

  // Create a CSV string for each message type
  for (const messageType in groupedMessages) {
    const messagesOfType = groupedMessages[messageType];
    if (messagesOfType.length === 0) continue;

    const headers = Object.keys(messagesOfType[0]);
    const csvRows = [headers.join(',')];

    for (const message of messagesOfType) {
      const row = headers.map(header => {
        const value = message[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`; // Add quotes to values with commas
        }
        return value;
      }).join(',');
      csvRows.push(row);
    }
    csvSections[messageType] = csvRows.join('\n');
  }

  return csvSections;
}
