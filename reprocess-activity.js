import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from env.local
dotenv.config({ path: 'env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error(
    'Missing Supabase environment variables. Please ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are set in your env.local file.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function reprocessActivity(fileName) {
  try {
    // 1. Find activities by file name
    console.log(`Searching for activities with file name: ${fileName}`);
    const { data: activities, error: findError } = await supabase
      .from('activities')
      .select('id, status')
      .eq('file_name', fileName);

    if (findError) {
      console.error('Error finding activities:', findError.message);
      return;
    }

    if (!activities || activities.length === 0) {
      console.error('No activities found with that file name.');
      return;
    }

    console.log(`Found ${activities.length} activities to reprocess.`);

    for (const activity of activities) {
      const { id: activityId, status } = activity;
      console.log(`\n--- Processing activity ID: ${activityId}. Current status: ${status} ---`);

      // 2. Reset status to 'uploaded' if it's already processed or failed
      if (status === 'processed' || status === 'failed') {
        console.log(`Resetting status to 'uploaded' for reprocessing...`);
        const { error: updateError } = await supabase
          .from('activities')
          .update({ status: 'uploaded' })
          .eq('id', activityId);

        if (updateError) {
          console.error(`Error resetting status for ${activityId}:`, updateError.message);
          continue; // Skip to the next activity
        }
        console.log(`Activity status reset successfully for ${activityId}.`);
      } else if (status === 'processing') {
          console.warn(`Activity ${activityId} is currently being processed. Skipping.`);
          continue; // Skip to the next activity
      } else if (status === 'uploaded') {
          console.log(`Activity ${activityId} is already "uploaded". Proceeding to trigger processing.`);
      }

      // 3. Invoke the 'process-activity' function
      console.log(`Invoking 'process-activity' function for activity ID: ${activityId}`);
      const { data: functionData, error: functionError } = await supabase.functions.invoke('process-activity', {
        body: { activityId },
      });

      if (functionError) {
        console.error(`Error invoking function for ${activityId}:`, functionError.message);
        await supabase.from('activities').update({ status: 'failed' }).eq('id', activityId);
        continue; // Skip to the next activity
      }

      console.log(`Successfully invoked function for ${activityId}. Response:`, functionData);
    }
    
    console.log(`\n✅ Finished triggering reprocessing for all found activities.`);
    console.log("Please check your Supabase dashboard to monitor their status.");

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
  }
}

// Get the file name from command-line arguments
const fileName = process.argv[2];

if (!fileName) {
  console.error('Please provide the file name of the activity to reprocess.');
  console.log('Usage: node reprocess-activity.js <file-name>');
  process.exit(1);
}

reprocessActivity(fileName);
