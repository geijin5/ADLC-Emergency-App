const webpush = require('web-push');
const { run, all, get, serialize, getDbType } = require('../db');
const { v4: uuidv4 } = require('uuid');

// FCM and APNs imports (optional - only initialize if configured)
let firebaseAdmin = null;
let apnModule = null;

try {
  firebaseAdmin = require('firebase-admin');
} catch (e) {
  console.log('firebase-admin not available (FCM disabled)');
}

try {
  apnModule = require('apn');
} catch (e) {
  console.log('apn package not available (APNs disabled)');
}

// Notification types
const NOTIFICATION_TYPES = {
  PUBLIC_ALERT: 'public-alert',
  PERSONNEL_CALLOUT: 'personnel-callout',
  CHAT_MESSAGE: 'chat-message',
  TRAINING_REMINDER: 'training-reminder',
  MAINTENANCE_ALERT: 'maintenance-alert',
  SHIFT_REQUEST: 'shift-request',
  SYSTEM_ALERT: 'system-alert',
  ADMIN_ANNOUNCEMENT: 'admin-announcement'
};

// Notification categories
const NOTIFICATION_CATEGORIES = {
  EMERGENCY: 'emergency',
  ALERT: 'alert',
  WARNING: 'warning',
  INFO: 'info',
  OPERATIONAL: 'operational',
  TRAINING: 'training',
  MAINTENANCE: 'maintenance',
  SYSTEM: 'system'
};

// Target types
const TARGET_TYPES = {
  ALL: 'all',
  PUBLIC: 'public',
  PERSONNEL: 'personnel',
  DEPARTMENT: 'department',
  ROLE: 'role',
  USER: 'user',
  CUSTOM_GROUP: 'custom-group'
};

// Platform types
const PLATFORMS = {
  WEB: 'web',
  ANDROID: 'android',
  IOS: 'ios'
};

// Delivery status
const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

