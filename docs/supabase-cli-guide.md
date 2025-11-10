# Supabase CLI Guide

## Quick Start

### 1. Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate. You only need to do this once.

### 2. Link Your Project

Link your local project to your remote Supabase project:

```bash
supabase link --project-ref otkxverokhbsxrmrxdrx
```

You'll be prompted for your database password. You can find it in:
- Supabase Dashboard → Settings → Database → Database Password

### 3. Apply Migrations

Once linked, you can push all pending migrations:

```bash
# Push all migrations to remote database
supabase db push
```

Or apply migrations one by one:

```bash
# Apply next pending migration
supabase migration up
```

### 4. Deploy Edge Functions

Deploy your edge functions to production:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy generate-analysis
supabase functions deploy generate-week-plan
```

## Common Commands

### Database Operations

```bash
# Push all migrations
supabase db push

# Pull remote schema changes
supabase db pull

# Reset local database (requires Docker)
supabase db reset

# Create a new migration
supabase migration new migration_name

# Check migration status
supabase migration list
```

### Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy function-name

# Serve functions locally (requires Docker)
supabase functions serve

# View function logs
supabase functions logs function-name
```

### Project Management

```bash
# Link to remote project
supabase link --project-ref YOUR_PROJECT_REF

# Unlink from project
supabase unlink

# Check project status
supabase status
```

## Applying Your Migration

For your current situation (applying `scheduled_workouts` table):

```bash
# 1. Login (if not already)
supabase login

# 2. Link project
supabase link --project-ref otkxverokhbsxrmrxdrx

# 3. Push migration
supabase db push
```

This will apply the `20250101000018_create_scheduled_workouts.sql` migration to your remote database.

## Alternative: Manual SQL Execution

If you prefer, you can also run the SQL directly in Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/otkxverokhbsxrmrxdrx
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20250101000018_create_scheduled_workouts.sql`
4. Paste and run

## Troubleshooting

### "Cannot connect to Docker daemon"
- This is only needed for local development
- For remote operations (push, deploy), Docker is NOT required
- You can use `supabase db push` and `supabase functions deploy` without Docker

### "Project not linked"
- Run `supabase link --project-ref otkxverokhbsxrmrxdrx`
- You'll need your database password from Supabase Dashboard

### "Migration already applied"
- Supabase tracks applied migrations
- If a migration was already applied manually, you may need to mark it as applied
- Check `supabase_migrations.schema_migrations` table

