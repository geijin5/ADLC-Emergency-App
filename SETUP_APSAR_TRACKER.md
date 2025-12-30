# APSAR Tracker Integration Setup

This document explains how to configure the integration between the ADLC Emergency App and the APSAR Tracker app.

## Overview

When a chat message is sent to the "Search and Rescue" department in the ADLC Emergency App, it will automatically be forwarded to the APSAR Tracker app via HTTP POST request.

## Configuration

### Environment Variable

Add the following environment variable to your `.env` file (for local development) or to your Render dashboard (for production):

```
APSAR_TRACKER_API_URL=https://your-apsar-tracker-app.com/api/chat
```

**Important:** Replace `https://your-apsar-tracker-app.com/api/chat` with the actual API endpoint URL for your APSAR Tracker app.

### Setting Up on Render

1. Go to your Render dashboard
2. Select your web service
3. Navigate to the "Environment" tab
4. Click "Add Environment Variable"
5. Add:
   - **Key:** `APSAR_TRACKER_API_URL`
   - **Value:** Your APSAR Tracker API endpoint URL (e.g., `https://apsar-tracker.example.com/api/chat`)
6. Save the changes
7. Redeploy your service (Render will automatically redeploy when environment variables change)

## How It Works

1. When a user sends a chat message and selects "Search and Rescue" as the department
2. The message is saved to the database as normal
3. The system checks if `APSAR_TRACKER_API_URL` is configured
4. If configured, it sends a POST request to the APSAR Tracker API with the following payload:

```json
{
  "message": "The chat message content",
  "user_name": "Name of the user who sent the message",
  "user_id": 123,
  "department_name": "Search and Rescue",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "source": "ADLC Emergency App"
}
```

## Error Handling

- If the APSAR Tracker API is not configured (environment variable not set), the chat message will still be saved normally, but no forwarding will occur
- If the API request fails, an error will be logged but the chat message will still be saved successfully
- The chat functionality will continue to work even if APSAR Tracker is unavailable

## Testing

To test the integration:

1. Ensure `APSAR_TRACKER_API_URL` is set in your environment
2. Open the Department Chat in the Personnel Dashboard
3. Select "Search and Rescue" from the department filter
4. Send a test message
5. Check your APSAR Tracker app to verify the message was received
6. Check server logs for confirmation messages or errors

## Troubleshooting

- **Messages not being forwarded:** Check that `APSAR_TRACKER_API_URL` is correctly set in your environment variables
- **API errors:** Check server logs for detailed error messages about the API request
- **Connection issues:** Verify that the APSAR Tracker API endpoint is accessible and accepts POST requests with JSON payloads



