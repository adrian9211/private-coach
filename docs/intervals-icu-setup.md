# Intervals.icu Integration Setup

This guide will help you set up the Intervals.icu OAuth integration for automatic activity syncing.

## Prerequisites

1. An Intervals.icu account (free or paid)
2. Supabase project set up
3. Application deployed (or running locally)

## Step 1: Create Intervals.icu OAuth Application

1. **Go to Intervals.icu Settings**
   - Log in to https://intervals.icu
   - Navigate to Settings → API & OAuth

2. **Create New OAuth Application**
   - Click "Register new application"
   - Fill in the details:
     - **Name**: `Personal Cycling Coach` (or your app name)
     - **Description**: `AI-powered cycling coach`
     - **Redirect URI**: 
       - Local: `http://localhost:54321/functions/v1/intervals-oauth-callback`
       - Production: `https://YOUR_PROJECT.supabase.co/functions/v1/intervals-oauth-callback`
     - **Scopes**: Select:
       - `ACTIVITY:READ` - Read activities
       - `ATHLETE:READ` - Read athlete profile
       - (Optional for future) `WELLNESS:READ`, `EVENTS:READ`

3. **Save OAuth Credentials**
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - **Keep these secret!**

## Step 2: Apply Database Migration

Run the migration to create the necessary tables:

```bash
cd /path/to/private-coach
supabase db push
```

This will create:
- `intervals_connections` table - Stores OAuth tokens per user
- `intervals_sync_logs` table - Logs sync operations

## Step 3: Deploy Edge Functions

Deploy the OAuth callback and sync functions:

```bash
# Deploy OAuth callback function
supabase functions deploy intervals-oauth-callback

# Deploy activity sync function
supabase functions deploy intervals-sync-activities
```

## Step 4: Configure Environment Variables

### Local Development

Add to your `.env.local` file:

```bash
# Intervals.icu OAuth
NEXT_PUBLIC_INTERVALS_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_INTERVALS_REDIRECT_URI=http://localhost:54321/functions/v1/intervals-oauth-callback
```

Add to `supabase/functions/.env` (or set in Supabase dashboard):

```bash
INTERVALS_CLIENT_ID=your_client_id_here
INTERVALS_CLIENT_SECRET=your_client_secret_here
INTERVALS_REDIRECT_URI=http://localhost:54321/functions/v1/intervals-oauth-callback
APP_URL=http://localhost:3000
```

### Production (Vercel)

1. **Vercel Environment Variables**:
   ```bash
   NEXT_PUBLIC_INTERVALS_CLIENT_ID=your_client_id_here
   NEXT_PUBLIC_INTERVALS_REDIRECT_URI=https://YOUR_PROJECT.supabase.co/functions/v1/intervals-oauth-callback
   ```

2. **Supabase Edge Function Secrets**:
   
   Go to Supabase Dashboard → Edge Functions → Secrets, or use CLI:
   
   ```bash
   supabase secrets set INTERVALS_CLIENT_ID=your_client_id_here
   supabase secrets set INTERVALS_CLIENT_SECRET=your_client_secret_here
   supabase secrets set INTERVALS_REDIRECT_URI=https://YOUR_PROJECT.supabase.co/functions/v1/intervals-oauth-callback
   supabase secrets set APP_URL=https://your-app.vercel.app
   ```

## Step 5: Regenerate TypeScript Types

After applying the migration, regenerate types to include the new tables:

```bash
supabase gen types typescript --linked > apps/web/src/lib/supabase-types.ts
```

## Step 6: Test the Integration

1. **Navigate to Settings**
   - Go to `/settings` in your app
   - Find the "Intervals.icu Integration" section

2. **Connect Account**
   - Click "Connect to Intervals.icu"
   - You'll be redirected to Intervals.icu to authorize
   - After authorization, you'll be redirected back

3. **Sync Activities**
   - Once connected, click "Sync Now"
   - The first sync will import activities from the last 30 days
   - Subsequent syncs will only import new activities

## How It Works

### OAuth Flow

1. User clicks "Connect" → Redirected to Intervals.icu
2. User authorizes → Intervals.icu redirects to callback function
3. Callback exchanges code for access token
4. Token stored securely in `intervals_connections` table

### Activity Sync

1. User clicks "Sync Now" (or runs on schedule)
2. Fetch activities from Intervals.icu API since last sync
3. For each activity:
   - Check if already exists (by `intervals_id`)
   - If new, create activity record with summary data
   - Mark as `processed` since we have all data
4. Update `last_sync_at` timestamp

### Data Stored

From each Intervals.icu activity, we store:
- Basic metadata (name, type, date)
- Summary metrics (distance, duration, power, HR)
- Calculated metrics (NP, IF, TSS)
- Link to original Intervals.icu activity

## Security Considerations

1. **OAuth Tokens**: Stored encrypted in Supabase with RLS policies
2. **User Isolation**: Each user can only see/modify their own connection
3. **Token Refresh**: Implement token refresh when needed (future enhancement)
4. **Secrets Management**: Use Supabase secrets for sensitive data

## Troubleshooting

### "OAuth configuration missing"
- Check that environment variables are set correctly
- Ensure you've deployed the edge functions

### "Failed to fetch activities"
- Verify the access token is valid
- Check that the athlete_id is correct
- Review Intervals.icu API rate limits

### "Database error"
- Ensure migration was applied: `supabase db push`
- Regenerate types: `supabase gen types typescript --linked`

### Activities not appearing
- Check sync logs table for errors
- Verify activities exist in Intervals.icu for the date range
- Check browser console for errors

## Future Enhancements (Phase 2 & 3)

- [ ] Automatic scheduled syncs (daily/hourly)
- [ ] Wellness data sync (sleep, HRV, weight)
- [ ] Training calendar sync (planned workouts)
- [ ] Power zone sync (auto-update FTP)
- [ ] Bidirectional sync (push AI insights back)
- [ ] Webhook support for real-time updates

## API Documentation

Official Intervals.icu API docs: https://intervals.icu/api-docs.html

Key endpoints used:
- `GET /api/v1/athlete` - Get athlete profile
- `GET /api/v1/athlete/{id}/activities` - Get activities
- `GET /api/v1/athlete/{id}/wellness` - Get wellness data (future)
- `GET /api/v1/athlete/{id}/events` - Get calendar events (future)