class NotificationService {
  constructor() {
    this.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    this.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    this.isTestMode = process.env.NOTIFICATION_TEST_MODE === 'true';
    this.admin = null;
    this.apnProvider = null;
    
    // Initialize Web Push (VAPID)
    if (this.VAPID_PUBLIC_KEY && this.VAPID_PRIVATE_KEY) {
      try {
        webpush.setVapidDetails(
          'mailto:admin@adlc-emergency.com',
          this.VAPID_PUBLIC_KEY,
          this.VAPID_PRIVATE_KEY
        );
        console.log('✅ NotificationService: VAPID keys configured');
      } catch (error) {
        console.warn('⚠️ NotificationService: Invalid VAPID keys', error.message);
      }
    }

    // Initialize Firebase Admin (FCM) if service account key is provided
    const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (firebaseAdmin && firebaseServiceAccount) {
      try {
        const serviceAccount = JSON.parse(firebaseServiceAccount);
        this.admin = firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(serviceAccount)
        }, 'notification-service');
        console.log('✅ NotificationService: Firebase Admin (FCM) initialized');
      } catch (error) {
        // Check if app already initialized
        if (error.code === 'app/duplicate-app') {
          this.admin = firebaseAdmin.app('notification-service');
          console.log('✅ NotificationService: Firebase Admin (FCM) using existing instance');
        } else {
          console.warn('⚠️ NotificationService: Failed to initialize Firebase Admin', error.message);
        }
      }
    } else if (!firebaseServiceAccount) {
      console.log('ℹ️ NotificationService: FCM not configured (FIREBASE_SERVICE_ACCOUNT_KEY not set)');
    }

    // Initialize APNs if keys are provided
    const apnKeyId = process.env.APN_KEY_ID;
    const apnTeamId = process.env.APN_TEAM_ID;
    const apnKeyPath = process.env.APN_KEY_PATH;
    const apnBundleId = process.env.APN_BUNDLE_ID;
    const apnProduction = process.env.APN_PRODUCTION === 'true';

    if (apnModule && apnKeyId && apnTeamId && apnKeyPath && apnBundleId) {
      try {
        const fs = require('fs');

        if (fs.existsSync(apnKeyPath)) {
          this.apnProvider = new apnModule.Provider({
            token: {
              key: fs.readFileSync(apnKeyPath),
              keyId: apnKeyId,
              teamId: apnTeamId
            },
            production: apnProduction
          });
          console.log(`✅ NotificationService: APNs initialized (${apnProduction ? 'Production' : 'Sandbox'})`);
        } else {
          console.warn(`⚠️ NotificationService: APNs key file not found at ${apnKeyPath}`);
        }
      } catch (error) {
        console.warn('⚠️ NotificationService: Failed to initialize APNs', error.message);
      }
    } else {
      console.log('ℹ️ NotificationService: APNs not configured (APN_* environment variables not set)');
    }
  }

  /**
   * Send a notification to specified targets
   * @param {Object} options - Notification options
   * @param {string} options.type - Notification type
   * @param {string} options.category - Notification category
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {string} options.targetType - Target type (all, public, personnel, department, role, user)
   * @param {Array} options.targetIds - Array of target IDs (department IDs, user IDs, etc.)
   * @param {Object} options.sender - Sender information { id, name }
   * @param {Object} options.payload - Additional payload data
   * @param {boolean} options.isEmergency - Whether this is an emergency notification
   * @param {boolean} options.isTestMode - Whether this is a test notification
   * @param {Date} options.scheduledFor - Schedule notification for future date
   * @returns {Promise<Object>} Notification log entry
   */
  async sendNotification(options) {
    const {
      type = NOTIFICATION_TYPES.PUBLIC_ALERT,
      category = NOTIFICATION_CATEGORIES.INFO,
      title,
      message,
      targetType = TARGET_TYPES.ALL,
      targetIds = [],
      sender = null,
      payload = {},
      isEmergency = false,
      isTestMode = this.isTestMode,
      scheduledFor = null
    } = options;

    if (!title || !message) {
      throw new Error('Title and message are required');
    }

    // Generate unique notification ID
    const notificationId = uuidv4();

    // Create notification log entry
    const logEntry = await this.createNotificationLog({
      notificationId,
      type,
      category,
      title,
      message,
      targetType,
      targetIds: JSON.stringify(targetIds),
      senderId: sender?.id || null,
      senderName: sender?.name || 'System',
      isTestMode: isTestMode || false,
      scheduledFor
    });

    // If scheduled for future, return log entry (scheduling logic handled elsewhere)
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      return logEntry;
    }

    // Get recipients based on target type
    const recipients = await this.getRecipients(targetType, targetIds, isEmergency);

    if (recipients.length === 0) {
      await this.updateNotificationLog(logEntry.id, {
        deliveryStatus: DELIVERY_STATUS.FAILED,
        failedAt: new Date(),
        errorMessage: 'No recipients found',
        totalRecipients: 0
      });
      return logEntry;
    }

    // In test mode, filter out public recipients to prevent actual delivery
    let filteredRecipients = recipients;
    if (isTestMode) {
      // Only allow personnel recipients in test mode (for testing purposes)
      // Public users should not receive test notifications
      filteredRecipients = recipients.filter(r => r.userId !== null);
      console.log(`🧪 Test Mode: Filtered ${recipients.length - filteredRecipients.length} public recipients. Sending to ${filteredRecipients.length} personnel only.`);
    }

    // Send notifications
    const results = await this.sendToRecipients(logEntry.id, filteredRecipients, {
      type,
      category,
      title,
      message,
      payload,
      isEmergency,
      isTestMode
    });

    // Update log entry with results
    await this.updateNotificationLog(logEntry.id, {
      deliveryStatus: DELIVERY_STATUS.SENT,
      sentAt: new Date(),
      totalRecipients: recipients.length,
      successfulDeliveries: results.successful,
      failedDeliveries: results.failed
    });

    return logEntry;
  }

  /**
   * Get recipients based on target type and IDs
   */
  async getRecipients(targetType, targetIds = [], isEmergency = false) {
    const recipients = [];

    try {
      if (targetType === TARGET_TYPES.ALL) {
        // Get all public and personnel subscriptions (including device tokens for FCM/APNs)
        const publicSubs = await all('SELECT id, endpoint, p256dh, auth, platform, device_token FROM push_subscriptions');
        const personnelSubs = await all(`
          SELECT pps.id, pps.endpoint, pps.p256dh, pps.auth, pps.platform, pps.device_token, pps.user_id, u.name as user_name
          FROM personnel_push_subscriptions pps
          INNER JOIN users u ON pps.user_id = u.id
        `);
        
        publicSubs.forEach(sub => {
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: null,
            userName: null
          });
        });

        personnelSubs.forEach(sub => {
          // Check user preferences (skip if emergency notifications are disabled, but allow emergency)
          if (!isEmergency) {
            // Check preferences - implement later
          }
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: sub.user_id,
            userName: sub.user_name
          });
        });
      } else if (targetType === TARGET_TYPES.PUBLIC) {
        const publicSubs = await all('SELECT id, endpoint, p256dh, auth, platform, device_token FROM push_subscriptions');
        publicSubs.forEach(sub => {
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: null,
            userName: null
          });
        });
      } else if (targetType === TARGET_TYPES.PERSONNEL) {
        const personnelSubs = await all(`
          SELECT pps.id, pps.endpoint, pps.p256dh, pps.auth, pps.platform, pps.device_token, pps.user_id, u.name as user_name
          FROM personnel_push_subscriptions pps
          INNER JOIN users u ON pps.user_id = u.id
        `);
        personnelSubs.forEach(sub => {
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: sub.user_id,
            userName: sub.user_name
          });
        });
      } else if (targetType === TARGET_TYPES.DEPARTMENT && targetIds.length > 0) {
        const placeholders = targetIds.map(() => '?').join(',');
        const personnelSubs = await all(`
          SELECT pps.id, pps.endpoint, pps.p256dh, pps.auth, pps.platform, pps.device_token, pps.user_id, u.name as user_name
          FROM personnel_push_subscriptions pps
          INNER JOIN users u ON pps.user_id = u.id
          WHERE u.department_id IN (${placeholders})
        `, targetIds);
        personnelSubs.forEach(sub => {
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: sub.user_id,
            userName: sub.user_name
          });
        });
      } else if (targetType === TARGET_TYPES.USER && targetIds.length > 0) {
        const placeholders = targetIds.map(() => '?').join(',');
        const personnelSubs = await all(`
          SELECT pps.id, pps.endpoint, pps.p256dh, pps.auth, pps.platform, pps.device_token, pps.user_id, u.name as user_name
          FROM personnel_push_subscriptions pps
          INNER JOIN users u ON pps.user_id = u.id
          WHERE u.id IN (${placeholders})
        `, targetIds);
        personnelSubs.forEach(sub => {
          recipients.push({
            subscriptionId: sub.id,
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            platform: sub.platform || PLATFORMS.WEB,
            deviceToken: sub.device_token || null,
            userId: sub.user_id,
            userName: sub.user_name
          });
        });
      }
    } catch (error) {
      console.error('Error getting recipients:', error);
      throw error;
    }

    return recipients;
  }

  /**
   * Send notifications to recipients
   */
  async sendToRecipients(logId, recipients, notification) {
    const results = { successful: 0, failed: 0 };
    const promises = [];

    for (const recipient of recipients) {
      const promise = this.sendToRecipient(logId, recipient, notification)
        .then(() => {
          results.successful++;
        })
        .catch((error) => {
          results.failed++;
          console.error(`Failed to send notification to ${recipient.endpoint.substring(0, 50)}...:`, error.message);
        });
      
      promises.push(promise);
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Send notification to a single recipient
   */
  async sendToRecipient(logId, recipient, notification) {
    const { type, category, title, message, payload, isEmergency, isTestMode = false } = notification;

    // Create delivery record
    const deliveryId = await this.createDeliveryRecord(logId, recipient);

    // In test mode, skip actual delivery but mark as delivered for testing purposes
    if (isTestMode) {
      console.log(`🧪 Test Mode: Simulating delivery to ${recipient.userName || recipient.endpoint.substring(0, 50)}...`);
      await this.updateDeliveryRecord(deliveryId, {
        deliveryStatus: DELIVERY_STATUS.DELIVERED,
        deliveredAt: new Date()
      });
      return; // Skip actual push notification
    }

    try {
      // Prepare notification payload
      const notificationPayload = JSON.stringify({
        title,
        message,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: type,
        requireInteraction: isEmergency || category === NOTIFICATION_CATEGORIES.EMERGENCY,
        vibrate: isEmergency ? [300, 100, 300, 100, 300] : [200, 100, 200],
        data: {
          type,
          category,
          ...payload,
          notificationId: logId
        }
      });

      // Send based on platform
      if (recipient.platform === PLATFORMS.WEB || !recipient.platform) {
        // Web Push
        if (!this.VAPID_PUBLIC_KEY || !this.VAPID_PRIVATE_KEY) {
          throw new Error('VAPID keys not configured');
        }

        const subscription = {
          endpoint: recipient.endpoint,
          keys: recipient.keys
        };

        await webpush.sendNotification(subscription, notificationPayload);
        await this.updateDeliveryRecord(deliveryId, {
          deliveryStatus: DELIVERY_STATUS.DELIVERED,
          deliveredAt: new Date()
        });
      } else if (recipient.platform === PLATFORMS.ANDROID) {
        // Firebase Cloud Messaging (FCM)
        if (!this.admin) {
          throw new Error('Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
        }

        if (!recipient.deviceToken) {
          throw new Error('Device token required for FCM');
        }

        const fcmMessage = {
          notification: {
            title: title,
            body: message
          },
          data: {
            type: type,
            category: category,
            ...payload,
            notificationId: logId.toString()
          },
          android: {
            priority: isEmergency ? 'high' : 'normal',
            notification: {
              sound: 'default',
              channelId: isEmergency ? 'emergency_alerts' : 'default',
              priority: isEmergency ? 'high' : 'default'
            }
          },
          token: recipient.deviceToken
        };

        const response = await this.admin.messaging().send(fcmMessage);
        console.log(`✅ FCM notification sent: ${response}`);
        
        await this.updateDeliveryRecord(deliveryId, {
          deliveryStatus: DELIVERY_STATUS.DELIVERED,
          deliveredAt: new Date()
        });
      } else if (recipient.platform === PLATFORMS.IOS) {
        // Apple Push Notification Service (APNs)
        if (!this.apnProvider) {
          throw new Error('APNs provider not initialized. Configure APN_* environment variables.');
        }

        if (!recipient.deviceToken) {
          throw new Error('Device token required for APNs');
        }

        if (!apnModule) {
          throw new Error('APNs module not available');
        }

        const apnNotification = new apnModule.Notification();
        apnNotification.alert = {
          title: title,
          body: message
        };
        apnNotification.sound = 'default';
        apnNotification.badge = 1;
        apnNotification.topic = process.env.APN_BUNDLE_ID;
        apnNotification.payload = {
          type: type,
          category: category,
          ...payload,
          notificationId: logId.toString()
        };
        apnNotification.priority = isEmergency ? 10 : 5;
        apnNotification.pushType = 'alert';

        const result = await this.apnProvider.send(apnNotification, recipient.deviceToken);
        
        if (result.sent && result.sent.length > 0) {
          console.log(`✅ APNs notification sent to ${result.sent.length} device(s)`);
          await this.updateDeliveryRecord(deliveryId, {
            deliveryStatus: DELIVERY_STATUS.DELIVERED,
            deliveredAt: new Date()
          });
        } else if (result.failed && result.failed.length > 0) {
          const error = result.failed[0].error;
          throw new Error(`APNs delivery failed: ${error}`);
        } else {
          throw new Error('APNs delivery failed: Unknown error');
        }
      }
    } catch (error) {
      // Handle invalid subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        await this.removeInvalidSubscription(recipient.subscriptionId, recipient.platform || PLATFORMS.WEB);
      }

      await this.updateDeliveryRecord(deliveryId, {
        deliveryStatus: DELIVERY_STATUS.FAILED,
        failedAt: new Date(),
        errorMessage: error.message,
        retryCount: 1
      });

      throw error;
    }
  }

  /**
   * Create notification log entry
   */
  async createNotificationLog(data) {
    const sql = `INSERT INTO notification_logs (
      notification_id, type, category, title, message, target_type, target_ids,
      sender_id, sender_name, is_test_mode, scheduled_for
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      data.notificationId,
      data.type,
      data.category,
      data.title,
      data.message,
      data.targetType,
      data.targetIds,
      data.senderId,
      data.senderName,
      data.isTestMode ? (getDbType() === 'postgres' ? true : 1) : (getDbType() === 'postgres' ? false : 0),
      data.scheduledFor
    ];

    const result = await run(sql, params);
    return await get('SELECT * FROM notification_logs WHERE id = ?', [result.lastID]);
  }

  /**
   * Update notification log entry
   */
  async updateNotificationLog(logId, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      fields.push(`${key} = ?`);
      // Convert boolean values for database
      let value = updates[key];
      if (typeof value === 'boolean' && getDbType() !== 'postgres') {
        value = value ? 1 : 0;
      }
      values.push(value);
    });

    values.push(logId);

    const sql = `UPDATE notification_logs SET ${fields.join(', ')} WHERE id = ?`;
    await run(sql, values);
  }

  /**
   * Create delivery record
   */
  async createDeliveryRecord(logId, recipient) {
    const sql = `INSERT INTO notification_deliveries (
      notification_log_id, user_id, subscription_id, endpoint, platform
    ) VALUES (?, ?, ?, ?, ?)`;

    const params = [
      logId,
      recipient.userId || null,
      recipient.subscriptionId || null,
      recipient.endpoint || recipient.deviceToken || null,
      recipient.platform || PLATFORMS.WEB
    ];

    const result = await run(sql, params);
    return result.lastID;
  }

  /**
   * Update delivery record
   */
  async updateDeliveryRecord(deliveryId, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      fields.push(`${key} = ?`);
      // Convert boolean values for database
      let value = updates[key];
      if (typeof value === 'boolean' && getDbType() !== 'postgres') {
        value = value ? 1 : 0;
      }
      values.push(value);
    });

    values.push(deliveryId);

    const sql = `UPDATE notification_deliveries SET ${fields.join(', ')} WHERE id = ?`;
    await run(sql, values);
  }

  /**
   * Remove invalid subscription
   */
  async removeInvalidSubscription(subscriptionId, platform) {
    try {
      if (platform === PLATFORMS.WEB) {
        await run('DELETE FROM push_subscriptions WHERE id = ?', [subscriptionId]);
        await run('DELETE FROM personnel_push_subscriptions WHERE id = ?', [subscriptionId]);
      }
    } catch (error) {
      console.error('Error removing invalid subscription:', error);
    }
  }

  /**
   * Get notification log by ID
   */
  async getNotificationLog(logId) {
    return await get('SELECT * FROM notification_logs WHERE id = ?', [logId]);
  }

  /**
   * Get notification logs with filters
   */
  async getNotificationLogs(filters = {}) {
    const { limit = 100, offset = 0, type, targetType, senderId, status } = filters;
    let sql = 'SELECT * FROM notification_logs WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (targetType) {
      sql += ' AND target_type = ?';
      params.push(targetType);
    }
    if (senderId) {
      sql += ' AND sender_id = ?';
      params.push(senderId);
    }
    if (status) {
      sql += ' AND delivery_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await all(sql, params);
  }

  /**
   * Get delivery statistics for a notification log
   */
  async getDeliveryStatistics(logId) {
    const deliveries = await all(
      'SELECT delivery_status, COUNT(*) as count FROM notification_deliveries WHERE notification_log_id = ? GROUP BY delivery_status',
      [logId]
    );
    return deliveries;
  }
}

module.exports = {
  NotificationService,
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  TARGET_TYPES,
  PLATFORMS,
  DELIVERY_STATUS
};

