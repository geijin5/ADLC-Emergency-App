const { run, all, get, getDbType } = require('../db');
const { DELIVERY_STATUS } = require('./notificationService');

class NotificationScheduler {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.schedulerInterval = null;
    this.checkInterval = 60 * 1000; // Check every minute for scheduled notifications
  }

  /**
   * Start the scheduler service
   */
  start() {
    if (this.schedulerInterval) {
      return; // Already running
    }

    console.log('✅ NotificationScheduler: Starting scheduled notification processor');
    
    // Check immediately on start
    this.processScheduledNotifications();

    // Then check at intervals
    this.schedulerInterval = setInterval(() => {
      this.processScheduledNotifications();
    }, this.checkInterval);
  }

  /**
   * Stop the scheduler service
   */
  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('⏹️ NotificationScheduler: Stopped scheduled notification processor');
    }
  }

  /**
   * Process scheduled notifications that are due
   */
  async processScheduledNotifications() {
    try {
      const now = new Date();
      const dbType = getDbType();
      
      // Find all scheduled notifications that are due
      // For PostgreSQL, use NOW() directly in query; for SQLite, use parameter
      let scheduledNotifications;
      try {
        scheduledNotifications = dbType === 'postgres'
          ? await all(
              `SELECT * FROM notification_logs 
               WHERE scheduled_for IS NOT NULL 
               AND scheduled_for <= NOW()
               AND delivery_status = $1
               ORDER BY scheduled_for ASC`,
              [DELIVERY_STATUS.PENDING]
            )
          : await all(
              `SELECT * FROM notification_logs 
               WHERE scheduled_for IS NOT NULL 
               AND scheduled_for <= ? 
               AND delivery_status = ?
               ORDER BY scheduled_for ASC`,
              [now.toISOString(), DELIVERY_STATUS.PENDING]
            );
      } catch (dbError) {
        // Handle database connection errors gracefully (especially during startup)
        if (dbError.message && (dbError.message.includes('Connection terminated') || 
                              dbError.message.includes('connection timeout') ||
                              dbError.message.includes('ECONNREFUSED'))) {
          // Silently skip during startup - will retry on next interval
          return;
        }
        throw dbError;
      }

      if (!scheduledNotifications || scheduledNotifications.length === 0) {
        return; // No scheduled notifications to process
      }

      console.log(`📅 NotificationScheduler: Processing ${scheduledNotifications.length} scheduled notification(s)`);

      for (const logEntry of scheduledNotifications) {
        try {
          // Get recipients based on target type
          const targetIds = logEntry.target_ids ? JSON.parse(logEntry.target_ids) : [];
          const recipients = await this.notificationService.getRecipients(
            logEntry.target_type,
            targetIds,
            logEntry.category === 'emergency'
          );

          if (recipients.length === 0) {
            await this.notificationService.updateNotificationLog(logEntry.id, {
              deliveryStatus: DELIVERY_STATUS.FAILED,
              failedAt: new Date(),
              errorMessage: 'No recipients found for scheduled notification',
              totalRecipients: 0
            });
            continue;
          }

          // Send notifications
          const results = await this.notificationService.sendToRecipients(logEntry.id, recipients, {
            type: logEntry.type,
            category: logEntry.category,
            title: logEntry.title,
            message: logEntry.message,
            payload: {},
            isEmergency: logEntry.category === 'emergency'
          });

          // Update log entry with results
          await this.notificationService.updateNotificationLog(logEntry.id, {
            deliveryStatus: DELIVERY_STATUS.SENT,
            sentAt: new Date(),
            totalRecipients: recipients.length,
            successfulDeliveries: results.successful,
            failedDeliveries: results.failed,
            scheduledFor: null // Clear scheduled_for after sending
          });

          console.log(`✅ NotificationScheduler: Sent scheduled notification ${logEntry.id} to ${recipients.length} recipients`);
        } catch (error) {
          console.error(`❌ NotificationScheduler: Error processing scheduled notification ${logEntry.id}:`, error);
          await this.notificationService.updateNotificationLog(logEntry.id, {
            deliveryStatus: DELIVERY_STATUS.FAILED,
            failedAt: new Date(),
            errorMessage: error.message || 'Failed to process scheduled notification'
          });
        }
      }
    } catch (error) {
      console.error('❌ NotificationScheduler: Error checking scheduled notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(limit = 100) {
    try {
      const dbType = getDbType();
      const nowFunction = dbType === 'postgres' ? 'NOW()' : "datetime('now')";
      
      return await all(
        `SELECT * FROM notification_logs 
         WHERE scheduled_for IS NOT NULL 
         AND scheduled_for > ${nowFunction}
         AND delivery_status = ?
         ORDER BY scheduled_for ASC
         LIMIT ?`,
        [DELIVERY_STATUS.PENDING, limit]
      );
    } catch (error) {
      console.error('Error fetching scheduled notifications:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(logId) {
    try {
      const logEntry = await get('SELECT * FROM notification_logs WHERE id = ?', [logId]);
      
      if (!logEntry) {
        throw new Error('Notification log not found');
      }

      if (logEntry.delivery_status !== DELIVERY_STATUS.PENDING || !logEntry.scheduled_for) {
        throw new Error('Notification is not scheduled or already processed');
      }

      await this.notificationService.updateNotificationLog(logId, {
        deliveryStatus: DELIVERY_STATUS.CANCELLED
      });

      return true;
    } catch (error) {
      console.error('Error cancelling scheduled notification:', error);
      throw error;
    }
  }
}

module.exports = { NotificationScheduler };

