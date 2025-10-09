# Personal Cycling Coach - Architecture Documentation

## System Architecture

### High-Level Overview

The Personal Cycling Coach application follows a modern serverless architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Data Layer    │
│   (Next.js)     │◄──►│   (Supabase)    │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Upload   │    │   Edge Functions│    │   Storage       │
│   (Supabase)    │    │   (Deno/TS)     │    │   (Supabase)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────┐
                    │   AI Analysis   │
                    │   (OpenAI API)  │
                    └─────────────────┘
```

## Component Details

### 1. Frontend Layer (Next.js)

**Technology**: Next.js 14 with App Router
**Location**: `apps/web/`

**Key Features**:
- File upload interface for .fit files
- Activity visualization and charts
- AI insights display
- User preferences management
- Responsive design with Tailwind CSS

**Architecture Patterns**:
- Server-side rendering for SEO
- Client-side state management with React hooks
- Component-based architecture
- Type-safe with TypeScript

### 2. Backend Layer (Supabase)

**Technology**: Supabase Edge Functions (Deno)
**Location**: `apps/api/functions/`

**Functions**:

#### `process-activity`
- **Purpose**: Orchestrates FIT file processing
- **Input**: Activity ID, file metadata
- **Process**: Calls Python service, updates database
- **Output**: Processed activity data

#### `generate-analysis`
- **Purpose**: Creates AI-powered insights
- **Input**: Activity data, user preferences
- **Process**: Calls OpenAI API, structures response
- **Output**: Analysis with recommendations

#### `weekly-summary`
- **Purpose**: Generates weekly training summaries
- **Trigger**: Scheduled via GitHub Actions
- **Process**: Aggregates weekly data, generates insights
- **Output**: Weekly report for users

### 3. Data Processing Layer (Python)

**Technology**: FastAPI with fitdecode
**Location**: `packages/fit-processor/`

**Key Components**:
- FIT file parser using fitdecode library
- Data validation and normalization
- Structured JSON output generation
- Error handling and logging

**API Endpoints**:
- `POST /process-fit`: Process FIT file data
- `POST /process-upload`: Handle direct file uploads
- `GET /`: Health check endpoint

### 4. Data Layer (PostgreSQL)

**Technology**: Supabase PostgreSQL
**Location**: `supabase/migrations/`

**Tables**:

#### `users`
- User profiles and authentication
- Preferences and settings
- Row Level Security (RLS) enabled

#### `activities`
- Cycling activity data
- File metadata and processing status
- Structured activity data (JSONB)

#### `activity_analyses`
- AI-generated insights
- Recommendations and trends
- Performance metrics

**Security**:
- Row Level Security (RLS) policies
- JWT-based authentication
- API key protection for service accounts

### 5. Storage Layer (Supabase Storage)

**Purpose**: File storage for .fit files
**Features**:
- Automatic file organization
- Access control via RLS
- CDN distribution
- File size limits (50MB)

### 6. AI Analysis Layer (Google Gemini)

**Technology**: Google Gemini API
**Integration**: Via Supabase Edge Functions

**Capabilities**:
- Activity performance analysis
- Personalized recommendations
- Training trend identification
- Goal-based workout suggestions

## Data Flow

### 1. File Upload Flow

```
User → Frontend → Supabase Storage → Edge Function → Python Service → Database
```

1. User uploads .fit file via frontend
2. File stored in Supabase Storage
3. Edge function triggered with file metadata
4. Python service processes FIT file
5. Structured data saved to database
6. Frontend displays processed activity

### 2. Analysis Generation Flow

```
Database → Edge Function → Google Gemini API → Database → Frontend
```

1. User requests analysis for activity
2. Edge function retrieves activity data
3. Google Gemini API generates insights
4. Analysis saved to database
5. Frontend displays AI recommendations

### 3. Weekly Summary Flow

```
GitHub Actions → Edge Function → Database → Google Gemini API → User Notification
```

1. Scheduled GitHub Action triggers weekly summary
2. Edge function aggregates user data
3. Google Gemini generates personalized summary
4. Summary delivered via email/notification

## Security Architecture

### Authentication
- Supabase Auth with JWT tokens
- Row Level Security (RLS) policies
- API key management for services

### Data Protection
- Encrypted data transmission (HTTPS)
- Secure file storage with access controls
- Environment variable management
- No sensitive data in client-side code

### API Security
- CORS configuration
- Rate limiting via Supabase
- Input validation and sanitization
- Error handling without data leakage

## Scalability Considerations

### Horizontal Scaling
- Serverless functions auto-scale
- Database connection pooling
- CDN for static assets
- Stateless application design

### Performance Optimization
- Database indexing strategy
- Caching for frequently accessed data
- Image optimization
- Code splitting in frontend

### Monitoring
- Supabase built-in monitoring
- Optional Logtail integration
- GitHub Actions workflow monitoring
- Error tracking and alerting

## Deployment Architecture

### Development Environment
- Local Supabase instance
- Python service on localhost
- Next.js development server
- Hot reloading enabled

### Production Environment
- Vercel for frontend hosting
- Supabase Cloud for backend
- GitHub Actions for CI/CD
- Automated deployments

### Environment Management
- Separate environments for dev/staging/prod
- Environment-specific configuration
- Secret management via platform tools
- Database migration strategy
