import React from 'react';
import { Link } from 'react-router-dom';
import MapView from './MapView';
import PushNotification from './PushNotification';
import './PublicHome.css';

const PublicHome = () => {
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

      <div className="hero">
        <img src="/logo.png" alt="ADLC Emergency Services Logo" style={{ height: '250px', width: '250px', marginBottom: '30px', display: 'block', margin: '0 auto 30px auto' }} />
        <h1>Anaconda-Deer Lodge County</h1>
        <p>Emergency Services</p>
      </div>

      <div className="container">
        <PushNotification />
        <MapView />
        
        <div className="grid">
          <div className="feature-card">
            <h3 style={{ color: '#f9fafb' }}>📢 Public Alerts</h3>
            <p style={{ color: '#d1d5db' }}>Stay informed about emergency alerts, weather warnings, and important community announcements.</p>
            <Link to="/alerts" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '15px' }}>
              View Alerts
            </Link>
          </div>

          <div className="feature-card">
            <h3 style={{ color: '#f9fafb' }}>📞 Contact Information</h3>
            <p style={{ color: '#d1d5db' }}><strong>Emergency:</strong> 911</p>
            <p style={{ color: '#d1d5db' }}><strong>Non-Emergency:</strong> (406) 563-5241</p>
            <p style={{ color: '#d1d5db' }}><strong>Address:</strong> Anaconda-Deer Lodge County, MT</p>
          </div>
        </div>

        <div className="info-section">
          <h2 style={{ color: '#f9fafb' }}>Important Information</h2>
          <div className="card">
            <h3 style={{ color: '#f9fafb' }}>When to Call 911</h3>
            <ul>
              <li>Fire emergencies</li>
              <li>Medical emergencies requiring immediate attention</li>
              <li>Crimes in progress</li>
              <li>Any situation requiring immediate emergency response</li>
            </ul>
          </div>

          <div className="card">
            <h3 style={{ color: '#f9fafb' }}>Emergency Preparedness</h3>
            <p style={{ color: '#d1d5db' }}>Stay prepared for emergencies by:</p>
            <ul>
              <li>Having an emergency kit ready</li>
              <li>Knowing your evacuation routes</li>
              <li>Keeping important documents in a safe place</li>
              <li>Staying informed through our alerts system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicHome;

