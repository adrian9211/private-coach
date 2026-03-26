const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://otkxverokhbsxrmrxdrx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90a3h2ZXJva2hic3hybXJ4ZHJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk1MjczOSwiZXhwIjoyMDc1NTI4NzM5fQ.vMB1sE449BruUKmTT17NAxPWrCTGqSz1QXM3-LzkVAQ');

supabase.from('activities')
  .select('metadata, data, max_power, avg_power')
  .not('metadata->>source', 'eq', 'STRAVA')
  .order('created_at', { ascending: false })
  .limit(1)
  .then(({data, error}) => {
    if (error) console.error(error);
    else {
      if(!data || !data[0]) { console.log('No non-Strava activities found'); return; }
      const act = data[0];
      const summary = act.data.summary;
      console.log('DB Column max_power:', act.max_power);
      console.log('DB Column avg_power:', act.avg_power);
      console.log('Max Power:', summary.maxPower, 'Raw max_watts:', summary._raw.max_watts);
      console.log('Stream Data exists?', summary.streams ? summary.streams.length : 'No streams');
      if (summary.streams && summary.streams.length > 0) {
        console.log('First stream type:', summary.streams[0].title || Object.keys(summary.streams[0]));
      }
      console.log('Power Curve info in raw?', Object.keys(summary._raw).filter(k => k.includes('power')));
      console.log('Peak info in raw?', Object.keys(summary._raw).filter(k => k.includes('peak')));
      console.log('All icu stuff:', Object.keys(summary._raw).filter(k=>k.includes('icu_')));
    }
  });
