# Acknowledgement Tracking and Escalation System - Complete

## ✅ Implementation Complete

Both requested features have been successfully implemented:

### 1. ✅ Acknowledgement Tracking for Personnel Callouts

**Backend Enhancements:**
- Enhanced callout creation to use notification service with tracking
- Updated acknowledge endpoint to create records in `notification_acknowledgements` table
- Callout listing now includes acknowledgement statistics (count, rate, user status)
- Dual tracking system:
  - Legacy: `acknowledged_by` JSON field in `callouts` table (for backward compatibility)
  - New: `notification_acknowledgements` table (for detailed tracking)

**Features:**
- Track which users have acknowledged each callout
- Track acknowledgement timestamps
- Optional response/comment when acknowledging
- Acknowledgement rate calculation (percentage of delivered notifications acknowledged)
- User-specific acknowledgement status in callout listings

**API Endpoints:**
- `PUT /api/personnel/callouts/:id/acknowledge` - Acknowledge a callout (enhanced)
- `POST /api/personnel/notifications/acknowledge` - Acknowledge via notification log
- `GET /api/personnel/callouts` - List callouts with acknowledgement stats

### 2. ✅ Escalation Logic for Unacknowledged Callouts

**Escalation Service:**
- New service: `server/services/escalationService.js`
- Automatic monitoring of unacknowledged callouts
- Configurable timeouts via environment variables
- Automatic escalation notifications

**Configuration:**
Environment variables (optional, defaults provided):
- `CALLOUT_ACKNOWLEDGEMENT_TIMEOUT_MINUTES` - Time before considering callout unacknowledged (default: 15 minutes)
- `CALLOUT_ESCALATION_TIMEOUT_MINUTES` - Time before escalating (default: 30 minutes)

**Escalation Rules:**
1. Checks callouts every 5 minutes
2. Identifies callouts where:
   - More than 15 minutes have passed since notification
   - Less than 50% of recipients have acknowledged
   - Callout is still active
3. Sends escalation notifications to:
   - Unacknowledged users specifically (if notification log exists)
   - Entire department (if no specific unacknowledged list)
4. Escalation notifications are marked as emergency and high priority

**Features:**
- Automatic background monitoring
- Smart escalation (targets unacknowledged users when possible)
- Prevents duplicate acknowledgements
- Logs all escalation actions
- Respects callout active status

## How It Works

### Callout Creation Flow

1. **Admin/Officer creates callout:**
   - Callout record created in database
   - Notification sent via notification service
   - Notification log entry created
   - Delivery records created for each recipient

2. **Personnel receive notification:**
   - Push notification delivered (Web/FCM/APNs)
   - Delivery record marked as delivered

3. **Personnel acknowledge:**
   - User clicks acknowledge button
   - Acknowledgement record created in `notification_acknowledgements`
   - Legacy `acknowledged_by` field updated
   - Acknowledgement timestamp recorded

### Escalation Flow

1. **Escalation Service monitors:**
   - Runs every 5 minutes
   - Checks all active callouts
   - Identifies unacknowledged callouts

2. **Escalation criteria:**
   - Callout is active
   - More than acknowledgement timeout has passed
   - Less than 50% acknowledgement rate

3. **Escalation action:**
   - Finds unacknowledged users
   - Sends emergency escalation notification
   - Marks as escalation in payload
   - Creates new notification log entry

## Database Schema

### notification_acknowledgements table
```sql
- id (primary key)
- notification_log_id (foreign key to notification_logs)
- user_id (foreign key to users)
- callout_id (foreign key to callouts)
- acknowledged_at (timestamp)
- response (optional text response)
```

### Enhanced callouts query
Now includes:
- `acknowledgement_count` - Number of acknowledgements
- `delivery_count` - Number of deliveries
- `user_acknowledged` - Whether current user acknowledged
- `acknowledgement_rate` - Percentage acknowledged

## Usage Examples

### Acknowledge a Callout

**Via Callout Endpoint:**
```
PUT /api/personnel/callouts/:id/acknowledge
Headers: Authorization: Bearer <token>
Body: {
  response: "On my way" (optional)
}
```

**Via Notification Endpoint:**
```
POST /api/personnel/notifications/acknowledge
Headers: Authorization: Bearer <token>
Body: {
  notificationLogId: 123,
  calloutId: 456,
  response: "Acknowledged" (optional)
}
```

### Get Callouts with Acknowledgement Stats

```
GET /api/personnel/callouts
Headers: Authorization: Bearer <token>

Response includes:
- acknowledgement_count
- delivery_count
- user_acknowledged (boolean)
- acknowledgement_rate (percentage)
```

## Environment Variables

Optional configuration (defaults work well for most cases):

```env
# Escalation timing (in minutes)
CALLOUT_ACKNOWLEDGEMENT_TIMEOUT_MINUTES=15
CALLOUT_ESCALATION_TIMEOUT_MINUTES=30
```

## Testing

### Test Acknowledgement Tracking

1. Create a callout
2. Check notification log is created
3. Acknowledge the callout
4. Verify acknowledgement record in database
5. Check callout listing shows acknowledgement stats

### Test Escalation

1. Create a callout
2. Wait 15+ minutes without acknowledging
3. Check escalation service logs
4. Verify escalation notification sent
5. Check new notification log entry created

## Service Lifecycle

The escalation service:
- Starts automatically when server starts
- Runs continuously in background
- Can be stopped/started programmatically (for testing)
- Logs all escalation actions
- Handles errors gracefully (won't crash server)

## Next Steps

The system is fully functional. Optional enhancements:
- Admin UI for viewing acknowledgement statistics
- Manual escalation trigger button
- Escalation configuration UI
- Acknowledgement reports/analytics
- Custom escalation rules per department

## Summary

✅ **Acknowledgement Tracking** - Fully implemented with dual tracking system
✅ **Escalation Logic** - Fully implemented with automatic monitoring
✅ **Integration** - Seamlessly integrated with existing notification system
✅ **Backward Compatible** - Works with existing callout acknowledge system
✅ **Production Ready** - Error handling, logging, and monitoring included

The system is ready for production use!

