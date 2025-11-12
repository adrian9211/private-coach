#!/usr/bin/env tsx
/**
 * Test script for Intervals.icu API connection
 * Tests API key authentication and fetches basic athlete info
 * 
 * Usage: 
 *   npm run test:intervals
 *   # or
 *   tsx scripts/test-intervals-connection.ts
 */

import 'dotenv/config'

const API_KEY = process.env.INTERVALS_API_KEY
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID

if (!API_KEY || !ATHLETE_ID) {
  console.error('❌ Missing credentials in env.local:')
  console.error('   INTERVALS_API_KEY')
  console.error('   INTERVALS_ATHLETE_ID')
  process.exit(1)
}

async function testConnection() {
  console.log('🔄 Testing Intervals.icu API connection...\n')
  
  try {
    // Test 1: Get athlete info
    console.log('📋 Test 1: Fetching athlete info...')
    const athleteResponse = await fetch(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`API_KEY:${API_KEY}`).toString('base64')}`,
      },
    })

    if (!athleteResponse.ok) {
      throw new Error(`Failed to fetch athlete: ${athleteResponse.status} ${athleteResponse.statusText}`)
    }

    const athlete = await athleteResponse.json()
    console.log('✅ Athlete info retrieved:')
    console.log(`   Name: ${athlete.name}`)
    console.log(`   ID: ${athlete.id}`)
    console.log(`   Email: ${athlete.email || 'N/A'}`)
    console.log(`   Timezone: ${athlete.timezone}`)
    console.log('')

    // Test 2: Get recent activities
    console.log('📋 Test 2: Fetching recent activities (last 7 days)...')
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const oldest = sevenDaysAgo.toISOString().split('T')[0]

    const activitiesResponse = await fetch(
      `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${oldest}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`API_KEY:${API_KEY}`).toString('base64')}`,
        },
      }
    )

    if (!activitiesResponse.ok) {
      throw new Error(`Failed to fetch activities: ${activitiesResponse.status} ${activitiesResponse.statusText}`)
    }

    const activities = await activitiesResponse.json()
    console.log(`✅ Found ${activities.length} activities in the last 7 days`)
    
    if (activities.length > 0) {
      console.log('\n📊 Recent activities:')
      activities.slice(0, 5).forEach((activity: any, index: number) => {
        const date = new Date(activity.start_date_local).toLocaleDateString()
        const distance = activity.distance ? `${(activity.distance / 1000).toFixed(1)}km` : 'N/A'
        const duration = activity.moving_time ? `${Math.floor(activity.moving_time / 60)}min` : 'N/A'
        const avgPower = activity.icu_average_watts || activity.average_watts || 'N/A'
        const tss = activity.icu_training_load || 'N/A'
        
        console.log(`   ${index + 1}. ${activity.name}`)
        console.log(`      ${date} • ${activity.type} • ${distance} • ${duration}`)
        console.log(`      Power: ${avgPower}W • TSS: ${tss}`)
        console.log('')
      })
    }

    // Test 3: Get wellness data
    console.log('📋 Test 3: Checking wellness data...')
    const today = new Date().toISOString().split('T')[0]
    const wellnessResponse = await fetch(
      `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness/${today}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`API_KEY:${API_KEY}`).toString('base64')}`,
        },
      }
    )

    if (wellnessResponse.ok) {
      const wellness = await wellnessResponse.json()
      console.log('✅ Wellness data available:')
      if (wellness.weight) console.log(`   Weight: ${wellness.weight}kg`)
      if (wellness.restingHR) console.log(`   Resting HR: ${wellness.restingHR}bpm`)
      if (wellness.hrv) console.log(`   HRV: ${wellness.hrv}`)
      if (wellness.ctl) console.log(`   CTL (Fitness): ${wellness.ctl.toFixed(1)}`)
      if (wellness.atl) console.log(`   ATL (Fatigue): ${wellness.atl.toFixed(1)}`)
      console.log('')
    } else {
      console.log('⚠️  No wellness data for today')
      console.log('')
    }

    // Test 4: Get sport settings (FTP, zones, etc.)
    console.log('📋 Test 4: Fetching sport settings...')
    const settingsResponse = await fetch(
      `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/sport-settings/Ride`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`API_KEY:${API_KEY}`).toString('base64')}`,
        },
      }
    )

    if (settingsResponse.ok) {
      const settings = await settingsResponse.json()
      console.log('✅ Sport settings retrieved:')
      if (settings.ftp) console.log(`   FTP: ${settings.ftp}W`)
      if (settings.indoor_ftp) console.log(`   Indoor FTP: ${settings.indoor_ftp}W`)
      if (settings.w_prime) console.log(`   W': ${settings.w_prime}J`)
      if (settings.lthr) console.log(`   LTHR: ${settings.lthr}bpm`)
      if (settings.max_hr) console.log(`   Max HR: ${settings.max_hr}bpm`)
      console.log('')
    } else {
      console.log('⚠️  No sport settings found')
      console.log('')
    }

    console.log('✅ All tests passed! Your Intervals.icu connection is working perfectly.')
    console.log('\n🚀 Next steps:')
    console.log('   1. Apply database migration: cd /Users/adriannykiel/Projects/private-coach && supabase db push')
    console.log('   2. Deploy edge functions: supabase functions deploy intervals-oauth-callback')
    console.log('   3. Set Supabase secrets with your API key')
    console.log('   4. Test in the app: Go to /settings and click "Connect to Intervals.icu"')

  } catch (error) {
    console.error('\n❌ Connection test failed:')
    console.error(`   ${error instanceof Error ? error.message : String(error)}`)
    console.error('\n📝 Troubleshooting:')
    console.error('   1. Verify your API key is correct in env.local')
    console.error('   2. Check your athlete ID (should be like "i247527")')
    console.error('   3. Visit https://intervals.icu/settings to verify API access is enabled')
    process.exit(1)
  }
}

testConnection()

