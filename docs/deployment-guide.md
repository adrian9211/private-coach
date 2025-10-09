# Personal Cycling Coach - Deployment Guide

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Project**: Create a new project at [supabase.com](https://supabase.com)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Google API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. **GitHub Repository**: Push your code to GitHub

## Environment Setup

### 1. Supabase Configuration

1. **Create Supabase Project**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login to Supabase
   supabase login
   
   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Deploy Database Schema**:
   ```bash
   supabase db push
   ```

3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy
   ```

4. **Set Environment Variables in Supabase Dashboard**:
   - `GOOGLE_API_KEY`: Your Google API key
   - `GEMINI_MODEL`: Gemini model to use (default: gemini-1.5-pro)
   - `PYTHON_SERVICE_URL`: URL of your Python service (if external)

### 2. Vercel Configuration

1. **Connect Repository**:
   - Go to Vercel Dashboard
   - Import your GitHub repository
   - Select `apps/web` as the root directory

2. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GOOGLE_API_KEY=your-google-api-key
   GEMINI_MODEL=gemini-1.5-pro
   ```

3. **Configure Build Settings**:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Python Service Deployment

#### Option A: Render (Recommended)

1. **Create Render Account**: Sign up at [render.com](https://render.com)

2. **Create Web Service**:
   - Connect GitHub repository
   - Root Directory: `packages/fit-processor`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python main.py`

3. **Set Environment Variables**:
   ```
   PYTHONPATH=/opt/render/project/src
   ```

#### Option B: Railway

1. **Create Railway Account**: Sign up at [railway.app](https://railway.app)

2. **Deploy from GitHub**:
   - Connect repository
   - Select `packages/fit-processor` directory
   - Railway will auto-detect Python and install dependencies

#### Option C: Self-hosted

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar
   - Python 3.9+
   - 1GB RAM minimum
   - 10GB storage

2. **Deployment Script**:
   ```bash
   # Install dependencies
   sudo apt update
   sudo apt install python3 python3-pip nginx
   
   # Clone repository
   git clone https://github.com/your-username/personal-cycling-coach.git
   cd personal-cycling-coach/packages/fit-processor
   
   # Install Python dependencies
   pip3 install -r requirements.txt
   
   # Create systemd service
   sudo nano /etc/systemd/system/fit-processor.service
   ```

3. **Systemd Service File**:
   ```ini
   [Unit]
   Description=FIT File Processor
   After=network.target
   
   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/path/to/personal-cycling-coach/packages/fit-processor
   ExecStart=/usr/bin/python3 main.py
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

4. **Start Service**:
   ```bash
   sudo systemctl enable fit-processor
   sudo systemctl start fit-processor
   ```

## GitHub Actions Setup

### 1. Repository Secrets

Add the following secrets to your GitHub repository:

- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `SUPABASE_ACCESS_TOKEN`: Supabase access token
- `SUPABASE_PROJECT_REF`: Supabase project reference
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `GOOGLE_API_KEY`: Google API key

### 2. Vercel Token Setup

1. Go to Vercel Dashboard → Settings → Tokens
2. Create new token with appropriate scope
3. Add to GitHub repository secrets

### 3. Supabase Token Setup

1. Go to Supabase Dashboard → Settings → Access Tokens
2. Create new token with project access
3. Add to GitHub repository secrets

## Monitoring Setup

### 1. Logtail (Optional)

1. **Create Logtail Account**: Sign up at [logtail.com](https://logtail.com)

2. **Add to Environment Variables**:
   ```
   LOGTAIL_SOURCE_TOKEN=your-logtail-token
   ```

3. **Configure Logging**:
   - Add Logtail client to your applications
   - Set up log aggregation and alerting

### 2. Supabase Monitoring

- Built-in monitoring available in Supabase Dashboard
- Database performance metrics
- Function execution logs
- API usage statistics

## Domain Configuration

### 1. Custom Domain (Optional)

1. **Vercel Domain Setup**:
   - Add domain in Vercel Dashboard
   - Configure DNS records as instructed
   - Enable SSL certificate

2. **Supabase Custom Domain**:
   - Configure in Supabase Dashboard
   - Update API URLs in environment variables

## Testing Deployment

### 1. Health Checks

```bash
# Frontend
curl https://your-app.vercel.app

# Backend Functions
curl https://your-project.supabase.co/functions/v1/process-activity \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activityId":"test"}'

# Python Service
curl https://your-python-service.com/
```

### 2. End-to-End Testing

1. **Upload Test File**:
   - Use frontend to upload a sample .fit file
   - Verify processing completes successfully

2. **Check Database**:
   - Verify data appears in Supabase tables
   - Check activity status updates

3. **Test AI Analysis**:
   - Generate analysis for processed activity
   - Verify Google Gemini integration works

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**:
   - Check all required variables are configured
   - Verify variable names match exactly

2. **Function Deployment Failures**:
   - Check Supabase CLI version
   - Verify project linking
   - Check function syntax

3. **Python Service Not Starting**:
   - Check Python version compatibility
   - Verify all dependencies installed
   - Check port configuration

4. **Database Connection Issues**:
   - Verify Supabase project is active
   - Check connection string format
   - Verify RLS policies

### Debug Commands

```bash
# Check Supabase status
supabase status

# View function logs
supabase functions logs

# Test database connection
supabase db ping

# Check Vercel deployment
vercel logs

# Test Python service
curl -X POST http://localhost:8000/process-fit \
  -H "Content-Type: application/json" \
  -d '{"activityId":"test","fileName":"test.fit","fileSize":1000}'
```

## Maintenance

### Regular Tasks

1. **Monitor Resource Usage**:
   - Check Supabase usage limits
   - Monitor Vercel bandwidth
   - Review Google Gemini API usage

2. **Update Dependencies**:
   - Keep Node.js packages updated
   - Update Python dependencies
   - Monitor security advisories

3. **Backup Strategy**:
   - Supabase provides automatic backups
   - Consider additional backup solutions
   - Test restore procedures

### Scaling Considerations

1. **Database Scaling**:
   - Monitor query performance
   - Add indexes as needed
   - Consider read replicas

2. **Function Scaling**:
   - Monitor execution times
   - Optimize function code
   - Consider caching strategies

3. **Storage Scaling**:
   - Monitor file storage usage
   - Implement cleanup policies
   - Consider CDN for large files
