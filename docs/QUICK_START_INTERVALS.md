# 🚀 Quick Start: Intervals.icu Integration

Your credentials have been saved in `env.local` (✅ Git-ignored for security).

## Step 1: Install Dependencies

```bash
cd /Users/adriannykiel/Projects/private-coach
npm install
```

This will install:
- `tsx` - For running TypeScript files
- `@types/node` - TypeScript definitions

## Step 2: Test Your Connection

Run the test script to verify your API key works:

```bash
npm run test:intervals
```

This will:
- ✅ Fetch your athlete info
- ✅ Get your recent activities (last 7 days)
- ✅ Check wellness data
- ✅ Retrieve your sport settings (FTP, zones, etc.)

**Expected Output:**
```
🔄 Testing Intervals.icu API connection...

📋 Test 1: Fetching athlete info...
✅ Athlete info retrieved:
   Name: Your Name
   ID: i247527
   ...

📋 Test 2: Fetching recent activities (last 7 days)...
✅ Found X activities in the last 7 days

✅ All tests passed! Your Intervals.icu connection is working perfectly.
```

## Step 3: Apply Database Migration

```bash
cd /Users/adriannykiel/Projects/private-coach
supabase db push
```

This creates the tables:
- `intervals_connections` - OAuth tokens
- `intervals_sync_logs` - Sync history

## Step 4: Deploy Edge Functions

```bash
# Deploy OAuth callback
supabase functions deploy intervals-oauth-callback

# Deploy activity sync
supabase functions deploy intervals-sync-activities
```

## Step 5: Set Supabase Secrets

Your API key needs to be available to Edge Functions:

```bash
# Set secrets for Edge Functions
supabase secrets set INTERVALS_API_KEY=11rc4qk584u9f7vhy4n9zv2ea
supabase secrets set INTERVALS_ATHLETE_ID=i247527
supabase secrets set APP_URL=http://localhost:3000

# Verify secrets are set
supabase secrets list
```

## Step 6: Regenerate TypeScript Types

After applying migrations, update your types:

```bash
supabase gen types typescript --linked > apps/web/src/lib/supabase-types.ts
```

## Step 7: Test in the App

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Settings:**
   - Open http://localhost:3000/settings
   - Scroll to "Intervals.icu Integration"

3. **Connect your account:**
   - Click "Connect to Intervals.icu"
   - You'll be redirected to authorize
   - After authorization, you'll return to settings

4. **Sync Activities:**
   - Click "Sync Now"
   - Your activities will import from Intervals.icu
   - Check `/activities` to see them!

## 🔐 Security Notes

### Your Credentials Are Safe:

1. **Not in Git:**
   - `env.local` is in `.gitignore`
   - Will never be committed

2. **Supabase Secrets:**
   - Stored encrypted in Supabase
   - Only accessible by Edge Functions
   - Not exposed to frontend

3. **RLS Policies:**
   - Each user can only see their own data
   - Tokens are isolated per user

### API Key vs OAuth:

**Your current setup (API Key):**
- ✅ Perfect for personal use
- ✅ Simple, no authorization flow
- ✅ Direct access to your account
- ⚠️  Only works for your account

**OAuth (for production):**
- ✅ Multi-user support
- ✅ Users authorize their own accounts
- ✅ Each user has their own connection
- 📝 Requires OAuth app creation on Intervals.icu

## 🔧 Troubleshooting

### Test Script Fails

**Error: "Missing credentials"**
```bash
# Check env.local exists and has:
cat env.local | grep INTERVALS
```

**Error: "Failed to fetch athlete"**
- Verify API key is correct (no extra spaces)
- Check athlete ID format (should be `i247527`)
- Test API key at https://intervals.icu/settings

### Database Migration Fails

**Error: "already exists"**
- Migrations are already applied
- Safe to ignore if tables exist
- Check with: `supabase db inspect`

### Edge Functions Fail to Deploy

**Error: "Not logged in"**
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

**Error: "Missing secrets"**
```bash
# Set all required secrets
supabase secrets set INTERVALS_API_KEY=your_key
supabase secrets set INTERVALS_ATHLETE_ID=your_id
supabase secrets set APP_URL=http://localhost:3000
```

### Activities Not Syncing

1. **Check connection:**
   ```bash
   npm run test:intervals
   ```

2. **Check Edge Function logs:**
   ```bash
   supabase functions logs intervals-sync-activities
   ```

3. **Verify secrets:**
   ```bash
   supabase secrets list
   ```

## 📊 What Data Gets Synced?

From each Intervals.icu activity:

### Basic Metrics:
- ✅ Name, type, date
- ✅ Distance, duration
- ✅ Location data (if available)

### Power Metrics:
- ✅ Average power
- ✅ Normalized power (NP)
- ✅ Intensity factor (IF)
- ✅ Training stress score (TSS)
- ✅ Max power

### Heart Rate:
- ✅ Average HR
- ✅ Max HR
- ✅ HR zones distribution

### Other:
- ✅ Speed data
- ✅ Elevation gain
- ✅ Calories
- ✅ Cadence

## 🎯 Next Steps

Once everything is working:

1. **Automatic Sync (Future):**
   - Set up cron job for daily sync
   - Or use Intervals.icu webhooks

2. **Wellness Data (Phase 2):**
   - Sync weight, HRV, sleep
   - Track fitness/fatigue (CTL/ATL)

3. **Training Calendar (Phase 3):**
   - Sync planned workouts
   - Push AI-generated workouts back

## 📚 Resources

- **Intervals.icu API Docs**: https://intervals.icu/api-docs.html
- **Forum**: https://forum.intervals.icu/c/api/11
- **Settings**: https://intervals.icu/settings
- **OpenAPI Spec**: `docs/openapi-spec.json`

---

**Ready?** Start with Step 1: `npm install` then `npm run test:intervals` 🚀

