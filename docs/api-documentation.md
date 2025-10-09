# Personal Cycling Coach - API Documentation

## Overview

The Personal Cycling Coach API provides endpoints for uploading, processing, and analyzing cycling activities. The API is built using Supabase Edge Functions and follows RESTful principles.

## Base URL

- **Development**: `http://localhost:54321/functions/v1`
- **Production**: `https://your-project.supabase.co/functions/v1`

## Authentication

All API requests require authentication via Supabase JWT tokens:

```bash
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Process Activity

**POST** `/process-activity`

Processes a FIT file and extracts structured activity data.

#### Request Body

```json
{
  "activityId": "string",
  "fileName": "string",
  "fileSize": "number"
}
```

#### Response

```json
{
  "success": true,
  "message": "Activity processed successfully",
  "data": {
    "metadata": {
      "device": "Garmin Edge 530",
      "sport": "cycling",
      "startTime": "2024-01-01T10:00:00Z",
      "totalTime": 3600,
      "totalDistance": 25000,
      "avgSpeed": 6.94,
      "maxSpeed": 12.5,
      "avgHeartRate": 150,
      "maxHeartRate": 180,
      "avgPower": 200,
      "maxPower": 400,
      "calories": 800,
      "elevationGain": 500,
      "temperature": 20
    },
    "records": [],
    "laps": [],
    "sessions": []
  }
}
```

#### Error Response

```json
{
  "error": "Activity ID is required",
  "details": "string"
}
```

### Generate Analysis

**POST** `/generate-analysis`

Generates AI-powered insights and recommendations for an activity.

#### Request Body

```json
{
  "activityId": "string"
}
```

#### Response

```json
{
  "success": true,
  "analysis": {
    "summary": "Your cycling performance shows excellent endurance...",
    "insights": [
      "Consistent power output throughout the ride",
      "Good heart rate zone distribution"
    ],
    "recommendations": [
      {
        "type": "endurance",
        "duration": 90,
        "intensity": "moderate",
        "description": "Long steady ride",
        "targetMetrics": {
          "heartRate": {
            "min": 120,
            "max": 150
          }
        },
        "rationale": "Build aerobic base"
      }
    ],
    "trends": [
      {
        "metric": "average_power",
        "period": "week",
        "direction": "up",
        "change": 5.2,
        "significance": "medium"
      }
    ],
    "performanceMetrics": {
      "fitnessScore": 75,
      "fatigueScore": 60,
      "formScore": 80
    }
  }
}
```

### Weekly Summary

**POST** `/weekly-summary`

Generates weekly training summaries for users.

#### Request Body

```json
{
  "action": "generate_weekly_summary"
}
```

#### Response

```json
{
  "success": true,
  "summary": {
    "week": "2024-01-01",
    "totalActivities": 5,
    "totalDistance": 125000,
    "totalTime": 18000,
    "avgPower": 195,
    "avgHeartRate": 145,
    "insights": [
      "Increased training volume this week",
      "Good consistency in power output"
    ],
    "recommendations": [
      "Consider adding interval training",
      "Focus on recovery rides"
    ]
  }
}
```

## Python Service API

### Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://your-python-service.com`

### Process FIT File

**POST** `/process-fit`

Processes a FIT file and returns structured data.

#### Request Body

```json
{
  "activityId": "string",
  "fileName": "string",
  "fileSize": "number"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "metadata": {
      "device": "string",
      "sport": "string",
      "startTime": "2024-01-01T10:00:00Z",
      "totalTime": 3600,
      "totalDistance": 25000,
      "avgSpeed": 6.94,
      "maxSpeed": 12.5,
      "avgHeartRate": 150,
      "maxHeartRate": 180,
      "avgPower": 200,
      "maxPower": 400,
      "calories": 800,
      "elevationGain": 500,
      "temperature": 20
    },
    "records": [
      {
        "timestamp": "2024-01-01T10:00:00Z",
        "position": {
          "lat": 40.7128,
          "lng": -74.0060
        },
        "altitude": 100,
        "speed": 6.94,
        "heartRate": 150,
        "power": 200,
        "cadence": 85,
        "temperature": 20
      }
    ],
    "laps": [
      {
        "startTime": "2024-01-01T10:00:00Z",
        "endTime": "2024-01-01T10:30:00Z",
        "totalTime": 1800,
        "totalDistance": 12500,
        "avgSpeed": 6.94,
        "maxSpeed": 12.5,
        "avgHeartRate": 150,
        "maxHeartRate": 180,
        "avgPower": 200,
        "maxPower": 400,
        "calories": 400
      }
    ],
    "sessions": [
      {
        "sport": "cycling",
        "startTime": "2024-01-01T10:00:00Z",
        "endTime": "2024-01-01T11:00:00Z",
        "totalTime": 3600,
        "totalDistance": 25000,
        "avgSpeed": 6.94,
        "maxSpeed": 12.5,
        "avgHeartRate": 150,
        "maxHeartRate": 180,
        "avgPower": 200,
        "maxPower": 400,
        "calories": 800,
        "trainingEffect": 3.5,
        "normalizedPower": 205,
        "intensityFactor": 0.85,
        "variabilityIndex": 1.02
      }
    ]
  },
  "message": "FIT file processed successfully"
}
```

### Process Uploaded File

**POST** `/process-upload`

Processes an uploaded FIT file directly.

#### Request

- **Content-Type**: `multipart/form-data`
- **Body**: File upload with `.fit` extension

#### Response

Same as `/process-fit` endpoint.

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Common Error Scenarios

1. **Missing Activity ID**: `400` - "Activity ID is required"
2. **Activity Not Found**: `404` - "Activity not found"
3. **Invalid File Format**: `400` - "File must be a .fit file"
4. **Processing Failure**: `500` - "Failed to process FIT file"
5. **Authentication Error**: `401` - "Invalid or missing token"

## Rate Limiting

- **Edge Functions**: 1000 requests per hour per user
- **Python Service**: 100 requests per minute per IP
- **Google Gemini API**: Subject to Google's rate limits

## Webhooks

### Activity Processed

Triggered when an activity is successfully processed.

**Payload**:
```json
{
  "event": "activity.processed",
  "data": {
    "activityId": "string",
    "userId": "string",
    "processedAt": "2024-01-01T10:00:00Z"
  }
}
```

### Analysis Generated

Triggered when AI analysis is completed.

**Payload**:
```json
{
  "event": "analysis.generated",
  "data": {
    "activityId": "string",
    "analysisId": "string",
    "generatedAt": "2024-01-01T10:00:00Z"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Process activity
const { data, error } = await supabase.functions.invoke('process-activity', {
  body: {
    activityId: 'act_123',
    fileName: 'ride.fit',
    fileSize: 1024000
  }
})

// Generate analysis
const { data: analysis, error: analysisError } = await supabase.functions.invoke('generate-analysis', {
  body: {
    activityId: 'act_123'
  }
})
```

### Python

```python
import httpx

async def process_activity(activity_id: str, file_name: str, file_size: int):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/process-fit",
            json={
                "activityId": activity_id,
                "fileName": file_name,
                "fileSize": file_size
            }
        )
        return response.json()
```
