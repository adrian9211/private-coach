# 🔄 Restart Required!

Your dev server needs to be restarted to load the new environment variables.

## Why?

Next.js bakes `NEXT_PUBLIC_*` environment variables into the build at **start time**. 
Since we added these to `env.local`:
```bash
NEXT_PUBLIC_INTERVALS_API_KEY=11rc4qk584u9f7vhy4n9zv2ea
NEXT_PUBLIC_INTERVALS_ATHLETE_ID=i247527
```

The running dev server doesn't know about them yet.

## How to Restart

### Option 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Option 2: Hard Restart (if Option 1 doesn't work)
```bash
# Stop current server (Ctrl+C)
# Clear Next.js cache
rm -rf apps/web/.next
# Restart
npm run dev
```

## Verify It Works

After restarting:
1. Go to Settings → Intervals.icu Integration
2. Open browser console (F12)
3. Look for these debug logs when the page loads:
   ```
   🔍 Intervals.icu Debug:
     API Key present: true  ← Should be TRUE
     Athlete ID present: true  ← Should be TRUE
   ```

4. Click "Full Sync (All History)"
5. Look for:
   ```
   🔍 Sync Debug: { hasApiKey: true, apiKey: 'present', ... }
   🔄 Full sync using API key...
   ```

If you see `hasApiKey: false`, the env vars still aren't loaded!

## What to Look For

✅ **Good** - API key path:
```
🔍 Sync Debug: { hasApiKey: true, ... }
🔄 Full sync using API key...
📥 Fetched 198 activities
💾 Importing activities to database...
```

❌ **Bad** - OAuth path (wrong!):
```
🔍 Sync Debug: { hasApiKey: false, ... }
⚠️ Using OAuth/edge function path
📡 Calling intervals-sync-activities edge function...
❌ 403 Access denied
```

