import React, { useState, useEffect } from 'react';
import { sendNotification, getNotificationLogs, getNotificationTypes, getDepartments, getUsers } from '../../api/api';
import './NotificationManagement.css';

const NotificationManagement = ({ user }) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState(null);

  // Notification form state
  const [formData, setFormData] = useState({
    type: 'public-alert',
    category: 'info',
    title: '',
    message: '',
    targetType: 'all',
    targetIds: [],
    isEmergency: false,
    isTestMode: false,
    scheduledFor: ''
  });

  useEffect(() => {
    if (showSendModal || showLogsModal) {
      loadNotificationTypes();
      if (showSendModal) {
        loadDepartmentsAndUsers();
      }
      if (showLogsModal) {
        loadNotificationLogs();
      }
    }
  }, [showSendModal, showLogsModal]);

  const loadNotificationTypes = async () => {
    try {
      const response = await getNotificationTypes();
      setNotificationTypes(response.data);
    } catch (error) {
      console.error('Error loading notification types:', error);
    }
  };

  const loadDepartmentsAndUsers = async () => {
    try {
      const [deptResponse, userResponse] = await Promise.all([
        getDepartments(),
        getUsers()
      ]);
      setDepartments(deptResponse.data || []);
      setUsers(userResponse.data || []);
    } catch (error) {
      console.error('Error loading departments/users:', error);
    }
  };

  const loadNotificationLogs = async () => {
    setLoading(true);
    try {
      const response = await getNotificationLogs({ limit: 50 });
      setNotificationLogs(response.data || []);
    } catch (error) {
      console.error('Error loading notification logs:', error);
      alert('Failed to load notification logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      alert('Title and message are required');
      return;
    }

    setLoading(true);
    try {
      await sendNotification(formData);
      alert('Notification sent successfully!');
      setShowSendModal(false);
      setFormData({
        type: 'public-alert',
        category: 'info',
        title: '',
        message: '',
        targetType: 'all',
        targetIds: [],
        isEmergency: false,
        isTestMode: false,
        scheduledFor: ''
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      alert(error.response?.data?.error || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetTypeChange = (targetType) => {
    setFormData({
      ...formData,
      targetType,
      targetIds: []
    });
  };

  const handleTargetIdToggle = (id) => {
    const currentIds = formData.targetIds || [];
    const newIds = currentIds.includes(id)
      ? currentIds.filter(selectedId => selectedId !== id)
      : [...currentIds, id];
    setFormData({ ...formData, targetIds: newIds });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', class: 'badge-warning' },
      sent: { text: 'Sent', class: 'badge-info' },
      delivered: { text: 'Delivered', class: 'badge-success' },
      failed: { text: 'Failed', class: 'badge-danger' }
    };
    const badge = badges[status] || { text: status, class: 'badge-secondary' };
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  if (!notificationTypes) {
    return null; // Don't render until types are loaded
  }

  return (
    <div className="notification-management-section">
      <div className="card dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>🔔 Notification Management</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowSendModal(true)}
              className="btn btn-primary"
              disabled={user?.role !== 'admin' && user?.role !== 'officer'}
            >
              📤 Send Notification
            </button>
            <button
              onClick={() => {
                setShowLogsModal(true);
                loadNotificationLogs();
              }}
              className="btn btn-secondary"
              disabled={user?.role !== 'admin' && user?.role !== 'officer'}
            >
              📋 View Logs
            </button>
          </div>
        </div>

        {(user?.role !== 'admin' && user?.role !== 'officer') && (
          <p style={{ color: '#6b7280', textAlign: 'center' }}>
            Admin or officer access required to send notifications
          </p>
        )}
      </div>

      {/* Send Notification Modal */}
      {showSendModal && (
        <div className="modal-backdrop" onClick={() => setShowSendModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>📤 Send Notification</h2>
              <button
                onClick={() => setShowSendModal(false)}
                className="btn btn-secondary"
                style={{ padding: '5px 15px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendNotification}>
              <div className="form-group">
                <label>Notification Type *</label>
                <select
                  className="select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  {Object.entries(notificationTypes.types).map(([key, value]) => (
                    <option key={key} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  className="select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {Object.entries(notificationTypes.categories).map(([key, value]) => (
                    <option key={key} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea
                  className="input"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Notification message"
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Audience *</label>
                <select
                  className="select"
                  value={formData.targetType}
                  onChange={(e) => handleTargetTypeChange(e.target.value)}
                  required
                >
                  {Object.entries(notificationTypes.targetTypes).map(([key, value]) => (
                    <option key={key} value={value}>{value}</option>
                  ))}
                </select>
              </div>

              {formData.targetType === 'department' && departments.length > 0 && (
                <div className="form-group">
                  <label>Select Departments</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #374151', borderRadius: '4px', padding: '10px' }}>
                    {departments.map(dept => (
                      <label key={dept.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.targetIds.includes(dept.id)}
                          onChange={() => handleTargetIdToggle(dept.id)}
                          style={{ marginRight: '8px' }}
                        />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.targetType === 'user' && users.length > 0 && (
                <div className="form-group">
                  <label>Select Users</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #374151', borderRadius: '4px', padding: '10px' }}>
                    {users.map(usr => (
                      <label key={usr.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.targetIds.includes(usr.id)}
                          onChange={() => handleTargetIdToggle(usr.id)}
                          style={{ marginRight: '8px' }}
                        />
                        {usr.name || usr.username} ({usr.role})
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isEmergency}
                    onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })}
                  />
                  <span>🚨 Emergency Notification (bypasses user preferences)</span>
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isTestMode}
                    onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                  />
                  <span>🧪 Test Mode (log only, no delivery)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  {loading ? 'Sending...' : '📤 Send Notification'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Logs Modal */}
      {showLogsModal && (
        <div className="modal-backdrop" onClick={() => setShowLogsModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>📋 Notification Logs</h2>
              <button
                onClick={() => setShowLogsModal(false)}
                className="btn btn-secondary"
                style={{ padding: '5px 15px' }}
              >
                ✕
              </button>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
            ) : notificationLogs.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280' }}>No notifications sent yet</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Success</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.type}</td>
                        <td><strong>{log.title}</strong></td>
                        <td>{log.target_type}</td>
                        <td>{getStatusBadge(log.delivery_status)}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(log.created_at)}</td>
                        <td>{log.successful_deliveries || 0}</td>
                        <td>{log.failed_deliveries || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagement;

