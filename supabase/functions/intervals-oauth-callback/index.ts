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
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // Contains userId
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return new Response(
        JSON.stringify({ error: 'OAuth authorization failed', details: error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const clientId = Deno.env.get('INTERVALS_CLIENT_ID')
    const clientSecret = Deno.env.get('INTERVALS_CLIENT_SECRET')
    const redirectUri = Deno.env.get('INTERVALS_REDIRECT_URI')

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing Intervals.icu OAuth configuration')
      return new Response(
        JSON.stringify({ error: 'OAuth configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for tokens
    console.log('Exchanging authorization code for access token...')
    const tokenResponse = await fetch('https://intervals.icu/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Token exchange failed', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokens = await tokenResponse.json()
    console.log('Token exchange successful')

    // Get athlete info (use /i to get current authenticated athlete)
    const athleteResponse = await fetch('https://intervals.icu/api/v1/athlete/i', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    if (!athleteResponse.ok) {
      console.error('Failed to fetch athlete info')
      return new Response(
        JSON.stringify({ error: 'Failed to fetch athlete info' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const athlete = await athleteResponse.json()
    console.log('Athlete info retrieved:', athlete.id)

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate token expiry (tokens typically expire in 1 hour)
    const expiresIn = tokens.expires_in || 3600 // Default to 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    // Store or update connection
    const { data, error: dbError } = await supabase
      .from('intervals_connections')
      .upsert({
        user_id: state, // state contains userId
        athlete_id: athlete.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        connected_at: new Date().toISOString(),
        sync_enabled: true,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save connection', details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Connection saved successfully')

    // Redirect back to settings page with success message
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
    return Response.redirect(`${appUrl}/settings?intervals=connected`, 302)

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

