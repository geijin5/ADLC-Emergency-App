const { run, all, get, getDbType } = require('../db');

// Audit action types
const AUDIT_ACTIONS = {
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_SCHEDULED: 'notification_scheduled',
  NOTIFICATION_CANCELLED: 'notification_cancelled',
  NOTIFICATION_EDITED: 'notification_edited',
  NOTIFICATION_VIEWED: 'notification_viewed',
  TEST_NOTIFICATION: 'test_notification',
  PREFERENCES_UPDATED: 'preferences_updated',
  ACKNOWLEDGEMENT_RECORDED: 'acknowledgement_recorded',
  ESCALATION_TRIGGERED: 'escalation_triggered',
  DELIVERY_RETRY: 'delivery_retry',
  SYSTEM_ERROR: 'system_error'
};

class AuditLogService {
  /**
   * Log an audit event
   * @param {Object} options - Audit log options
   * @param {string} options.action - Action type (from AUDIT_ACTIONS)
   * @param {number} options.notificationLogId - Related notification log ID (optional)
   * @param {number} options.userId - User ID who performed the action
   * @param {string} options.userName - User name
   * @param {Object} options.actionDetails - Additional details about the action
   * @param {string} options.ipAddress - IP address of the requester
   * @param {string} options.userAgent - User agent string
   */
  async logAction(options) {
    const {
      action,
      notificationLogId = null,
      userId = null,
      userName = null,
      actionDetails = {},
      ipAddress = null,
      userAgent = null
    } = options;

    if (!action) {
      throw new Error('Action is required for audit log');
    }

    try {
      const sql = `INSERT INTO notification_audit_logs (
        action, notification_log_id, user_id, user_name, action_details, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

      const params = [
        action,
        notificationLogId,
        userId,
        userName,
        JSON.stringify(actionDetails),
        ipAddress,
        userAgent
      ];

      await run(sql, params);
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Error logging audit event:', error);
    }
  }

  /**
   * Get audit logs with filters
   * @param {Object} filters - Filter options
   * @param {number} filters.limit - Maximum number of records
   * @param {number} filters.offset - Offset for pagination
   * @param {string} filters.action - Filter by action type
   * @param {number} filters.userId - Filter by user ID
   * @param {number} filters.notificationLogId - Filter by notification log ID
   * @param {Date} filters.startDate - Start date filter
   * @param {Date} filters.endDate - End date filter
   */
  async getAuditLogs(filters = {}) {
    const {
      limit = 100,
      offset = 0,
      action,
      userId,
      notificationLogId,
      startDate,
      endDate
    } = filters;

    try {
      let sql = 'SELECT * FROM notification_audit_logs WHERE 1=1';
      const params = [];

      if (action) {
        sql += ' AND action = ?';
        params.push(action);
      }

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (notificationLogId) {
        sql += ' AND notification_log_id = ?';
        params.push(notificationLogId);
      }

      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const logs = await all(sql, params);

      // Parse action_details JSON
      return logs.map(log => ({
        ...log,
        action_details: log.action_details ? JSON.parse(log.action_details) : {}
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM notification_audit_logs
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }

      sql += ' GROUP BY action ORDER BY count DESC';

      return await all(sql, params);
    } catch (error) {
      console.error('Error fetching audit statistics:', error);
      throw error;
    }
  }

  /**
   * Get audit log for a specific notification
   */
  async getNotificationAuditLog(notificationLogId) {
    try {
      const logs = await all(
        'SELECT * FROM notification_audit_logs WHERE notification_log_id = ? ORDER BY created_at DESC',
        [notificationLogId]
      );

      return logs.map(log => ({
        ...log,
        action_details: log.action_details ? JSON.parse(log.action_details) : {}
      }));
    } catch (error) {
      console.error('Error fetching notification audit log:', error);
      throw error;
    }
  }
}

module.exports = { AuditLogService, AUDIT_ACTIONS };

