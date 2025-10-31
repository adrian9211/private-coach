# AI Coach Setup Guide

## Environment Variables Required

The AI Coach Analysis feature requires the following environment variable to be set in your Supabase Edge Functions:

### GOOGLE_API_KEY

**How to set it:**

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. In Supabase Dashboard:
   - Go to **Project Settings** → **Edge Functions** → **Secrets**
   - Add a new secret:
     - **Name:** `GOOGLE_API_KEY`
     - **Value:** Your Gemini API key

3. Or via CLI:
   ```bash
   supabase secrets set GOOGLE_API_KEY=your_api_key_here
   ```

### Optional: GEMINI_MODEL

Default is `gemini-1.5-pro`. You can override by setting:
- **Name:** `GEMINI_MODEL`
- **Value:** e.g., `gemini-1.5-flash` (faster) or `gemini-1.5-pro` (more capable)

## Troubleshooting

### Error: "GOOGLE_API_KEY environment variable is not set"
- Solution: Set the `GOOGLE_API_KEY` secret in Supabase Edge Functions

### Error: "Gemini API error"
- Check your API key is valid
- Verify you have quota/credits remaining
- Check function logs in Supabase Dashboard for detailed error messages

### Error: "Failed to save analysis"
- The analysis was generated but couldn't be saved to database
- Check RLS policies allow inserts to `activity_analyses` table
- The analysis will still be displayed even if save fails

## Testing

After setting up the API key:
1. Navigate to any processed activity
2. Click "AI Coach Analysis" tab
3. Click "Generate Analysis"
4. Wait for analysis (may take 10-30 seconds)

The analysis includes:
- What worked well
- Critical issues & wasted time
- Time optimization recommendations
- Training structure feedback
- Recovery & fatigue assessment
- Next session recommendations

