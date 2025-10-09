// Quick test script to check storage bucket
const { createClient } = require('@supabase/supabase-js')

// You'll need to add your Supabase URL and anon key here
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testStorage() {
  console.log('Testing storage bucket...')
  
  // Try to list files in the bucket
  const { data, error } = await supabase.storage
    .from('activity-files')
    .list()
  
  if (error) {
    console.error('Storage bucket error:', error)
  } else {
    console.log('Storage bucket exists:', data)
  }
}

testStorage()
