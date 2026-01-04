import React, { useState, useEffect } from 'react';
import { getNotificationPreferences, updateNotificationPreferences, getNotificationTypes } from '../../api/api';
import './NotificationPreferences.css';

const NotificationPreferences = ({ user }) => {
  const [preferences, setPreferences] = useState({
    enabled: true,
    categories: [],
    emergencyOnly: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationTypes, setNotificationTypes] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const [prefsResponse, typesResponse] = await Promise.all([
        getNotificationPreferences(),
        getNotificationTypes()
      ]);
      
      const prefs = prefsResponse.data;
      setPreferences({
        enabled: prefs.enabled !== undefined ? prefs.enabled : true,
        categories: prefs.categories || [],
        emergencyOnly: prefs.emergencyOnly || false
      });
      setNotificationTypes(typesResponse.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
      await updateNotificationPreferences(preferences);
      setSuccessMessage('Preferences saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryToggle = (category) => {
    const currentCategories = preferences.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    setPreferences({
      ...preferences,
      categories: newCategories
    });
  };

  if (loading || !notificationTypes) {
    return (
      <div className="card dashboard-section">
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading preferences...</p>
      </div>
    );
  }

  const allCategories = Object.values(notificationTypes.categories);

  return (
    <div className="notification-preferences-section">
      <div className="card dashboard-section">
        <h2>🔔 Notification Preferences</h2>
        <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
          Manage your notification preferences. Emergency notifications will always be delivered.
        </p>

        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: '20px' }}>
            {successMessage}
          </div>
        )}

        <div className="preferences-form">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ fontSize: '16px', fontWeight: '500' }}>
                Enable Notifications
              </span>
            </label>
            <small style={{ color: '#9ca3af', marginLeft: '30px', display: 'block', marginTop: '5px' }}>
              When disabled, you will only receive emergency notifications
            </small>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.emergencyOnly}
                onChange={(e) => setPreferences({ ...preferences, emergencyOnly: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ fontSize: '16px', fontWeight: '500' }}>
                Emergency Notifications Only
              </span>
            </label>
            <small style={{ color: '#9ca3af', marginLeft: '30px', display: 'block', marginTop: '5px' }}>
              Only receive emergency alerts and critical notifications
            </small>
          </div>

          {preferences.enabled && !preferences.emergencyOnly && (
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>
                Notification Categories
              </label>
              <small style={{ color: '#9ca3af', display: 'block', marginBottom: '15px' }}>
                Select which types of notifications you want to receive
              </small>
              <div className="categories-list">
                {allCategories.map((category) => {
                  const isSelected = (preferences.categories || []).includes(category);
                  const isEmergency = category === 'emergency';
                  
                  return (
                    <label
                      key={category}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: isSelected ? '#374151' : '#1f2937',
                        border: `1px solid ${isSelected ? '#3b82f6' : '#374151'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(category)}
                        disabled={isEmergency}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ flex: 1, textTransform: 'capitalize' }}>
                        {category}
                        {isEmergency && (
                          <span style={{ color: '#9ca3af', marginLeft: '8px', fontSize: '12px' }}>
                            (Always enabled)
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {(!preferences.categories || preferences.categories.length === 0) && (
                <small style={{ color: '#9ca3af', display: 'block', marginTop: '10px' }}>
                  Select at least one category to receive notifications
                </small>
              )}
            </div>
          )}

          <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : '💾 Save Preferences'}
            </button>
            <button
              onClick={loadPreferences}
              disabled={saving}
              className="btn btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;

