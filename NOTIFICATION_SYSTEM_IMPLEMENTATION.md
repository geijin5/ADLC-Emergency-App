# Comprehensive Notification System Implementation

## Overview

This document describes the comprehensive notification system implemented for the Anaconda-Deer Lodge County Emergency Services app.

## Current Implementation Status

### ✅ Completed

1. **Database Schema Enhancements**
   - `notification_logs` table - tracks all notification sends
   - `notification_deliveries` table - tracks individual delivery attempts
   - `notification_preferences` table - user opt-in/out settings
   - `notification_acknowledgements` table - tracks acknowledgements for callouts
   - Enhanced `push_subscriptions` and `personnel_push_subscriptions` tables with platform support

2. **Notification Service Layer**
   - `server/services/notificationService.js` - comprehensive notification service
   - Support for multiple notification types and categories
   - Platform abstraction (Web Push, FCM, APNs ready)
   - Delivery tracking and logging
   - Test mode support

3. **Notification Types Supported**
   - Public Alerts
   - Personnel Callouts
   - Chat Messages
   - Training Reminders (structure ready)
   - Maintenance Alerts (structure ready)
   - Shift Requests (structure ready)
   - System Alerts (structure ready)
   - Admin Announcements (structure ready)

4. **Target Types**
   - All users
   - Public users only
   - Personnel only
   - Specific departments
   - Specific users
   - Custom groups (structure ready)

### 🚧 In Progress / Partial

1. **API Endpoints** - Core endpoints need to be added to server/index.js
2. **Admin Dashboard UI** - Component needs to be created
3. **User Preferences UI** - Component needs to be created
4. **Acknowledgement Tracking** - Backend ready, frontend needed
5. **Escalation Logic** - Structure ready, implementation needed

### ⏳ Pending (Requires External Setup)

1. **Firebase Cloud Messaging (FCM) for Android**
   - Requires Firebase project setup
   - Requires `firebase-admin` npm package
   - Service account key needed
   - Implementation structure ready in notification service

2. **Apple Push Notification Service (APNs) for iOS**
   - Requires Apple Developer account
   - Requires APNs certificates or keys
   - Requires `apn` npm package
   - Implementation structure ready in notification service

## Architecture

### Database Tables

#### notification_logs
Tracks all notification sends with metadata:
- Notification ID (UUID)
- Type, category, title, message
- Target type and IDs
- Sender information
- Delivery status and statistics
- Test mode flag
- Scheduling support

#### notification_deliveries
Tracks individual delivery attempts:
- Links to notification_logs
- User/subscription information
- Delivery status per recipient
- Error messages and retry counts
- Timestamps for sent/delivered/failed

#### notification_preferences
User notification preferences:
- User ID (or public user flag)
- Enabled/disabled status
- Category preferences (JSON)
- Emergency-only mode

#### notification_acknowledgements
Tracks acknowledgements for personnel callouts:
- Links to notification_logs and callouts
- User ID and timestamp
- Response text

### Notification Service

The `NotificationService` class provides:

```javascript
const notificationService = new NotificationService();

// Send a notification
await notificationService.sendNotification({
  type: NOTIFICATION_TYPES.PUBLIC_ALERT,
  category: NOTIFICATION_CATEGORIES.EMERGENCY,
  title: 'Emergency Alert',
  message: 'This is an emergency alert',
  targetType: TARGET_TYPES.ALL,
  targetIds: [],
  sender: { id: userId, name: userName },
  isEmergency: true,
  isTestMode: false
});
```

### API Endpoints (To Be Implemented)

#### Send Notification
```
POST /api/personnel/notifications/send
Body: {
  type: string,
  category: string,
  title: string,
  message: string,
  targetType: string,
  targetIds: array,
  isEmergency: boolean,
  isTestMode: boolean,
  scheduledFor: date (optional)
}
```

#### Get Notification Logs
```
GET /api/personnel/notifications/logs?limit=100&offset=0&type=public-alert&status=sent
```

#### Get Notification Details
```
GET /api/personnel/notifications/logs/:id
```

#### Get Delivery Statistics
```
GET /api/personnel/notifications/logs/:id/statistics
```

#### Get User Preferences
```
GET /api/personnel/notifications/preferences
```

#### Update User Preferences
```
PUT /api/personnel/notifications/preferences
Body: {
  enabled: boolean,
  categories: array,
  emergencyOnly: boolean
}
```

#### Acknowledge Callout
```
POST /api/personnel/notifications/acknowledge
Body: {
  notificationLogId: number,
  calloutId: number,
  response: string (optional)
}
```

## Next Steps

1. **Add API Endpoints** - Implement the endpoints listed above in server/index.js
2. **Create Admin UI Component** - Build the notification sending interface
3. **Create Preferences UI** - Allow users to manage notification preferences
4. **Implement FCM** - Set up Firebase and integrate FCM support
5. **Implement APNs** - Set up Apple Developer account and integrate APNs support
6. **Add Escalation Logic** - Implement automatic escalation for unacknowledged callouts
7. **Add Scheduling** - Implement scheduled notification sending
8. **Add Metrics Dashboard** - Create admin dashboard for notification metrics

## Testing

The notification system includes test mode support. Set `NOTIFICATION_TEST_MODE=true` in environment variables to enable test mode, which prevents actual delivery but logs all attempts.

## Security Considerations

- All notification endpoints require authentication
- Role-based permissions enforced (admin, officer, personnel)
- Emergency notifications can bypass user preferences
- All notifications logged for audit purposes
- HTTPS/TLS required for production

## Documentation

Additional documentation will be created for:
- FCM setup and configuration
- APNs setup and configuration
- Admin user guide
- Troubleshooting guide

