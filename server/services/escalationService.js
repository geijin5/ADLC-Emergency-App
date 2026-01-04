const { run, all, get, getDbType } = require('../db');
const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, TARGET_TYPES } = require('./notificationService');

class EscalationService {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.escalationInterval = null;
    this.escalationCheckInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.acknowledgementTimeout = 15 * 60 * 1000; // 15 minutes default timeout
    this.escalationTimeout = 30 * 60 * 1000; // 30 minutes for escalation
  }

  /**
   * Start the escalation service
   */
  start() {
    if (this.escalationInterval) {
      return; // Already running
    }

    console.log('✅ EscalationService: Starting escalation monitoring');
    
    // Check immediately on start
    this.checkEscalations();

    // Then check at intervals
    this.escalationInterval = setInterval(() => {
      this.checkEscalations();
    }, this.escalationCheckInterval);
  }

  /**
   * Stop the escalation service
   */
  stop() {
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = null;
      console.log('⏹️ EscalationService: Stopped escalation monitoring');
    }
  }

  /**
   * Check for callouts that need escalation
   */
  async checkEscalations() {
    try {
      const unacknowledgedCallouts = await this.getUnacknowledgedCallouts();
      
      for (const callout of unacknowledgedCallouts) {
        await this.processEscalation(callout);
      }
    } catch (error) {
      console.error('Error checking escalations:', error);
    }
  }

  /**
   * Get callouts that need escalation
   */
  async getUnacknowledgedCallouts() {
    // Use the simpler query for now (more reliable)
    return await this.getUnacknowledgedCalloutsSimple();
  }

  /**
   * Simplified query for unacknowledged callouts
   */
  async getUnacknowledgedCalloutsSimple() {
    const isPostgres = getDbType() === 'postgres';
    const timeoutMinutes = parseInt(process.env.CALLOUT_ACKNOWLEDGEMENT_TIMEOUT_MINUTES || '15', 10);

    // Get all active callouts older than timeout
    const query = isPostgres
      ? `SELECT c.*,
                (SELECT COUNT(*) FROM notification_acknowledgements na WHERE na.callout_id = c.id) as acknowledgement_count
         FROM callouts c
         WHERE c.is_active = true
           AND c.created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'`
      : `SELECT c.*,
                (SELECT COUNT(*) FROM notification_acknowledgements na WHERE na.callout_id = c.id) as acknowledgement_count
         FROM callouts c
         WHERE c.is_active = 1
           AND datetime(c.created_at) < datetime('now', '-${timeoutMinutes} minutes')`;

    const callouts = await all(query, []);
    
    // Filter callouts that need escalation (low acknowledgement rate)
    // For now, escalate if acknowledgement_count is 0 or very low
    // This is a simplified approach - can be enhanced later
    return callouts.filter(callout => {
      // If no acknowledgements at all, definitely escalate
      if (!callout.acknowledgement_count || callout.acknowledgement_count === 0) {
        return true;
      }
      // Additional logic can be added here based on delivery count
      return false; // For now, only escalate if no acknowledgements
    });
  }

  /**
   * Process escalation for a callout
   */
  async processEscalation(callout) {
    try {
      // Find associated notification log
      const calloutDetails = await get('SELECT title, created_at FROM callouts WHERE id = ?', [callout.id]);
      
      if (!calloutDetails) {
        return;
      }

      // Find notification logs for this callout
      const isPostgres = getDbType() === 'postgres';
      
      let notificationLogs;
      if (isPostgres) {
        notificationLogs = await all(
          `SELECT id FROM notification_logs 
           WHERE type = 'personnel-callout' 
           AND title LIKE '%' || ? || '%'
           AND created_at >= ? - INTERVAL '1 hour'
           ORDER BY created_at DESC
           LIMIT 1`,
          [calloutDetails.title, calloutDetails.created_at]
        );
      } else {
        notificationLogs = await all(
          `SELECT id FROM notification_logs 
           WHERE type = 'personnel-callout' 
           AND title LIKE '%' || ? || '%'
           AND datetime(created_at) >= datetime(?, '-1 hour')
           ORDER BY created_at DESC
           LIMIT 1`,
          [calloutDetails.title, calloutDetails.created_at]
        );
      }

      const notificationLogId = notificationLogs && notificationLogs.length > 0 ? notificationLogs[0].id : null;

      // Always send escalation if no acknowledgements
      if (!callout.acknowledgement_count || callout.acknowledgement_count === 0) {
        await this.sendEscalationNotification(callout, notificationLogId);
        return;
      }

      // If notification log exists, check if we should escalate further
      if (notificationLogId) {
        const shouldEscalate = await this.shouldEscalate(callout, notificationLogId);
        if (shouldEscalate) {
          await this.sendEscalationNotification(callout, notificationLogId);
        }
      }
    } catch (error) {
      console.error(`Error processing escalation for callout ${callout.id}:`, error);
    }
  }

  /**
   * Check if escalation should occur
   */
  async shouldEscalate(callout, notificationLogId) {
    // Get all deliveries for this notification
    const deliveries = await all(
      'SELECT * FROM notification_deliveries WHERE notification_log_id = ?',
      [notificationLogId]
    );

    // Get all acknowledgements for this callout
    const acknowledgements = await all(
      'SELECT user_id FROM notification_acknowledgements WHERE callout_id = ?',
      [callout.id]
    );

    const acknowledgedUserIds = new Set(acknowledgements.map(a => a.user_id));
    const unacknowledgedDeliveries = deliveries.filter(d => 
      d.user_id && !acknowledgedUserIds.has(d.user_id)
    );

    // Escalate if more than 50% are unacknowledged and it's been more than the timeout
    const unacknowledgedPercentage = deliveries.length > 0 
      ? unacknowledgedDeliveries.length / deliveries.length 
      : 1;

    return unacknowledgedPercentage > 0.5;
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(callout, originalNotificationLogId = null) {
    try {
      // Get department ID for the callout
      const calloutDetails = await get(
        'SELECT department_id, created_by FROM callouts WHERE id = ?',
        [callout.id]
      );

      if (!calloutDetails) {
        return;
      }

      // Get users who haven't acknowledged
      let unacknowledgedUserIds = [];
      if (originalNotificationLogId) {
        const acknowledgements = await all(
          'SELECT user_id FROM notification_acknowledgements WHERE callout_id = ?',
          [callout.id]
        );
        const acknowledgedUserIds = new Set(acknowledgements.map(a => a.user_id));
        
        const deliveries = await all(
          'SELECT DISTINCT user_id FROM notification_deliveries WHERE notification_log_id = ? AND user_id IS NOT NULL',
          [originalNotificationLogId]
        );
        
        unacknowledgedUserIds = deliveries
          .map(d => d.user_id)
          .filter(id => !acknowledgedUserIds.has(id));
      }

      // Send escalation notification
      if (unacknowledgedUserIds.length > 0) {
        // Send to specific unacknowledged users
        await this.notificationService.sendNotification({
          type: NOTIFICATION_TYPES.PERSONNEL_CALLOUT,
          category: NOTIFICATION_CATEGORIES.EMERGENCY,
          title: `🔔 ESCALATION: ${callout.title}`,
          message: `URGENT: This callout requires your attention. ${callout.message || ''}`,
          targetType: TARGET_TYPES.USER,
          targetIds: unacknowledgedUserIds,
          sender: { id: calloutDetails.created_by, name: 'System' },
          payload: {
            calloutId: callout.id,
            isEscalation: true,
            originalNotificationLogId: originalNotificationLogId
          },
          isEmergency: true,
          isTestMode: false
        });
      } else {
        // Send to entire department
        await this.notificationService.sendNotification({
          type: NOTIFICATION_TYPES.PERSONNEL_CALLOUT,
          category: NOTIFICATION_CATEGORIES.EMERGENCY,
          title: `🔔 ESCALATION: ${callout.title}`,
          message: `URGENT: This callout requires attention. ${callout.message || ''}`,
          targetType: TARGET_TYPES.DEPARTMENT,
          targetIds: [calloutDetails.department_id],
          sender: { id: calloutDetails.created_by, name: 'System' },
          payload: {
            calloutId: callout.id,
            isEscalation: true,
            originalNotificationLogId: originalNotificationLogId
          },
          isEmergency: true,
          isTestMode: false
        });
      }

      console.log(`✅ Escalation notification sent for callout ${callout.id}`);
    } catch (error) {
      console.error(`Error sending escalation notification for callout ${callout.id}:`, error);
    }
  }
}

module.exports = { EscalationService };

