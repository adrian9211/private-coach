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
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Create a client scoped to the user's auth token
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      )

    // Get user from Authorization header
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let requestBody
    try {
      requestBody = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { activityId } = requestBody

    if (!activityId || typeof activityId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid Activity ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // First, fetch the activity to get file_name using the service role client
    const { data: activity, error: fetchError } = await serviceRoleClient
      .from('activities')
      .select('file_name, user_id')
      .eq('id', activityId)
      .single()

    if (fetchError) {
      console.error(`Error fetching activity ${activityId}:`, fetchError)
      return new Response(
        JSON.stringify({ error: `Activity not found: ${fetchError.message}` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    
    // Manually enforce ownership check
    if (activity.user_id !== user.id) {
        console.warn(`User ${user.id} attempted to delete activity ${activityId} owned by ${activity.user_id}`)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Delete the activity file from storage
    if (activity.file_name) {
      const filePath = `${user.id}/${activity.file_name}`
      const { error: storageError } = await serviceRoleClient.storage
        .from('activity-files')
        .remove([filePath])

      if (storageError) {
        // Log error but proceed to delete db record, as it's more critical
        console.error(`Error deleting file ${filePath} from storage:`, storageError)
      }
    }

    // Delete the activity from the database using the service role client
    const { error: deleteError } = await serviceRoleClient
      .from('activities')
      .delete()
      .eq('id', activityId)

    if (deleteError) {
      console.error(`Error deleting activity ${activityId} from database:`, deleteError)
      return new Response(
        JSON.stringify({ error: `Failed to delete activity from database: ${deleteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Successfully deleted activity ${activityId} for user ${user.id}`)
    return new Response(
      JSON.stringify({ success: true, message: 'Activity deleted successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error deleting activity:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
