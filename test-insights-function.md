# Testing generate-insights Edge Function

## Quick Test Steps:

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Navigate to** `/insights` page
3. **Check console logs** - you should see:
   - `AIRecommendations: useEffect triggered` with userId
   - `AIRecommendations: Loading cached insights for userId: ...`
   - Either cached insights loaded OR `generateRecommendations: Starting for userId: ...`

## Common Issues:

### Issue 1: Table doesn't exist
**Error:** `relation "public.user_insights" does not exist`
**Solution:** Apply migration `20250101000014_create_user_insights.sql`

### Issue 2: No userId
**Console:** `AIRecommendations: userId is empty, waiting...`
**Solution:** Check if user is logged in and `user.id` is available

### Issue 3: Function not called
**Console:** No logs after "Loading cached insights"
**Check:**
- Browser Network tab for failed requests
- Supabase Edge Function logs
- CORS errors in console

## Manual Test:

Run this in browser console on `/insights` page:

```javascript
// Test edge function directly
const { data, error } = await supabase.functions.invoke('generate-insights', {
  body: { userId: 'YOUR_USER_ID_HERE' }
})
console.log('Test result:', { data, error })
```

Replace `YOUR_USER_ID_HERE` with your actual user ID from `user.id`

