# Personal Cycling Coach - Environment Configuration

## Required Environment Variables

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key for client-side
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations

### Google Gemini
- `GOOGLE_API_KEY`: Your Google API key for Gemini AI analysis
- `GEMINI_MODEL`: Gemini model to use (default: gemini-1.5-pro)

### Optional
- `LOGTAIL_SOURCE_TOKEN`: For monitoring and logging (BetterStack)

## Setup Instructions

1. Copy `env.example` to `.env.local`
2. Fill in your actual API keys and URLs
3. Never commit `.env.local` to version control

## Environment-specific Notes

- **Development**: Use local Supabase instance with `supabase start`
- **Production**: Set variables in Vercel dashboard for automatic deployment
