import React, { useState, useEffect } from 'react';
import { getNotificationMetrics } from '../../api/api';
import './NotificationMetrics.css';

const NotificationMetrics = ({ user }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getNotificationMetrics(dateRange.startDate, dateRange.endDate);
      setMetrics(response.data);
    } catch (err) {
      console.error('Error loading metrics:', err);
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="card">
        <h2>📊 Notification Metrics</h2>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>📊 Notification Metrics</h2>
        <p className="error">{error}</p>
        <button onClick={loadMetrics} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="notification-metrics">
      <div className="card">
        <div className="metrics-header">
          <h2>📊 Notification Metrics & Monitoring</h2>
          <div className="date-range-selector">
            <label>
              Start Date:
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="input"
              />
            </label>
            <label>
              End Date:
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="input"
              />
            </label>
            <button onClick={loadMetrics} className="btn btn-secondary">Refresh</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="metrics-summary">
          <div className="metric-card">
            <div className="metric-value">{metrics.summary.total}</div>
            <div className="metric-label">Total Notifications</div>
          </div>
          <div className="metric-card success">
            <div className="metric-value">{metrics.summary.sent}</div>
            <div className="metric-label">Sent</div>
          </div>
          <div className="metric-card warning">
            <div className="metric-value">{metrics.summary.scheduled}</div>
            <div className="metric-label">Scheduled</div>
          </div>
          <div className="metric-card error">
            <div className="metric-value">{metrics.summary.failed}</div>
            <div className="metric-label">Failed</div>
          </div>
          <div className="metric-card info">
            <div className="metric-value">{metrics.summary.test}</div>
            <div className="metric-label">Test Mode</div>
          </div>
        </div>

        {/* Delivery Statistics */}
        <div className="metrics-section">
          <h3>📈 Delivery Statistics</h3>
          <div className="delivery-stats">
            <div className="stat-item">
              <span className="stat-label">Total Recipients:</span>
              <span className="stat-value">{metrics.delivery.totalRecipients}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Successful Deliveries:</span>
              <span className="stat-value success">{metrics.delivery.totalSuccessful}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Failed Deliveries:</span>
              <span className="stat-value error">{metrics.delivery.totalFailed}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Success Rate:</span>
              <span className="stat-value">{metrics.delivery.successRate}%</span>
            </div>
          </div>
        </div>

        {/* Notifications by Type */}
        {metrics.byType && metrics.byType.length > 0 && (
          <div className="metrics-section">
            <h3>📋 Notifications by Type</h3>
            <div className="metrics-table-wrapper">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byType.map((item, index) => (
                    <tr key={index}>
                      <td>{item.type}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notifications by Category */}
        {metrics.byCategory && metrics.byCategory.length > 0 && (
          <div className="metrics-section">
            <h3>🏷️ Notifications by Category</h3>
            <div className="metrics-table-wrapper">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byCategory.map((item, index) => (
                    <tr key={index}>
                      <td>{item.category}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Counts */}
        {metrics.dailyCounts && metrics.dailyCounts.length > 0 && (
          <div className="metrics-section">
            <h3>📅 Daily Notification Counts</h3>
            <div className="metrics-table-wrapper">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.dailyCounts.map((item, index) => (
                    <tr key={index}>
                      <td>{new Date(item.date).toLocaleDateString()}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationMetrics;

