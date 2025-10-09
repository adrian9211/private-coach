# Personal Cycling Coach - Development Guide

## Project Overview

This is a modern serverless web application for analyzing cycling activities and generating personalized workout recommendations using AI.

## Architecture

### Frontend (Next.js)
- **Location**: `apps/web/`
- **Tech Stack**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Features**: File upload, activity visualization, AI insights display

### Backend (Supabase Edge Functions)
- **Location**: `apps/api/functions/`
- **Tech Stack**: Deno, TypeScript
- **Functions**:
  - `process-activity`: Handles FIT file processing
  - `generate-analysis`: Creates AI-powered insights
  - `weekly-summary`: Generates weekly reports

### Data Processing (Python)
- **Location**: `packages/fit-processor/`
- **Tech Stack**: FastAPI, fitdecode
- **Purpose**: Converts FIT files to structured JSON data

### Shared Package
- **Location**: `packages/shared/`
- **Purpose**: Common TypeScript types and utilities

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase CLI
- Git

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd personal-cycling-coach
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env.local
   # Fill in your API keys and URLs
   ```

3. **Start Supabase locally**:
   ```bash
   supabase start
   ```

4. **Start the Python processor**:
   ```bash
   cd packages/fit-processor
   pip install -r requirements.txt
   python main.py
   ```

5. **Start the frontend**:
   ```bash
   npm run dev
   ```

## Development Workflow

### Adding New Features

1. **Frontend Components**: Add to `apps/web/src/components/`
2. **API Endpoints**: Add to `apps/api/functions/`
3. **Data Processing**: Extend `packages/fit-processor/`
4. **Types**: Update `packages/shared/src/types/`

### Database Changes

1. Create migration in `supabase/migrations/`
2. Apply locally: `supabase db reset`
3. Deploy: `supabase db push`

### Testing

```bash
# Frontend tests
npm run test --workspace=apps/web

# Python tests
cd packages/fit-processor
python -m pytest

# Type checking
npm run type-check
```

## Deployment

### Frontend (Vercel)
- Automatic deployment on push to `main`
- Environment variables set in Vercel dashboard

### Backend (Supabase)
```bash
supabase functions deploy
```

### Database
```bash
supabase db push
```

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### Optional
- `LOGTAIL_SOURCE_TOKEN`
- `PYTHON_SERVICE_URL`

## Project Structure

```
personal-cycling-coach/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # Supabase Edge Functions
├── packages/
│   ├── shared/              # Shared types and utilities
│   └── fit-processor/       # Python FIT processing
├── supabase/                # Database configuration
├── .github/workflows/       # CI/CD automation
└── docs/                    # Documentation
```

## Contributing

1. Create feature branch from `develop`
2. Make changes and test locally
3. Create pull request to `develop`
4. After review, merge to `main` for deployment

## Troubleshooting

### Common Issues

1. **Supabase connection errors**: Check environment variables
2. **Python service not starting**: Verify Python dependencies
3. **Build failures**: Check Node.js version compatibility

### Getting Help

- Check the documentation in `docs/`
- Review GitHub Issues
- Contact the development team


