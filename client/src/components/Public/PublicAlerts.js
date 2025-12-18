import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublicAlerts } from '../../api/api';

const PublicAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await getPublicAlerts();
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'warning':
        return 'alert-warning';
      case 'danger':
        return 'alert-danger';
      default:
        return 'alert-info';
    }
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/logo.png" alt="ADLC Emergency Services Logo" style={{ height: '60px', width: '60px' }} />
            <span style={{ fontSize: '20px' }}>ADLC Emergency Services</span>
          </div>
          <div className="navbar-links">
            <Link to="/">Home</Link>
            <Link to="/alerts">Alerts</Link>
            <Link to="/personnel/login" className="btn btn-secondary" style={{ 
              textDecoration: 'none', 
              padding: '8px 16px', 
              borderRadius: '5px',
              fontSize: '14px',
              marginLeft: '10px'
            }}>
              Personnel Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="container">
        <h1 style={{ marginBottom: '30px', color: '#f9fafb' }}>Public Alerts</h1>

        {loading ? (
          <div className="card">
            <p>Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="card">
            <p style={{ textAlign: 'center', color: '#d1d5db' }}>
              No active alerts at this time.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`alert ${getSeverityClass(alert.severity)}`}>
              <h3 style={{ marginBottom: '10px' }}>{alert.title}</h3>
              <p style={{ marginBottom: '10px' }}>{alert.message}</p>
              <small style={{ color: 'inherit', opacity: 0.8 }}>
                {new Date(alert.created_at).toLocaleString()}
              </small>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PublicAlerts;

